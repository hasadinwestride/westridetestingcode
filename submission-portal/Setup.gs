/**
 * ฟังก์ชันตั้งค่าครั้งเดียว — รันจาก editor ของ Apps Script ไม่ได้เรียกจากหน้าเว็บ
 */

/**
 * 1) สร้าง Google Sheet สำหรับ Roster + Log
 * รันครั้งเดียว แล้วเอา ID ที่ได้จาก log ไปใส่ CONFIG.ROSTER_SHEET_ID
 */
function setupPortal() {
  var ss = SpreadsheetApp.create('WeStride Submission Portal — Roster & Log');

  var roster = ss.getSheets()[0].setName(CONFIG.ROSTER_TAB);
  roster.getRange(1, 1, 1, 5)
    .setValues([['code', 'full_name', 'folder_name', 'file_tag', 'email']])
    .setFontWeight('bold');
  roster.getRange(2, 1, 1, 5).setValues([
    ['', 'Somchai Jaidee', 'Somchai-Jaidee', 'Somchai', 'somchai@example.com']
  ]);
  roster.setFrozenRows(1);

  var log = ss.insertSheet(CONFIG.LOG_TAB);
  log.getRange(1, 1, 1, 9)
    .setValues([['timestamp', 'full_name', 'folder_name', 'email', 'module', 'slot', 'file_name', 'size_bytes', 'file_url']])
    .setFontWeight('bold');
  log.setFrozenRows(1);

  console.log('ROSTER_SHEET_ID = %s', ss.getId());
  console.log('เปิดชีตที่: %s', ss.getUrl());
  return ss.getId();
}

/**
 * 2) เติมรหัสให้นักเรียนทุกแถวที่ยังไม่มีรหัส
 * รหัสยาว 10 ตัว ตัดตัวอักษรที่สับสน (0/O/1/I) ออกแล้ว
 */
function generateMissingCodes() {
  var sheet = getSheet_(CONFIG.ROSTER_TAB);
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var codeCol = headers.indexOf('code');
  var nameCol = headers.indexOf('full_name');
  if (codeCol === -1 || nameCol === -1) {
    throw new Error('Roster ต้องมีคอลัมน์ code และ full_name');
  }

  var used = {};
  var updates = 0;

  for (var r = 1; r < values.length; r++) {
    var existing = normalizeCode_(values[r][codeCol]);
    if (existing) { used[existing] = true; }
  }

  for (var i = 1; i < values.length; i++) {
    var hasName = String(values[i][nameCol] || '').trim();
    if (!hasName || normalizeCode_(values[i][codeCol])) continue;

    var code;
    do { code = randomCode_(10); } while (used[code]);
    used[code] = true;

    sheet.getRange(i + 1, codeCol + 1).setValue(code);
    updates++;
  }

  console.log('สร้างรหัสใหม่ %s รายการ', updates);
  return updates;
}

function randomCode_(length) {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < length; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

/**
 * 3) ล็อกสิทธิ์โฟลเดอร์แม่: เมนเทอร์เท่านั้นที่เข้าได้ นักเรียนไม่มีสิทธิ์ใด ๆ
 *
 * หมายเหตุ: ถ้าโฟลเดอร์อยู่ใน Shared Drive ให้จัดการสมาชิกที่หน้า Shared Drive แทน
 * ฟังก์ชันนี้ใช้กับโฟลเดอร์ใน My Drive
 */
function lockDownRootFolder() {
  var folder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);

  folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  folder.setShareableByEditors(false);

  var removed = [];
  folder.getEditors().forEach(function (user) {
    var email = user.getEmail();
    if (email && email !== CONFIG.MENTOR_GROUP) {
      folder.removeEditor(user);
      removed.push(email);
    }
  });
  folder.getViewers().forEach(function (user) {
    var email = user.getEmail();
    if (email && email !== CONFIG.MENTOR_GROUP) {
      folder.removeViewer(user);
      removed.push(email);
    }
  });

  folder.addEditor(CONFIG.MENTOR_GROUP);

  console.log('ถอดสิทธิ์ออก %s ราย: %s', removed.length, removed.join(', ') || '(ไม่มี)');
  console.log('เหลือสิทธิ์: เจ้าของ + %s', CONFIG.MENTOR_GROUP);
}

/**
 * 4) ส่งอีเมลรหัส + ลิงก์พอร์ทัลให้นักเรียนที่ยังไม่ได้ส่ง
 * ทำเครื่องหมายในคอลัมน์ code_sent_at เพื่อไม่ส่งซ้ำ
 */
function emailCodesToStudents(portalUrl) {
  if (!portalUrl) throw new Error('ใส่ URL ของ web app ที่ deploy แล้วเป็นพารามิเตอร์');

  var sheet = getSheet_(CONFIG.ROSTER_TAB);
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });

  var codeCol = headers.indexOf('code');
  var nameCol = headers.indexOf('full_name');
  var emailCol = headers.indexOf('email');
  if (codeCol === -1 || nameCol === -1 || emailCol === -1) {
    throw new Error('Roster ต้องมีคอลัมน์ code, full_name และ email');
  }

  var sentCol = headers.indexOf('code_sent_at');
  if (sentCol === -1) {
    sentCol = headers.length;
    sheet.getRange(1, sentCol + 1).setValue('code_sent_at').setFontWeight('bold');
  }

  var sent = 0;
  for (var i = 1; i < values.length; i++) {
    var code = normalizeCode_(values[i][codeCol]);
    var name = String(values[i][nameCol] || '').trim();
    var email = String(values[i][emailCol] || '').trim();
    if (!code || !name || !email || values[i][sentCol]) continue;

    MailApp.sendEmail({
      to: email,
      subject: 'รหัสส่งงาน UXUI Bootcamp ของคุณ',
      htmlBody:
        '<p>สวัสดีครับคุณ ' + name + '</p>' +
        '<p>รหัสสำหรับส่งงานของคุณคือ <b style="font-size:18px;letter-spacing:2px">' + code + '</b></p>' +
        '<p>ใช้รหัสนี้ในช่องส่งงานท้ายบทเรียนได้ทุกโมดูลตลอดคอร์ส ' +
        'หรือเปิดหน้าส่งงานโดยตรงที่ <a href="' + portalUrl + '">' + portalUrl + '</a></p>' +
        '<p>รหัสนี้เป็นของคุณคนเดียว กรุณาอย่าส่งต่อให้ผู้อื่นนะครับ</p>'
    });

    sheet.getRange(i + 1, sentCol + 1).setValue(new Date());
    sent++;
  }

  console.log('ส่งอีเมลแล้ว %s ฉบับ', sent);
  return sent;
}

/**
 * WeStride Submission Portal — server side.
 *
 * หลักการ: นักเรียน "ไม่มีสิทธิ์ใน Drive เลย" ทุกอย่างวิ่งผ่าน web app ตัวนี้ซึ่งรันด้วยสิทธิ์
 * ของเจ้าของสคริปต์ ดังนั้นนักเรียนจึงเปิดโฟลเดอร์ของเพื่อนไม่ได้เพราะไม่เคยได้สิทธิ์ตั้งแต่แรก
 * ส่วนเมนเทอร์ได้สิทธิ์ที่โฟลเดอร์แม่ผ่าน Google Group จึงเห็นงานทุกคน
 */

// ---------------------------------------------------------------- entry point

function doGet(e) {
  var moduleId = (e && e.parameter && e.parameter.module) || CONFIG.DEFAULT_MODULE;
  var mod = getModule_(moduleId);

  var t = HtmlService.createTemplateFromFile('Index');
  t.moduleId = moduleId;
  t.moduleTitle = mod.title;
  t.slots = mod.slots;
  t.maxFileMb = CONFIG.MAX_FILE_MB;

  // ?embed=1 มาจาก embed-snippet-inline.html — ตัดหัวข้อกับกรอบออกเพราะหน้าบทเรียนมีให้แล้ว
  // ถ้าไม่มีพารามิเตอร์ แปลว่าเปิดเป็นแท็บของตัวเอง จึงจัดหน้าให้อยู่กลางจอและมีหัวข้อบอกว่าอยู่ที่ไหน
  t.embed = !!(e && e.parameter && e.parameter.embed);

  return t.evaluate()
    .setTitle('ส่งงาน — ' + mod.title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ------------------------------------------------------------ public API (client)

/**
 * เปิดช่องส่งงาน แล้วคืนสถานะการส่งงานของ "ตัวเองเท่านั้น"
 * ถ้าเป็นคนใหม่และเปิด ALLOW_SELF_REGISTER ไว้ ระบบจะเพิ่มเข้า Roster ให้เลย
 *
 * payload: { who, fullName, moduleId }
 *
 * รับเป็น object ไม่ใช่ argument เรียงกัน เพราะถ้า Index.html ที่ deploy อยู่เป็นเวอร์ชันเก่า
 * กว่าไฟล์นี้ การเรียงลำดับจะเลื่อน แล้วค่าอย่าง moduleId จะไหลไปตกในช่องชื่อนักเรียน
 * กลายเป็นโฟลเดอร์ชื่อ "module-01" โดยไม่มีใครรู้ตัว object ทำให้ผิดพลาดแบบนั้นไม่ได้
 */
function api_signIn(payload) {
  assertModernClient_(payload);
  var student = resolveStudent_(payload.who, payload.fullName);
  return {
    fullName: student.fullName,
    folderName: student.folderName,
    submissions: readSubmissions_(student, getModule_(payload.moduleId))
  };
}

function assertModernClient_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('หน้าส่งงานเป็นเวอร์ชันเก่ากว่าสคริปต์ กรุณาอัปเดต Index.html แล้ว Deploy version ใหม่');
  }
}

/**
 * อัปโหลดไฟล์ 1 ชิ้นเข้า slot ที่ระบุ
 * payload: { who, fullName, moduleId, slotId, mimeType, sizeBytes, dataBase64 }
 */
function api_upload(payload) {
  assertModernClient_(payload);
  var student = resolveStudent_(payload.who, payload.fullName);
  var mod = getModule_(payload.moduleId);
  var slot = findSlot_(mod, payload.slotId);

  validateUpload_(payload);

  var targetName = buildFileName_(slot, student);
  var folder = getSubmitFolder_(student, mod);

  archiveExisting_(folder, targetName);

  var blob = Utilities.newBlob(
    Utilities.base64Decode(payload.dataBase64),
    payload.mimeType,
    targetName
  );
  var file = folder.createFile(blob);

  logSubmission_(student, mod, slot, file);

  return {
    slotId: slot.id,
    fileName: file.getName(),
    submittedAt: formatDate_(file.getDateCreated()),
    sizeBytes: file.getSize()
  };
}

function api_status(who, moduleId) {
  var student = resolveStudent_(who);
  return readSubmissions_(student, getModule_(moduleId));
}

// ------------------------------------------------------------------- identity

/**
 * หานักเรียนใน Roster จากอีเมลที่ใช้สมัครเรียน
 *
 * รับรหัสในคอลัมน์ code ได้ด้วย เผื่อคนที่อยากใช้รหัสแทนอีเมล
 * แต่ค่าปกติของหน้าเว็บคือถามอีเมล เพราะนักเรียนจำได้อยู่แล้วไม่ต้องแจกอะไรเพิ่ม
 *
 * Roster sheet ต้องมีหัวคอลัมน์: code | full_name | folder_name | file_tag | email
 * (code และ file_tag จะเว้นว่างก็ได้)
 */
function resolveStudent_(identifier, fullNameInput) {
  var key = normalizeId_(identifier);
  if (!key) throw new Error('กรุณากรอกอีเมลของคุณ');

  var found = findInRoster_(key);
  if (found) return found;

  if (!CONFIG.ALLOW_SELF_REGISTER) {
    console.warn('Rejected sign-in attempt: %s', key);
    throw new Error('ไม่พบอีเมลนี้ในรายชื่อของคอร์ส ลองเช็กว่าพิมพ์ตรงกับอีเมลที่ใช้สมัครไหม หรือทักทีมงานได้เลยครับ');
  }
  return registerStudent_(key, fullNameInput);
}

function findInRoster_(key) {
  var rows = getRoster_();
  for (var i = 0; i < rows.length; i++) {
    var email = normalizeId_(rows[i].email);
    var code = normalizeId_(rows[i].code);
    if (key !== email && (!code || key !== code)) continue;

    var fullName = String(rows[i].full_name || '').trim();
    if (!fullName) continue;
    var folderName = String(rows[i].folder_name || '').trim() || sanitizeName_(fullName);
    var fileTag = String(rows[i].file_tag || '').trim() || firstToken_(folderName);
    return {
      key: key,
      fullName: fullName,
      folderName: sanitizeName_(folderName),
      fileTag: sanitizeName_(fileTag),
      email: String(rows[i].email || '').trim()
    };
  }
  return null;
}

/**
 * เพิ่มนักเรียนหน้าใหม่เข้า Roster เอง
 *
 * อีเมลเป็นตัวชี้ขาดว่าเป็นใคร ครั้งต่อไปที่กรอกอีเมลเดิม ระบบจะเจอแถวนี้และใช้
 * โฟลเดอร์เดิมเสมอ ต่อให้พิมพ์ชื่อไม่เหมือนเดิม จึงไม่เกิดโฟลเดอร์ซ้ำจากการพิมพ์คลาดเคลื่อน
 */
function registerStudent_(email, fullNameInput) {
  var fullName = sanitizeName_(String(fullNameInput || '')).slice(0, 60);
  if (fullName.replace(/[^A-Za-zก-๙]/g, '').length < 2) {
    throw new Error('กรุณากรอกชื่อ-นามสกุลของคุณด้วย ระบบใช้ตั้งชื่อโฟลเดอร์ให้');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // เช็กอีกรอบหลังได้ lock เผื่อกดพร้อมกันหลายแท็บ
    var existing = findInRoster_(email);
    if (existing) return existing;

    var folderName = uniqueFolderName_(sanitizeName_(fullName));
    var fileTag = firstToken_(folderName);

    appendRosterRow_({
      code: '',
      full_name: fullName,
      folder_name: folderName,
      file_tag: fileTag,
      email: email,
      registered_at: new Date()
    });

    console.log('Self-registered: %s → %s', email, folderName);
    return {
      key: email,
      fullName: fullName,
      folderName: folderName,
      fileTag: fileTag,
      email: email
    };
  } finally {
    lock.releaseLock();
  }
}

/** กันกรณีชื่อซ้ำกันจริง ๆ ระหว่างนักเรียนคนละคน */
function uniqueFolderName_(base) {
  var taken = {};
  getRoster_().forEach(function (row) {
    var name = String(row.folder_name || '').trim().toLowerCase();
    if (name) taken[name] = true;
  });

  if (!taken[base.toLowerCase()]) return base;
  for (var n = 2; n < 100; n++) {
    if (!taken[(base + '-' + n).toLowerCase()]) return base + '-' + n;
  }
  return base + '-' + Date.now();
}

/** เขียนแถวใหม่โดยอ้างชื่อคอลัมน์ ไม่ยึดลำดับ เผื่อมีคนสลับคอลัมน์ในชีต */
function appendRosterRow_(values) {
  var sheet = getSheet_(CONFIG.ROSTER_TAB);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase().replace(/\s+/g, '_'); });
  sheet.appendRow(headers.map(function (h) {
    return values[h] === undefined ? '' : values[h];
  }));
}

function getRoster_() {
  var sheet = getSheet_(CONFIG.ROSTER_TAB);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(function (h) {
    return String(h).trim().toLowerCase().replace(/\s+/g, '_');
  });

  return values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// -------------------------------------------------------------------- storage

/**
 * ลำดับโฟลเดอร์นับจาก ROOT_FOLDER_ID ลงไป ตาม CONFIG.FOLDER_LAYOUT
 */
function folderPath_(student, mod) {
  switch (CONFIG.FOLDER_LAYOUT) {
    case 'flat': return [student.folderName];
    case 'student-first': return [student.folderName, mod.folderName];
    default: return [mod.folderName, student.folderName];
  }
}

/**
 * โฟลเดอร์ปลายทางของนักเรียน สร้างให้อัตโนมัติถ้ายังไม่มี
 * ใช้ LockService กันกรณีนักเรียนกดส่งหลายไฟล์พร้อมกันแล้วเกิดโฟลเดอร์ซ้ำ
 */
function getSubmitFolder_(student, mod) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var folder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    folderPath_(student, mod).forEach(function (name) {
      folder = getOrCreateChild_(folder, name);
    });
    return folder;
  } finally {
    lock.releaseLock();
  }
}

/** เหมือน getSubmitFolder_ แต่ไม่สร้างอะไรเลย คืน null ถ้ายังไม่เคยส่งงาน */
function findSubmitFolder_(student, mod) {
  var folder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  var path = folderPath_(student, mod);
  for (var i = 0; i < path.length; i++) {
    var it = folder.getFoldersByName(path[i]);
    if (!it.hasNext()) return null;
    folder = it.next();
  }
  return folder;
}

function getOrCreateChild_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/**
 * ส่งซ้ำ = เก็บของเก่าไว้ใน _previous-versions แทนที่จะทับทิ้ง
 * เมนเทอร์จะได้ย้อนดูได้ว่าปรับอะไรไปบ้าง
 */
function archiveExisting_(folder, fileName) {
  var it = folder.getFilesByName(fileName);
  if (!it.hasNext()) return;

  var archive = getOrCreateChild_(folder, CONFIG.ARCHIVE_FOLDER_NAME);
  var stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmm');
  var dot = fileName.lastIndexOf('.');
  var base = dot > 0 ? fileName.slice(0, dot) : fileName;
  var ext = dot > 0 ? fileName.slice(dot) : '';

  while (it.hasNext()) {
    var old = it.next();
    old.setName(base + '__' + stamp + ext);
    old.moveTo(archive);
  }
}

function readSubmissions_(student, mod) {
  var folder = findSubmitFolder_(student, mod);
  if (!folder) return {};

  var result = {};
  mod.slots.forEach(function (slot) {
    var name = buildFileName_(slot, student);
    var files = folder.getFilesByName(name);
    if (files.hasNext()) {
      var f = files.next();
      result[slot.id] = {
        fileName: f.getName(),
        submittedAt: formatDate_(f.getDateCreated()),
        sizeBytes: f.getSize()
      };
    }
  });
  return result;
}

// ------------------------------------------------------------------ validation

function validateUpload_(payload) {
  if (!payload || !payload.dataBase64) throw new Error('ไม่พบข้อมูลไฟล์ กรุณาลองใหม่');

  if (CONFIG.ALLOWED_MIME.indexOf(payload.mimeType) === -1) {
    throw new Error('รับเฉพาะไฟล์ PDF เท่านั้น');
  }

  var maxBytes = CONFIG.MAX_FILE_MB * 1024 * 1024;
  if (payload.sizeBytes > maxBytes) {
    throw new Error('ไฟล์ใหญ่เกิน ' + CONFIG.MAX_FILE_MB + 'MB กรุณาบีบอัดไฟล์ก่อนส่ง');
  }
}

// ---------------------------------------------------------------------- naming

function buildFileName_(slot, student) {
  return slot.filePrefix + '_' + student.fileTag + '.pdf';
}

function sanitizeName_(value) {
  return String(value).replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}


function firstToken_(value) {
  return String(value).split(/[\s\-_]+/)[0] || String(value);
}

function normalizeCode_(code) {
  return String(code == null ? '' : code).trim().toUpperCase();
}

/** ใช้เทียบอีเมลและรหัสแบบไม่สนตัวพิมพ์ใหญ่เล็กและช่องว่างหัวท้าย */
function normalizeId_(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function formatDate_(date) {
  return Utilities.formatDate(date, 'Asia/Bangkok', 'd MMM yyyy HH:mm');
}

// ----------------------------------------------------------------- module defs

function getModule_(moduleId) {
  var mod = CONFIG.MODULES[moduleId || CONFIG.DEFAULT_MODULE];
  if (!mod) throw new Error('ไม่พบโมดูล: ' + moduleId);
  return mod;
}

function findSlot_(mod, slotId) {
  for (var i = 0; i < mod.slots.length; i++) {
    if (mod.slots[i].id === slotId) return mod.slots[i];
  }
  throw new Error('ไม่พบหัวข้องาน: ' + slotId);
}

// ------------------------------------------------------------------- logging

function logSubmission_(student, mod, slot, file) {
  try {
    getSheet_(CONFIG.LOG_TAB).appendRow([
      new Date(),
      student.fullName,
      student.folderName,
      student.email,
      mod.title,
      slot.label,
      file.getName(),
      file.getSize(),
      file.getUrl()
    ]);
  } catch (err) {
    // log ล้มเหลวไม่ควรทำให้การส่งงานล้มเหลวตาม
    console.error('logSubmission_ failed: %s', err.message);
  }
}

function getSheet_(tabName) {
  var ss = SpreadsheetApp.openById(CONFIG.ROSTER_SHEET_ID);
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error('ไม่พบแท็บ "' + tabName + '" ใน Google Sheet');
  return sheet;
}

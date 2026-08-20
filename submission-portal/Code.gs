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

  return t.evaluate()
    .setTitle('ส่งงาน — ' + mod.title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ------------------------------------------------------------ public API (client)

/**
 * ตรวจรหัสของนักเรียน แล้วคืนสถานะการส่งงานของ "ตัวเองเท่านั้น"
 */
function api_signIn(code, moduleId) {
  var student = resolveStudent_(code);
  return {
    fullName: student.fullName,
    folderName: student.folderName,
    submissions: readSubmissions_(student, getModule_(moduleId))
  };
}

/**
 * อัปโหลดไฟล์ 1 ชิ้นเข้า slot ที่ระบุ
 * payload: { code, moduleId, slotId, mimeType, sizeBytes, dataBase64 }
 */
function api_upload(payload) {
  var student = resolveStudent_(payload.code);
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

function api_status(code, moduleId) {
  var student = resolveStudent_(code);
  return readSubmissions_(student, getModule_(moduleId));
}

// ------------------------------------------------------------------- identity

/**
 * หา นักเรียน จากรหัสใน Roster
 *
 * Roster sheet ต้องมีหัวคอลัมน์: code | full_name | folder_name | file_tag | email
 * (file_tag และ email จะเว้นว่างก็ได้)
 */
function resolveStudent_(code) {
  var key = normalizeCode_(code);
  if (!key) throw new Error('กรุณากรอกรหัสนักเรียน');

  var rows = getRoster_();
  for (var i = 0; i < rows.length; i++) {
    if (normalizeCode_(rows[i].code) === key) {
      var fullName = String(rows[i].full_name || '').trim();
      if (!fullName) throw new Error('Roster แถวนี้ยังไม่ได้ใส่ชื่อ กรุณาแจ้งทีมงาน');
      var folderName = String(rows[i].folder_name || '').trim() || slugName_(fullName);
      var fileTag = String(rows[i].file_tag || '').trim() || firstToken_(folderName);
      return {
        code: key,
        fullName: fullName,
        folderName: sanitizeName_(folderName),
        fileTag: sanitizeName_(fileTag),
        email: String(rows[i].email || '').trim()
      };
    }
  }

  console.warn('Rejected sign-in attempt with code: %s', key);
  throw new Error('ไม่พบรหัสนี้ในระบบ กรุณาตรวจสอบอีกครั้งหรือทักทีมงาน');
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
 * โฟลเดอร์ปลายทางของนักเรียน สร้างให้อัตโนมัติถ้ายังไม่มี
 * ใช้ LockService กันกรณีนักเรียนกดส่งหลายไฟล์พร้อมกันแล้วเกิดโฟลเดอร์ซ้ำ
 */
function getSubmitFolder_(student, mod) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    var folder = getOrCreateChild_(root, student.folderName);
    if (CONFIG.USE_MODULE_SUBFOLDER) {
      folder = getOrCreateChild_(folder, mod.folderName);
    }
    return folder;
  } finally {
    lock.releaseLock();
  }
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
  var root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  var it = root.getFoldersByName(student.folderName);
  if (!it.hasNext()) return {};

  var folder = it.next();
  if (CONFIG.USE_MODULE_SUBFOLDER) {
    var sub = folder.getFoldersByName(mod.folderName);
    if (!sub.hasNext()) return {};
    folder = sub.next();
  }

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

function slugName_(fullName) {
  return sanitizeName_(fullName).replace(/\s+/g, '-');
}

function firstToken_(value) {
  return String(value).split(/[\s\-_]+/)[0] || String(value);
}

function normalizeCode_(code) {
  return String(code == null ? '' : code).trim().toUpperCase();
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

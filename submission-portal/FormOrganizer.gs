/**
 * ทางเลือกที่เบากว่า: ใช้ Google Form (File upload) เป็นหน้าส่งงาน
 * แล้วให้สคริปต์นี้ย้าย/เปลี่ยนชื่อไฟล์เข้าโฟลเดอร์ของนักเรียนให้อัตโนมัติ
 *
 * ใช้เมื่อไม่อยาก deploy web app แต่ยังอยากได้โครงโฟลเดอร์ที่เป็นระเบียบ
 * นักเรียนมองไม่เห็นงานของกันและกันอยู่แล้ว เพราะไฟล์เป็นของเจ้าของฟอร์ม
 *
 * วิธีติดตั้ง:
 *   1. สร้างฟอร์ม เปิด "Collect email addresses" และเพิ่มคำถามชนิด File upload
 *      ตั้งชื่อคำถามให้ตรงกับ key ใน FORM_SLOT_MAP ด้านล่าง
 *   2. เอาสคริปต์นี้ไปวางในโปรเจกต์เดียวกับ Config.gs และ Code.gs
 *   3. ตั้ง trigger: onFormSubmitOrganize — event source: From form — event type: On form submit
 */

/** ชื่อคำถามในฟอร์ม → prefix ของชื่อไฟล์ */
var FORM_SLOT_MAP = {
  'User Research Plan': '01-user-research-plan',
  'Competitive Analysis': '02-competitive-analysis',
  'Provisional Personas': '03-provisional-personas'
};

function onFormSubmitOrganize(e) {
  var response = e.response;
  var email = String(response.getRespondentEmail() || '').trim();
  var student = findStudentByEmail_(email);

  if (!student) {
    console.warn('ไม่พบ %s ใน Roster ปล่อยไฟล์ไว้ที่เดิม', email || '(ไม่มีอีเมล)');
    return;
  }

  var mod = getModule_(CONFIG.DEFAULT_MODULE);
  var folder = getSubmitFolder_(student, mod);

  response.getItemResponses().forEach(function (itemResponse) {
    if (itemResponse.getItem().getType() !== FormApp.ItemType.FILE_UPLOAD) return;

    var prefix = FORM_SLOT_MAP[itemResponse.getItem().getTitle().trim()];
    if (!prefix) return;

    var targetName = prefix + '_' + student.fileTag + '.pdf';
    archiveExisting_(folder, targetName);

    [].concat(itemResponse.getResponse()).forEach(function (fileId) {
      var file = DriveApp.getFileById(fileId);
      file.setName(targetName);
      file.moveTo(folder);
      logSubmission_(student, mod, { label: itemResponse.getItem().getTitle() }, file);
    });
  });
}

function findStudentByEmail_(email) {
  try {
    return resolveStudent_(email);
  } catch (err) {
    return null;
  }
}

/**
 * WeStride Submission Portal — configuration.
 *
 * แก้ค่าในไฟล์นี้ไฟล์เดียว ส่วนไฟล์อื่นไม่ต้องแตะ
 */
var CONFIG = {

  /** ID ของโฟลเดอร์แม่ (เอามาจาก URL ของโฟลเดอร์ใน Drive ส่วนหลัง /folders/) */
  ROOT_FOLDER_ID: 'PUT_ROOT_FOLDER_ID_HERE',

  /** ID ของ Google Sheet ที่ใช้เก็บ Roster + Log (สร้างอัตโนมัติได้ด้วย setupPortal()) */
  ROSTER_SHEET_ID: '',

  ROSTER_TAB: 'Roster',
  LOG_TAB: 'SubmissionLog',

  /** Google Group ของเมนเทอร์ ใช้แชร์โฟลเดอร์แม่ครั้งเดียว แล้วจัดการคนที่ group แทน */
  MENTOR_GROUP: 'uxui-mentors@we-stride.com',

  /**
   * true  = ไฟล์ถูกเก็บใน <ชื่อนักเรียน>/Module-01/...
   * false = ไฟล์ถูกเก็บใน <ชื่อนักเรียน>/... (แบบเดิมของคลาส)
   */
  USE_MODULE_SUBFOLDER: false,

  /** ชื่อโฟลเดอร์เก็บไฟล์เวอร์ชันเก่า เวลานักเรียนส่งซ้ำ */
  ARCHIVE_FOLDER_NAME: '_previous-versions',

  /**
   * ขนาดไฟล์สูงสุดต่อชิ้น (MB)
   * ข้อจำกัดจริงของ Apps Script web app คือ payload ~50MB และ base64 ทำให้ขนาดโตขึ้น ~33%
   * จึงตั้งเพดานไว้ที่ 25MB เพื่อความปลอดภัย
   */
  MAX_FILE_MB: 25,

  ALLOWED_MIME: ['application/pdf'],

  DEFAULT_MODULE: 'module-01',

  /** นิยามของแต่ละโมดูล — เพิ่มโมดูลใหม่ได้เรื่อย ๆ โดยไม่ต้องแก้โค้ดส่วนอื่น */
  MODULES: {
    'module-01': {
      title: 'Module 1 · UX Design Process',
      folderName: 'Module-01',
      slots: [
        { id: '01', label: 'User Research Plan', filePrefix: '01-user-research-plan' },
        { id: '02', label: 'Competitive Analysis', filePrefix: '02-competitive-analysis' },
        { id: '03', label: 'Provisional Personas', filePrefix: '03-provisional-personas' }
      ]
    }
  }
};

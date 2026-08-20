/**
 * WeStride Submission Portal — configuration.
 *
 * แก้ค่าในไฟล์นี้ไฟล์เดียว ส่วนไฟล์อื่นไม่ต้องแตะ
 *
 * เพิ่มโมดูลใหม่ = เพิ่มบล็อกใน MODULES ด้านล่าง แล้ว Deploy version ใหม่ครั้งเดียว
 * ไม่ต้องสร้าง deployment แยกต่อโมดูล — URL เดียวเสิร์ฟทุกโมดูลผ่าน ?module=
 */
var CONFIG = {

  /** ID ของโฟลเดอร์แม่ (เอามาจาก URL ของโฟลเดอร์ใน Drive ส่วนหลัง /folders/) */
  ROOT_FOLDER_ID: 'PUT_ROOT_FOLDER_ID_HERE',

  /** ID ของ Google Sheet ที่ใช้เก็บ Roster + Log (สร้างอัตโนมัติได้ด้วย setupPortal()) */
  ROSTER_SHEET_ID: '',

  ROSTER_TAB: 'Roster',
  LOG_TAB: 'SubmissionLog',

  /**
   * true  = ใครก็ส่งงานได้เลย ไม่ต้องแอดรายชื่อไว้ก่อน
   *         นักเรียนกรอกชื่อ+อีเมลครั้งแรก ระบบเพิ่มเข้า Roster และสร้างโฟลเดอร์ให้เอง
   *         ครั้งต่อไปกรอกอีเมลเดิม ระบบจำได้ว่าเป็นใคร
   * false = ส่งได้เฉพาะคนที่มีชื่อใน Roster อยู่แล้ว
   */
  ALLOW_SELF_REGISTER: true,

  /** Google Group ของเมนเทอร์ ใช้แชร์โฟลเดอร์แม่ครั้งเดียว แล้วจัดการคนที่ group แทน */
  MENTOR_GROUP: 'uxui-mentors@we-stride.com',

  /**
   * โครงโฟลเดอร์ปลายทาง
   *
   * 'module-first'  = Project: UX Design Process/หัศดินทร์ ส่องสี/ไฟล์...   ← ค่าตั้งต้น
   * 'student-first' = หัศดินทร์ ส่องสี/Project: UX Design Process/ไฟล์...
   * 'flat'          = หัศดินทร์ ส่องสี/ไฟล์...
   *
   * module-first เหมาะกับการตรวจงาน เพราะเปิดโฟลเดอร์โมดูลเดียวแล้วเห็นงานนักเรียนทุกคน
   * student-first เหมาะกับการดูพัฒนาการรายคนตลอดคอร์ส
   */
  FOLDER_LAYOUT: 'module-first',

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

  /**
   * นิยามของแต่ละโมดูล
   *
   * id         = ตัวเลขนำหน้าชื่อไฟล์ ควรไล่ต่อเนื่องทั้งคอร์สจะได้ไม่ซ้ำกัน
   * label      = ชื่อที่นักเรียนเห็นในช่องอัปโหลด
   * filePrefix = ชื่อไฟล์จริงใน Drive (ต่อท้ายด้วย _<file_tag>.pdf)
   */
  MODULES: {

    'module-01': {
      title: 'Project: UX Design Process',
      folderName: 'Project: UX Design Process',
      slots: [
        { id: '01', label: 'User Research Plan', filePrefix: '01-user-research-plan' },
        { id: '02', label: 'Competitive Analysis', filePrefix: '02-competitive-analysis' },
        { id: '03', label: 'Provisional Personas', filePrefix: '03-provisional-personas' }
      ]
    },

    // ───────────────────────────────────────────────────────────────
    // TODO: 7 โมดูลด้านล่างใส่โครงไว้ให้แล้ว แต่รายการงานย่อยยังเป็นของสมมติ
    // แก้ label กับ filePrefix ให้ตรงกับโจทย์จริงก่อนเปิดใช้โมดูลนั้น
    // ───────────────────────────────────────────────────────────────

    'module-02': {
      title: 'Project: Research Methodology',
      folderName: 'Project: Research Methodology',
      slots: [
        { id: '04', label: 'Research Methodology', filePrefix: '04-research-methodology' }
      ]
    },

    'module-03': {
      title: 'Project: Research Analysis and Synthesis',
      folderName: 'Project: Research Analysis and Synthesis',
      slots: [
        { id: '05', label: 'Research Analysis & Synthesis', filePrefix: '05-research-analysis' }
      ]
    },

    'module-04': {
      title: 'Project: Sharing Insights & Portfolio',
      folderName: 'Project: Sharing Insights & Portfolio',
      slots: [
        { id: '06', label: 'Sharing Insights & Portfolio', filePrefix: '06-sharing-insights' }
      ]
    },

    'module-05': {
      title: 'Project: Ideation & Concept Selection',
      folderName: 'Project: Ideation & Concept Selection',
      slots: [
        { id: '07', label: 'Ideation & Concept Selection', filePrefix: '07-ideation' }
      ]
    },

    'module-06': {
      title: 'Project: Wireframing Process',
      folderName: 'Project: Wireframing Process',
      slots: [
        { id: '08', label: 'Wireframing Process', filePrefix: '08-wireframing' }
      ]
    },

    'module-07': {
      title: 'Project: Design System & Responsive UI',
      folderName: 'Project: Design System & Responsive UI',
      slots: [
        { id: '09', label: 'Design System & Responsive UI', filePrefix: '09-design-system' }
      ]
    },

    'module-08': {
      title: 'Project: From Hi-Fi to Handoff',
      folderName: 'Project: From Hi-Fi to Handoff',
      slots: [
        { id: '10', label: 'From Hi-Fi to Handoff', filePrefix: '10-hifi-to-handoff' }
      ]
    }
  }
};

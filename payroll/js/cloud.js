/* Payroll Full Loop — ฐานข้อมูลคลาวด์ (Supabase)
 *  - เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน · บทบาทจาก plfl_profile (ผู้ดูแลกำหนด)
 *  - โหลดเฉพาะเอกสารที่มีสิทธิ์อ่าน (RLS) → รวมเป็น state เดิมของแอป
 *  - บันทึก: เทียบกับ snapshot ส่งเฉพาะเอกสารที่เปลี่ยน พร้อมเวอร์ชัน (มีคนแก้ก่อน → แจ้งและโหลดใหม่)
 *  - ประวัติการทำงานเขียนลง plfl_activity · ประวัติแก้ไขระดับฟิลด์ทำโดย trigger ในฐานข้อมูล
 *  - สำรองอัตโนมัติวันละครั้งเมื่อผู้มีสิทธิ์เปิดระบบ */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, Store = PL.Store;
  const esc = U.esc;
  const CFG = g.PL_CONFIG || {};
  const ROLE_TH = {
    admin: 'ผู้ดูแลระบบ', hr: 'ฝ่ายบุคคล (HR)', accountant: 'ฝ่ายบัญชี/เงินเดือน', manager: 'หัวหน้างาน (ผู้อนุมัติ)',
    employee: 'พนักงาน', pending: 'รอกำหนดสิทธิ์', disabled: 'ระงับการใช้งาน',
  };
  const DOC_TH = (k) => {
    const c = Store.docClass(k);
    const m = { meta: 'ตัวนับ', config: 'การตั้งค่า', employees: 'ทะเบียนพนักงาน', roster: 'ตารางกะ', requests: 'คำขอ', imports: 'ประวัตินำเข้า', punches: 'บันทึกเวลา', period: 'ผลบันทึกเวลา', pay: 'ข้อมูลเงินเดือน' };
    const pk = k.includes(':') ? ' ' + U.fmtPeriodShort(k.split(':')[1]) : '';
    return (k === 'pay_profiles' ? 'ข้อมูลเงินเดือนพนักงาน' : k === 'pay_config' ? 'ตั้งค่าเงินเดือน' : m[c] || k) + pk;
  };
  const PERIOD_KEY = 'plfl-period';
  const MAX_BATCH = 700 * 1024;
  const lsGet = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  };

  // เปิดเป็นเมนูใน HR Unified System (iframe โดเมนเดียวกัน): ใช้การล็อกอินของ HR Unified ผ่าน parent.HRU.token()
  // ไม่ล็อกอินซ้ำ และไม่ refresh token เอง (ให้ HR Unified เป็นเจ้าของ session เพียงฝั่งเดียว)
  const HOST = (() => {
    try {
      return g.parent !== g && g.parent.HRU && typeof g.parent.HRU.token === 'function' ? g.parent : null;
    } catch (e) {
      return null; // ต่างโดเมน
    }
  })();

  const Cloud = (PL.Cloud = {
    ROLE_TH,
    DOC_TH,
    embedded: !!HOST,
    // ?local=1 ที่หน้านี้ หรือ HR Unified เปิดโหมดสาธิต (?local=1) → ใช้แบบเครื่องเดียว
    enabled: !!(CFG.supabaseUrl && CFG.supabaseKey) && !/[?&]local=1\b/.test(location.search) && !(HOST && /[?&]local=1\b/.test(HOST.location.search)),
    sb: null,
    profile: null,
    versions: {},
    snap: {},
    pendingLog: [],
    dirty: false,
    saving: false,
    timer: null,
    chain: Promise.resolve(),
    lastCheck: 0,
    status: 'saved',

    /* ---------- เริ่มต้น: คืน true เมื่อโหลดข้อมูลพร้อมให้แอปทำงาน ---------- */
    async start() {
      if (!g.supabase || !g.supabase.createClient) {
        this.screen('error', { msg: 'โหลดไลบรารีฐานข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่' });
        return false;
      }
      if (this.embedded) {
        document.body.classList.add('embedded');
        const token = async () => {
          const t = await HOST.HRU.token();
          if (!t || !t.access_token) throw new Error('ยังไม่ได้เข้าสู่ระบบ HR Unified');
          return t.access_token;
        };
        this.sb = g.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'plfl-embedded' },
          global: {
            fetch: async (input, init = {}) => {
              const h = new Headers(init.headers || {});
              h.set('Authorization', 'Bearer ' + (await token()));
              return fetch(input, Object.assign({}, init, { headers: h }));
            },
          },
        });
      } else {
        // แอปย่อยของระบบ HR: ใช้ storage key มาตรฐานของ Supabase = session เดียวกับระบบ HR (โดเมนเดียวกัน) → ล็อกอินครั้งเดียว
        const authOpts = { persistSession: true, autoRefreshToken: true };
        if (!CFG.hostApp) authOpts.storageKey = 'plfl-auth';
        this.sb = g.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: authOpts });
        this.sb.auth.onAuthStateChange((ev) => {
          if (ev === 'PASSWORD_RECOVERY') this.screen('newpass');
          if (ev === 'SIGNED_OUT') location.reload();
        });
        const { data } = await this.sb.auth.getSession();
        if (/type=recovery/.test(location.hash)) return false; // รอ PASSWORD_RECOVERY
        if (!data.session) {
          if (CFG.hostApp && CFG.hostApp.loginUrl) { // ยังไม่ได้ล็อกอิน → ไปล็อกอินที่ระบบ HR แล้วพากลับมาที่หน้านี้
            location.replace(CFG.hostApp.loginUrl + '?next=' + encodeURIComponent(location.pathname + location.hash));
            return false;
          }
          this.screen('login');
          return false;
        }
      }
      const me = await this.sb.rpc('plfl_me');
      if (me.error) {
        this.screen('error', { msg: 'อ่านข้อมูลผู้ใช้ไม่สำเร็จ: ' + me.error.message });
        return false;
      }
      this.profile = me.data;
      const role = this.profile.role;
      if (!['admin', 'hr', 'accountant', 'manager'].includes(role)) {
        this.screen('blocked', { role });
        return false;
      }
      Store.role = role;
      Store.backend = this;
      this.loading(true);
      const docs = await this.fetchDocs();
      this.loading(false);
      if (!docs) return false;
      if (!Object.keys(docs).length || !docs.config) {
        if (!Store.can('hr')) {
          this.screen('error', { msg: 'ยังไม่มีข้อมูลในระบบ — รอฝ่ายบุคคล (HR) หรือผู้ดูแลระบบตั้งค่าครั้งแรก', logout: true });
          return false;
        }
        const s = await this.setupScreen();
        Store.s = s;
        this.applyUser(s);
        this.snap = {};
        this.versions = {};
        this.dirty = true;
        this.loading(true, 'กำลังอัปโหลดข้อมูลขึ้นฐานข้อมูล…');
        const ok = await this.saveNow();
        this.loading(false);
        if (!ok) return false;
        Store.log('ตั้งค่าฐานข้อมูลครั้งแรก', `พนักงาน ${s.employees.length} คน`);
        this.queueSave();
      } else {
        this.useDocs(docs);
        await this.loadActivity();
      }
      this.watch();
      if (['admin', 'hr', 'accountant'].includes(role)) this.sb.rpc('plfl_backup_now', { p_kind: 'auto' }).then((r) => r.data && r.data.id && console.info('สำรองข้อมูลอัตโนมัติแล้ว', r.data));
      return true;
    },

    async fetchDocs() {
      const { data, error } = await this.sb.from('plfl_doc').select('key,data,version');
      if (error) {
        this.screen('error', { msg: 'โหลดข้อมูลไม่สำเร็จ: ' + error.message, logout: true });
        return null;
      }
      const docs = {};
      this.versions = {};
      for (const r of data) {
        docs[r.key] = r.data;
        this.versions[r.key] = r.version;
      }
      return docs;
    },
    useDocs(docs) {
      const s = Store.hydrate(Store.join(docs), { noDemoPay: true });
      const keep = lsGet(PERIOD_KEY);
      const pks = Object.keys(s.periods).sort();
      s.settings.period = keep && /^\d{4}-\d{2}$/.test(keep) ? keep : pks[pks.length - 1] || U.todayStr().slice(0, 7);
      this.applyUser(s);
      Store.s = s;
      this.takeSnapshot();
    },
    applyUser(s) {
      s.user = { name: this.profile.name || this.profile.email, role: ROLE_TH[this.profile.role] || this.profile.role, email: this.profile.email };
    },
    takeSnapshot() {
      const docs = Store.split(Store.s);
      this.snap = {};
      for (const [k, v] of Object.entries(docs)) this.snap[k] = JSON.stringify(v);
    },
    async loadActivity() {
      const { data } = await this.sb.from('plfl_activity').select('at,by_name,action,detail').order('at', { ascending: false }).limit(300);
      Store.s.log = (data || []).map((r) => ({ at: r.at, by: r.by_name || '', action: r.action, detail: r.detail || '' }));
    },
    async reload(msg) {
      this.loading(true, 'กำลังโหลดข้อมูลล่าสุด…');
      const docs = await this.fetchDocs();
      this.loading(false);
      if (!docs) return;
      this.useDocs(docs);
      await this.loadActivity();
      this.dirty = false;
      this.setStatus('saved');
      if (msg) PL.UI.toast(msg, 'info', 5000);
      PL.App && PL.App.current && PL.App.rerender();
    },

    /* ---------- บันทึก ---------- */
    queueSave() {
      if (Store.s && Store.s.settings) lsSet(PERIOD_KEY, Store.s.settings.period);
      this.dirty = true;
      this.setStatus('pending');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.saveNow(), 400);
      return true;
    },
    logActivity(entry) {
      this.pendingLog.push({ by_name: entry.by, action: entry.action, detail: entry.detail });
      this.dirty = true;
    },
    saveNow() {
      clearTimeout(this.timer);
      this.chain = this.chain.then(() => this._save()).catch((e) => {
        console.error(e);
        return false;
      });
      return this.chain;
    },
    // เอกสารที่เปลี่ยนจาก snapshot (แยกที่บันทึกได้ / ไม่มีสิทธิ์)
    diff() {
      const docs = Store.split(Store.s), role = Store.role;
      const changes = [], denied = [];
      for (const [k, v] of Object.entries(docs)) {
        const str = JSON.stringify(v);
        if (str === this.snap[k]) continue;
        if (Store.canWrite(role, k)) changes.push({ key: k, data: v, version: this.versions[k] || 0, str });
        else if (Store.canRead(role, k)) denied.push(k);
      }
      for (const k of Object.keys(this.snap)) {
        if (k in docs) continue;
        if (Store.canWrite(role, k)) changes.push({ key: k, data: null, version: this.versions[k] || 0, str: null });
        else if (Store.canRead(role, k)) denied.push(k);
      }
      return { changes, denied };
    },
    async _save() {
      if (!this.dirty) return true;
      this.dirty = false;
      this.saving = true;
      this.setStatus('saving');
      try {
        const { changes, denied } = this.diff();
        if (denied.length) {
          PL.UI.toast(`บทบาทของคุณไม่มีสิทธิ์แก้ไข: ${denied.map(DOC_TH).join(', ')} — ยกเลิกการเปลี่ยนแปลงนี้และโหลดข้อมูลล่าสุด`, 'bad', 8000);
          this.pendingLog = [];
          await this.reload();
          return false;
        }
        // แบ่งเป็นชุดไม่เกิน ~700KB ต่อการเรียก (เอกสารใหญ่ส่งเดี่ยว)
        const batches = [];
        let cur = [], size = 0;
        for (const c of changes) {
          const n = c.str ? c.str.length : 10;
          if (cur.length && size + n > MAX_BATCH) {
            batches.push(cur);
            cur = [];
            size = 0;
          }
          cur.push(c);
          size += n;
        }
        if (cur.length) batches.push(cur);
        for (const b of batches) {
          const { data, error } = await this.sb.rpc('plfl_save', { p_docs: b.map((c) => ({ key: c.key, data: c.data, version: c.version })) });
          if (error) throw error;
          for (const c of b) {
            const v = data[c.key];
            if (!v) {
              delete this.versions[c.key];
              delete this.snap[c.key];
            } else {
              this.versions[c.key] = v;
              this.snap[c.key] = c.str;
            }
          }
          // ตัวนับรวมฝั่งเซิร์ฟเวอร์ (ค่ามากสุดของทุกคน)
          if (data.meta_data) {
            const s = Store.s, m = data.meta_data;
            s.seq = Math.max(+s.seq || 0, +m.seq || 0);
            s.counters = s.counters || {};
            for (const [k, v] of Object.entries(m.counters || {})) s.counters[k] = Math.max(+s.counters[k] || 0, +v || 0);
            this.snap.meta = JSON.stringify({ version: s.version, seq: s.seq, counters: s.counters });
          }
        }
        if (this.pendingLog.length) {
          const rows = this.pendingLog.splice(0);
          const { error } = await this.sb.from('plfl_activity').insert(rows);
          if (error) console.warn('บันทึกประวัติการทำงานไม่สำเร็จ', error);
        }
        this.setStatus(this.dirty ? 'pending' : 'saved');
        return true;
      } catch (e) {
        const msg = String((e && e.message) || e);
        const m = msg.match(/conflict:([^:]+):(.*)/);
        if (m) {
          await PL.UI.confirm(`<b>${esc(DOC_TH(m[1]))}</b> ถูกแก้ไขโดย <b>${esc(m[2] || 'ผู้ใช้อื่น')}</b> ระหว่างที่คุณทำงาน<br>การเปลี่ยนแปลงล่าสุดของคุณยังไม่ถูกบันทึก — ระบบจะโหลดข้อมูลล่าสุด แล้วกรุณาทำรายการนั้นอีกครั้ง`, { title: 'มีผู้ใช้อื่นแก้ไขข้อมูลเดียวกัน', ok: 'โหลดข้อมูลล่าสุด', cancel: 'ปิด' });
          this.pendingLog = [];
          await this.reload();
          return false;
        }
        this.dirty = true;
        this.setStatus('error');
        PL.UI.toast('บันทึกข้อมูลไม่สำเร็จ: ' + esc(msg) + ' — จะลองใหม่อัตโนมัติ', 'bad', 6000);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.saveNow(), 8000);
        return false;
      } finally {
        this.saving = false;
      }
    },

    /* ---------- ตรวจการเปลี่ยนแปลงจากผู้ใช้อื่น ---------- */
    watch() {
      const check = () => this.checkRemote();
      g.addEventListener('focus', check);
      setInterval(() => document.visibilityState === 'visible' && check(), 90000);
      g.addEventListener('beforeunload', (e) => {
        if (this.dirty || this.saving) {
          e.preventDefault();
          e.returnValue = '';
        }
      });
    },
    async checkRemote(force) {
      if (!force && (Date.now() - this.lastCheck < 20000 || this.dirty || this.saving)) return;
      this.lastCheck = Date.now();
      const { data, error } = await this.sb.from('plfl_doc').select('key,version');
      if (error || !data || this.dirty || this.saving) return;
      const server = {};
      data.forEach((r) => (server[r.key] = r.version));
      const changed = data.some((r) => this.versions[r.key] !== r.version) || Object.keys(this.versions).some((k) => !(k in server));
      if (changed) await this.reload('มีการแก้ไขจากผู้ใช้อื่น — โหลดข้อมูลล่าสุดแล้ว');
    },

    /* ---------- สถานะการบันทึก ---------- */
    setStatus(st) {
      this.status = st;
      const el = document.getElementById('saveStatus');
      if (el) el.outerHTML = this.statusHTML();
    },
    statusHTML() {
      const m = { saved: ['ok', 'บันทึกแล้ว'], pending: ['warn', 'รอบันทึก…'], saving: ['warn', 'กำลังบันทึก…'], error: ['bad', 'บันทึกไม่สำเร็จ'] }[this.status] || ['', ''];
      return `<span id="saveStatus" class="save-st ${m[0]}" title="ฐานข้อมูลคลาวด์">${m[1]}</span>`;
    },
    async logout() {
      if (this.dirty || this.saving) await this.saveNow();
      if (this.embedded) return HOST.HRU.signOut(); // ออกจาก HR Unified ทั้งระบบ
      if (CFG.hostApp && CFG.hostApp.clearKeysPrefix) { // ออกจากระบบ = ออกทั้งระบบ HR ด้วย → ล้างข้อมูล HR ที่แคชในเครื่อง
        try { Object.keys(localStorage).filter((k) => k.indexOf(CFG.hostApp.clearKeysPrefix) === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
      }
      await this.sb.auth.signOut();
      location.reload();
    },

    /* ---------- รายชื่อพนักงานจาก HR Unified System ---------- */
    // เปิดใน HR Unified: อ่านจากแอปโดยตรง (parent.hruApp.directory) · เปิดแยก: ตาราง hru_employee (ตามสิทธิ์ RLS ของ HR Unified)
    async hruDirectory() {
      if (HOST && HOST.hruApp && typeof HOST.hruApp.directory === 'function') return { from: 'app', employees: HOST.hruApp.directory().employees || [] };
      if (CFG.hostApp) { // แอปย่อยของระบบ HR รวมศูนย์: อ่านรายชื่อจากฐานข้อมูลหลัก (hr_db) เฉพาะส่วน employees
        const r = await this.sb.from('hr_db').select('employees:data->employees').eq('id', 'main').maybeSingle();
        if (r.error) throw r.error;
        const iso = (v) => {
          const t = String(v || '').trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
          const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
          if (!m) return '';
          const y = +m[3] > 2400 ? +m[3] - 543 : +m[3];
          return y + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
        };
        const list = ((r.data && r.data.employees) || []).map((e) => ({ emp_code: e.empCode, name: e.fullName, hire_date: iso(e.startDate), company: e.company || '', department: e.department || '', position: e.position || '', active: e.status !== 'Inactive' }));
        return { from: 'app', employees: list };
      }
      const { data, error } = await this.sb.from('hru_employee').select('emp_code,name,hire_date,company,department,position,active');
      if (error) throw error;
      return { from: 'table', employees: data || [] };
    },

    /* ---------- หน้าจอก่อนเข้าระบบ ---------- */
    loading(on, msg) {
      let el = document.getElementById('cloudLoading');
      if (!on) return el && el.remove();
      if (!el) {
        el = document.createElement('div');
        el.id = 'cloudLoading';
        el.className = 'cloud-loading';
        document.body.appendChild(el);
      }
      el.innerHTML = `<div class="spinner"></div><div>${esc(msg || 'กำลังโหลดข้อมูล…')}</div>`;
    },
    screen(kind, o = {}) {
      document.body.classList.add('auth-mode');
      let el = document.getElementById('authScreen');
      if (!el) {
        el = document.createElement('div');
        el.id = 'authScreen';
        el.className = 'auth-screen';
        document.body.appendChild(el);
      }
      const brand = `<div class="auth-brand"><svg viewBox="0 0 48 24" width="56"><path d="M24 12C18 4 7 4 7 12s11 8 17 0 17-8 17 0-11 8-17 0z" fill="none" stroke="#0e9fb3" stroke-width="4" stroke-linecap="round"/></svg><div><b>Payroll Full Loop</b><span>ระบบบันทึกเวลาและเงินเดือน</span></div></div>`;
      const out = `<button class="btn" data-logout>ออกจากระบบ</button>`;
      let body = '';
      if (kind === 'login' || kind === 'signup' || kind === 'forgot') {
        const isUp = kind === 'signup', isForgot = kind === 'forgot';
        body = `<h2>${isUp ? 'สมัครบัญชีผู้ใช้' : isForgot ? 'ลืมรหัสผ่าน' : 'เข้าสู่ระบบ'}</h2>
          <form data-form class="stack">
            <label class="field"><span class="lbl">อีเมล</span><input class="input" type="email" name="email" autocomplete="username" required></label>
            ${isForgot ? '' : `<label class="field"><span class="lbl">รหัสผ่าน${isUp ? ' (อย่างน้อย 8 ตัวอักษร)' : ''}</span><input class="input" type="password" name="password" minlength="${isUp ? 8 : 1}" autocomplete="${isUp ? 'new-password' : 'current-password'}" required></label>`}
            <div class="auth-msg" data-msg></div>
            <button class="btn primary lg" type="submit">${isUp ? 'สมัครใช้งาน' : isForgot ? 'ส่งลิงก์ตั้งรหัสผ่านใหม่' : 'เข้าสู่ระบบ'}</button>
          </form>
          <div class="auth-links">${kind !== 'login' ? '<a href="#" data-go="login">มีบัญชีแล้ว? เข้าสู่ระบบ</a>' : '<a href="#" data-go="signup">สมัครบัญชีใหม่</a> · <a href="#" data-go="forgot">ลืมรหัสผ่าน</a>'}</div>
          ${isUp ? '<p class="muted auth-note">สมัครแล้วต้องรอผู้ดูแลระบบกำหนดสิทธิ์ก่อนจึงจะเห็นข้อมูล</p>' : ''}`;
      } else if (kind === 'newpass') {
        body = `<h2>ตั้งรหัสผ่านใหม่</h2><form data-form class="stack">
          <label class="field"><span class="lbl">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</span><input class="input" type="password" name="password" minlength="8" autocomplete="new-password" required></label>
          <div class="auth-msg" data-msg></div><button class="btn primary lg" type="submit">บันทึกรหัสผ่าน</button></form>`;
      } else if (kind === 'blocked') {
        const p = this.profile || {};
        body = o.role === 'employee'
          ? `<h2>ระบบสำหรับพนักงาน (ESS) ยังไม่เปิดใช้</h2><p>บัญชี <b>${esc(p.email)}</b> เป็นบทบาทพนักงาน — การยื่นคำขอลา/OT และดูสลิปด้วยตนเองจะเปิดในรอบพัฒนาถัดไป</p>${out}`
          : o.role === 'disabled'
            ? `<h2>บัญชีถูกระงับ</h2><p>บัญชี <b>${esc(p.email)}</b> ถูกระงับการใช้งาน — ติดต่อผู้ดูแลระบบ</p>${out}`
            : `<h2>รอกำหนดสิทธิ์</h2><p>บัญชี <b>${esc(p.email)}</b> สมัครแล้ว แต่ยังไม่ได้รับสิทธิ์ใช้งาน<br>แจ้งผู้ดูแลระบบให้กำหนดบทบาทที่ <b>ตั้งค่า &gt; ผู้ใช้และสิทธิ์</b> แล้วกดปุ่มด้านล่าง</p>
               <div class="row"><button class="btn primary" data-retry>ตรวจสอบอีกครั้ง</button>${out}</div>`;
      } else {
        body = `<h2>ไม่สามารถเปิดระบบได้</h2><p>${esc(o.msg || '')}</p><div class="row"><button class="btn primary" data-retry>ลองอีกครั้ง</button>${o.logout ? out : ''}</div>`;
      }
      el.innerHTML = `<div class="auth-card">${brand}${body}</div>`;
      el.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => (e.preventDefault(), this.screen(a.dataset.go))));
      const lo = el.querySelector('[data-logout]');
      if (lo) lo.addEventListener('click', () => this.logout());
      const rt = el.querySelector('[data-retry]');
      if (rt) rt.addEventListener('click', () => location.reload());
      const form = el.querySelector('[data-form]');
      if (form) form.addEventListener('submit', (e) => this.submitAuth(e, kind, form));
      const first = el.querySelector('input');
      if (first) first.focus();
    },
    async submitAuth(e, kind, form) {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const msg = form.querySelector('[data-msg]');
      const btn = form.querySelector('button[type=submit]');
      const say = (t, bad) => ((msg.textContent = t), msg.classList.toggle('bad', !!bad));
      btn.disabled = true;
      say('กำลังดำเนินการ…');
      const back = location.origin + location.pathname;
      try {
        let r;
        if (kind === 'login') {
          r = await this.sb.auth.signInWithPassword({ email: f.email, password: f.password });
          if (r.error) throw r.error;
          location.reload();
          return;
        }
        if (kind === 'signup') {
          r = await this.sb.auth.signUp({ email: f.email, password: f.password, options: { emailRedirectTo: back } });
          if (r.error) throw r.error;
          if (r.data.session) return location.reload();
          say('ส่งอีเมลยืนยันแล้ว — กดลิงก์ในอีเมล แล้วกลับมาเข้าสู่ระบบ');
          return;
        }
        if (kind === 'forgot') {
          r = await this.sb.auth.resetPasswordForEmail(f.email, { redirectTo: back });
          if (r.error) throw r.error;
          say('ถ้ามีบัญชีนี้ ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว');
          return;
        }
        if (kind === 'newpass') {
          r = await this.sb.auth.updateUser({ password: f.password });
          if (r.error) throw r.error;
          history.replaceState(null, '', back);
          location.reload();
        }
      } catch (err) {
        const m = String(err.message || err);
        say(/Invalid login/i.test(m) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : /not confirmed/i.test(m) ? 'ยังไม่ได้ยืนยันอีเมล — ตรวจกล่องจดหมาย' : m, true);
      } finally {
        btn.disabled = false;
      }
    },
    // ฐานข้อมูลว่าง: เลือกข้อมูลตั้งต้น
    setupScreen() {
      return new Promise((resolve) => {
        let local = null;
        try {
          const raw = lsGet(Store.KEY);
          if (raw) local = Store.hydrate(JSON.parse(raw));
        } catch (e) {}
        this.screen('error', {});
        const el = document.getElementById('authScreen');
        el.querySelector('.auth-card').innerHTML = `<h2>ตั้งค่าฐานข้อมูลครั้งแรก</h2>
          <p class="muted">ฐานข้อมูลยังว่าง เลือกข้อมูลตั้งต้น (ทำครั้งเดียว — ผู้ใช้อื่นจะเห็นข้อมูลชุดนี้)</p>
          <div class="stack">
            ${local ? `<button class="btn primary" data-pick="local">ย้ายข้อมูลจากเบราว์เซอร์เครื่องนี้<br><small>พนักงาน ${local.employees.length} คน · บันทึกเวลา ${U.num(local.punches.length)} รายการ · ${Object.keys(local.periods).length} รอบ</small></button>` : ''}
            <label class="btn">นำเข้าไฟล์สำรอง (JSON)<input type="file" accept=".json" hidden data-file></label>
            <button class="btn" data-pick="demo">ใช้ข้อมูลตัวอย่าง (48 คน ก.ย.–ต.ค. 2569)</button>
            <button class="btn" data-pick="empty">เริ่มว่าง (มีค่าตั้งต้น กะ วันหยุด กฎ)</button>
          </div><div class="auth-msg" data-msg></div>`;
        const done = (s) => {
          document.body.classList.remove('auth-mode');
          el.remove();
          resolve(s);
        };
        el.querySelectorAll('[data-pick]').forEach((b) =>
          b.addEventListener('click', () => {
            const k = b.dataset.pick;
            if (k === 'local') done(local);
            if (k === 'demo') done(PL.Seed.build());
            if (k === 'empty') done(PL.Seed.empty());
          })
        );
        el.querySelector('[data-file]').addEventListener('change', async (e) => {
          try {
            const data = JSON.parse(await U.readFile(e.target.files[0]));
            if (data.version !== 1 || !Array.isArray(data.employees)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
            done(Store.hydrate(data));
          } catch (err) {
            el.querySelector('[data-msg]').textContent = 'อ่านไฟล์ไม่สำเร็จ: ' + err.message;
          }
        });
      });
    },
    ready() {
      document.body.classList.remove('auth-mode');
      const el = document.getElementById('authScreen');
      if (el) el.remove();
    },

    /* ---------- ผู้ใช้ / ประวัติแก้ไข / สำรองข้อมูล ---------- */
    async users() {
      // plfl_users() (002_plfl_hru_roles.sql) ให้บทบาทที่ใช้จริงรวมสิทธิ์จาก HR Unified · ยังไม่ติดตั้ง → อ่านตารางตรง
      const r = await this.sb.rpc('plfl_users');
      if (!r.error) return r.data;
      const { data, error } = await this.sb.from('plfl_profile').select('*').order('created_at');
      if (error) throw error;
      return data.map((u) => Object.assign(u, { effective: u.role, source: u.role === 'pending' ? 'none' : 'plfl' }));
    },
    async setUser(id, role, name, emp) {
      const { data, error } = await this.sb.rpc('plfl_set_user', { p_user: id, p_role: role, p_name: name || '', p_emp: emp || '' });
      if (error) throw error;
      return data;
    },
    async audit(f = {}) {
      let q = this.sb.from('plfl_audit').select('*').order('at', { ascending: false }).limit(f.limit || 300);
      if (f.doc) q = q.like('doc', f.doc + '%');
      if (f.user) q = q.eq('user_name', f.user);
      if (f.q) q = q.ilike('path', `%${f.q}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async backups() {
      const { data, error } = await this.sb.rpc('plfl_backups');
      if (error) throw error;
      return data;
    },
    async backupNow() {
      if (this.dirty || this.saving) await this.saveNow();
      const { data, error } = await this.sb.rpc('plfl_backup_now', { p_kind: 'manual' });
      if (error) throw error;
      return data;
    },
    async backupFile(id) {
      const { data, error } = await this.sb.from('plfl_backup').select('at,docs').eq('id', id).single();
      if (error) throw error;
      const docs = {};
      for (const [k, v] of Object.entries(data.docs)) docs[k] = v.data;
      const s = Store.hydrate(Store.join(docs), { noDemoPay: true });
      s.user = Store.s.user;
      return { at: data.at, json: Store.serialize(s) };
    },
    async restore(id) {
      const { data, error } = await this.sb.rpc('plfl_restore', { p_id: id });
      if (error) throw error;
      await this.reload();
      return data;
    },
  });
})(window);

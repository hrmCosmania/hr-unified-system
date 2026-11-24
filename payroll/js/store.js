/* Payroll Full Loop — จัดเก็บข้อมูล: localStorage (เครื่องเดียว) หรือ Supabase ผ่าน PL.Cloud (js/cloud.js) */
(function (g) {
  'use strict';
  const PL = (g.PL = g.PL || {});
  const U = PL.U, E = PL.Engine;
  const KEY = 'payroll-full-loop/v1';

  // ตัดค่าเริ่มต้นออกก่อนบันทึก เพื่อลดขนาดข้อมูล
  const CALC_DEF = { code: '', type: 'WORK', adj: '', st: 'NORMAL', late: 0, early: 0, work: 0, absent: 0, leave: 0, lt: '', lpart: '', ot1: 0, ot15: 0, ot2: 0, ot3: 0, inc: '', pend: 0, in: null, out: null, ps: null, pe: null };
  const MAP_DEF = { code: '', type: 'WORK', st: 'OK', bs: null, be: null, in: null, out: null, n: 0, ps: null, pe: null };
  const TIME_KEYS = { ps: 1, pe: 1, bs: 1, be: 1, in: 1, out: 1 };
  // เวลาเก็บเป็นนาทีนับจากต้นวันของแถว (ตัวเลขสั้นกว่านาทีสัมบูรณ์)
  const pack = (row, def) => {
    const o = {};
    const base = U.dnum(row.d) * 1440;
    for (const k in row) {
      let v = row[k];
      if (k in def && v === def[k]) continue;
      if (Array.isArray(v) && !v.length) continue;
      if (TIME_KEYS[k] && v != null) v -= base;
      else if (k === 'p') v = v.map((m) => m - base);
      o[k] = v;
    }
    return o;
  };
  const unpack = (row, def, arrKeys, off) => {
    const base = off ? U.dnum(row.d) * 1440 : 0;
    const o = Object.assign({}, def, row);
    for (const k in TIME_KEYS) if (row[k] != null) o[k] = row[k] + base;
    if (row.p) o.p = row.p.map((m) => m + base);
    arrKeys.forEach((k) => {
      if (!o[k]) o[k] = [];
    });
    return o;
  };
  const serialize = (s) => {
    const periods = {};
    for (const [pk, P] of Object.entries(s.periods)) {
      periods[pk] = Object.assign({}, P, {
        mapping: P.mapping && P.mapping.map((r) => pack(r, MAP_DEF)),
        calc: P.calc && P.calc.map((r) => pack(r, CALC_DEF)),
      });
    }
    return JSON.stringify(Object.assign({}, s, { periods, fmt: 2 }));
  };
  /* ---------- แบ่งข้อมูลเป็นเอกสารตามกลุ่มสิทธิ์ (ใช้กับฐานข้อมูลคลาวด์) ----------
   * meta: ตัวนับ · config: บริษัท กฎ กะ วันหยุด · employees: ทะเบียน (ไม่มีเงินเดือน)
   * pay_profiles: เงินเดือน/ข้อมูลภาษีรายคน · roster · requests · punches:YYYY-MM · imports
   * period:YYYY-MM (ผลโอน/คำนวณ แบบบีบอัด) · pay_config · pay_run:YYYY-MM
   * รอบที่เลือก (settings.period) เป็นค่าของผู้ใช้แต่ละคน ไม่ได้เก็บรวม */
  const PAY_FIELDS = ['pay', 'salary', 'rates'];
  const docClass = (k) =>
    k.startsWith('period:') ? 'period' : k.startsWith('punches:') ? 'punches' : k.startsWith('pay_run:') || k === 'pay_profiles' || k === 'pay_config' ? 'pay' : k;
  // ต้องตรงกับ plfl_can_read / plfl_can_write ในฐานข้อมูล (ฝั่งเซิร์ฟเวอร์เป็นตัวบังคับจริง)
  const canRead = (role, k) => ['admin', 'hr', 'accountant'].includes(role) || (role === 'manager' && docClass(k) !== 'pay');
  const canWrite = (role, k) => {
    const c = docClass(k);
    return ['admin', 'hr'].includes(role) || (role === 'accountant' && ['pay', 'meta', 'period'].includes(c)) || (role === 'manager' && ['requests', 'roster', 'period', 'meta'].includes(c));
  };
  const split = (s) => {
    const docs = {};
    docs.meta = { version: s.version, seq: s.seq, counters: s.counters || {} };
    const settings = Object.assign({}, s.settings);
    delete settings.period;
    docs.config = { company: s.company, settings, shifts: s.shifts, leaveTypes: s.leaveTypes, holidays: s.holidays, depts: s.depts };
    docs.employees = {};
    docs.pay_profiles = {};
    for (const e of s.employees) {
      const rest = {}, pp = {};
      for (const k in e) (PAY_FIELDS.includes(k) ? pp : rest)[k] = e[k];
      docs.employees[e.id] = rest;
      docs.pay_profiles[e.id] = pp;
    }
    docs.roster = s.roster || {};
    docs.requests = {};
    for (const r of s.requests || []) docs.requests[r.id] = r;
    for (const p of s.punches || []) (docs['punches:' + p.t.slice(0, 7)] = docs['punches:' + p.t.slice(0, 7)] || []).push(p);
    docs.imports = s.imports || [];
    for (const [pk, P] of Object.entries(s.periods || {}))
      docs['period:' + pk] = Object.assign({}, P, { mapping: P.mapping && P.mapping.map((r) => pack(r, MAP_DEF)), calc: P.calc && P.calc.map((r) => pack(r, CALC_DEF)) });
    if (s.pay) {
      const cfg = {};
      for (const k in s.pay) if (k !== 'runs') cfg[k] = s.pay[k];
      docs.pay_config = cfg;
      for (const [pk, run] of Object.entries(s.pay.runs || {})) docs['pay_run:' + pk] = run;
    }
    return docs;
  };
  // รวมเอกสารกลับเป็น state (ก่อน hydrate) — เอกสารที่ไม่มีสิทธิ์อ่านจะไม่อยู่ใน docs
  const join = (docs) => {
    const meta = docs.meta || {}, cfg = docs.config || {};
    const s = {
      version: meta.version || 1, seq: meta.seq || 1, counters: meta.counters || {}, fmt: 2,
      company: cfg.company || { name: '' }, settings: Object.assign({}, cfg.settings), shifts: cfg.shifts, leaveTypes: cfg.leaveTypes, holidays: cfg.holidays, depts: cfg.depts,
      user: { name: '', role: '' }, roster: docs.roster || {}, imports: docs.imports || [], log: [], periods: {}, punches: [],
    };
    const pp = docs.pay_profiles || {};
    s.employees = Object.values(docs.employees || {}).sort((a, b) => String(a.id).localeCompare(String(b.id))).map((e) => Object.assign({}, e, pp[e.id]));
    s.requests = Object.values(docs.requests || {}).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)));
    const keys = Object.keys(docs).sort();
    for (const k of keys) {
      if (k.startsWith('punches:')) s.punches.push(...docs[k]);
      else if (k.startsWith('period:')) s.periods[k.slice(7)] = docs[k];
    }
    if (docs.pay_config) {
      s.pay = Object.assign({}, docs.pay_config, { runs: {} });
      for (const k of keys) if (k.startsWith('pay_run:')) s.pay.runs[k.slice(8)] = docs[k];
    }
    return s;
  };

  // รวมรายชื่อพนักงานจาก HR Unified (emp_code, name, hire_date, company, department, position)
  //  - คนใหม่: เพิ่มเป็นรายเดือน อัตรา 0 (ต้องกรอกเงินเดือน/กะเอง) · คนที่มีแล้ว: อัปเดตชื่อ แผนก ตำแหน่ง (ถ้าเลือก) เติมวันเริ่มงานถ้าว่าง
  //  - ไม่แตะเงินเดือน กะ บัญชี และไม่ลบ/ปิดคนที่ไม่อยู่ใน HR Unified (รายงานไว้ใน missing)
  const syncEmployees = (s, list, opt = {}) => {
    const out = { added: [], updated: [], same: 0, missing: [], skipped: 0 };
    const byCode = {};
    s.employees.forEach((e) => (byCode[U.normCode(e.code)] = e));
    const seen = new Set();
    const shift = (s.shifts.find((x) => (x.type || 'WORK') === 'WORK') || {}).code || 'D';
    let n = s.employees.reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0);
    for (const r of list) {
      const code = U.normCode(r.emp_code);
      if (!code || !r.name || r.active === false || (opt.company && r.company !== opt.company)) {
        out.skipped++;
        continue;
      }
      seen.add(code);
      const dept = String(r.department || '').trim() || '-', pos = String(r.position || '').trim();
      const start = /^\d{4}-\d{2}-\d{2}$/.test(r.hire_date || '') ? r.hire_date : '';
      const ex = byCode[code];
      if (!ex) {
        const e = { id: 'E' + U.pad(++n, 4), code, card: '', name: r.name, dept, position: pos, payType: 'M', salary: 0, shift, pattern: 'SIX', team: 'A', active: true, hru: true };
        if (start) e.start = start;
        s.employees.push(e);
        out.added.push(e);
      } else {
        const ch = {};
        if (opt.update !== false) {
          if (ex.name !== r.name) ch.name = r.name;
          if (dept !== '-' && ex.dept !== dept) ch.dept = dept;
          if (pos && ex.position !== pos) ch.position = pos;
        }
        if (start && !ex.start) ch.start = start;
        if (Object.keys(ch).length) {
          out.updated.push({ code, from: Object.fromEntries(Object.keys(ch).map((k) => [k, ex[k]])), to: ch });
          Object.assign(ex, ch);
        } else out.same++;
      }
      if (dept !== '-' && !s.depts.includes(dept)) s.depts.push(dept);
    }
    out.missing = s.employees.filter((e) => e.active !== false && !seen.has(U.normCode(e.code))).map((e) => e.code);
    return out;
  };

  const hydrate = (s, opt = {}) => {
    const off = s.fmt === 2;
    delete s.fmt;
    for (const P of Object.values(s.periods || {})) {
      if (P.mapping) P.mapping = P.mapping.map((r) => unpack(r, MAP_DEF, ['p'], off));
      if (P.calc) P.calc = P.calc.map((r) => unpack(r, CALC_DEF, ['notes'], off));
      P.stamps = P.stamps || {};
      P.transfers = P.transfers || [];
    }
    s.settings = Object.assign({}, PL.Seed.DEFAULT_SETTINGS, s.settings);
    ['employees', 'punches', 'imports', 'requests', 'log', 'shifts', 'leaveTypes', 'holidays', 'depts'].forEach((k) => (s[k] = s[k] || []));
    s.roster = s.roster || {};
    s.periods = s.periods || {};
    s.counters = s.counters || {};
    // ข้อมูลเงินเดือน: เพิ่มให้ข้อมูลเดิมที่สร้างก่อนมีโมดูลเงินเดือน
    const isDemo = !opt.noDemoPay && !s.pay && s.log.some((l) => l.action === 'สร้างข้อมูลตัวอย่าง');
    PL.Payroll.ensure(s);
    if (isDemo) PL.Seed.seedPay(s);
    return s;
  };

  const Store = (PL.Store = {
    s: null,
    bytes: 0,
    KEY,
    serialize,
    hydrate,
    split,
    join,
    syncEmployees,
    docClass,
    canRead,
    canWrite,
    backend: null, // null = localStorage, PL.Cloud = Supabase
    role: 'admin', // บทบาทผู้ใช้ปัจจุบัน (โหมดเครื่องเดียว = admin)
    get cloud() {
      return !!this.backend;
    },
    // สิทธิ์ใช้งานเมนู (ฝั่งหน้าจอ — ฝั่งเซิร์ฟเวอร์บังคับด้วย RLS อีกชั้น)
    can(what) {
      const r = this.role;
      if (what === 'pay') return ['admin', 'hr', 'accountant'].includes(r);
      if (what === 'admin') return r === 'admin';
      if (what === 'hr') return ['admin', 'hr'].includes(r);
      return true;
    },
    load() {
      let s = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) s = hydrate(JSON.parse(raw));
      } catch (e) {
        console.warn('โหลดข้อมูลไม่สำเร็จ', e);
      }
      if (!s || s.version !== 1) {
        this.s = PL.Seed.build();
        this.firstRun = true;
        this.save();
      } else this.s = s;
      return this.s;
    },
    save() {
      if (this.backend) return this.backend.queueSave();
      try {
        const txt = serialize(this.s);
        localStorage.setItem(KEY, txt);
        this.bytes = txt.length;
        return true;
      } catch (e) {
        console.error(e);
        PL.UI && PL.UI.toast('บันทึกข้อมูลไม่สำเร็จ: พื้นที่จัดเก็บของเบราว์เซอร์เต็ม — สำรองข้อมูลแล้วล้างรอบเก่าที่หน้า "ตั้งค่า > ข้อมูลระบบ"', 'bad', 8000);
        return false;
      }
    },
    replace(s) {
      this.s = hydrate(s);
      if (this.backend) this.backend.applyUser(this.s);
      this.save();
    },
    get pk() {
      return this.s.settings.period;
    },
    P(pk) {
      return E.P(this.s, pk || this.pk);
    },
    range(pk) {
      return E.range(this.s, pk || this.pk);
    },
    ix() {
      return E.idx(this.s);
    },
    emp(id) {
      return this.s.employees.find((e) => e.id === id);
    },
    touch(kind, dates) {
      E.touch(this.s, kind, dates);
    },
    isLocked(pk) {
      const P = this.s.periods[pk || this.pk];
      return !!(P && P.locked);
    },
    // ตรวจว่าวันที่ที่จะแก้ไขอยู่ในรอบที่ล็อกแล้วหรือไม่
    guard(dates) {
      const pks = [...new Set((dates || []).map((d) => E.periodOf(this.s, d)))];
      const lk = pks.filter((pk) => this.isLocked(pk));
      if (lk.length) {
        PL.UI.toast(`รอบ ${lk.map(U.fmtPeriodShort).join(', ')} ส่งข้อมูลให้ฝ่ายเงินเดือนแล้วและถูกล็อก — ปลดล็อกได้ที่หน้า "โอนผลบันทึกเวลา"`, 'warn', 5500);
        return false;
      }
      return true;
    },
    log(action, detail) {
      const entry = { at: U.nowISO(), by: this.s.user.name, action, detail: detail || '' };
      this.s.log.unshift(entry);
      if (this.s.log.length > 300) this.s.log.length = 300;
      if (this.backend) this.backend.logActivity(entry);
    },
    commit(action, detail) {
      if (action) this.log(action, detail);
      this.save();
      PL.App && PL.App.refreshChrome();
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);

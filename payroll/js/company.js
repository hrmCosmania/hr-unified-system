/* Payroll Full Loop — แยกตามบริษัท (CMN / CIL) ในระบบ HR รวมศูนย์
 * บริษัทที่ทำงานมาจาก /shared/company.js (window.HRUCompany — เลือกที่แอปหลักหรือหน้าต่างเลือกบริษัท)
 *
 * 1) กรองข้อมูล: ทุกตาราง (UI.DataTable), ตัวเลือกพนักงาน/แผนก, งวดเงินเดือน (Pay.status → run เฉพาะบริษัท
 *    พร้อมยอดรวมใหม่) และสรุปรายปี (Pay.yearSummary → ภ.ง.ด.1ก / 50 ทวิ) แสดงเฉพาะพนักงานของบริษัทที่เลือก
 *    พนักงานที่ยังไม่รู้บริษัท (เพิ่มเองในระบบเงินเดือน ไม่ได้มาจากระบบ HR) แสดงทุกบริษัท
 * 2) ข้อมูลบริษัทแยกกัน: ชื่อ/ที่อยู่ (s.company) และเลขผู้เสียภาษี/สาขา/ธนาคาร/เลขบัญชี (s.pay.settings)
 *    เก็บเป็นโปรไฟล์ต่อบริษัท แล้วสลับเข้าค่าปัจจุบันเมื่อเปลี่ยนบริษัท — หน้าตั้งค่า/รายงานเดิมใช้ได้ตามเดิม
 *      s.settings.companyActive               บริษัทที่ค่าปัจจุบันเป็นของ
 *      s.settings.companyProfiles[c]          { name, address }                     (เอกสาร config)
 *      s.pay.settings.companyProfiles[c]      { companyTaxId, companyBranch, ... }  (เอกสาร pay_config — เฉพาะสิทธิ์เงินเดือน)
 * 3) การคำนวณและปิดงวดเงินเดือนยังเป็นงวดเดียวรวมทุกบริษัท (ปิดงวด = ปิดทั้งสองบริษัท)
 */
(function (g) {
  'use strict';
  const PL = g.PL;
  const Pay = PL.Payroll, UI = PL.UI;
  const PAY_KEYS = ['companyTaxId', 'companyBranch', 'companyBank', 'companyAccount'];
  let bypass = 0;

  const Co = (PL.Co = {
    code() {
      if (bypass) return '';
      return (g.HRUCompany && g.HRUCompany.get()) || '';
    },
    /** เรียก fn โดยไม่กรองบริษัท (เช่น ตรวจความพร้อมก่อนปิดงวด ซึ่งปิดทั้งสองบริษัท) */
    all(fn) {
      bypass++;
      try { return fn(); } finally { bypass--; }
    },
    empOk(e) {
      const c = Co.code();
      return !c || !e || !e.company || e.company === c;
    },
    /** หาพนักงานของแถวข้อมูล (แถวพนักงานเอง, r.emp, r.e / r.eid = id, r.code = รหัสพนักงาน) */
    empOf(r, ix) {
      if (!r || typeof r !== 'object') return null;
      ix = ix || PL.Store.ix();
      if (r.emp && typeof r.emp === 'object') return r.emp;
      if (typeof r.emp === 'string') return Co.codeLookup(ix, r.emp);
      if (r.e && ix.emps[r.e]) return ix.emps[r.e];
      if (r.eid && ix.emps[r.eid]) return ix.emps[r.eid];
      if (r.id && ix.emps[r.id] === r) return r;
      if (r.code) return Co.codeLookup(ix, r.code);
      return null;
    },
    codeLookup(ix, code) {
      const id = ix.byCode && ix.byCode[PL.U.normCode(code)];
      return (id && ix.emps[id]) || null;
    },
    rowOk(r, ix) {
      return Co.empOk(Co.empOf(r, ix));
    },
    rows(rows) {
      if (!Co.code() || !rows) return rows;
      const ix = PL.Store.ix();
      return rows.filter((r) => Co.rowOk(r, ix));
    },
    employees() {
      return PL.Store.s.employees.filter(Co.empOk);
    },
    /** มุมมองงวดเงินเดือนเฉพาะบริษัท (สำเนา — การแก้ไขสถานะงวดต้องทำที่ s.pay.runs[pk]) */
    run(run) {
      if (!run || !Co.code()) return run;
      const rows = Co.rows(run.rows);
      return Object.assign({}, run, { rows, totals: Pay.totals(rows), companyView: Co.code() });
    },
    name() {
      const c = Co.code();
      return c ? 'บริษัท ' + c : 'ทุกบริษัท';
    },

    /* ---------- ข้อมูลบริษัทแยกกัน ---------- */
    snapshot(s) {
      const a = { name: s.company.name || '', address: s.company.address || '' };
      const b = {};
      PAY_KEYS.forEach((k) => (b[k] = (s.pay && s.pay.settings && s.pay.settings[k]) || ''));
      return [a, b];
    },
    activate(c) {
      const S = PL.Store, s = S.s;
      if (!c || !s) return false;
      s.settings.companyProfiles = s.settings.companyProfiles || {};
      const payOk = S.can('pay') && s.pay && s.pay.settings;
      if (payOk) s.pay.settings.companyProfiles = s.pay.settings.companyProfiles || {};
      const cur = s.settings.companyActive;
      if (cur === c) return false;
      const [info, pay] = Co.snapshot(s);
      if (cur) {
        s.settings.companyProfiles[cur] = info;
        if (payOk) s.pay.settings.companyProfiles[cur] = pay;
      } else {
        // ครั้งแรก: ข้อมูลบริษัทเดิมเป็นของบริษัทที่ชื่อระบุไว้ (ถ้าชื่อมีรหัสอีกบริษัท ให้เป็นของบริษัทนั้น)
        const other = (g.HRUCompany ? g.HRUCompany.list : []).map((x) => x.c).find((x) => x !== c && new RegExp(x, 'i').test(info.name) && !new RegExp(c, 'i').test(info.name));
        if (other) {
          s.settings.companyProfiles[other] = info;
          if (payOk) s.pay.settings.companyProfiles[other] = pay;
        } else {
          s.settings.companyProfiles[c] = info;
          if (payOk) s.pay.settings.companyProfiles[c] = pay;
        }
      }
      const pi = s.settings.companyProfiles[c] || { name: 'บริษัท ' + c, address: '' };
      s.company.name = pi.name;
      s.company.address = pi.address;
      if (payOk) {
        const pp = s.pay.settings.companyProfiles[c] || {};
        PAY_KEYS.forEach((k) => (s.pay.settings[k] = pp[k] || (k === 'companyBranch' ? '00000' : '')));
        Pay.touch(s);
      }
      s.settings.companyActive = c;
      S.touch('config');
      S.save();
      return true;
    },

    /** เริ่มหลังโหลดข้อมูลและล็อกอินแล้ว */
    init() {
      if (!g.HRUCompany) return;
      const box = document.getElementById('coChip');
      if (box) g.HRUCompany.mount(box);
      g.HRUCompany.ensure();
      if (Co.code()) Co.activate(Co.code());
      g.HRUCompany.onChange((c) => {
        Co.activate(c);
        UI.toast('เปลี่ยนเป็น ' + Co.name() + ' แล้ว — แสดงเฉพาะพนักงาน รายงาน และข้อมูลบริษัทของ ' + c, 'info', 4000);
        PL.App.rerender();
      });
    },
  });

  /* ---------- กรองแบบรวมศูนย์ ---------- */
  const status = Pay.status;
  Pay.status = (s, pk) => {
    const r = status(s, pk);
    return r.run && Co.code() ? Object.assign({}, r, { run: Co.run(r.run) }) : r;
  };
  const yearSummary = Pay.yearSummary;
  Pay.yearSummary = (s, year) => {
    const r = yearSummary(s, year);
    return Co.code() ? Object.assign({}, r, { rows: Co.rows(r.rows) }) : r;
  };
  const setRows = UI.DataTable.prototype.setRows;
  UI.DataTable.prototype.setRows = function (rows, keepPage) {
    return setRows.call(this, Co.rows(rows), keepPage);
  };
  const empOptions = UI.empOptions;
  UI.empOptions = function (selected, opt) {
    const s = PL.Store.s, all = s.employees;
    if (!Co.code()) return empOptions.call(UI, selected, opt);
    s.employees = all.filter((e) => Co.empOk(e) || e.id === selected);
    try { return empOptions.call(UI, selected, opt); } finally { s.employees = all; }
  };
  const deptOptions = UI.deptOptions;
  UI.deptOptions = function (selected, allLabel) {
    if (!Co.code()) return deptOptions.call(UI, selected, allLabel);
    const s = PL.Store.s, depts = [...new Set(Co.employees().map((e) => e.dept))];
    return `<option value="">${allLabel || 'ทุกแผนก'}</option>` + depts.map((d) => `<option ${d === selected ? 'selected' : ''}>${PL.U.esc(d)}</option>`).join('');
  };
})(typeof window !== 'undefined' ? window : globalThis);

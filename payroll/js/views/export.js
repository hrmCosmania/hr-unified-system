/* ขั้นตอนที่ 9: โอนผลบันทึกเวลาเพื่อคำนวณเงินเดือน (Export to Payroll) */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const st = { money: true, dept: '' };

  const payrollCols = (s) => [
    { label: 'รหัสพนักงาน', get: (r) => r.emp.code },
    { label: 'ชื่อ-สกุล', get: (r) => r.emp.name },
    { label: 'แผนก', get: (r) => r.emp.dept },
    { label: 'ประเภทการจ้าง', get: (r) => (r.emp.payType === 'D' ? 'รายวัน' : 'รายเดือน') },
    { label: 'อัตราเงินเดือน/ค่าจ้าง', get: (r) => r.emp.salary },
    { label: 'วันทำงานตามกะ', get: (r) => r.x.sched },
    { label: 'วันมาทำงาน', get: (r) => r.x.present },
    { label: 'ขาดงาน(วัน)', get: (r) => r.x.absent },
    { label: 'สาย(ครั้ง)', get: (r) => r.x.lateCnt },
    { label: 'สาย(นาที)', get: (r) => r.x.lateMin },
    { label: 'กลับก่อน(ครั้ง)', get: (r) => r.x.earlyCnt },
    { label: 'กลับก่อน(นาที)', get: (r) => r.x.earlyMin },
    ...s.leaveTypes.map((l) => ({ label: `${l.name}(วัน)`, get: (r) => r.x.leave[l.code] || 0 })),
    { label: 'วันหยุดนักขัตฤกษ์(วัน)', get: (r) => r.x.holidays },
    { label: 'OT 1 เท่า(ชม.)', get: (r) => U.r2(r.x.ot1 / 60) },
    { label: 'OT 1.5 เท่า(ชม.)', get: (r) => U.r2(r.x.ot15 / 60) },
    { label: 'OT 2 เท่า(ชม.)', get: (r) => U.r2(r.x.ot2 / 60) },
    { label: 'OT 3 เท่า(ชม.)', get: (r) => U.r2(r.x.ot3 / 60) },
    { label: 'บันทึกไม่สมบูรณ์(รายการ)', get: (r) => r.x.inc },
    { label: 'วันที่ได้รับค่าจ้าง (รายวัน)', get: (r) => (r.payDays == null ? '' : r.payDays) },
    { label: 'ค่าจ้างต่อชั่วโมง', get: (r) => r.hourly },
    { label: 'ค่าล่วงเวลา(ประมาณการ)', get: (r) => r.otPay },
    { label: 'หักขาดงาน', get: (r) => r.dAbsent },
    { label: 'หักลาไม่รับค่าจ้าง', get: (r) => r.dUnpaid },
    { label: 'หักมาสาย', get: (r) => r.dLate },
    { label: 'หักกลับก่อน', get: (r) => r.dEarly },
    { label: 'ฐานเงินเดือน/ค่าแรง(ประมาณการ)', get: (r) => r.base },
    { label: 'รวมก่อนหักภาษี/ประกันสังคม(ประมาณการ)', get: (r) => r.gross },
  ];

  PL.Views.export = {
    render(el) {
      const s = Store.s, pk = Store.pk;
      const v = E.validate(s, pk);
      const p = v.pipe, P = p.P;
      const rows = E.payroll(s, pk);
      const locked = p.locked;
      const tot = {
        emp: rows.length,
        ot: U.sum(rows, (r) => r.x.ot),
        otPay: U.sum(rows, (r) => r.otPay),
        deduct: U.sum(rows, (r) => r.deduct),
        gross: U.sum(rows, (r) => r.gross),
      };
      const check = (c) => {
        const cls = c.ok ? 'ok' : c.level;
        return `<div class="chk ${cls}"><span class="c-ic">${UI.icon(c.ok ? 'check' : c.level === 'error' ? 'x' : 'alert', 16)}</span>
          <div><div class="c-label">${esc(c.label)}</div><div class="c-detail">${esc(c.detail)}</div></div>
          ${!c.ok ? `<a class="c-link" href="#/${c.link}">แก้ไข ${UI.icon('arrowRight', 13)}</a>` : ''}</div>`;
      };
      const status = locked
        ? UI.banner('ok', `ส่งข้อมูลรอบ ${U.fmtPeriod(pk)} ให้ฝ่ายเงินเดือนแล้วเมื่อ ${U.fmtStamp(p.last && p.last.at)} โดย ${esc((p.last && p.last.by) || '')} — ข้อมูลรอบนี้ถูกล็อก`, `<a class="btn sm primary" href="#/payroll">${UI.icon('banknote', 15)} ไปคำนวณเงินเดือน</a><button class="btn sm" data-act="unlock">${UI.icon('unlock', 15)} ปลดล็อกรอบ</button>`)
        : v.errors
          ? UI.banner('bad', `ยังส่งไม่ได้ — มีรายการที่ต้องแก้ไข ${v.errors} ข้อ`)
          : v.warns
            ? UI.banner('warn', `ส่งได้ แต่มีข้อควรตรวจสอบ ${v.warns} ข้อ`)
            : UI.banner('ok', 'ผ่านการตรวจสอบครบทุกข้อ — พร้อมส่งข้อมูลเพื่อคำนวณเงินเดือน');

      el.innerHTML = `${UI.stepHeader(
        'export',
        `<button class="btn" data-act="csvDaily" ${rows.length ? '' : 'disabled'}>${UI.icon('download', 16)} รายละเอียดรายวัน</button>
         <button class="btn" data-act="csv" ${rows.length ? '' : 'disabled'}>${UI.icon('download', 16)} ไฟล์ Payroll (CSV)</button>
         <button class="btn primary" data-act="send" ${locked || v.errors ? 'disabled' : ''}>${UI.icon('send', 16)} ส่งข้อมูลไปยังฝ่ายเงินเดือน</button>`
      )}
      ${status}
      <div class="grid">
        <div class="card span-5"><div class="card-head"><h3>${UI.icon('checkCircle', 18)} ตรวจสอบความพร้อมก่อนส่ง</h3></div>
          <div class="checklist">${v.checks.map(check).join('')}</div></div>
        <div class="card span-7"><div class="card-head"><h3>${UI.icon('bars', 18)} สรุปข้อมูลที่จะส่ง · รอบ ${U.fmtPeriod(pk)}</h3></div>
          <div class="mini-stats" style="margin-bottom:10px">
            <div class="mini"><div class="m-label">พนักงาน</div><div class="m-val">${U.num(tot.emp)}</div><div class="m-sub">คน</div></div>
            <div class="mini m-purple"><div class="m-label">ชั่วโมง OT</div><div class="m-val">${U.hrs(tot.ot, 1)}</div><div class="m-sub">ชม.</div></div>
            <div class="mini"><div class="m-label">ค่าล่วงเวลา*</div><div class="m-val">${U.num(tot.otPay)}</div><div class="m-sub">บาท</div></div>
            <div class="mini m-bad"><div class="m-label">รายการหัก*</div><div class="m-val">${U.num(tot.deduct)}</div><div class="m-sub">ขาด/ลาไม่รับค่าจ้าง/สาย/กลับก่อน</div></div>
          </div>
          <p class="muted" style="font-size:12.5px;margin:0">* ประมาณการจากอัตราค่าจ้าง: รายเดือน = เงินเดือน ÷ ${s.settings.monthDivisor} ÷ ${s.settings.hoursPerDay} ชม., รายวัน = ค่าแรง ÷ ${s.settings.hoursPerDay} ชม. — ระบบเงินเดือนจะคำนวณยอดจริงรวมภาษีและประกันสังคม</p>
          ${P.transfers.length ? `<h4 style="margin:16px 0 8px;font-size:13.5px">ประวัติการส่ง</h4>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>เมื่อ</th><th>โดย</th><th class="r">พนักงาน</th><th class="r">OT (ชม.)</th><th class="r">ค่า OT*</th><th>ไฟล์</th></tr></thead><tbody>
          ${P.transfers.slice().reverse().map((t) => `<tr><td class="nowrap">${U.fmtStamp(t.at)}</td><td>${esc(t.by)}</td><td class="r">${t.rows}</td><td class="r">${U.num(t.otHours, 1)}</td><td class="r">${U.money(t.otPay)}</td><td class="mono">${esc(t.file)}</td></tr>`).join('')}
          </tbody></table></div>` : ''}
        </div>
      </div>
      <div class="card"><div class="card-head"><h3>${UI.icon('list', 18)} ข้อมูลส่งเงินเดือนรายพนักงาน</h3><span class="spacer"></span>
        <select class="input sm" data-dept>${UI.deptOptions(st.dept)}</select>
        <label class="check"><input type="checkbox" data-money ${st.money ? 'checked' : ''}> แสดงยอดเงินประมาณการ</label></div>
        ${rows.length ? '<div data-tbl></div>' : UI.empty('ยังไม่มีผลคำนวณ', '<a class="btn primary" href="#/calc">ไปคำนวณบันทึกเวลา</a>')}
      </div>
      ${UI.stepNav('export')}`;

      if (rows.length) {
        const h = (m) => (m ? U.hrs(m) : '<span class="muted">–</span>');
        const mny = (n, neg) => (n ? `<span style="${neg ? 'color:var(--bad)' : ''}">${neg ? '-' : ''}${U.money(n)}</span>` : '<span class="muted">–</span>');
        const cols = [
          { key: 'code', label: 'พนักงาน', sv: (r) => r.emp.code, render: (r) => UI.empCell(r.emp) },
          { key: 'dept', label: 'แผนก', sv: (r) => r.emp.dept, render: (r) => esc(r.emp.dept) },
          { key: 'pay', label: 'จ้าง', sv: (r) => r.emp.payType, render: (r) => UI.pill(r.emp.payType === 'D' ? 'รายวัน' : 'รายเดือน', r.emp.payType === 'D' ? 'info' : 'off') },
          { key: 'present', label: 'มาทำงาน', align: 'r', sv: (r) => r.x.present, render: (r) => U.num(r.x.present, r.x.present % 1 ? 1 : 0) },
          { key: 'absent', label: 'ขาด', align: 'r', sv: (r) => r.x.absent, render: (r) => (r.x.absent ? U.num(r.x.absent, 1) : '<span class="muted">–</span>') },
          { key: 'late', label: 'สาย (นาที)', align: 'r', sv: (r) => r.x.lateMin, render: (r) => r.x.lateMin || '<span class="muted">–</span>' },
          { key: 'leave', label: 'ลา (วัน)', align: 'r', sv: (r) => r.x.leaveDays, render: (r) => (r.x.leaveDays ? U.num(r.x.leaveDays, 1) + (r.unpaid ? ` <small class="muted">(ไม่รับ ${r.unpaid})</small>` : '') : '<span class="muted">–</span>') },
          { key: 'ot1', label: 'OT 1×', align: 'r', sv: (r) => r.x.ot1, render: (r) => h(r.x.ot1) },
          { key: 'ot15', label: 'OT 1.5×', align: 'r', sv: (r) => r.x.ot15, render: (r) => h(r.x.ot15) },
          { key: 'ot2', label: 'OT 2×', align: 'r', sv: (r) => r.x.ot2, render: (r) => h(r.x.ot2) },
          { key: 'ot3', label: 'OT 3×', align: 'r', sv: (r) => r.x.ot3, render: (r) => h(r.x.ot3) },
        ];
        const money = [
          { key: 'otPay', label: 'ค่า OT*', align: 'r', sv: (r) => r.otPay, render: (r) => mny(r.otPay) },
          { key: 'deduct', label: 'รายการหัก*', align: 'r', sv: (r) => r.deduct, render: (r) => mny(r.deduct, true) },
          { key: 'gross', label: 'รวมก่อนภาษี*', align: 'r', sv: (r) => r.gross, render: (r) => `<b>${U.money(r.gross)}</b>` },
        ];
        const t = new UI.DataTable({
          pageSize: 50,
          compact: true,
          columns: st.money ? cols.concat(money) : cols,
          onRow: (r) => UI.timecard(r.emp.id),
          footer: (rs) => `<tr><td colspan="3">รวม ${rs.length} คน</td><td class="r">${U.num(U.sum(rs, (r) => r.x.present), 1)}</td><td class="r">${U.num(U.sum(rs, (r) => r.x.absent), 1)}</td><td class="r">${U.num(U.sum(rs, (r) => r.x.lateMin))}</td><td class="r">${U.num(U.sum(rs, (r) => r.x.leaveDays), 1)}</td>
            ${['ot1', 'ot15', 'ot2', 'ot3'].map((k) => `<td class="r">${U.hrs(U.sum(rs, (r) => r.x[k]))}</td>`).join('')}
            ${st.money ? `<td class="r">${U.money(U.sum(rs, (r) => r.otPay))}</td><td class="r">-${U.money(U.sum(rs, (r) => r.deduct))}</td><td class="r">${U.money(U.sum(rs, (r) => r.gross))}</td>` : ''}</tr>`,
        });
        t.setRows(rows.filter((r) => !st.dept || r.emp.dept === st.dept));
        el.querySelector('[data-tbl]').appendChild(t.el);
      }
      el.querySelector('[data-dept]').addEventListener('change', (e) => ((st.dept = e.target.value), PL.App.rerender()));
      el.querySelector('[data-money]').addEventListener('change', (e) => ((st.money = e.target.checked), PL.App.rerender()));
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const a = b.dataset.act;
        if (a === 'csv') this.downloadPayroll();
        if (a === 'csvDaily') this.downloadDaily();
        if (a === 'send') this.send();
        if (a === 'unlock') this.unlock();
      });
    },
    fileName: (pk) => `payroll-input_${pk}.csv`,
    downloadPayroll() {
      const s = Store.s, pk = Store.pk;
      UI.exportCSV(this.fileName(pk), payrollCols(s), E.payroll(s, pk));
    },
    downloadDaily() {
      const s = Store.s, pk = Store.pk, ix = Store.ix(), P = Store.P();
      const e = (r) => ix.emps[r.e] || {};
      UI.exportCSV(`time-daily_${pk}.csv`, [
        { label: 'วันที่', get: (r) => r.d }, { label: 'รหัสพนักงาน', get: (r) => e(r).code }, { label: 'ชื่อ-สกุล', get: (r) => e(r).name },
        { label: 'ประเภทวัน', get: (r) => E.DAY_TYPE[r.type] }, { label: 'กะ', get: (r) => r.code },
        { label: 'เวลาเข้า', get: (r) => (r.in != null ? U.tstr(r.in) : '') }, { label: 'เวลาออก', get: (r) => (r.out != null ? U.tstr(r.out) : '') },
        { label: 'ชั่วโมงทำงาน', get: (r) => U.r2(r.work / 60) }, { label: 'สาย(นาที)', get: (r) => r.late }, { label: 'กลับก่อน(นาที)', get: (r) => r.early },
        { label: 'ขาด(วัน)', get: (r) => r.absent }, { label: 'ลา(วัน)', get: (r) => r.leave }, { label: 'ประเภทลา', get: (r) => r.lt },
        { label: 'OT1', get: (r) => U.r2(r.ot1 / 60) }, { label: 'OT1.5', get: (r) => U.r2(r.ot15 / 60) }, { label: 'OT2', get: (r) => U.r2(r.ot2 / 60) }, { label: 'OT3', get: (r) => U.r2(r.ot3 / 60) },
        { label: 'สถานะ', get: (r) => E.STATUS[r.st].label }, { label: 'หมายเหตุ', get: (r) => r.notes.join('; ') },
      ], PL.Co ? PL.Co.rows(P.calc || []) : P.calc || []);
    },
    async send() {
      const s = Store.s, pk = Store.pk;
      const v = E.validate(s, pk);
      if (v.errors) return UI.toast('ยังมีรายการที่ต้องแก้ไขก่อนส่ง', 'bad');
      const warns = v.checks.filter((c) => !c.ok);
      const rows = E.payroll(s, pk);
      const msg = `ส่งผลบันทึกเวลารอบ <b>${U.fmtPeriod(pk)}</b> ของพนักงาน <b>${rows.length}</b> คน ไปคำนวณเงินเดือน?
        ${warns.length ? `<div style="margin-top:10px;color:var(--warn)"><b>ข้อควรตรวจสอบ:</b><ul>${warns.map((c) => `<li>${esc(c.label)} — ${esc(c.detail)}</li>`).join('')}</ul></div>` : ''}
        <div class="muted" style="margin-top:10px">ระบบจะส่งผลไปที่ <b>คำนวณเงินเดือน</b> และ <b>ล็อกรอบนี้</b> ไม่ให้แก้ไขบันทึกเวลา ตารางกะ และคำขอ (ปลดล็อกได้ภายหลัง)</div>
        <label class="check" style="margin-top:10px"><input type="checkbox" id="dlPayrollCsv"> ดาวน์โหลดไฟล์ <code>${this.fileName(pk)}</code> สำหรับระบบเงินเดือนภายนอกด้วย</label>`;
      if (!(await UI.confirm(msg, { title: 'ส่งข้อมูลไปยังฝ่ายเงินเดือน', ok: 'ส่งข้อมูลและล็อกรอบ' }))) return;
      const dl = document.getElementById('dlPayrollCsv');
      const P = Store.P();
      if (dl && dl.checked) this.downloadPayroll();
      P.transfers.push({
        at: U.nowISO(), by: s.user.name, seq: P.calcSeq, rows: rows.length,
        otHours: U.r2(U.sum(rows, (r) => r.x.ot) / 60), otPay: U.r2(U.sum(rows, (r) => r.otPay)), deduct: U.r2(U.sum(rows, (r) => r.deduct)),
        file: this.fileName(pk), warnings: warns.length,
      });
      P.locked = true;
      Store.commit('ส่งข้อมูลให้ฝ่ายเงินเดือน', `รอบ ${U.fmtPeriodShort(pk)}: ${rows.length} คน`);
      UI.toast(`ส่งผลบันทึกเวลารอบ ${U.fmtPeriod(pk)} แล้ว — ต่อไป: คำนวณเงินเดือน`, 'ok', 5000);
      PL.App.go('payroll');
    },
    async unlock() {
      const run = Store.s.pay.runs[Store.pk];
      if (run && run.status === 'APPROVED') return UI.toast('เงินเดือนงวดนี้ปิดแล้ว — ยกเลิกการปิดงวดที่หน้า "คำนวณเงินเดือน" ก่อน จึงจะปลดล็อกบันทึกเวลาได้', 'warn', 6000);
      if (!(await UI.confirm('ปลดล็อกรอบนี้เพื่อแก้ไขข้อมูล?<br><span class="muted">ถ้ามีการแก้ไข ต้องคำนวณใหม่และส่งข้อมูลให้ฝ่ายเงินเดือนอีกครั้ง</span>', { ok: 'ปลดล็อก', danger: true }))) return;
      Store.P().locked = false;
      Store.commit('ปลดล็อกรอบ', U.fmtPeriodShort(Store.pk));
      UI.toast('ปลดล็อกรอบแล้ว', 'info');
      PL.App.rerender();
    },
  };
})(window);

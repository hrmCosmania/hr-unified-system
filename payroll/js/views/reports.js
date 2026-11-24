/* ขั้นตอนที่ 6–8: รายงานบันทึกเวลา / บันทึกเวลาไม่สมบูรณ์ / ขาด ลา มาสาย */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;

  // ส่วนหัวรายงาน: แจ้งเตือนถ้ายังไม่คำนวณ / ผลไม่เป็นปัจจุบัน
  const calcGate = (el, key, actions) => {
    const s = Store.s, pk = Store.pk, P = Store.P();
    if (!P.calc) {
      el.innerHTML = `${UI.stepHeader(key)}<div class="card">${UI.empty('ยังไม่มีผลคำนวณของรอบนี้ — รายงานจะแสดงหลังคำนวณบันทึกเวลา', '<a class="btn primary" href="#/calc">ไปขั้นตอนที่ 5 คำนวณบันทึกเวลา</a>')}</div>${UI.stepNav(key)}`;
      return null;
    }
    const stale = !Store.isLocked() && E.calcStale(s, pk);
    return {
      head: UI.stepHeader(key, actions) + (stale ? UI.banner('warn', `ผลคำนวณไม่เป็นปัจจุบัน (คำนวณเมื่อ ${U.fmtStamp(P.calcAt)}) — รายงานอาจไม่ตรงกับข้อมูลล่าสุด`, '<a class="btn sm primary" href="#/calc">คำนวณใหม่</a>') : ''),
      printHead: `<div class="print-only" style="margin-bottom:8px"><b>${esc(s.company.name)}</b> · รอบ ${U.fmtPeriod(pk)} · พิมพ์เมื่อ ${U.fmtStamp(U.nowISO())}</div>`,
    };
  };
  const ROW_STATUSES = ['NORMAL', 'LATE', 'EARLY', 'LATE_EARLY', 'ABSENT', 'INCOMPLETE', 'LEAVE', 'HALF_LEAVE', 'HOLIDAY_WORK', 'OFF', 'HOLIDAY', 'NO_SHIFT'];
  const ot = (r) => r.ot1 + r.ot15 + r.ot2 + r.ot3;

  /* ================= 6. รายงานบันทึกเวลา ================= */
  const s6 = { view: 'daily', dept: '', q: '', from: '', to: '', status: '', pk: '' };
  PL.Views.report = {
    render(el, params) {
      const s = Store.s, pk = Store.pk, ix = Store.ix(), R = Store.range();
      if (s6.pk !== pk) Object.assign(s6, { from: R.start, to: R.end, pk });
      if (params.view) s6.view = params.view;
      if (params.dept != null) s6.dept = params.dept;
      const g0 = calcGate(el, 'report', `<button class="btn" data-act="csv">${UI.icon('download', 16)} ส่งออก CSV</button><button class="btn" data-act="print">${UI.icon('printer', 16)} พิมพ์</button>`);
      if (!g0) return;
      const P = Store.P(), sm = E.summary(s, pk);
      const lt = ix.leaveTypes;
      const title = { daily: 'รายงานบันทึกเวลารายวัน', summary: 'รายงานสรุปเวลาการทำงานรายพนักงาน', ot: 'รายงาน OT และเวลาทำงานล่วงเวลา' }[s6.view];
      el.innerHTML = `${g0.head}
        <div class="card">${g0.printHead}
          <div class="toolbar">
            ${UI.seg('view', [{ key: 'daily', label: 'รายวัน' }, { key: 'summary', label: 'สรุปรายพนักงาน' }, { key: 'ot', label: 'OT' }], s6.view)}
            <select class="input sm" data-k="dept">${UI.deptOptions(s6.dept)}</select>
            <input class="input sm search-in" data-k="q" placeholder="ค้นหาพนักงาน" value="${esc(s6.q)}">
            ${s6.view !== 'summary' ? `<input class="input sm" type="date" data-k="from" value="${s6.from}" min="${R.start}" max="${R.end}"> – <input class="input sm" type="date" data-k="to" value="${s6.to}" min="${R.start}" max="${R.end}">` : ''}
            ${s6.view === 'daily' ? `<select class="input sm" data-k="status"><option value="">ทุกสถานะ</option>${ROW_STATUSES.map((k) => `<option value="${k}" ${s6.status === k ? 'selected' : ''}>${E.STATUS[k].label}</option>`).join('')}</select>` : ''}
          </div>
          <h3 class="print-only" style="margin-bottom:6px">${title}</h3>
          <div data-tbl></div></div>${UI.stepNav('report')}`;

      let cols, csvCols, rows;
      const E_ = (r) => ix.emps[r.e] || {};
      if (s6.view === 'summary') {
        rows = s.employees.filter((e) => sm.emps[e.id]).map((e) => ({ emp: e, x: sm.emps[e.id] }));
        cols = [
          { key: 'code', label: 'พนักงาน', sv: (r) => r.emp.code, render: (r) => UI.empCell(r.emp) },
          { key: 'dept', label: 'แผนก', sv: (r) => r.emp.dept, render: (r) => esc(r.emp.dept) },
          { key: 'sched', label: 'วันตามกะ', align: 'r', sv: (r) => r.x.sched, render: (r) => r.x.sched },
          { key: 'present', label: 'มาทำงาน', align: 'r', sv: (r) => r.x.present, render: (r) => U.num(r.x.present, 1) },
          { key: 'work', label: 'ชม.ทำงาน', align: 'r', sv: (r) => r.x.work, render: (r) => U.hrs(r.x.work) },
          { key: 'absent', label: 'ขาด', align: 'r', sv: (r) => r.x.absent, render: (r) => U.num(r.x.absent, 1) },
          { key: 'late', label: 'สาย ครั้ง/นาที', align: 'r', sv: (r) => r.x.lateMin, render: (r) => `${r.x.lateCnt} / ${r.x.lateMin}` },
          { key: 'early', label: 'กลับก่อน ครั้ง/นาที', align: 'r', sv: (r) => r.x.earlyMin, render: (r) => `${r.x.earlyCnt} / ${r.x.earlyMin}` },
          { key: 'leave', label: 'ลา (วัน)', align: 'r', sv: (r) => r.x.leaveDays, render: (r) => U.num(r.x.leaveDays, 1) },
          { key: 'ot', label: 'OT รวม (ชม.)', align: 'r', sv: (r) => r.x.ot, render: (r) => U.hrs(r.x.ot) },
          { key: 'inc', label: 'ไม่สมบูรณ์', align: 'r', sv: (r) => r.x.inc, render: (r) => r.x.inc || '' },
        ];
        csvCols = [
          { label: 'รหัสพนักงาน', get: (r) => r.emp.code }, { label: 'ชื่อ-สกุล', get: (r) => r.emp.name }, { label: 'แผนก', get: (r) => r.emp.dept },
          { label: 'วันทำงานตามกะ', get: (r) => r.x.sched }, { label: 'วันมาทำงาน', get: (r) => r.x.present }, { label: 'ชั่วโมงทำงาน', get: (r) => U.r2(r.x.work / 60) },
          { label: 'ขาดงาน(วัน)', get: (r) => r.x.absent }, { label: 'สาย(ครั้ง)', get: (r) => r.x.lateCnt }, { label: 'สาย(นาที)', get: (r) => r.x.lateMin },
          { label: 'กลับก่อน(ครั้ง)', get: (r) => r.x.earlyCnt }, { label: 'กลับก่อน(นาที)', get: (r) => r.x.earlyMin }, { label: 'ลา(วัน)', get: (r) => r.x.leaveDays },
          { label: 'OT 1x(ชม.)', get: (r) => U.r2(r.x.ot1 / 60) }, { label: 'OT 1.5x(ชม.)', get: (r) => U.r2(r.x.ot15 / 60) }, { label: 'OT 2x(ชม.)', get: (r) => U.r2(r.x.ot2 / 60) }, { label: 'OT 3x(ชม.)', get: (r) => U.r2(r.x.ot3 / 60) },
          { label: 'ไม่สมบูรณ์(รายการ)', get: (r) => r.x.inc },
        ];
      } else {
        rows = P.calc.filter((r) => r.d >= s6.from && r.d <= s6.to && (s6.view !== 'ot' || ot(r) > 0));
        const base = [
          { key: 'd', label: 'วันที่', render: (r) => `<span class="nowrap">${U.fmtDay(r.d)}</span>` },
          { key: 'e', label: 'พนักงาน', sv: (r) => E_(r).code, render: (r) => `<div class="emp-name">${esc(E_(r).name)}</div><div class="emp-code">${esc(E_(r).code)}</div>` },
          { key: 'dept', label: 'แผนก', sv: (r) => E_(r).dept, render: (r) => esc(E_(r).dept) },
          { key: 'code', label: 'กะ', render: (r) => UI.shiftChip(r.code, ix) },
          { key: 'in', label: 'เข้า', render: (r) => (r.in != null ? `<span class="mono">${U.clock(r.in)}</span>` : r.inc === 'IN' ? '<span class="miss">--:--</span>' : '') },
          { key: 'out', label: 'ออก', render: (r) => (r.out != null ? `<span class="mono">${U.clock(r.out)}</span>` : r.inc === 'OUT' ? '<span class="miss">--:--</span>' : '') },
        ];
        const csvBase = [
          { label: 'วันที่', get: (r) => r.d }, { label: 'รหัสพนักงาน', get: (r) => E_(r).code }, { label: 'ชื่อ-สกุล', get: (r) => E_(r).name }, { label: 'แผนก', get: (r) => E_(r).dept },
          { label: 'กะ', get: (r) => r.code }, { label: 'เวลาเข้า', get: (r) => (r.in != null ? U.tstr(r.in) : '') }, { label: 'เวลาออก', get: (r) => (r.out != null ? U.tstr(r.out) : '') },
        ];
        if (s6.view === 'ot') {
          cols = base.concat([
            { key: 'type', label: 'ประเภทวัน', render: (r) => UI.pill(E.DAY_TYPE[r.type], r.type === 'WORK' ? 'off' : 'purple') },
            ...['ot1', 'ot15', 'ot2', 'ot3'].map((k, i) => ({ key: k, label: `OT ${['1', '1.5', '2', '3'][i]}×`, align: 'r', render: (r) => (r[k] ? U.dur(r[k]) : '') })),
            { key: 'ot', label: 'รวม (ชม.)', align: 'r', sv: ot, render: (r) => `<b>${U.hrs(ot(r))}</b>` },
            { key: 'notes', label: 'หมายเหตุ', sort: false, render: (r) => `<span class="notes">${r.notes.map(esc).join('<br>')}</span>` },
          ]);
          csvCols = csvBase.concat([
            { label: 'ประเภทวัน', get: (r) => E.DAY_TYPE[r.type] },
            ...['ot1', 'ot15', 'ot2', 'ot3'].map((k, i) => ({ label: `OT ${['1', '1.5', '2', '3'][i]}x(ชม.)`, get: (r) => U.r2(r[k] / 60) })),
            { label: 'รวม OT(ชม.)', get: (r) => U.r2(ot(r) / 60) },
          ]);
        } else {
          if (s6.status) rows = rows.filter((r) => r.st === s6.status);
          cols = base.concat([
            { key: 'work', label: 'ชม.ทำงาน', align: 'r', render: (r) => U.dur(r.work) },
            { key: 'late', label: 'สาย', align: 'r', render: (r) => r.late || '' },
            { key: 'early', label: 'กลับก่อน', align: 'r', render: (r) => r.early || '' },
            { key: 'ot', label: 'OT', align: 'r', sv: ot, render: (r) => U.dur(ot(r)) },
            { key: 'leave', label: 'ลา', render: (r) => (r.leave ? esc((lt[r.lt] || {}).name || r.lt) + (r.leave < 1 ? ' ½' : '') : '') },
            { key: 'st', label: 'สถานะ', render: (r) => UI.status(r.st) },
            { key: 'notes', label: 'หมายเหตุ', sort: false, render: (r) => `<span class="notes">${r.notes.map(esc).join('<br>')}</span>` },
          ]);
          csvCols = csvBase.concat([
            { label: 'ชั่วโมงทำงาน', get: (r) => U.r2(r.work / 60) }, { label: 'สาย(นาที)', get: (r) => r.late }, { label: 'กลับก่อน(นาที)', get: (r) => r.early },
            { label: 'OT รวม(ชม.)', get: (r) => U.r2(ot(r) / 60) }, { label: 'ลา', get: (r) => (r.leave ? `${(lt[r.lt] || {}).name || r.lt} ${r.leave}` : '') },
            { label: 'ขาด(วัน)', get: (r) => r.absent }, { label: 'สถานะ', get: (r) => E.STATUS[r.st].label }, { label: 'หมายเหตุ', get: (r) => r.notes.join('; ') },
          ]);
        }
      }
      const q = s6.q.toLowerCase();
      const empOf = (r) => r.emp || ix.emps[r.e] || {};
      rows = rows.filter((r) => {
        const e = empOf(r);
        if (s6.dept && e.dept !== s6.dept) return false;
        if (q && !`${e.code} ${e.name}`.toLowerCase().includes(q)) return false;
        return true;
      });
      const t = new UI.DataTable({ pageSize: 50, compact: true, columns: cols, sortKey: s6.view === 'summary' ? 'code' : 'd', onRow: (r) => UI.timecard(empOf(r).id), rowClass: (r) => (r.type && r.type !== 'WORK' && r.st !== 'HOLIDAY_WORK' ? 'row-off' : '') });
      t.setRows(rows);
      el.querySelector('[data-tbl]').appendChild(t.el);

      el.querySelector('[data-seg="view"]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (b) PL.App.go('report', { view: b.dataset.v });
      });
      el.querySelectorAll('[data-k]').forEach((inp) =>
        inp.addEventListener(inp.dataset.k === 'q' ? 'input' : 'change', U.debounce(() => {
          s6[inp.dataset.k] = inp.value.trim();
          PL.App.rerender();
          if (inp.dataset.k === 'q') {
            const i = document.querySelector('[data-k="q"]');
            i.focus();
            i.setSelectionRange(i.value.length, i.value.length);
          }
        }, inp.dataset.k === 'q' ? 350 : 0))
      );
      el.querySelector('[data-act="csv"]').addEventListener('click', () => UI.exportCSV(`time-report-${s6.view}_${pk}.csv`, csvCols, t._rows));
      el.querySelector('[data-act="print"]').addEventListener('click', () => {
        t.o.pageSize = 100000;
        t.render();
        window.print();
        t.o.pageSize = 50;
        t.render();
      });
    },
  };

  /* ================= 7. รายงานบันทึกเวลาไม่สมบูรณ์ ================= */
  const s7 = { dept: '', q: '', side: '' };
  PL.Views.incomplete = {
    render(el) {
      const s = Store.s, pk = Store.pk, ix = Store.ix();
      const g0 = calcGate(el, 'incomplete', `<button class="btn" data-act="csv">${UI.icon('download', 16)} ส่งออก CSV</button><button class="btn" data-act="print">${UI.icon('printer', 16)} พิมพ์</button>`);
      if (!g0) return;
      const P = Store.P(), locked = Store.isLocked();
      // คำขอแก้ไขเวลาที่รออนุมัติ หรืออนุมัติแล้วแต่ยังไม่ได้คำนวณใหม่
      const pendAdj = {};
      const doneAdj = {};
      const calcAdj = {};
      Store.P().calc.forEach((r) => r.adj && (calcAdj[r.e + '|' + r.d] = r.adj));
      s.requests.forEach((r) => {
        if (r.kind !== 'ADJ') return;
        const k = r.e + '|' + r.date;
        if (r.status === 'PENDING') pendAdj[k] = r;
        else if (r.status === 'APPROVED' && calcAdj[k] !== r.id && (r.adjIn || r.adjOut)) doneAdj[k] = r;
      });
      const all = P.calc.filter((r) => r.inc);
      const ms = P.mapStats || {};
      const byDept = {};
      all.forEach((r) => {
        const d = (ix.emps[r.e] || {}).dept || '-';
        byDept[d] = (byDept[d] || 0) + 1;
      });
      const emps = new Set(all.map((r) => r.e)).size;
      const withReq = all.filter((r) => pendAdj[r.e + '|' + r.d]).length;

      el.innerHTML = `${g0.head}
        ${all.length ? UI.banner('warn', `พบบันทึกเวลาไม่ครบขาเข้า-ขาออก <b>${all.length}</b> รายการ (${emps} คน) — วันเหล่านี้ยังคำนวณชั่วโมงทำงาน/OT ไม่ได้ ควรสร้าง <b>คำขอแก้ไขเวลา</b> แล้วอนุมัติก่อนส่งเงินเดือน`) : UI.banner('ok', 'บันทึกเวลาครบขาเข้า-ขาออกทุกรายการ 🎉')}
        ${ms.orphanCount ? UI.banner('info', `มีเวลาสแกน ${ms.orphanCount} ครั้งที่ไม่อยู่ในช่วงกะใด — ดูได้ที่ <a href="#/mapping">ขั้นตอนที่ 3</a>`) : ''}
        <div class="mini-stats">
          <div class="mini m-orange"><div class="m-label">รายการไม่สมบูรณ์</div><div class="m-val">${all.length}</div></div>
          <div class="mini"><div class="m-label">พนักงาน</div><div class="m-val">${emps} คน</div></div>
          <div class="mini m-orange"><div class="m-label">ไม่มีขาเข้า</div><div class="m-val">${all.filter((r) => r.inc === 'IN').length}</div></div>
          <div class="mini m-orange"><div class="m-label">ไม่มีขาออก</div><div class="m-val">${all.filter((r) => r.inc === 'OUT').length}</div></div>
          <div class="mini m-warn"><div class="m-label">มีคำขอแก้ไขรออนุมัติ</div><div class="m-val">${withReq}</div><div class="m-sub">${withReq ? '<a href="#/requests?kind=ADJ">ไปอนุมัติ →</a>' : ''}</div></div>
        </div>
        <div class="grid">
          <div class="card span-12">${g0.printHead}
            <div class="toolbar">
              <select class="input sm" data-dept>${UI.deptOptions(s7.dept)}</select>
              <input class="input sm search-in" data-q placeholder="ค้นหาพนักงาน" value="${esc(s7.q)}">
              ${UI.seg('side', [{ key: '', label: 'ทั้งหมด' }, { key: 'IN', label: 'ไม่มีขาเข้า' }, { key: 'OUT', label: 'ไม่มีขาออก' }], s7.side)}
              <span class="spacer"></span>
              ${locked ? '' : `<button class="btn sm primary" data-act="bulk" disabled>${UI.icon('edit', 15)} สร้างคำขอแก้ไขตามเวลากะ</button>`}
            </div>
            <h3 class="print-only">รายงานบันทึกเวลาไม่สมบูรณ์</h3>
            <div data-tbl></div></div>
          <div class="card span-6 no-print"><div class="card-head"><h3>${UI.icon('bars', 18)} แยกตามแผนก</h3></div>
            ${UI.hbars(Object.entries(byDept).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: '#f97316' })), { fmt: (v) => `${v} รายการ` })}</div>
        </div>${UI.stepNav('incomplete')}`;

      const t = new UI.DataTable({
        pageSize: 50,
        compact: true,
        selectable: !locked,
        rowKey: (r) => r.e + '|' + r.d,
        canSelect: (r) => !pendAdj[r.e + '|' + r.d] && !doneAdj[r.e + '|' + r.d],
        sortKey: 'd',
        onSelect: (sel) => {
          const b = el.querySelector('[data-act="bulk"]');
          if (b) {
            b.disabled = !sel.length;
            b.innerHTML = `${UI.icon('edit', 15)} สร้างคำขอแก้ไขตามเวลากะ${sel.length ? ` (${sel.length})` : ''}`;
          }
        },
        columns: [
          { key: 'd', label: 'วันที่', render: (r) => `<span class="nowrap">${U.fmtDay(r.d)}</span>` },
          { key: 'e', label: 'พนักงาน', sv: (r) => (ix.emps[r.e] || {}).code, render: (r) => UI.empCell(ix.emps[r.e]) },
          { key: 'dept', label: 'แผนก', sv: (r) => (ix.emps[r.e] || {}).dept, render: (r) => esc((ix.emps[r.e] || {}).dept) },
          { key: 'code', label: 'กะ', render: (r) => `<span class="nowrap">${UI.shiftChip(r.code, ix)} <span class="mono muted">${U.clock(r.ps)}–${U.clock(r.pe)}</span></span>` },
          { key: 'in', label: 'เข้า', render: (r) => (r.in != null ? `<b class="mono">${U.clock(r.in)}</b>` : '<span class="miss">--:--</span>') },
          { key: 'out', label: 'ออก', render: (r) => (r.out != null ? `<b class="mono">${U.clock(r.out)}</b>` : '<span class="miss">--:--</span>') },
          { key: 'inc', label: 'ขาดส่วน', render: (r) => UI.pill(r.inc === 'IN' ? 'ไม่มีขาเข้า' : 'ไม่มีขาออก', 'orange') },
          { key: 'req', label: 'คำขอแก้ไข', sort: false, render: (r) => {
            const k = r.e + '|' + r.d, q = pendAdj[k], dn = doneAdj[k];
            if (q) return `${UI.pill('รออนุมัติ', 'warn')} <span class="mono muted">${esc(q.id)}</span>`;
            if (dn) return `${UI.pill('อนุมัติแล้ว · รอคำนวณใหม่', 'ok')} <span class="mono muted">${esc(dn.id)}</span>`;
            return '<span class="muted">–</span>';
          } },
          { key: '_', label: '', sort: false, align: 'r', render: (r) => {
            const k = r.e + '|' + r.d;
            if (locked) return '';
            if (pendAdj[k]) return `<a class="btn xs" href="#/requests?kind=ADJ">ไปอนุมัติ</a>`;
            if (doneAdj[k]) return `<a class="btn xs" href="#/calc">คำนวณใหม่</a>`;
            return `<button class="btn xs primary" data-act="fix">${UI.icon('edit', 13)} แก้ไขเวลา</button>`;
          } },
        ],
        onAction: (a, r) => {
          if (a === 'fix') PL.Forms.request('ADJ', { e: r.e, date: r.d });
        },
      });
      el.querySelector('[data-tbl]').appendChild(t.el);
      const apply = () => {
        const q = s7.q.toLowerCase();
        t.setRows(all.filter((r) => {
          const e = ix.emps[r.e] || {};
          if (s7.dept && e.dept !== s7.dept) return false;
          if (s7.side && r.inc !== s7.side) return false;
          if (q && !`${e.code} ${e.name}`.toLowerCase().includes(q)) return false;
          return true;
        }));
        t.o.onSelect(t.selected());
      };
      apply();
      el.querySelector('[data-dept]').addEventListener('change', (e) => ((s7.dept = e.target.value), apply()));
      el.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((s7.q = e.target.value.trim()), apply()), 150));
      el.querySelector('[data-seg="side"]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (!b) return;
        s7.side = b.dataset.v;
        el.querySelectorAll('[data-seg="side"] button').forEach((x) => x.classList.toggle('active', x === b));
        apply();
      });
      const csv = [
        { label: 'วันที่', get: (r) => r.d }, { label: 'รหัสพนักงาน', get: (r) => (ix.emps[r.e] || {}).code }, { label: 'ชื่อ-สกุล', get: (r) => (ix.emps[r.e] || {}).name },
        { label: 'แผนก', get: (r) => (ix.emps[r.e] || {}).dept }, { label: 'กะ', get: (r) => r.code }, { label: 'เวลาเข้า', get: (r) => (r.in != null ? U.tstr(r.in) : '') },
        { label: 'เวลาออก', get: (r) => (r.out != null ? U.tstr(r.out) : '') }, { label: 'ขาดส่วน', get: (r) => (r.inc === 'IN' ? 'ไม่มีขาเข้า' : 'ไม่มีขาออก') },
        { label: 'คำขอแก้ไขที่รออนุมัติ', get: (r) => (pendAdj[r.e + '|' + r.d] || {}).id || '' },
      ];
      el.querySelector('[data-act="csv"]').addEventListener('click', () => UI.exportCSV(`incomplete-time_${pk}.csv`, csv, t._rows));
      el.querySelector('[data-act="print"]').addEventListener('click', () => {
        t.o.pageSize = 100000;
        t.render();
        window.print();
        t.o.pageSize = 50;
        t.render();
      });
      const bulk = el.querySelector('[data-act="bulk"]');
      if (bulk) bulk.addEventListener('click', () => this.bulk(t.selected()));
    },
    bulk(list) {
      if (!list.length) return;
      const s = Store.s, ix = Store.ix();
      const m = UI.modal({
        title: 'สร้างคำขอแก้ไขเวลาตามเวลากะ',
        size: 'sm',
        body: `<div class="confirm-msg">สร้างคำขอแก้ไขเวลา <b>${list.length}</b> รายการ โดยใช้ <b>เวลาเข้า/ออกตามกะ</b> แทนส่วนที่ขาด
          <div style="margin-top:12px" class="stack">
            <label class="field"><span class="lbl">เหตุผล</span><input class="input" name="reason" value="ลืมสแกนนิ้ว (HR บันทึกตามเวลากะ)"></label>
            <label class="check"><input type="checkbox" name="approveNow"> อนุมัติทันที</label></div></div>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>สร้างคำขอ</button>`,
      });
      m.$('[data-ok]').addEventListener('click', () => {
        const f = UI.formData(m.el);
        const dates = list.map((r) => r.d);
        if (!Store.guard(dates)) return;
        const now = U.nowISO();
        list.forEach((r) => {
          s.requests.push({
            id: E.nextId(s, 'ADJ'), kind: 'ADJ', e: r.e, date: r.d,
            adjIn: r.inc === 'IN' ? U.tstr(r.ps) : '', adjOut: r.inc === 'OUT' ? U.tstr(r.pe) : '',
            reason: f.reason, createdAt: now, createdBy: s.user.name,
            status: f.approveNow ? 'APPROVED' : 'PENDING', decidedAt: f.approveNow ? now : null, decidedBy: f.approveNow ? s.user.name : null,
          });
        });
        Store.touch('requests', dates);
        Store.commit('สร้างคำขอแก้ไขเวลาแบบกลุ่ม', `${list.length} รายการ`);
        m.close();
        UI.toast(`สร้างคำขอแก้ไขเวลา ${list.length} รายการ${f.approveNow ? ' และอนุมัติแล้ว — กดคำนวณใหม่เพื่ออัปเดต' : ' (รออนุมัติ)'}`, 'ok', 5000);
        PL.App.rerender();
      });
    },
  };

  /* ================= 8. รายงานขาด ลา มาสาย ================= */
  const s8 = { tab: 'summary', dept: '', q: '', type: '', any: true };
  PL.Views.absence = {
    render(el) {
      const s = Store.s, pk = Store.pk, ix = Store.ix();
      const g0 = calcGate(el, 'absence', `<button class="btn" data-act="csv">${UI.icon('download', 16)} ส่งออก CSV</button><button class="btn" data-act="print">${UI.icon('printer', 16)} พิมพ์</button>`);
      if (!g0) return;
      const P = Store.P(), sm = E.summary(s, pk), T = sm.T;
      const LT = s.leaveTypes;
      // Top สาย และสรุปตามแผนก
      const top = s.employees.filter((e) => sm.emps[e.id] && sm.emps[e.id].lateCnt).map((e) => ({ e, x: sm.emps[e.id] })).sort((a, b) => b.x.lateMin - a.x.lateMin).slice(0, 10);
      const depts = {};
      s.employees.forEach((e) => {
        const x = sm.emps[e.id];
        if (!x) return;
        const d = (depts[e.dept] = depts[e.dept] || { n: 0, late: 0, absent: 0, leave: 0 });
        d.n++;
        d.late += x.lateCnt;
        d.absent += x.absent;
        d.leave += x.leaveDays;
      });

      el.innerHTML = `${g0.head}
        <div class="mini-stats">
          <div class="mini m-bad"><div class="m-label">${UI.icon('xCircle', 14)} ขาดงาน</div><div class="m-val">${U.num(T.absent, 1)} วัน</div><div class="m-sub">${T.absentEmp} คน</div></div>
          <div class="mini m-warn"><div class="m-label">${UI.icon('clock', 14)} มาสาย</div><div class="m-val">${U.num(T.lateCnt)} ครั้ง</div><div class="m-sub">${U.num(T.lateMin)} นาที · ${T.lateEmp} คน</div></div>
          <div class="mini m-warn"><div class="m-label">${UI.icon('logout', 14)} กลับก่อน</div><div class="m-val">${U.num(T.earlyCnt)} ครั้ง</div><div class="m-sub">${U.num(T.earlyMin)} นาที</div></div>
          ${LT.map((l) => `<div class="mini"><div class="m-label">${esc(l.name)}</div><div class="m-val">${U.num(T.leave[l.code] || 0, 1)}</div><div class="m-sub">วัน</div></div>`).join('')}
        </div>
        ${UI.tabs([{ key: 'summary', label: 'สรุปรายพนักงาน', icon: 'users' }, { key: 'detail', label: 'รายละเอียดรายวัน', icon: 'list' }, { key: 'chart', label: 'วิเคราะห์', icon: 'bars' }], s8.tab)}
        <div data-body></div>${UI.stepNav('absence')}`;
      const body = el.querySelector('[data-body]');
      let table, csvCols;

      if (s8.tab === 'chart') {
        body.innerHTML = `<div class="grid"><div class="card span-6"><div class="card-head"><h3>${UI.icon('clock', 18)} มาสายมากที่สุด 10 อันดับ (นาที)</h3></div>
          ${UI.hbars(top.map((r) => ({ label: r.e.name, value: r.x.lateMin, sub: `${r.x.lateCnt} ครั้ง`, color: '#f59e0b' })), { fmt: (v) => U.num(v) })}</div>
          <div class="card span-6"><div class="card-head"><h3>${UI.icon('users', 18)} สรุปตามแผนก</h3></div>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>แผนก</th><th class="r">คน</th><th class="r">สาย (ครั้ง)</th><th class="r">ขาด (วัน)</th><th class="r">ลา (วัน)</th><th class="r">สาย/คน</th></tr></thead><tbody>
          ${Object.entries(depts).sort((a, b) => b[1].late / b[1].n - a[1].late / a[1].n).map(([d, x]) => `<tr><td>${esc(d)}</td><td class="r">${x.n}</td><td class="r">${x.late}</td><td class="r">${U.num(x.absent, 1)}</td><td class="r">${U.num(x.leave, 1)}</td><td class="r"><b>${U.num(x.late / x.n, 1)}</b></td></tr>`).join('')}
          </tbody></table></div></div></div>`;
      } else {
        body.innerHTML = `<div class="card">${g0.printHead}<div class="toolbar">
            <select class="input sm" data-dept>${UI.deptOptions(s8.dept)}</select>
            <input class="input sm search-in" data-q placeholder="ค้นหาพนักงาน" value="${esc(s8.q)}">
            ${s8.tab === 'detail' ? `<select class="input sm" data-type><option value="">ทุกประเภท</option><option value="ABSENT" ${s8.type === 'ABSENT' ? 'selected' : ''}>ขาดงาน</option><option value="LATE" ${s8.type === 'LATE' ? 'selected' : ''}>มาสาย</option><option value="EARLY" ${s8.type === 'EARLY' ? 'selected' : ''}>กลับก่อน</option><option value="LEAVE" ${s8.type === 'LEAVE' ? 'selected' : ''}>ลา</option></select>` : `<label class="check"><input type="checkbox" data-any ${s8.any ? 'checked' : ''}> เฉพาะคนที่มีขาด/ลา/สาย</label>`}
          </div><h3 class="print-only">รายงานขาด ลา มาสาย</h3><div data-tbl></div></div>`;
        const q = s8.q.toLowerCase();
        const okEmp = (e) => e && (!s8.dept || e.dept === s8.dept) && (!q || `${e.code} ${e.name}`.toLowerCase().includes(q));
        if (s8.tab === 'summary') {
          const rows = s.employees.filter((e) => sm.emps[e.id] && okEmp(e)).map((e) => ({ emp: e, x: sm.emps[e.id] })).filter((r) => !s8.any || r.x.absent || r.x.lateCnt || r.x.earlyCnt || r.x.leaveDays);
          const z = (v, dp = 0) => (v ? U.num(v, dp && v % 1 ? 1 : 0) : '<span class="muted">–</span>');
          table = new UI.DataTable({
            pageSize: 50,
            compact: true,
            sortKey: 'lateMin',
            sortDir: -1,
            onRow: (r) => UI.timecard(r.emp.id),
            columns: [
              { key: 'code', label: 'พนักงาน', sv: (r) => r.emp.code, render: (r) => UI.empCell(r.emp) },
              { key: 'dept', label: 'แผนก', sv: (r) => r.emp.dept, render: (r) => esc(r.emp.dept) },
              { key: 'lateCnt', label: 'สาย (ครั้ง)', align: 'r', sv: (r) => r.x.lateCnt, render: (r) => z(r.x.lateCnt) },
              { key: 'lateMin', label: 'สาย (นาที)', align: 'r', sv: (r) => r.x.lateMin, render: (r) => z(r.x.lateMin) },
              { key: 'earlyCnt', label: 'กลับก่อน (ครั้ง)', align: 'r', sv: (r) => r.x.earlyCnt, render: (r) => z(r.x.earlyCnt) },
              { key: 'earlyMin', label: 'กลับก่อน (นาที)', align: 'r', sv: (r) => r.x.earlyMin, render: (r) => z(r.x.earlyMin) },
              { key: 'absent', label: 'ขาด (วัน)', align: 'r', sv: (r) => r.x.absent, render: (r) => (r.x.absent ? `<b style="color:var(--bad)">${U.num(r.x.absent, r.x.absent % 1 ? 1 : 0)}</b>` : z(0)) },
              ...LT.map((l) => ({ key: 'lv_' + l.code, label: esc(l.name), align: 'r', sv: (r) => r.x.leave[l.code] || 0, render: (r) => z(r.x.leave[l.code], 1) })),
              { key: 'leaveDays', label: 'รวมลา', align: 'r', sv: (r) => r.x.leaveDays, render: (r) => z(r.x.leaveDays, 1) },
            ],
          });
          table.setRows(rows);
          csvCols = [
            { label: 'รหัสพนักงาน', get: (r) => r.emp.code }, { label: 'ชื่อ-สกุล', get: (r) => r.emp.name }, { label: 'แผนก', get: (r) => r.emp.dept },
            { label: 'สาย(ครั้ง)', get: (r) => r.x.lateCnt }, { label: 'สาย(นาที)', get: (r) => r.x.lateMin }, { label: 'กลับก่อน(ครั้ง)', get: (r) => r.x.earlyCnt },
            { label: 'กลับก่อน(นาที)', get: (r) => r.x.earlyMin }, { label: 'ขาดงาน(วัน)', get: (r) => r.x.absent },
            ...LT.map((l) => ({ label: `${l.name}(วัน)`, get: (r) => r.x.leave[l.code] || 0 })), { label: 'รวมลา(วัน)', get: (r) => r.x.leaveDays },
          ];
        } else {
          const ev = [];
          for (const r of P.calc) {
            const e = ix.emps[r.e];
            if (!okEmp(e)) continue;
            if (r.absent) ev.push({ r, e, type: 'ABSENT', label: 'ขาดงาน', cls: 'bad', detail: r.absent < 1 ? 'ครึ่งวัน' : 'เต็มวัน', v: r.absent });
            if (r.late) ev.push({ r, e, type: 'LATE', label: 'มาสาย', cls: 'warn', detail: `${r.late} นาที (เข้า ${U.clock(r.in)})`, v: r.late });
            if (r.early) ev.push({ r, e, type: 'EARLY', label: 'กลับก่อน', cls: 'warn', detail: `${r.early} นาที (ออก ${U.clock(r.out)})`, v: r.early });
            if (r.leave) ev.push({ r, e, type: 'LEAVE', label: (ix.leaveTypes[r.lt] || {}).name || 'ลา', cls: 'info', detail: E.LEAVE_PART[r.lpart] || '', v: r.leave });
          }
          const rows = ev.filter((x) => !s8.type || x.type === s8.type);
          table = new UI.DataTable({
            pageSize: 50,
            compact: true,
            sortKey: 'd',
            onRow: (x) => UI.timecard(x.e.id),
            columns: [
              { key: 'd', label: 'วันที่', sv: (x) => x.r.d, render: (x) => `<span class="nowrap">${U.fmtDay(x.r.d)}</span>` },
              { key: 'code', label: 'พนักงาน', sv: (x) => x.e.code, render: (x) => UI.empCell(x.e) },
              { key: 'dept', label: 'แผนก', sv: (x) => x.e.dept, render: (x) => esc(x.e.dept) },
              { key: 'shift', label: 'กะ', sv: (x) => x.r.code, render: (x) => UI.shiftChip(x.r.code, ix) },
              { key: 'type', label: 'ประเภท', render: (x) => UI.pill(x.label, x.cls) },
              { key: 'detail', label: 'รายละเอียด', sort: false, render: (x) => esc(x.detail) },
            ],
          });
          table.setRows(rows);
          csvCols = [
            { label: 'วันที่', get: (x) => x.r.d }, { label: 'รหัสพนักงาน', get: (x) => x.e.code }, { label: 'ชื่อ-สกุล', get: (x) => x.e.name },
            { label: 'แผนก', get: (x) => x.e.dept }, { label: 'กะ', get: (x) => x.r.code }, { label: 'ประเภท', get: (x) => x.label }, { label: 'รายละเอียด', get: (x) => x.detail },
          ];
        }
        body.querySelector('[data-tbl]').appendChild(table.el);
        const re = () => PL.App.rerender();
        body.querySelector('[data-dept]').addEventListener('change', (e) => ((s8.dept = e.target.value), re()));
        body.querySelector('[data-q]').addEventListener('input', U.debounce((e) => {
          s8.q = e.target.value.trim();
          re();
          const i = document.querySelector('[data-q]');
          i.focus();
          i.setSelectionRange(i.value.length, i.value.length);
        }, 350));
        const ty = body.querySelector('[data-type]');
        if (ty) ty.addEventListener('change', (e) => ((s8.type = e.target.value), re()));
        const any = body.querySelector('[data-any]');
        if (any) any.addEventListener('change', (e) => ((s8.any = e.target.checked), re()));
      }
      el.querySelector('.tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (b) {
          s8.tab = b.dataset.tab;
          PL.App.rerender();
        }
      });
      el.querySelector('[data-act="csv"]').addEventListener('click', () => {
        if (!table) return UI.toast('เลือกแท็บ "สรุปรายพนักงาน" หรือ "รายละเอียดรายวัน" เพื่อส่งออก', 'info');
        UI.exportCSV(`absence-late-${s8.tab}_${pk}.csv`, csvCols, table._rows);
      });
      el.querySelector('[data-act="print"]').addEventListener('click', () => {
        if (table) {
          table.o.pageSize = 100000;
          table.render();
        }
        window.print();
        if (table) {
          table.o.pageSize = 50;
          table.render();
        }
      });
    },
  };
})(window);

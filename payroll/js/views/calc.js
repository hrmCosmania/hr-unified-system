/* ขั้นตอนที่ 5: คำนวณบันทึกเวลา (Time Calculation) */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const st = { dept: '', q: '', only: '' };

  PL.Views.calc = {
    render(el) {
      const s = Store.s, pk = Store.pk, S = s.settings, ix = Store.ix();
      const P = Store.P(), p = E.pipeline(s, pk);
      const sm = E.summary(s, pk);
      const locked = Store.isLocked();
      const banner = locked
        ? UI.banner('info', 'รอบนี้ถูกล็อกแล้ว — แสดงผลคำนวณที่ส่งให้ฝ่ายเงินเดือน')
        : !P.calcSeq
          ? UI.banner('info', 'ยังไม่ได้คำนวณรอบนี้ — กด <b>คำนวณบันทึกเวลา</b> (ระบบจะโอนเทียบกะให้อัตโนมัติถ้ายังไม่เป็นปัจจุบัน)')
          : p.calcStale
            ? UI.banner('warn', `มีการเปลี่ยนแปลงหลังคำนวณครั้งล่าสุด (${U.fmtStamp(P.calcAt)})${p.mapStale ? ' — รวมถึงบันทึกเวลา/ตารางกะ' : ' — เช่น อนุมัติคำขอเพิ่ม'} กรุณาคำนวณใหม่`, `<button class="btn sm primary" data-act="run">${UI.icon('calculator', 15)} คำนวณใหม่</button>`)
            : UI.banner('ok', `คำนวณล่าสุดเมื่อ ${U.fmtStamp(P.calcAt)} — ผลเป็นปัจจุบัน`);
      const graces = s.shifts.filter((x) => (x.type || 'WORK') === 'WORK').map((x) => `${x.code} ${x.grace || 0} นาที`).join(', ');
      const T = sm && sm.T;
      const mini = (label, val, sub, cls = '') => `<div class="mini ${cls}"><div class="m-label">${label}</div><div class="m-val">${val}</div>${sub ? `<div class="m-sub">${sub}</div>` : ''}</div>`;

      el.innerHTML = `${UI.stepHeader('calc', `<button class="btn primary" data-act="run" ${locked ? 'disabled' : ''}>${UI.icon('calculator', 16)} คำนวณบันทึกเวลา</button>`)}
        ${banner}
        <div class="card" style="padding:14px 18px;margin-bottom:18px"><div class="row" style="font-size:13px;color:var(--text-2)">${UI.icon('info', 16)} กฎการคำนวณ:
          ${UI.pill(`ผ่อนผันสาย: ${graces}`, 'brand')}
          ${UI.pill(S.otRequireApproval ? 'OT นับเฉพาะที่มีคำขออนุมัติ' : 'OT นับอัตโนมัติหลังเลิกกะ', 'brand')}
          ${UI.pill(`OT ปัดลง ${S.otRoundBlock} นาที ขั้นต่ำ ${S.otMinMinutes} นาที`, 'brand')}
          ${UI.pill('วันทำงาน 1.5× · วันหยุด 1× (รายเดือน) / 2× (รายวัน) · OT วันหยุด 3×', 'brand')}
          <a href="#/settings?tab=rules">แก้ไขกฎ</a></div></div>
        ${
          T
            ? `<div class="mini-stats">
          ${mini('วันทำงานตามกะ', U.num(T.sched), `${T.empCount} คน`)}
          ${mini('มาทำงาน', U.num(T.present, 1), `อัตรามาทำงาน ${U.num(T.attendRate, 1)}%`, 'm-ok')}
          ${mini('ขาดงาน (วัน)', U.num(T.absent, 1), `${T.absentEmp} คน`, 'm-bad')}
          ${mini('มาสาย', `${U.num(T.lateCnt)} ครั้ง`, `${U.num(T.lateMin)} นาที · ${T.lateEmp} คน`, 'm-warn')}
          ${mini('กลับก่อน', `${U.num(T.earlyCnt)} ครั้ง`, `${U.num(T.earlyMin)} นาที`, 'm-warn')}
          ${mini('ลา (วัน)', U.num(T.leaveDays, 1), Object.entries(T.leave).map(([k, v]) => `${(ix.leaveTypes[k] || {}).name || k} ${U.num(v, 1)}`).join(' · '))}
          ${mini('OT รวม (ชม.)', U.hrs(T.ot, 1), `1×${U.hrs(T.ot1, 1)} · 1.5×${U.hrs(T.ot15, 1)} · 2×${U.hrs(T.ot2, 1)} · 3×${U.hrs(T.ot3, 1)}`, 'm-purple')}
          ${mini('ไม่สมบูรณ์', U.num(T.inc), T.inc ? '<a href="#/incomplete">ไปแก้ไข →</a>' : 'ครบถ้วน', T.inc ? 'm-orange' : 'm-ok')}
        </div>
        <div class="card"><div class="card-head"><h3>${UI.icon('users', 18)} ผลคำนวณรายพนักงาน</h3><span class="spacer"></span><span class="muted" style="font-size:12.5px">คลิกแถวเพื่อดูบัตรลงเวลารายวัน</span></div>
          <div class="toolbar">
            <select class="input sm" data-dept>${UI.deptOptions(st.dept)}</select>
            <input class="input sm search-in" data-q placeholder="ค้นหาพนักงาน" value="${esc(st.q)}">
            ${UI.seg('only', [{ key: '', label: 'ทั้งหมด' }, { key: 'issue', label: 'มีขาด/สาย/ไม่สมบูรณ์' }, { key: 'ot', label: 'มี OT' }], st.only)}
            <span class="spacer"></span>
            <a class="btn sm" href="#/report">${UI.icon('chart', 15)} ดูรายงานรายวัน</a>
          </div><div data-tbl></div></div>`
            : UI.empty('ยังไม่มีผลคำนวณ', locked ? '' : `<button class="btn primary" data-act="run">${UI.icon('calculator', 16)} คำนวณบันทึกเวลา</button>`)
        }
        ${UI.stepNav('calc')}`;

      if (T) {
        const rows = s.employees.filter((e) => sm.emps[e.id]).map((e) => ({ emp: e, x: sm.emps[e.id] }));
        const n1 = (v) => (v ? U.num(v, v % 1 ? 1 : 0) : '<span class="muted">0</span>');
        const h = (v) => (v ? U.hrs(v) : '<span class="muted">–</span>');
        const t = new UI.DataTable({
          pageSize: 50,
          compact: true,
          onRow: (r) => UI.timecard(r.emp.id),
          columns: [
            { key: 'code', label: 'พนักงาน', sv: (r) => r.emp.code, render: (r) => UI.empCell(r.emp) },
            { key: 'dept', label: 'แผนก', sv: (r) => r.emp.dept, render: (r) => esc(r.emp.dept) },
            { key: 'pay', label: 'จ้าง', sv: (r) => r.emp.payType, render: (r) => UI.pill(r.emp.payType === 'D' ? 'รายวัน' : 'รายเดือน', r.emp.payType === 'D' ? 'info' : 'off') },
            { key: 'sched', label: 'ตามกะ', align: 'r', sv: (r) => r.x.sched, render: (r) => r.x.sched },
            { key: 'present', label: 'มาทำงาน', align: 'r', sv: (r) => r.x.present, render: (r) => U.num(r.x.present, r.x.present % 1 ? 1 : 0) },
            { key: 'absent', label: 'ขาด', align: 'r', sv: (r) => r.x.absent, render: (r) => (r.x.absent ? `<b style="color:var(--bad)">${U.num(r.x.absent, r.x.absent % 1 ? 1 : 0)}</b>` : n1(0)) },
            { key: 'late', label: 'สาย ครั้ง/นาที', align: 'r', sv: (r) => r.x.lateMin, render: (r) => (r.x.lateCnt ? `${r.x.lateCnt} / ${r.x.lateMin}` : n1(0)) },
            { key: 'early', label: 'กลับก่อน', align: 'r', sv: (r) => r.x.earlyMin, render: (r) => (r.x.earlyCnt ? `${r.x.earlyCnt} / ${r.x.earlyMin}` : n1(0)) },
            { key: 'leave', label: 'ลา', align: 'r', sv: (r) => r.x.leaveDays, render: (r) => n1(r.x.leaveDays) },
            { key: 'ot1', label: 'OT 1×', align: 'r', sv: (r) => r.x.ot1, render: (r) => h(r.x.ot1) },
            { key: 'ot15', label: 'OT 1.5×', align: 'r', sv: (r) => r.x.ot15, render: (r) => h(r.x.ot15) },
            { key: 'ot2', label: 'OT 2×', align: 'r', sv: (r) => r.x.ot2, render: (r) => h(r.x.ot2) },
            { key: 'ot3', label: 'OT 3×', align: 'r', sv: (r) => r.x.ot3, render: (r) => h(r.x.ot3) },
            { key: 'inc', label: 'ไม่สมบูรณ์', align: 'r', sv: (r) => r.x.inc, render: (r) => (r.x.inc ? UI.pill(String(r.x.inc), 'orange') : n1(0)) },
          ],
          footer: (rows) =>
            `<tr><td colspan="3">รวม ${rows.length} คน</td><td class="r">${U.num(U.sum(rows, (r) => r.x.sched))}</td><td class="r">${U.num(U.sum(rows, (r) => r.x.present), 1)}</td><td class="r">${U.num(U.sum(rows, (r) => r.x.absent), 1)}</td>
            <td class="r">${U.num(U.sum(rows, (r) => r.x.lateCnt))} / ${U.num(U.sum(rows, (r) => r.x.lateMin))}</td><td class="r">${U.num(U.sum(rows, (r) => r.x.earlyCnt))} / ${U.num(U.sum(rows, (r) => r.x.earlyMin))}</td>
            <td class="r">${U.num(U.sum(rows, (r) => r.x.leaveDays), 1)}</td>${['ot1', 'ot15', 'ot2', 'ot3'].map((k) => `<td class="r">${U.hrs(U.sum(rows, (r) => r.x[k]))}</td>`).join('')}<td class="r">${U.num(U.sum(rows, (r) => r.x.inc))}</td></tr>`,
        });
        el.querySelector('[data-tbl]').appendChild(t.el);
        const apply = () => {
          const q = st.q.toLowerCase();
          t.setRows(
            rows.filter((r) => {
              if (st.dept && r.emp.dept !== st.dept) return false;
              if (q && !`${r.emp.code} ${r.emp.name}`.toLowerCase().includes(q)) return false;
              if (st.only === 'issue' && !(r.x.absent || r.x.lateCnt || r.x.inc)) return false;
              if (st.only === 'ot' && !r.x.ot) return false;
              return true;
            })
          );
        };
        apply();
        el.querySelector('[data-dept]').addEventListener('change', (e) => ((st.dept = e.target.value), apply()));
        el.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((st.q = e.target.value.trim()), apply()), 150));
        el.querySelector('[data-seg="only"]').addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (!b) return;
          st.only = b.dataset.v;
          el.querySelectorAll('[data-seg="only"] button').forEach((x) => x.classList.toggle('active', x === b));
          apply();
        });
      }
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="run"]')) this.run();
      });
    },
    run() {
      const s = Store.s, pk = Store.pk;
      if (!Store.guard([Store.range().start])) return;
      if (!E.pipeline(s, pk).punches) return UI.toast('ยังไม่มีบันทึกเวลาในรอบนี้', 'warn');
      const res = E.calcPeriod(s, pk);
      const T = E.summary(s, pk).T;
      Store.commit('คำนวณบันทึกเวลา', `รอบ ${U.fmtPeriodShort(pk)}`);
      UI.toast(`${res.remapped ? 'โอนเทียบกะใหม่และ' : ''}คำนวณเสร็จ · สาย ${U.num(T.lateCnt)} ครั้ง · ขาด ${U.num(T.absent, 1)} วัน · OT ${U.hrs(T.ot, 1)} ชม.${T.inc ? ` · ไม่สมบูรณ์ ${T.inc} รายการ` : ''}`, T.inc ? 'info' : 'ok', 5000);
      PL.App.rerender();
    },
  };
})(window);

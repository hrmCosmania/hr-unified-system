/* หน้าหลัก (Dashboard) */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  let metric = 'rate';

  const HERO_ART = `<svg class="hero-art" viewBox="0 0 120 110" aria-hidden="true">
    <rect x="8" y="18" width="86" height="78" rx="12" fill="#fff" stroke="#bfe6ec" stroke-width="2"/>
    <rect x="8" y="18" width="86" height="22" rx="12" fill="#2bc0cf"/><rect x="8" y="30" width="86" height="10" fill="#2bc0cf"/>
    <rect x="26" y="8" width="8" height="20" rx="4" fill="#0b8aa0"/><rect x="68" y="8" width="8" height="20" rx="4" fill="#0b8aa0"/>
    <g fill="#cfe9ef">${[0, 1, 2, 3]
      .map((c) => [0, 1, 2].map((r) => `<rect x="${20 + c * 18}" y="${50 + r * 14}" width="12" height="9" rx="2"/>`).join(''))
      .join('')}</g>
    <circle cx="92" cy="80" r="22" fill="#0e9fb3"/><path d="m82 80 7 7 13-14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  PL.Views.dashboard = {
    render(el) {
      const s = Store.s, pk = Store.pk;
      const pipe = E.pipeline(s, pk);
      const sm = E.summary(s, pk);
      const prev = E.summary(s, U.periodShift(pk, -1));
      const T = sm && sm.T, PT = prev && prev.T;
      const R = Store.range();
      const v = E.validate(s, pk);
      const act = s.employees.filter((e) => e.active !== false);
      const depts = new Set(act.map((e) => e.dept)).size;

      const stepper = pipe.steps
        .map((st, i) => {
          const n = PL.NAV.find((x) => x.key === st.key);
          return `${i ? `<span class="step-arrow">${UI.icon('arrowRight', 18)}</span>` : ''}<a class="step s-${st.state}" href="#/${st.key}" title="${esc(n.th)}">
            <span class="num">${st.state === 'done' ? UI.icon('check', 14) : st.n}</span><span class="sicon">${UI.icon(n.icon, 28)}</span>
            <span class="slabel">${n.short}</span><span class="snote">${esc(st.note)}</span></a>`;
        })
        .join('');

      const kpi = (icon, label, val, unit, sub, ghost) => `<div class="card kpi"><div class="kpi-ic">${UI.icon(icon, 28)}</div>
        <div style="min-width:0"><div class="kpi-label">${label}</div><div class="kpi-val">${val}<small>${unit}</small></div><div class="kpi-sub">${sub}</div></div>
        <div class="kpi-ghost">${UI.icon(ghost || icon, 74)}</div></div>`;
      const kpis = `<section class="kpis">
        ${kpi('users', 'พนักงานทั้งหมด', U.num(act.length), 'คน', `${depts} แผนก · รายเดือน ${act.filter((e) => e.payType !== 'D').length} / รายวัน ${act.filter((e) => e.payType === 'D').length}`)}
        ${kpi('calendarGrid', 'เวลาทำงานสมบูรณ์', T ? U.num(T.completeRate, 1) : '–', '%', T ? `${UI.delta(T.completeRate, PT && PT.completeRate)} ครบเข้า-ออก ${U.num(T.complete)} / ${U.num(T.attended)} วัน` : 'ยังไม่ได้คำนวณ', 'checkCircle')}
        ${kpi('clock', 'สาย / ขาดงาน (รอบนี้)', T ? U.num(T.lateOrAbsentEmp) : '–', 'คน', T ? `${UI.delta(T.lateCnt + T.absent, PT && PT.lateCnt + PT.absent, { invert: true })} สาย ${U.num(T.lateCnt)} ครั้ง · ขาด ${U.num(T.absent, 1)} วัน` : 'ยังไม่ได้คำนวณ', 'users')}
        ${kpi('timer', 'OT รอบนี้', T ? U.hrs(T.ot) : '–', 'ชม.', T ? `${UI.delta(T.ot, PT && PT.ot)} OT1.5 ${U.hrs(T.ot15, 1)} · วันหยุด ${U.hrs(T.ot1 + T.ot2 + T.ot3, 1)}` : 'ยังไม่ได้คำนวณ')}
      </section>`;

      // พร้อมส่ง
      let ready;
      const ps = PL.Payroll.status(s, pk), prun = ps.run;
      if (pipe.locked && !Store.can('pay')) {
        ready = `<div class="card ready span-3"><div class="r-ic">${UI.icon('lock', 32)}</div><h3>ส่งผลบันทึกเวลาแล้ว</h3>
          <p>รอบ ${U.fmtPeriod(pk)} ส่งให้ฝ่ายเงินเดือนเมื่อ ${U.fmtStamp(pipe.last && pipe.last.at)}<br>ข้อมูลรอบนี้ถูกล็อก</p></div>`;
      } else if (ps.key === 'APPROVED') {
        ready = `<div class="card ready span-3"><div class="r-ic">${UI.icon('receipt', 32)}</div><h3>ปิดงวดเงินเดือนแล้ว</h3>
          <p>รอบ ${U.fmtPeriod(pk)} · ${prun.rows.length} คน<br>จ่ายสุทธิ <b>${U.money(prun.totals.net)}</b> บาท<br>วันที่จ่าย ${U.fmtDate(prun.payDate)}</p>
          <a class="btn primary" href="#/payslip">${UI.icon('printer', 16)} สลิปเงินเดือน</a><a class="link" href="#/payreports">รายงาน ปกส. / ภ.ง.ด.1 / โอนเงิน →</a></div>`;
      } else if (pipe.locked) {
        ready = `<div class="card ready span-3"><div class="r-ic">${UI.icon('banknote', 32)}</div><h3>${prun ? 'เงินเดือนรออนุมัติ' : 'พร้อมคำนวณเงินเดือน'}</h3>
          <p>ส่งผลบันทึกเวลารอบ ${U.fmtPeriodShort(pk)} แล้ว<br>${prun ? `สุทธิ ${U.money(prun.totals.net)} บาท · ${ps.label}` : `เมื่อ ${U.fmtStamp(pipe.last && pipe.last.at)}`}</p>
          <a class="btn primary lg" href="#/payroll">${UI.icon('calculator', 17)} ${prun ? 'ตรวจและปิดงวด' : 'คำนวณเงินเดือน'}</a></div>`;
      } else if (!v.errors) {
        ready = `<div class="card ready span-3"><div class="r-ic">${UI.icon('check', 34)}</div><h3>พร้อมส่งข้อมูล<br>เพื่อคำนวณเงินเดือน</h3>
          <p>ข้อมูลบันทึกเวลาประจำรอบ ${U.fmtPeriodShort(pk)}<br>${v.warns ? `มีข้อควรตรวจสอบ ${v.warns} รายการ` : 'ผ่านการตรวจสอบครบทุกข้อ'}</p>
          <a class="btn primary lg" href="#/export">${UI.icon('send', 17)} ส่งข้อมูลไปยังฝ่ายเงินเดือน</a></div>`;
      } else {
        const issues = v.checks.filter((c) => !c.ok && c.level === 'error').slice(0, 3);
        ready = `<div class="card ready not span-3"><div class="r-ic">${UI.icon('alert', 30)}</div><h3>ยังไม่พร้อมส่ง</h3>
          <ul>${issues.map((c) => `<li><a href="#/${c.link}">${esc(c.label)}</a> — ${esc(c.detail)}</li>`).join('')}</ul>
          <button class="btn primary" data-act="runloop">${UI.icon('zap', 16)} ประมวลผลทั้งลูป</button></div>`;
      }

      const overview = `<div class="card span-5">
        <div class="ov-head"><h3>ภาพรวมการบริหารเวลา</h3>
          <select data-metric aria-label="เลือกตัวชี้วัด">
            ${[['rate', 'อัตราบันทึกครบถ้วน (%)'], ['late', 'จำนวนคนมาสาย'], ['absent', 'ขาดงาน (คน-วัน)'], ['ot', 'ชั่วโมง OT']].map(([k, l]) => `<option value="${k}" ${k === metric ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        ${
          T
            ? `<div class="ov-body"><div class="donut-wrap">${UI.donut(
                [
                  { value: T.complete, color: 'var(--brand)', label: 'ครบถ้วน' },
                  { value: T.attended - T.complete, color: '#8fd3ec', label: 'ไม่ครบถ้วน' },
                ],
                { center: U.num(T.completeRate, 1) + '%', sub: 'Time Accuracy', size: 160, thick: 22 }
              )}
              <div class="legend"><span><i style="background:var(--brand)"></i>ครบถ้วน ${U.num(T.completeRate, 1)}%</span><span><i style="background:#8fd3ec"></i>ไม่ครบถ้วน ${U.num(100 - T.completeRate, 1)}%</span></div></div>
              <div data-chart>${this.chart(sm)}</div></div>`
            : UI.empty('ยังไม่มีผลคำนวณของรอบนี้', '<button class="btn primary sm" data-act="runloop">ประมวลผลทั้งลูป</button>')
        }</div>`;

      const notif = `<div class="card span-4"><div class="card-head"><h3>${UI.icon('calendar', 18)} รายการแจ้งเตือนล่าสุด</h3><span class="spacer"></span></div>
        ${PL.App.notifHTML(PL.App.notifications())}</div>`;

      const tiles = [
        ['report?view=summary', 'calendarGrid', 'รายงานสรุปเวลา<br>การทำงาน'],
        ['absence', 'alert', 'รายงานขาด ลา มาสาย'],
        ['report?view=ot', 'clock', 'รายงาน OT<br>และเวลาทำงานล่วงเวลา'],
        ['incomplete', 'file', 'รายงานบันทึกเวลา<br>ไม่สมบูรณ์'],
      ];
      const popular = `<div class="card span-5"><div class="card-head"><h3>${UI.icon('bars', 18)} รายงานยอดนิยม</h3><span class="spacer"></span><a class="link" href="#/report">ดูทั้งหมด ${UI.icon('arrowRight', 14)}</a></div>
        <div class="tiles">${tiles.map(([h, i, l]) => `<a class="tile" href="#/${h}">${UI.icon(i, 30)}<span>${l}</span></a>`).join('')}</div></div>`;

      const stat = (icon, label, val, unit, d) => `<div class="stat">${UI.icon(icon, 22)}<span class="s-label">${label}</span><span class="s-val">${val} <small style="font-size:13px">${unit}</small></span>${d || '<span class="muted" style="font-size:12px">–</span>'}</div>`;
      const stats = `<div class="card span-7"><div class="card-head"><h3>${UI.icon('bars', 18)} สรุปสถิติสำคัญ</h3><span class="spacer"></span><span class="muted" style="font-size:12.5px">${PT ? `เทียบรอบ ${U.fmtPeriodShort(U.periodShift(pk, -1))}` : ''}</span></div>
        ${
          T
            ? `<div class="stats4">
          ${stat('calendar', 'ชั่วโมงทำงานรวม', U.num(T.work / 60), 'ชม.', PT && UI.delta(T.work, PT.work))}
          ${stat('timer', 'ชั่วโมง OT รวม', U.num(T.ot / 60), 'ชม.', PT && UI.delta(T.ot, PT.ot))}
          ${stat('users', 'ขาดงานรวม', U.num(T.absent, 1), 'คน-วัน', PT && UI.delta(T.absent, PT.absent, { invert: true }))}
          ${stat('userClock', 'สายรวม', U.num(T.lateCnt), 'คน-ครั้ง', PT && UI.delta(T.lateCnt, PT.lateCnt, { invert: true }))}</div>`
            : UI.empty('ยังไม่มีผลคำนวณ')
        }</div>`;

      el.innerHTML = `
        <section class="hero">
          <div>
            <h1>Payroll <span>Full Loop</span></h1>
            <p>ระบบเงินเดือนครบวงจร ตั้งแต่การดึงข้อมูลเวลา จนถึงการคำนวณเงินเดือน</p>
            <div class="hero-meta">
              ${UI.pill(`รอบ ${U.fmtPeriod(pk)}`, 'brand', 'calendar')}
              <span class="muted" style="font-size:13px">${U.fmtDate(R.start)} – ${U.fmtDate(R.end)}</span>
              ${pipe.locked ? UI.pill('ล็อกแล้ว', 'off', 'lock') : `<button class="btn primary sm" data-act="runloop" title="โอนบันทึกเวลาเทียบกะ + คำนวณ ในคลิกเดียว">${UI.icon('zap', 15)} ประมวลผลทั้งลูป</button>`}
            </div>
          </div>
          <div class="hero-right"><div class="hero-quote">ลดงาน ลดความผิดพลาด<br>เพิ่มความแม่นยำ ในการบริหารเวลาและเงินเดือน</div>${HERO_ART}</div>
        </section>
        <section class="card stepper" aria-label="ขั้นตอนการทำงาน">${stepper}</section>
        <div style="height:18px"></div>
        ${kpis}
        <section class="grid">${overview}${notif}${ready}</section>
        <section class="grid">${popular}${stats}</section>`;

      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="runloop"]')) PL.App.runLoop();
      });
      el.addEventListener('change', (e) => {
        if (e.target.matches('[data-metric]')) {
          metric = e.target.value;
          el.querySelector('[data-chart]').innerHTML = this.chart(E.summary(Store.s, Store.pk));
        }
      });
    },
    chart(sm) {
      if (!sm) return '';
      const days = Object.keys(sm.daily).sort();
      const pts = days
        .map((d) => {
          const x = sm.daily[d];
          if (!x.sched && metric !== 'ot') return null;
          let value;
          if (metric === 'rate') {
            if (!x.attended) return null;
            value = (x.complete / x.attended) * 100;
          } else if (metric === 'late') value = x.late;
          else if (metric === 'absent') value = x.absent;
          else value = x.ot / 60;
          return { label: String(+d.slice(8)), title: U.fmtDay(d), value };
        })
        .filter(Boolean);
      const cfg = {
        rate: { min: Math.min(90, ...pts.map((p) => p.value)), max: 100, fmt: (v) => U.num(v, v >= 99.95 || v % 1 === 0 ? 0 : 1), suffix: '%' },
        late: { min: 0, fmt: (v) => U.num(v) },
        absent: { min: 0, fmt: (v) => U.num(v, v % 1 ? 1 : 0) },
        ot: { min: 0, fmt: (v) => U.num(v, 0), color: '#6366f1' },
      }[metric];
      return UI.line(pts, Object.assign({ w: 340, h: 250 }, cfg)) + `<div class="muted" style="font-size:12px;text-align:center;margin-top:-4px">วันที่ในรอบ ${U.fmtPeriodShort(Store.pk)}</div>`;
    },
  };
})(window);

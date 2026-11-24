/* เงินเดือน: คำนวณเงินเดือน (ทะเบียน / รายการประจำงวด / ตรวจสอบ) และสลิปเงินเดือน */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store, Pay = PL.Payroll;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const m2 = (n) => U.money(n);
  const dash = (n) => (n ? m2(n) : '<span class="muted">–</span>');

  /* ================= สลิปเงินเดือน ================= */
  const Slip = (PL.Payslip = {
    html(s, run, r) {
      const R = E.range(s, run.pk), S = s.pay.settings;
      const y = Pay.ytd(s, r.e, run.pk);
      const earn = r.earn, ded = r.deductions;
      const n = Math.max(earn.length, ded.length, 5);
      const line = (x) => (x ? [esc(x.name), m2(x.amount)] : ['', '']);
      const body = Array.from({ length: n }, (_, i) => {
        const [a, b] = line(earn[i]), [c, d] = line(ded[i]);
        return `<tr><td>${a}</td><td class="r">${b}</td><td>${c}</td><td class="r">${d}</td></tr>`;
      }).join('');
      const t = r.time;
      return `<div class="slip ${run.status !== 'APPROVED' ? 'draft' : ''}">
        <div class="slip-head">
          <div><div class="slip-co">${esc(s.company.name)}</div><div class="slip-sub">เลขประจำตัวผู้เสียภาษี ${esc(S.companyTaxId || '–')}</div></div>
          <div class="slip-title">สลิปเงินเดือน<span>PAY SLIP</span></div>
        </div>
        <div class="slip-info">
          <div><span>รหัสพนักงาน</span><b>${esc(r.code)}</b></div><div><span>ชื่อ-สกุล</span><b>${esc(r.name)}</b></div>
          <div><span>แผนก / ตำแหน่ง</span><b>${esc(r.dept)}${r.position ? ' · ' + esc(r.position) : ''}</b></div>
          <div><span>งวด</span><b>${U.fmtPeriod(run.pk)} (${U.fmtDate(R.start)} – ${U.fmtDate(R.end)})</b></div>
          <div><span>วันที่จ่าย</span><b>${U.fmtDate(run.payDate)}</b></div>
          <div><span>โอนเข้าบัญชี</span><b>${r.acct ? `${esc(r.bank)} ${esc(Pay.maskAcct(r.acct))}` : '–'}</b></div>
        </div>
        <table class="slip-tbl"><thead><tr><th>รายได้ (Earnings)</th><th class="r">จำนวนเงิน</th><th>รายการหัก (Deductions)</th><th class="r">จำนวนเงิน</th></tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr><td>รวมเงินได้</td><td class="r">${m2(r.gross)}</td><td>รวมรายการหัก</td><td class="r">${m2(r.totalDed)}</td></tr></tfoot></table>
        <div class="slip-bottom">
          <div class="slip-side">
            <div class="slip-box"><b>สะสมทั้งปี ${+run.pk.slice(0, 4) + 543}</b>
              <div class="slip-kv"><span>เงินได้</span><span>${m2(y.gross)}</span><span>ภาษีหัก ณ ที่จ่าย</span><span>${m2(y.tax)}</span><span>ประกันสังคม</span><span>${m2(y.sso)}</span><span>กองทุนสำรองเลี้ยงชีพ</span><span>${m2(y.pvd)}</span></div></div>
            <div class="slip-time">วันทำงาน ${t.sched} · มาทำงาน ${U.num(t.present, t.present % 1 ? 1 : 0)} · ขาด ${U.num(t.absent, t.absent % 1 ? 1 : 0)} · ลา ${U.num(t.leaveDays, t.leaveDays % 1 ? 1 : 0)} · สาย ${t.lateCnt} ครั้ง (${t.lateMin} นาที) · OT ${U.hrs(t.ot)} ชม.</div>
          </div>
          <div class="slip-net"><span>เงินได้สุทธิ (Net Pay)</span><b>${m2(r.net)}</b><small>(${Pay.bahtText(r.net)})</small></div>
        </div>
        <div class="slip-foot">ออกโดยระบบ Payroll Full Loop · ข้อมูลส่วนบุคคล โปรดเก็บเป็นความลับ${run.status !== 'APPROVED' ? ' · <b>ฉบับร่าง ยังไม่อนุมัติ</b>' : ''}</div>
      </div>`;
    },
    open(run, r) {
      const s = Store.s;
      const m = UI.modal({
        title: `สลิปเงินเดือน · ${esc(r.name)}`,
        sub: `${esc(r.code)} · งวด ${U.fmtPeriod(run.pk)}`,
        size: 'lg',
        body: Slip.html(s, run, r) + this.calcNote(s, r),
        footer: `<button class="btn" data-close>ปิด</button><button class="btn primary" data-print>${UI.icon('printer', 16)} พิมพ์สลิป</button>`,
      });
      m.$('[data-print]').addEventListener('click', () => Slip.print(run, [r]));
    },
    calcNote(s, r) {
      const c = r.taxCalc;
      const extra = (c.nonTaxEarn ? `<span>เงินได้ที่ไม่คิดภาษี (ไม่อยู่ใน ภ.ง.ด.1 / 50 ทวิ)</span><span>${m2(c.nonTaxEarn)}</span>` : '') + (c.taxDed ? `<span>เงินหักก่อนภาษี (หักออกจากเงินได้แล้ว)</span><span>− ${m2(c.taxDed)}</span>` : '');
      const sso =`<span>ฐานค่าจ้างประกันสังคม (ขั้นต่ำ ${U.num(s.pay.settings.ssoMin)} สูงสุด ${U.num(s.pay.settings.ssoMax)})</span><span>${m2(r.ssoBase)} → ${m2(r.sso)}</span>`;
      if (c.method === 'YTD' || c.method === 'TRUEUP') {
        const tu = c.method === 'TRUEUP';
        return `<details class="calc-note" ${tu ? 'open' : ''}><summary>วิธีคำนวณภาษี${tu ? ' — ปรับปลายปี (true-up)' : ' — แบบสะสม (YTD)'}</summary><div class="kv" style="margin-top:8px">
          <span>เงินได้สะสมก่อนงวดนี้${c.prevIncome ? ` (รวมนายจ้างเดิม ${m2(c.prevIncome)})` : ''}</span><span>${m2(c.priorIncome)}</span>
          <span>เงินได้แน่นอนงวดนี้${tu ? '' : ` × ${c.left + 1} เดือน (งวดนี้ + ที่เหลือ)`}</span><span>${m2(c.regular)}</span>
          <span>เงินได้ไม่แน่นอนงวดนี้</span><span>${m2(c.irregular)}</span>${extra}
          <span>${tu ? 'เงินได้ทั้งปีจริง' : 'ประมาณการเงินได้ทั้งปี'}</span><span>${m2(c.annualIncome)}</span>
          <span>ค่าลดหย่อนทั้งปี (รวมประกันสังคม/กองทุน)</span><span>${m2(c.allowances)}</span>
          <span>ภาษีทั้งปี</span><span>${m2(c.annualTaxAll)}</span>
          <span>หักไปแล้วก่อนงวดนี้${c.prevTax ? ` (รวมนายจ้างเดิม ${m2(c.prevTax)})` : ''}</span><span>${m2(c.priorTax)}</span>
          <span>${tu ? 'ภาษีงวดนี้ = ภาษีทั้งปี − หักไปแล้ว' : `ภาษีงวดนี้ = (ภาษีส่วนเงินได้แน่นอน − หักไปแล้ว) ÷ ${c.left + 1} + ส่วนเพิ่มเงินได้ไม่แน่นอน ${m2(c.irrTax)}`}</span><span><b>${m2(r.tax)}</b></span>
          ${c.pending && c.pending.length ? `<span style="color:var(--bad)">งวดที่ยังไม่ปิด (ไม่นับ)</span><span>${c.pending.map(U.fmtPeriodShort).join(', ')}</span>` : ''}
          ${sso}</div></details>`;
      }
      return `<details class="calc-note"><summary>วิธีคำนวณภาษีและประกันสังคม</summary><div class="kv" style="margin-top:8px">
        <span>เงินได้แน่นอนต่อเดือน (หลังหักขาด/สาย)</span><span>${m2(c.regular)}</span>
        <span>เงินได้ไม่แน่นอนเดือนนี้ (OT, เบี้ยขยัน, โบนัส ฯลฯ)</span><span>${m2(c.irregular)}</span>${extra}
        <span>ประมาณการเงินได้ทั้งปี (แน่นอน × 12)</span><span>${m2(c.regular * 12)}</span>
        <span>ค่าลดหย่อนทั้งปี (รวมประกันสังคม/กองทุน)</span><span>${m2(c.allowances)}</span>
        <span>เงินได้สุทธิทั้งปี (หลังหักค่าใช้จ่าย 50% ไม่เกิน 100,000)</span><span>${m2(c.annualNet)}</span>
        <span>ภาษีทั้งปี ÷ 12</span><span>${m2(c.annualTax)} ÷ 12 = ${m2(c.annualTax / 12)}</span>
        <span>ภาษีส่วนเพิ่มของเงินได้ไม่แน่นอน</span><span>${m2(c.irrTax)}</span>
        ${sso}</div></details>`;
    },
    print(run, rows) {
      const s = Store.s;
      let root = document.getElementById('print-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'print-root';
        document.body.appendChild(root);
      }
      root.innerHTML = `<div class="slips-print">${rows.map((r) => Slip.html(s, run, r)).join('')}</div>`;
      document.body.classList.add('printing-slips');
      const prev = document.title;
      document.title = rows.length === 1 ? `สลิปเงินเดือน ${rows[0].code} ${run.pk}` : `สลิปเงินเดือน ${run.pk}`;
      window.print();
      document.title = prev;
      document.body.classList.remove('printing-slips');
      root.innerHTML = '';
    },
  });

  // ส่วนหัวสถานะงวดเงินเดือน (ใช้ร่วมกันทุกหน้าเงินเดือน)
  PL.payBanner = (s, pk, ps) => {
    const run = ps.run;
    if (ps.key === 'NOTIME')
      return UI.banner('info', `ยังไม่ได้รับผลบันทึกเวลารอบ ${U.fmtPeriod(pk)} — ต้องส่งผลบันทึกเวลาที่ขั้นตอนที่ 9 ก่อน จึงจะคำนวณเงินเดือนได้`, '<a class="btn sm primary" href="#/export">ไปขั้นตอนที่ 9</a>');
    if (ps.key === 'READY') return UI.banner('info', 'ได้รับผลบันทึกเวลาแล้ว — พร้อมคำนวณเงินเดือน');
    if (ps.key === 'STALE') return UI.banner('warn', `มีการเปลี่ยนแปลงหลังคำนวณเมื่อ ${U.fmtStamp(run.at)} (รายการประจำงวด ข้อมูลเงินเดือน หรือผลบันทึกเวลา) — กรุณาคำนวณใหม่`);
    if (ps.key === 'DRAFT') return UI.banner('warn', `คำนวณแล้วเมื่อ ${U.fmtStamp(run.at)} — ตรวจสอบแล้วกด <b>อนุมัติและปิดงวด</b>`);
    return UI.banner('ok', `ปิดงวดแล้วเมื่อ ${U.fmtStamp(run.approvedAt)} โดย ${esc(run.approvedBy || '')} · วันที่จ่าย ${U.fmtDate(run.payDate)}`);
  };

  /* ================= คำนวณเงินเดือน ================= */
  const st = { tab: 'register', dept: '', q: '' };
  PL.Views.payroll = {
    render(el, params) {
      if (params.tab) st.tab = params.tab;
      const s = Store.s, pk = Store.pk;
      const c = Pay.checks(s, pk), ps = c.st, run = ps.run;
      const items = Pay.itemMap(s);
      const inputs = s.pay.inputs[pk] || [];
      const canRun = ps.timeReady && !ps.approved;
      const T = run && run.totals;
      const mini = (label, val, sub, cls = '') => `<div class="mini ${cls}"><div class="m-label">${label}</div><div class="m-val">${val}</div>${sub ? `<div class="m-sub">${sub}</div>` : ''}</div>`;

      el.innerHTML = `${UI.stepHeader(
        'payroll',
        `${UI.pill(ps.label, ps.cls)}
         ${run && !ps.approved ? `<label class="row" style="gap:6px;font-size:13px">วันที่จ่าย <input class="input sm" type="date" data-paydate value="${run.payDate}"></label>` : ''}
         <button class="btn ${run ? '' : 'primary'}" data-act="run" ${canRun ? '' : 'disabled'}>${UI.icon('calculator', 16)} ${run ? 'คำนวณใหม่' : 'คำนวณเงินเดือน'}</button>
         ${ps.approved ? `<button class="btn" data-act="unapprove">${UI.icon('unlock', 16)} ยกเลิกการปิดงวด</button>` : `<button class="btn primary" data-act="approve" ${run && !ps.stale && !c.errors ? '' : 'disabled'}>${UI.icon('lock', 16)} อนุมัติและปิดงวด</button>`}`
      )}
      ${PL.payBanner(s, pk, ps)}
      ${
        T
          ? `<div class="mini-stats">
        ${mini('พนักงาน', U.num(T.n), 'คน')}
        ${mini('รวมเงินได้', U.num(T.gross), `OT ${U.num(T.otPay)}`)}
        ${mini('หักขาด/ลา/สาย', U.num(T.timeDed), '', 'm-orange')}
        ${mini('ภาษีหัก ณ ที่จ่าย', U.num(T.tax), 'ภ.ง.ด.1', 'm-bad')}
        ${mini('ประกันสังคม', U.num(T.sso), `นายจ้างสมทบ ${U.num(T.ssoEr)}`, 'm-bad')}
        ${mini('กองทุนสำรองฯ', U.num(T.pvd), `นายจ้างสมทบ ${U.num(T.pvdEr)}`)}
        ${mini('จ่ายสุทธิ', U.num(T.net), 'บาท', 'm-ok')}
        ${mini('ต้นทุนนายจ้าง', U.num(T.cost), 'เงินได้ + สมทบ')}
      </div>`
          : ''
      }
      ${UI.tabs(
        [
          { key: 'register', label: 'ทะเบียนเงินเดือน', icon: 'list' },
          { key: 'inputs', label: 'รายการได้/หักประจำงวด', icon: 'edit', count: inputs.length || '' },
          { key: 'checks', label: 'ตรวจสอบก่อนปิดงวด', icon: 'checkCircle', count: c.errors + c.warns || '' },
        ],
        st.tab
      )}
      <div data-body></div>
      <div class="step-nav"><a class="btn ghost" href="#/export">${UI.icon('chevronLeft', 16)} 9. โอนผลบันทึกเวลา</a><a class="btn ghost" href="#/payslip">สลิปเงินเดือน ${UI.icon('chevronRight', 16)}</a></div>`;

      const body = el.querySelector('[data-body]');
      if (st.tab === 'inputs') this.inputs(body, inputs, items, ps);
      else if (st.tab === 'checks') this.checks(body, c);
      else this.register(body, run);

      el.querySelector('.tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (b) {
          st.tab = b.dataset.tab;
          PL.App.rerender();
        }
      });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b || b.closest('.dt')) return;
        if (b.dataset.act === 'run') this.run();
        if (b.dataset.act === 'approve') this.approve();
        if (b.dataset.act === 'unapprove') this.unapprove();
      });
      const pd = el.querySelector('[data-paydate]');
      if (pd)
        pd.addEventListener('change', () => {
          run.payDate = pd.value || Pay.payDate(s, pk);
          Store.commit('แก้วันที่จ่ายเงินเดือน', `${pk}: ${run.payDate}`);
          UI.toast(`วันที่จ่าย ${U.fmtDate(run.payDate)}`);
        });
    },

    register(body, run) {
      if (!run) {
        body.innerHTML = `<div class="card">${UI.empty('ยังไม่ได้คำนวณเงินเดือนงวดนี้')}</div>`;
        return;
      }
      body.innerHTML = `<div class="card"><div class="toolbar">
          <select class="input sm" data-dept>${UI.deptOptions(st.dept)}</select>
          <input class="input sm search-in" data-q placeholder="ค้นหาพนักงาน" value="${esc(st.q)}">
          <span class="spacer"></span><span class="muted" style="font-size:12.5px">คลิกแถวเพื่อดูสลิป</span>
          <button class="btn sm" data-csv>${UI.icon('download', 15)} ส่งออก CSV</button></div><div data-tbl></div></div>`;
      const base = (r) => U.sum(r.earn.filter((x) => x.code === 'BASE'), (x) => x.amount);
      const t = new UI.DataTable({
        pageSize: 50,
        compact: true,
        sortKey: 'code',
        onRow: (r) => Slip.open(run, r),
        columns: [
          { key: 'code', label: 'พนักงาน', render: (r) => `<div class="emp-name nowrap">${esc(r.name)}</div><div class="emp-code">${esc(r.code)}</div>` },
          { key: 'dept', label: 'แผนก', render: (r) => esc(r.dept) },
          { key: 'payType', label: 'จ้าง', render: (r) => UI.pill(r.payType === 'D' ? 'รายวัน' : 'รายเดือน', r.payType === 'D' ? 'info' : 'off') },
          { key: 'base', label: 'เงินเดือน/ค่าแรง', align: 'r', sv: base, render: (r) => m2(base(r)) },
          { key: 'otPay', label: 'ค่าล่วงเวลา', align: 'r', render: (r) => dash(r.otPay) },
          { key: 'otherEarn', label: 'เงินได้อื่น', align: 'r', sv: (r) => r.gross - base(r) - r.otPay, render: (r) => dash(U.r2(r.gross - base(r) - r.otPay)) },
          { key: 'gross', label: 'รวมเงินได้', align: 'r', render: (r) => `<b>${m2(r.gross)}</b>` },
          { key: 'timeDed', label: 'หักขาด/สาย', align: 'r', render: (r) => dash(r.timeDed) },
          { key: 'sso', label: 'ประกันสังคม', align: 'r', render: (r) => dash(r.sso) },
          { key: 'tax', label: 'ภาษี', align: 'r', render: (r) => dash(r.tax) },
          { key: 'pvd', label: 'กองทุนฯ', align: 'r', render: (r) => dash(r.pvd) },
          { key: 'other', label: 'หักอื่น', align: 'r', render: (r) => dash(r.other) },
          { key: 'net', label: 'สุทธิ', align: 'r', render: (r) => `<b style="color:${r.net < 0 ? 'var(--bad)' : 'var(--ok)'}">${m2(r.net)}</b>` },
        ],
        footer: (rs) => {
          const sm = (f) => m2(U.sum(rs, f));
          return `<tr><td colspan="3">รวม ${rs.length} คน</td><td class="r">${sm(base)}</td><td class="r">${sm((r) => r.otPay)}</td><td class="r">${sm((r) => r.gross - base(r) - r.otPay)}</td><td class="r">${sm((r) => r.gross)}</td>
            <td class="r">${sm((r) => r.timeDed)}</td><td class="r">${sm((r) => r.sso)}</td><td class="r">${sm((r) => r.tax)}</td><td class="r">${sm((r) => r.pvd)}</td><td class="r">${sm((r) => r.other)}</td><td class="r">${sm((r) => r.net)}</td></tr>`;
        },
      });
      body.querySelector('[data-tbl]').appendChild(t.el);
      const apply = () => {
        const q = st.q.toLowerCase();
        t.setRows(run.rows.filter((r) => (!st.dept || r.dept === st.dept) && (!q || `${r.code} ${r.name}`.toLowerCase().includes(q))));
      };
      apply();
      body.querySelector('[data-dept]').addEventListener('change', (e) => ((st.dept = e.target.value), apply()));
      body.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((st.q = e.target.value.trim()), apply()), 150));
      body.querySelector('[data-csv]').addEventListener('click', () =>
        UI.exportCSV(`payroll-register_${run.pk}.csv`, [
          { label: 'รหัสพนักงาน', get: (r) => r.code }, { label: 'ชื่อ-สกุล', get: (r) => r.name }, { label: 'แผนก', get: (r) => r.dept },
          { label: 'ประเภทการจ้าง', get: (r) => (r.payType === 'D' ? 'รายวัน' : 'รายเดือน') }, { label: 'เงินเดือน/ค่าแรง', get: base },
          { label: 'ค่าล่วงเวลา', get: (r) => r.otPay }, { label: 'เงินได้อื่น', get: (r) => U.r2(r.gross - base(r) - r.otPay) }, { label: 'รวมเงินได้', get: (r) => r.gross },
          { label: 'หักขาด/ลา/สาย', get: (r) => r.timeDed }, { label: 'ประกันสังคม', get: (r) => r.sso }, { label: 'ภาษีหัก ณ ที่จ่าย', get: (r) => r.tax },
          { label: 'กองทุนสำรองเลี้ยงชีพ', get: (r) => r.pvd }, { label: 'หักอื่น', get: (r) => r.other }, { label: 'รวมรายการหัก', get: (r) => r.totalDed },
          { label: 'เงินได้สุทธิ', get: (r) => r.net }, { label: 'ประกันสังคมนายจ้าง', get: (r) => r.ssoEr }, { label: 'กองทุนฯ นายจ้าง', get: (r) => r.pvdEr },
        ], t._rows)
      );
    },

    inputs(body, inputs, items, ps) {
      const s = Store.s, pk = Store.pk, ix = Store.ix();
      const ro = ps.approved;
      const choosable = s.pay.items.filter((x) => !x.sys);
      const taxPill = (r) => {
        const it = items[r.code] || {}, tx = Pay.inputTaxable(r, it), own = typeof r.taxable === 'boolean' && r.taxable !== Pay.itemTaxable(it);
        const label = it.kind === 'DED' ? (tx ? 'หักก่อนภาษี' : 'หักหลังภาษี') : tx ? 'คิดภาษี' : 'ไม่คิดภาษี';
        return `${UI.pill(label, tx ? 'info' : 'off')}${own ? ' <small class="muted" title="ต่างจากค่าตั้งต้นของรายการ">กำหนดเอง</small>' : ''}`;
      };
      body.innerHTML = `<div class="card">
        ${ro ? UI.banner('info', 'งวดนี้ปิดแล้ว — ยกเลิกการปิดงวดก่อนจึงจะแก้ไขรายการได้') : `<div class="toolbar" style="align-items:flex-end">
          <label class="field" style="min-width:240px;flex:2"><span class="lbl">พนักงาน</span><select class="input" data-f="e">${UI.empOptions()}</select></label>
          <label class="field" style="min-width:180px;flex:1"><span class="lbl">รายการ</span><select class="input" data-f="code">
            <optgroup label="เงินได้">${choosable.filter((x) => x.kind === 'EARN').map((x) => `<option value="${x.code}">${esc(x.name)}</option>`).join('')}</optgroup>
            <optgroup label="เงินหัก">${choosable.filter((x) => x.kind === 'DED').map((x) => `<option value="${x.code}">${esc(x.name)}</option>`).join('')}</optgroup></select></label>
          <label class="field" style="width:140px"><span class="lbl">จำนวนเงิน</span><input class="input" type="number" min="0" step="0.01" data-f="amount"></label>
          <label class="check" style="padding-bottom:9px" title="ค่าตั้งต้นตามรายการ (ตั้งค่าเงินเดือน > รายการเงินได้/เงินหัก)"><input type="checkbox" data-f="taxable"> <span data-taxlbl>คำนวณภาษี</span></label>
          <label class="field" style="min-width:160px;flex:1"><span class="lbl">หมายเหตุ</span><input class="input" data-f="note"></label>
          <button class="btn primary" data-add>${UI.icon('plus', 16)} เพิ่ม</button>
          <label class="btn" title="CSV: รหัสพนักงาน,รหัสรายการ,จำนวนเงิน,หมายเหตุ,คำนวณภาษี(Y/N ไม่ระบุ=ตามรายการ)">${UI.icon('upload', 16)} นำเข้า CSV<input type="file" accept=".csv,.txt" hidden data-imp></label>
        </div>`}
        <div data-tbl></div>
        <p class="muted" style="font-size:12.5px;margin:12px 0 0">รายการประจำงวด เช่น โบนัส ค่าคอมมิชชั่น เงินเบิกล่วงหน้า — เงินได้/เงินหักประจำทุกเดือน (ค่าตำแหน่ง เงินกู้) ตั้งที่ <a href="#/paysetup">ตั้งค่าเงินเดือน</a><br>
          <b>คำนวณภาษี</b> — เงินได้ที่ไม่ติ๊ก ไม่นับเป็นเงินได้พึงประเมินและไม่แสดงใน ภ.ง.ด.1 / 50 ทวิ / ภ.ง.ด.1ก · เงินหักที่ติ๊ก = หักก่อนภาษี (ลดเงินได้ในแบบภาษี) ไม่ติ๊ก = หักจากเงินสุทธิเท่านั้น<br>
          CSV: <code>รหัสพนักงาน,รหัสรายการ,จำนวนเงิน,หมายเหตุ,คำนวณภาษี(Y/N)</code> · รหัสรายการ: ${choosable.map((x) => `<code>${x.code}</code> ${esc(x.name)}`).join(', ')}</p></div>`;
      const t = new UI.DataTable({
        pageSize: 50,
        compact: true,
        columns: [
          { key: 'e', label: 'พนักงาน', sv: (r) => (ix.emps[r.e] || {}).code, render: (r) => UI.empCell(ix.emps[r.e]) },
          { key: 'dept', label: 'แผนก', sv: (r) => (ix.emps[r.e] || {}).dept, render: (r) => esc((ix.emps[r.e] || {}).dept) },
          { key: 'code', label: 'รายการ', render: (r) => { const it = items[r.code] || {}; return `${UI.pill(it.kind === 'DED' ? 'เงินหัก' : 'เงินได้', it.kind === 'DED' ? 'bad' : 'ok')} ${esc(it.name || r.code)}`; } },
          { key: 'amount', label: 'จำนวนเงิน', align: 'r', render: (r) => `<b>${m2(+r.amount)}</b>` },
          { key: 'taxable', label: 'ภาษี', sort: false, sv: (r) => +Pay.inputTaxable(r, items[r.code]), render: (r) => taxPill(r) },
          { key: 'note', label: 'หมายเหตุ', render: (r) => `<span class="muted">${esc(r.note || '')}</span>` },
          { key: '_', label: '', sort: false, align: 'r', render: () => (ro ? '' : `<button class="btn xs" data-act="tax" title="สลับคิด/ไม่คิดภาษี">${UI.icon('refresh', 13)} ภาษี</button> <button class="btn xs icon danger-ghost" data-act="del">${UI.icon('trash', 14)}</button>`) },
        ],
        footer: (rs) => {
          const isDed = (r) => (items[r.code] || {}).kind === 'DED', tx = (r) => Pay.inputTaxable(r, items[r.code]);
          const sm = (f) => m2(U.sum(rs.filter(f), (r) => r.amount));
          return `<tr><td colspan="3">รวม ${rs.length} รายการ</td><td class="r" colspan="2">เงินได้ ${sm((r) => !isDed(r))} <span class="muted">(ไม่คิดภาษี ${sm((r) => !isDed(r) && !tx(r))})</span> · เงินหัก ${sm(isDed)} <span class="muted">(หักก่อนภาษี ${sm((r) => isDed(r) && tx(r))})</span></td><td colspan="2"></td></tr>`;
        },
        onAction: (a, r) => {
          const who = `${(ix.emps[r.e] || {}).code} ${r.code} ${r.amount}`;
          if (a === 'tax') {
            const next = !Pay.inputTaxable(r, items[r.code]);
            if (next === Pay.itemTaxable(items[r.code])) delete r.taxable;
            else r.taxable = next;
            Pay.touch(s, pk);
            Store.commit('เปลี่ยนการคิดภาษีรายการประจำงวด', `${who} → ${next ? 'คิดภาษี' : 'ไม่คิดภาษี'}`);
            return PL.App.rerender();
          }
          if (a !== 'del') return;
          s.pay.inputs[pk] = (s.pay.inputs[pk] || []).filter((x) => x !== r);
          Pay.touch(s, pk);
          Store.commit('ลบรายการประจำงวด', who);
          PL.App.rerender();
        },
      });
      t.setRows(inputs);
      body.querySelector('[data-tbl]').appendChild(t.el);
      if (ro) return;
      const f = (k) => body.querySelector(`[data-f="${k}"]`);
      // ช่องคำนวณภาษี: ค่าตั้งต้นตามรายการที่เลือก
      const syncTax = () => {
        const it = items[f('code').value] || {};
        f('taxable').checked = Pay.itemTaxable(it);
        body.querySelector('[data-taxlbl]').textContent = it.kind === 'DED' ? 'หักก่อนภาษี' : 'คำนวณภาษี';
      };
      f('code').addEventListener('change', syncTax);
      syncTax();
      body.querySelector('[data-add]').addEventListener('click', () => {
        const e = f('e').value, code = f('code').value, amount = U.r2(+f('amount').value);
        if (!e || !code || !(amount > 0)) return UI.toast('กรุณาเลือกพนักงาน รายการ และระบุจำนวนเงินมากกว่า 0', 'warn');
        const tx = f('taxable').checked;
        const rec = { id: E.nextId(s, 'PI'), e, code, amount, note: f('note').value.trim() };
        if (tx !== Pay.itemTaxable(items[code])) rec.taxable = tx; // เก็บเฉพาะเมื่อต่างจากค่าของรายการ
        (s.pay.inputs[pk] = s.pay.inputs[pk] || []).push(rec);
        Pay.touch(s, pk);
        Store.commit('เพิ่มรายการประจำงวด', `${(ix.emps[e] || {}).code} ${code} ${amount}${'taxable' in rec ? (tx ? ' (คิดภาษี)' : ' (ไม่คิดภาษี)') : ''}`);
        UI.toast(`เพิ่ม${items[code].name} ${m2(amount)} บาทแล้ว — กดคำนวณใหม่เพื่ออัปเดตเงินเดือน`);
        PL.App.rerender();
      });
      body.querySelector('[data-imp]').addEventListener('change', async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        const lines = (await U.readFile(file)).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
        let ok = 0;
        const bad = [];
        lines.forEach((l, i) => {
          const c = l.split(',').map((x) => x.replace(/^"|"$/g, '').trim());
          const id = E.resolveCode(ix, c[0]);
          const code = U.normCode(c[1]);
          const amount = U.r2(+String(c[2] || '').replace(/,/g, ''));
          if (!id || !items[code] || items[code].sys || !(amount > 0)) {
            if (i > 0 || /\d/.test(c[2] || '')) bad.push(i + 1);
            return;
          }
          const rec = { id: E.nextId(s, 'PI'), e: id, code, amount, note: c[3] || '' };
          const t5 = String(c[4] || '').trim().toUpperCase();
          if (/^(Y|YES|1|TRUE|คิด|ใช่)$/.test(t5)) rec.taxable = true;
          else if (/^(N|NO|0|FALSE|ไม่คิด|ไม่)$/.test(t5)) rec.taxable = false;
          if ('taxable' in rec && rec.taxable === Pay.itemTaxable(items[code])) delete rec.taxable;
          (s.pay.inputs[pk] = s.pay.inputs[pk] || []).push(rec);
          ok++;
        });
        if (ok) {
          Pay.touch(s, pk);
          Store.commit('นำเข้ารายการประจำงวด', `${ok} รายการ`);
        }
        UI.toast(`นำเข้า ${ok} รายการ${bad.length ? ` · ข้ามบรรทัด ${bad.slice(0, 6).join(', ')}` : ''}`, bad.length ? 'warn' : 'ok', 5000);
        PL.App.rerender();
      });
    },

    checks(body, c) {
      const row = (x) => {
        const cls = x.ok ? 'ok' : x.level;
        return `<div class="chk ${cls}"><span class="c-ic">${UI.icon(x.ok ? 'check' : x.level === 'error' ? 'x' : 'alert', 16)}</span>
          <div><div class="c-label">${esc(x.label)}</div><div class="c-detail">${esc(x.detail)}</div></div>
          ${!x.ok ? `<a class="c-link" href="#/${x.link}">แก้ไข ${UI.icon('arrowRight', 13)}</a>` : ''}</div>`;
      };
      body.innerHTML = `<div class="grid"><div class="card span-6"><div class="card-head"><h3>${UI.icon('checkCircle', 18)} ตรวจสอบก่อนปิดงวด</h3></div><div class="checklist">${c.checks.map(row).join('')}</div></div>
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('info', 18)} หลักการคำนวณ</h3></div>
        <ul style="margin:0;padding-left:20px;line-height:1.8;color:var(--text-2);font-size:13.5px">
          <li>เงินเดือน/ค่าแรงและ OT มาจากผลบันทึกเวลาที่ส่งในขั้นตอนที่ 9 (รายวัน = วันมาทำงาน + ลาที่ได้ค่าจ้าง + วันหยุดนักขัตฤกษ์)</li>
          <li>ประกันสังคม ${s0().ssoRate}% ของค่าจ้าง ฐานขั้นต่ำ ${U.num(s0().ssoMin)} สูงสุด ${U.num(s0().ssoMax)} บาท (สูงสุด ${U.num(Math.round((s0().ssoMax * s0().ssoRate) / 100))} บาท/เดือน) ไม่รวม OT และเงินได้ที่ไม่ได้ตั้งให้คิดประกันสังคม</li>
          <li>ภาษีหัก ณ ที่จ่าย: เงินได้แน่นอน × 12 คิดภาษีอัตราก้าวหน้า ÷ 12 · เงินได้ไม่แน่นอน (OT โบนัส คอมมิชชั่น) หักภาษีส่วนเพิ่มในเดือนที่จ่าย</li>
          <li>หักค่าใช้จ่าย 50% ไม่เกิน 100,000 · ลดหย่อนส่วนตัว 60,000 และค่าลดหย่อนตามข้อมูลพนักงาน</li>
          <li>ค่ากะดึก ${U.num(s0().nightRate)} บาท/คืน · เบี้ยขยัน ${U.num(s0().diligAmount)} บาท (ไม่สาย ไม่ขาด ไม่ลา ไม่กลับก่อน)</li>
        </ul><p class="muted" style="font-size:12.5px">ปรับอัตราได้ที่ <a href="#/paysetup?tab=rates">ตั้งค่าเงินเดือน</a></p></div></div>`;
    },

    run() {
      const s = Store.s, pk = Store.pk;
      const ps = Pay.status(s, pk);
      if (!ps.timeReady) return UI.toast('ยังไม่ได้รับผลบันทึกเวลา — ส่งที่ขั้นตอนที่ 9 ก่อน', 'warn');
      if (ps.approved) return UI.toast('งวดนี้ปิดแล้ว', 'warn');
      const run = Pay.run(s, pk);
      Store.commit('คำนวณเงินเดือน', `${U.fmtPeriodShort(pk)}: ${run.rows.length} คน สุทธิ ${m2(run.totals.net)}`);
      UI.toast(`คำนวณเงินเดือน ${run.rows.length} คน · จ่ายสุทธิ ${m2(run.totals.net)} บาท${run.totals.negative ? ` · สุทธิติดลบ ${run.totals.negative} คน` : ''}`, run.totals.negative ? 'warn' : 'ok', 5000);
      PL.App.rerender();
    },
    async approve() {
      const s = Store.s, pk = Store.pk;
      const c = Pay.checks(s, pk), run = c.st.run;
      if (c.errors || !run) return UI.toast('ยังมีรายการที่ต้องแก้ไขก่อนปิดงวด', 'bad');
      const warns = c.checks.filter((x) => !x.ok);
      const msg = `อนุมัติเงินเดือนงวด <b>${U.fmtPeriod(pk)}</b> พนักงาน ${run.rows.length} คน จ่ายสุทธิ <b>${m2(run.totals.net)}</b> บาท วันที่จ่าย ${U.fmtDate(run.payDate)}?
        ${warns.length ? `<div style="margin-top:10px;color:var(--warn)"><b>ข้อควรตรวจสอบ:</b><ul>${warns.map((x) => `<li>${esc(x.label)} — ${esc(x.detail)}</li>`).join('')}</ul></div>` : ''}
        <div class="muted" style="margin-top:10px">หลังปิดงวด รายการประจำงวดจะแก้ไขไม่ได้ และสลิป/รายงานจะเป็นฉบับจริง</div>`;
      if (!(await UI.confirm(msg, { title: 'อนุมัติและปิดงวดเงินเดือน', ok: 'อนุมัติและปิดงวด' }))) return;
      Object.assign(run, { status: 'APPROVED', approvedAt: U.nowISO(), approvedBy: s.user.name });
      Store.commit('ปิดงวดเงินเดือน', `${U.fmtPeriodShort(pk)}: ${m2(run.totals.net)}`);
      UI.toast(`ปิดงวดเงินเดือน ${U.fmtPeriod(pk)} แล้ว — พิมพ์สลิปและดึงรายงาน ภ.ง.ด.1 / ประกันสังคม / ไฟล์โอนเงินได้เลย`, 'ok', 5500);
      PL.App.rerender();
    },
    async unapprove() {
      if (!(await UI.confirm('ยกเลิกการปิดงวดเงินเดือนนี้?<br><span class="muted">สลิปและรายงานจะกลับเป็นฉบับร่างจนกว่าจะอนุมัติอีกครั้ง</span>', { ok: 'ยกเลิกการปิดงวด', danger: true }))) return;
      const run = Store.s.pay.runs[Store.pk];
      run.status = 'DRAFT';
      run.approvedAt = null;
      Store.commit('ยกเลิกการปิดงวดเงินเดือน', U.fmtPeriodShort(Store.pk));
      PL.App.rerender();
    },
  };
  const s0 = () => Store.s.pay.settings;

  /* ================= สลิปเงินเดือน (หน้า) ================= */
  const sp = { q: '', dept: '', sel: null };
  PL.Views.payslip = {
    render(el) {
      const s = Store.s, pk = Store.pk;
      const ps = Pay.status(s, pk), run = ps.run;
      el.innerHTML = `${UI.stepHeader('payslip', run ? `<button class="btn" data-act="one">${UI.icon('printer', 16)} พิมพ์สลิปนี้</button><button class="btn primary" data-act="all">${UI.icon('printer', 16)} พิมพ์ทั้งหมด (${run.rows.length})</button>` : '')}
        ${PL.payBanner(s, pk, ps)}
        ${run ? `<div class="slip-layout"><div class="card slip-list"><div class="toolbar"><select class="input sm" data-dept>${UI.deptOptions(sp.dept)}</select><input class="input sm" data-q placeholder="ค้นหา" value="${esc(sp.q)}" style="flex:1;min-width:0"></div><div data-list></div></div>
          <div class="card slip-preview" data-preview></div></div>` : `<div class="card">${UI.empty('ยังไม่มีเงินเดือนงวดนี้', '<a class="btn primary" href="#/payroll">ไปคำนวณเงินเดือน</a>')}</div>`}`;
      if (!run) return;
      const list = el.querySelector('[data-list]'), prev = el.querySelector('[data-preview]');
      const rows = () => {
        const q = sp.q.toLowerCase();
        return run.rows.filter((r) => (!sp.dept || r.dept === sp.dept) && (!q || `${r.code} ${r.name}`.toLowerCase().includes(q)));
      };
      const show = () => {
        const rs = rows();
        if (!rs.some((r) => r.e === sp.sel)) sp.sel = rs[0] ? rs[0].e : null;
        list.innerHTML = rs.length
          ? rs.map((r) => `<button class="slip-item ${r.e === sp.sel ? 'active' : ''}" data-e="${r.e}"><span><b>${esc(r.name)}</b><small>${esc(r.code)} · ${esc(r.dept)}</small></span><span class="mono">${m2(r.net)}</span></button>`).join('')
          : '<div class="muted" style="padding:12px">ไม่พบพนักงาน</div>';
        const r = run.rows.find((x) => x.e === sp.sel);
        prev.innerHTML = r ? Slip.html(s, run, r) + Slip.calcNote(s, r) : UI.empty('เลือกพนักงาน');
      };
      show();
      list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-e]');
        if (b) {
          sp.sel = b.dataset.e;
          show();
        }
      });
      el.querySelector('[data-dept]').addEventListener('change', (e) => ((sp.dept = e.target.value), show()));
      el.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((sp.q = e.target.value.trim()), show()), 150));
      el.querySelector('[data-act="one"]').addEventListener('click', () => {
        const r = run.rows.find((x) => x.e === sp.sel);
        if (r) Slip.print(run, [r]);
      });
      el.querySelector('[data-act="all"]').addEventListener('click', () => Slip.print(run, rows().length ? rows() : run.rows));
    },
  };
})(window);

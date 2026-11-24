/* เงินเดือน: รายงาน — ประกันสังคม / ภ.ง.ด.1 / ไฟล์โอนเงิน / สรุปตามแผนก / สรุปรายปี / ภ.ง.ด.1ก / 50 ทวิ */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store, Pay = PL.Payroll;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const m2 = (n) => U.money(n);
  const st = { tab: 'detail', taxOnly: false, year: '', q: '', dept: '', group: true };
  const YEAR_TABS = ['year', 'pnd1k', 'cert'];
  const years = (s) => [...new Set(Object.keys(s.pay.runs).map((k) => k.slice(0, 4)).concat(Store.pk.slice(0, 4)))].sort();
  const yearSelect = (s) => `<select class="input sm no-print" data-year>${years(s).map((y) => `<option value="${y}" ${y === st.year ? 'selected' : ''}>ปีภาษี ${+y + 543}</option>`).join('')}</select>`;
  const bindYear = (body) =>
    body.querySelector('[data-year]').addEventListener('change', (e) => {
      st.year = e.target.value;
      PL.App.rerender();
    });
  // ข้อมูลรายปีสำหรับ ภ.ง.ด.1ก / 50 ทวิ: งวดที่ปิดแล้ว + ที่อยู่ + สถานะครบปี
  const annual = (s, year) => {
    const ys = Pay.yearSummary(s, year);
    const emp = {};
    s.employees.forEach((e) => (emp[e.id] = e));
    const rows = ys.rows
      .filter((r) => r.taxIncome > 0)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((r, i) => {
        const e = emp[r.e] || {}, p = e.pay || {};
        return { ...r, no: i + 1, ...splitName(r.name), taxId: (p.taxId || r.taxId || ''), address: p.address || '', end: e.end || '' };
      });
    const dec = s.pay.runs[`${year}-12`];
    return { ...ys, rows, complete: !!dec && dec.status === 'APPROVED' };
  };
  const certHtml = (s, yearStr, r) => {
    const S = s.pay.settings, year = +yearStr;
    const box = (on) => `<span class="cb">${on ? '✓' : ''}</span>`;
    const id = (v) => `<span class="mono">${esc(U.fmtTaxId(v) || '–')}</span>`;
    return `<div class="cert">
      <div class="cert-top"><span>ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)</span><span>เล่มที่ ${year + 543} เลขที่ ${U.pad(r.no, 4)}</span></div>
      <h2>หนังสือรับรองการหักภาษี ณ ที่จ่าย</h2><div class="cert-sub">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
      <div class="cert-box"><b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</b>
        <div class="cert-row"><span>ชื่อ</span><b>${esc(s.company.name)}</b><span>เลขประจำตัวผู้เสียภาษีอากร</span>${id(S.companyTaxId)}</div>
        <div class="cert-row"><span>ที่อยู่</span><span class="fill">${esc(s.company.address || '')}</span><span>สาขา</span><span>${esc(S.companyBranch || '00000')}</span></div></div>
      <div class="cert-box"><b>ผู้ถูกหักภาษี ณ ที่จ่าย</b>
        <div class="cert-row"><span>ชื่อ</span><b>${esc(r.name)}</b><span>เลขประจำตัวผู้เสียภาษีอากร</span>${id(r.taxId)}</div>
        <div class="cert-row"><span>ที่อยู่</span><span class="fill">${esc(r.address)}</span></div>
        <div class="cert-row"><span>ลำดับที่ ${r.no} ในแบบ</span><span>${box(true)} (1) ภ.ง.ด.1ก &nbsp; ${box(false)} (2) ภ.ง.ด.1ก พิเศษ &nbsp; ${box(false)} (3) ภ.ง.ด.2 &nbsp; ${box(false)} (4) ภ.ง.ด.3 &nbsp; ${box(false)} (5) ภ.ง.ด.2ก &nbsp; ${box(false)} (6) ภ.ง.ด.3ก &nbsp; ${box(false)} (7) ภ.ง.ด.53</span></div></div>
      <table class="cert-tbl"><thead><tr><th>ประเภทเงินได้พึงประเมินที่จ่าย</th><th>วัน เดือน หรือปีภาษี ที่จ่าย</th><th class="r">จำนวนเงินที่จ่าย</th><th class="r">ภาษีที่หัก<br>และนำส่งไว้</th></tr></thead>
        <tbody><tr><td>1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</td><td>ปีภาษี ${year + 543}<br><small class="muted">${r.months.length} งวด (${U.fmtPeriodShort(r.months[0])} – ${U.fmtPeriodShort(r.months[r.months.length - 1])})</small></td><td class="r">${m2(r.taxIncome)}</td><td class="r">${m2(r.tax)}</td></tr>
        <tr><td>2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)</td><td></td><td></td><td></td></tr>
        <tr><td>3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)</td><td></td><td></td><td></td></tr>
        <tr><td>4. อื่น ๆ (ระบุ)</td><td></td><td></td><td></td></tr></tbody>
        <tfoot><tr><td colspan="2" class="r">รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td><td class="r">${m2(r.taxIncome)}</td><td class="r">${m2(r.tax)}</td></tr>
        <tr><td colspan="4">รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) <b>${Pay.bahtText(r.tax)}</b></td></tr></tfoot></table>
      <div class="cert-row" style="margin-top:8px"><span>เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน</span><span>–</span><span>กองทุนประกันสังคม</span><b>${m2(r.sso)}</b><span>กองทุนสำรองเลี้ยงชีพ</span><b>${m2(r.pvd)}</b></div>
      <div class="cert-row"><span>ผู้จ่ายเงิน</span><span>${box(true)} (1) หัก ณ ที่จ่าย &nbsp; ${box(false)} (2) ออกให้ตลอดไป &nbsp; ${box(false)} (3) ออกให้ครั้งเดียว &nbsp; ${box(false)} (4) อื่น ๆ</span></div>
      <div class="cert-sign"><div class="cert-warn">คำเตือน: ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร</div>
        <div class="cert-signbox">ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ<br><br>ลงชื่อ ....................................................... ผู้จ่ายเงิน<br>(.......................................................)<br>วันที่ ........ / ........ / ............<div class="cert-seal">ประทับตรา<br>นิติบุคคล<br>(ถ้ามี)</div></div></div>
    </div>`;
  };

  // แยกคำนำหน้า / ชื่อ / สกุล สำหรับแบบฟอร์มราชการ
  const splitName = (full) => {
    const m = String(full || '').match(/^(นางสาว|นาย|นาง|น\.ส\.)?\s*(\S+)\s*(.*)$/);
    return m ? { prefix: m[1] || '', first: m[2] || '', last: m[3] || '' } : { prefix: '', first: full, last: '' };
  };
  const nextMonthDay = (pk, d) => {
    const n = U.periodShift(pk, 1);
    return `${n}-${U.pad(d)}`;
  };

  PL.Views.payreports = {
    render(el, params) {
      if (params.tab) st.tab = params.tab;
      const s = Store.s, pk = Store.pk;
      const ps = Pay.status(s, pk), run = ps.run;
      const tabs = [
        { key: 'detail', label: 'รายละเอียดเงินเดือน', icon: 'list' },
        { key: 'acct', label: 'สรุปสำหรับฝ่ายบัญชี', icon: 'calculator' },
        { key: 'sso', label: 'ประกันสังคม (สปส.1-10)', icon: 'users' },
        { key: 'pnd1', label: 'ภาษี ภ.ง.ด.1', icon: 'file' },
        { key: 'bank', label: 'ไฟล์โอนเงินเดือน', icon: 'send' },
        { key: 'dept', label: 'สรุปตามแผนก', icon: 'bars' },
        { key: 'year', label: 'สรุปรายปี', icon: 'calendar' },
        { key: 'pnd1k', label: 'ภ.ง.ด.1ก', icon: 'file' },
        { key: 'cert', label: '50 ทวิ', icon: 'printer' },
      ];
      const yearly = YEAR_TABS.includes(st.tab);
      el.innerHTML = `${UI.stepHeader('payreports', `<button class="btn" data-act="csv">${UI.icon('download', 16)} ส่งออก CSV</button><button class="btn" data-act="print">${UI.icon('printer', 16)} พิมพ์</button>`)}
        ${yearly ? '' : PL.payBanner(s, pk, ps)}
        ${UI.tabs(tabs, st.tab)}<div data-body></div>`;
      el.querySelector('.tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (b) {
          st.tab = b.dataset.tab;
          PL.App.rerender();
        }
      });
      const body = el.querySelector('[data-body]');
      let out = null;
      if (yearly) out = this[st.tab](body);
      else if (!run) body.innerHTML = `<div class="card">${UI.empty('ยังไม่มีเงินเดือนงวดนี้', '<a class="btn primary" href="#/payroll">ไปคำนวณเงินเดือน</a>')}</div>`;
      else out = this[st.tab](body, run);
      el.querySelector('[data-act="csv"]').addEventListener('click', () => {
        if (!out) return UI.toast('ไม่มีข้อมูลให้ส่งออก', 'info');
        UI.exportCSV(out.file, out.cols, out.rows);
      });
      el.querySelector('[data-act="print"]').addEventListener('click', () => {
        if (out && out.print) return out.print();
        if (out && out.table) {
          out.table.o.pageSize = 100000;
          out.table.render();
        }
        window.print();
        if (out && out.table) {
          out.table.o.pageSize = 50;
          out.table.render();
        }
      });
    },
    head(title, kv, note) {
      const s = Store.s;
      return `<div class="card-head"><h3>${title}</h3></div>
        <div class="print-only" style="margin-bottom:6px"><b>${esc(s.company.name)}</b> · ${title}</div>
        <div class="kv kv-wide">${kv.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>
        ${note ? `<p class="muted" style="font-size:12.5px;margin:10px 0 14px">${note}</p>` : '<div style="height:14px"></div>'}`;
    },
    // หมายเหตุยอดที่ไม่อยู่ในแบบภาษี (เงินได้ไม่คิดภาษี) และเงินหักก่อนภาษีที่ลดเงินได้ไปแล้ว
    taxNote(rows) {
      const nt = U.sum(rows, (r) => r.nonTaxEarn || 0), td = U.sum(rows, (r) => r.taxDed || 0);
      if (!nt && !td) return '';
      return `<br>${nt ? `ไม่รวมเงินได้ที่ตั้ง "ไม่คิดภาษี" ${m2(nt)} บาท (${rows.filter((r) => r.nonTaxEarn).length} ราย)` : ''}${nt && td ? ' · ' : ''}${td ? `หักเงินหักก่อนภาษีออกแล้ว ${m2(td)} บาท (${rows.filter((r) => r.taxDed).length} ราย)` : ''}`;
    },
    table(body, cols, rows, footer) {
      const t = new UI.DataTable({ pageSize: 50, compact: true, columns: cols, footer });
      t.setRows(rows);
      body.querySelector('[data-tbl]').appendChild(t.el);
      return t;
    },

    // หัวรายงานที่พิมพ์/ส่งต่อ: ชื่อบริษัท งวด สถานะ
    runHead(s, run, title) {
      const R = E.range(s, run.pk), draft = run.status !== 'APPROVED';
      return `<div class="rep-head"><div><b>${esc(s.company.name)}</b>${s.pay.settings.companyTaxId ? ` <span class="muted">เลขผู้เสียภาษี ${esc(U.fmtTaxId(s.pay.settings.companyTaxId))}</span>` : ''}<h3>${title}</h3>
        <div class="muted">งวด ${U.fmtPeriod(run.pk)} (${U.fmtDate(R.start)} – ${U.fmtDate(R.end)}) · วันที่จ่าย ${U.fmtDate(run.payDate)}</div></div>
        <div class="rep-status">${draft ? UI.pill('ฉบับร่าง — ยังไม่ปิดงวด', 'warn') : UI.pill(`ปิดงวดแล้ว ${U.fmtStamp(run.approvedAt)}`, 'ok')}<div class="muted" style="font-size:11.5px;margin-top:4px">พิมพ์เมื่อ ${U.fmtStamp(U.nowISO())} โดย ${esc(s.user.name)}</div></div></div>`;
    },
    signBlock() {
      return `<div class="rep-sign">${['ผู้จัดทำ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ'].map((x) => `<div><div class="rep-line"></div>${x}<br><span class="muted">วันที่ ......../......../........</span></div>`).join('')}</div>`;
    },

    /* ---------- รายละเอียดเงินเดือน (ทุกรายการรายคน แยกแผนก) ---------- */
    detail(body, run) {
      const s = Store.s;
      const C = Pay.detailColumns(s, run);
      const cols = [
        ...C.earn.map((c) => ({ ...c, k: 'E:' + c.code, grp: 'earn' })),
        { k: 'gross', name: 'รวมเงินได้', grp: 'sum' },
        ...C.time.map((c) => ({ ...c, k: 'D:' + c.code, grp: 'ded' })),
        ...C.stat.map((c) => ({ ...c, k: 'D:' + c.code, grp: 'ded' })),
        ...C.ded.map((c) => ({ ...c, k: 'D:' + c.code, grp: 'ded' })),
        { k: 'totalDed', name: 'รวมรายการหัก', grp: 'sum' },
        { k: 'net', name: 'เงินได้สุทธิ', grp: 'net' },
        { k: 'ssoEr', name: 'ปกส. นายจ้าง', grp: 'er' },
        { k: 'pvdEr', name: 'กองทุนฯ นายจ้าง', grp: 'er' },
        { k: 'cost', name: 'ต้นทุนรวม', grp: 'er' },
      ];
      const val = (r, c) => {
        if (c.k === 'cost') return U.r2(r.gross - r.timeDed + r.ssoEr + r.pvdEr);
        return c.k.includes(':') ? r._m[c.k] || 0 : r[c.k] || 0;
      };
      const rows = run.rows
        .filter((r) => !st.dept || r.dept === st.dept)
        .slice()
        .sort((a, b) => (st.group ? a.dept.localeCompare(b.dept) : 0) || a.code.localeCompare(b.code))
        .map((r) => Object.assign({}, r, { _m: Pay.byCode(r) }));
      const cell = (v, c) => `<td class="r${c.grp === 'sum' || c.grp === 'net' ? ' b' : ''}">${v ? m2(v) : '<span class="muted">–</span>'}</td>`;
      const totalRow = (rs, label, cls) => `<tr class="${cls}"><td colspan="3">${label} (${rs.length} คน)</td>${cols.map((c) => cell(U.r2(U.sum(rs, (r) => val(r, c))), c)).join('')}</tr>`;
      let html = '', n = 0;
      const groups = st.group ? [...new Set(rows.map((r) => r.dept))] : [null];
      for (const g of groups) {
        const rs = g === null ? rows : rows.filter((r) => r.dept === g);
        if (g !== null) html += `<tr class="rep-grp"><td colspan="${cols.length + 3}">แผนก${esc(g)}</td></tr>`;
        html += rs.map((r) => `<tr><td class="r muted">${++n}</td><td class="mono">${esc(r.code)}</td><td class="nowrap">${esc(r.name)}${r.prorate ? ' <small class="muted">(ตามสัดส่วน)</small>' : ''}</td>${cols.map((c) => cell(val(r, c), c)).join('')}</tr>`).join('');
        if (g !== null && groups.length > 1) html += totalRow(rs, `รวมแผนก${esc(g)}`, 'rep-sub');
      }
      const grpHead = (grp, label) => {
        const k = cols.filter((c) => c.grp === grp).length;
        return k ? `<th colspan="${k}" class="c">${label}</th>` : '';
      };
      body.innerHTML = `<div class="card">
        <div class="toolbar no-print"><select class="input sm" data-dept>${UI.deptOptions(st.dept)}</select>
          <label class="check"><input type="checkbox" data-group ${st.group ? 'checked' : ''}> แยกตามแผนก พร้อมยอดรวมแผนก</label>
          <span class="spacer"></span><span class="muted" style="font-size:12.5px">${cols.length} คอลัมน์ · พิมพ์แนวนอน A4 / ส่งออก CSV ด้านบน</span></div>
        ${this.runHead(s, run, 'รายงานรายละเอียดเงินเดือน')}
        <div class="tbl-wrap rep-wide"><table class="tbl compact rep-tbl"><thead>
          <tr><th rowspan="2">#</th><th rowspan="2">รหัส</th><th rowspan="2">ชื่อ-สกุล</th>${grpHead('earn', 'เงินได้')}<th rowspan="2" class="r">รวมเงินได้</th>${cols.some((c) => c.grp === 'ded') ? `<th colspan="${cols.filter((c) => c.grp === 'ded').length}" class="c">รายการหัก</th>` : ''}<th rowspan="2" class="r">รวมรายการหัก</th><th rowspan="2" class="r">เงินได้สุทธิ</th>${grpHead('er', 'ส่วนนายจ้าง')}</tr>
          <tr>${cols.filter((c) => !['sum', 'net'].includes(c.grp)).map((c) => `<th class="r">${esc(c.name)}</th>`).join('')}</tr>
        </thead><tbody>${html}</tbody><tfoot>${totalRow(rows, 'รวมทั้งสิ้น', 'rep-total')}</tfoot></table></div>
        ${this.signBlock()}</div>`;
      body.querySelector('[data-dept]').addEventListener('change', (e) => ((st.dept = e.target.value), PL.App.rerender()));
      body.querySelector('[data-group]').addEventListener('change', (e) => ((st.group = e.target.checked), PL.App.rerender()));
      return {
        rows, file: `payroll-detail_${run.pk}.csv`,
        cols: [
          { label: 'รหัสพนักงาน', get: (r) => r.code }, { label: 'ชื่อ-สกุล', get: (r) => r.name }, { label: 'แผนก', get: (r) => r.dept }, { label: 'ตำแหน่ง', get: (r) => r.position },
          { label: 'ประเภทการจ้าง', get: (r) => (r.payType === 'D' ? 'รายวัน' : 'รายเดือน') }, { label: 'อัตรา', get: (r) => r.salary },
          ...cols.map((c) => ({ label: c.name, get: (r) => val(r, c) })),
          { label: 'เงินได้พึงประเมิน (ภาษี)', get: (r) => r.taxIncome }, { label: 'เงินได้ไม่คิดภาษี', get: (r) => r.nonTaxEarn || 0 },
          { label: 'ธนาคาร', get: (r) => r.bank }, { label: 'เลขที่บัญชี', get: (r) => String(r.acct || '').replace(/\D/g, '') },
        ],
      };
    },

    /* ---------- สรุปเงินเดือนสำหรับฝ่ายบัญชี ---------- */
    acct(body, run) {
      const s = Store.s;
      const A = Pay.accountingSummary(s, run), T = A.totals;
      const earnTotal = U.sum(A.earn, (e) => e.amount), timeTotal = U.sum(A.time, (e) => e.amount);
      const stat = [['ประกันสังคม (ลูกจ้าง)', T.sso], ['กองทุนสำรองเลี้ยงชีพ (ลูกจ้าง)', T.pvd], [T.tax < 0 ? 'คืนภาษีหัก ณ ที่จ่าย (ปรับปลายปี)' : 'ภาษีหัก ณ ที่จ่าย', T.tax]].filter(([, v]) => v);
      const row = (a, b, c, cls = '') => `<tr class="${cls}"><td>${a}</td><td class="r">${b}</td><td class="r">${c}</td></tr>`;
      body.innerHTML = `<div class="card">
        ${this.runHead(s, run, 'สรุปเงินเดือนสำหรับฝ่ายบัญชี')}
        ${run.status !== 'APPROVED' ? UI.banner('warn', 'งวดนี้ยังไม่ปิด — ตัวเลขอาจเปลี่ยนได้ ควรส่งฝ่ายบัญชีหลังอนุมัติและปิดงวด') : ''}
        <div class="mini-stats">
          <div class="mini"><div class="m-label">พนักงาน</div><div class="m-val">${T.n}</div><div class="m-sub">คน</div></div>
          <div class="mini"><div class="m-label">รวมเงินได้</div><div class="m-val">${U.num(T.gross)}</div><div class="m-sub">ก่อนหักขาด/สาย</div></div>
          <div class="mini m-bad"><div class="m-label">รวมรายการหัก</div><div class="m-val">${U.num(T.totalDed)}</div></div>
          <div class="mini m-ok"><div class="m-label">จ่ายสุทธิ</div><div class="m-val">${U.num(T.net)}</div></div>
          <div class="mini"><div class="m-label">ต้นทุนนายจ้าง</div><div class="m-val">${U.num(T.cost)}</div><div class="m-sub">รวมเงินสมทบ</div></div>
        </div>
        <div class="grid" style="margin-top:14px">
          <div class="span-6"><h4 class="rep-h4">1. เงินได้และรายการหักตามประเภท</h4>
            <table class="tbl compact rep-tbl"><thead><tr><th>รายการ</th><th class="r">คน</th><th class="r">จำนวนเงิน</th></tr></thead><tbody>
            ${A.earn.map((e) => row(`${esc(e.name)}${e.taxable ? '' : ' <small class="muted">(ไม่คิดภาษี)</small>'}`, e.n, m2(e.amount))).join('')}
            ${row('<b>รวมเงินได้</b>', '', `<b>${m2(earnTotal)}</b>`, 'rep-sub')}
            ${A.time.map((e) => row(`หัก ${esc(e.name.replace(/^หัก/, ''))}`, '', `(${m2(e.amount)})`)).join('')}
            ${A.time.length ? row('<b>เงินเดือนค่าจ้างหลังหักขาด/ลา/สาย</b>', '', `<b>${m2(earnTotal - timeTotal)}</b>`, 'rep-sub') : ''}
            ${stat.map(([n, v]) => row(esc(n), '', `(${m2(v)})`)).join('')}
            ${A.ded.map((d) => row(esc(d.name), d.n, `(${m2(d.amount)})`)).join('')}
            ${row('<b>จ่ายสุทธิให้พนักงาน</b>', T.n, `<b>${m2(T.net)}</b>`, 'rep-total')}
            ${row('เงินสมทบประกันสังคม (นายจ้าง)', '', m2(T.ssoEr))}
            ${T.pvdEr ? row('เงินสมทบกองทุนสำรองฯ (นายจ้าง)', '', m2(T.pvdEr)) : ''}
            ${row('<b>ต้นทุนเงินเดือนรวมของนายจ้าง</b>', '', `<b>${m2(T.cost)}</b>`, 'rep-total')}
            </tbody></table></div>
          <div class="span-6"><h4 class="rep-h4">3. การจ่ายเงินและการนำส่ง</h4>
            <table class="tbl compact rep-tbl"><thead><tr><th>รายการ</th><th>กำหนด</th><th class="r">จำนวนเงิน</th></tr></thead><tbody>
            ${Object.entries(A.banks).map(([b, x]) => `<tr><td>โอนเงินเดือน ธ.${esc(b)} <small class="muted">${x.n} คน</small></td><td class="nowrap">${U.fmtDate(run.payDate)}</td><td class="r">${m2(x.amount)}</td></tr>`).join('')}
            ${A.cash.n ? `<tr><td>จ่ายเงินสด/เช็ค <small class="muted">${A.cash.n} คน</small></td><td class="nowrap">${U.fmtDate(run.payDate)}</td><td class="r">${m2(A.cash.amount)}</td></tr>` : ''}
            <tr class="rep-sub"><td><b>รวมจ่ายพนักงาน</b></td><td></td><td class="r"><b>${m2(A.bankTotal + A.cash.amount)}</b></td></tr>
            ${A.remit.map((x) => `<tr><td>นำส่ง${esc(x.what)}</td><td class="nowrap">${x.due ? 'ภายใน ' + U.fmtDate(x.due) : ''}${x.note ? ` <small class="muted">${esc(x.note)}</small>` : ''}</td><td class="r">${m2(x.amount)}</td></tr>`).join('')}
            <tr class="rep-total"><td><b>รวมจ่ายพนักงาน + นำส่งราชการ/กองทุน</b></td><td></td><td class="r"><b>${m2(A.bankTotal + A.cash.amount + U.sum(A.remit, (x) => x.amount))}</b></td></tr>
            ${A.ded.length ? `<tr class="rep-grp"><td colspan="3">เงินหักอื่นจากพนักงาน — ตัดชำระลูกหนี้ หรือนำส่งหน่วยงาน (เช่น กยศ.) ตามประเภท</td></tr>
              ${A.ded.map((d) => `<tr><td>${esc(d.name)} <small class="muted">${d.n} คน</small></td><td></td><td class="r">${m2(d.amount)}</td></tr>`).join('')}` : ''}
            </tbody></table>
            <h4 class="rep-h4" style="margin-top:16px">4. ต้นทุนตามแผนก (ศูนย์ต้นทุน)</h4>
            <table class="tbl compact rep-tbl"><thead><tr><th>แผนก</th><th class="r">คน</th><th class="r">เงินได้หลังหักขาด/สาย</th><th class="r">สมทบนายจ้าง</th><th class="r">ต้นทุนรวม</th></tr></thead><tbody>
            ${A.depts.map((d) => `<tr><td>${esc(d.dept)}</td><td class="r">${d.n}</td><td class="r">${m2(d.gross - d.timeDed)}</td><td class="r">${m2(d.ssoEr + d.pvdEr)}</td><td class="r">${m2(d.cost)}</td></tr>`).join('')}
            <tr class="rep-total"><td>รวม</td><td class="r">${T.n}</td><td class="r">${m2(T.gross - T.timeDed)}</td><td class="r">${m2(T.ssoEr + T.pvdEr)}</td><td class="r">${m2(T.cost)}</td></tr></tbody></table></div>
          <div class="span-12"><h4 class="rep-h4">2. รายการบันทึกบัญชี (สมุดรายวันทั่วไป) ${A.balanced ? UI.pill('เดบิต = เครดิต', 'ok') : UI.pill('ไม่สมดุล — ตรวจสอบ', 'bad')}</h4>
            <table class="tbl compact rep-tbl"><thead><tr><th style="width:110px">รหัสบัญชี</th><th>ชื่อบัญชี</th><th>คำอธิบาย</th><th class="r">เดบิต</th><th class="r">เครดิต</th></tr></thead><tbody>
            ${A.lines.map((l) => `<tr><td class="mono">${esc(l.code)}</td><td>${l.cr && !l.dr ? '&nbsp;&nbsp;&nbsp;&nbsp;' : ''}${esc(l.name)}</td><td class="muted" style="font-size:12px">${esc(l.memo.join(', '))}</td><td class="r">${l.dr ? m2(l.dr) : ''}</td><td class="r">${l.cr ? m2(l.cr) : ''}</td></tr>`).join('')}
            </tbody><tfoot><tr class="rep-total"><td colspan="3">รวม · บันทึกค่าใช้จ่ายเงินเดือนงวด ${U.fmtPeriod(run.pk)} วันที่ ${U.fmtDate(run.payDate)}</td><td class="r">${m2(A.dr)}</td><td class="r">${m2(A.cr)}</td></tr></tfoot></table>
            <p class="muted no-print" style="font-size:12px;margin:8px 0 0">รหัสบัญชีตั้งที่ <a href="#/paysetup?tab=rates">ตั้งค่าเงินเดือน > อัตรา (ผังบัญชี)</a> และรายการเงินได้/เงินหักแต่ละตัว · ปุ่ม "ส่งออก CSV" ด้านบนส่งออกรายการบันทึกบัญชี <button class="btn xs" data-items>${UI.icon('download', 13)} CSV สรุปตามรายการ</button></p></div>
        </div>
        ${this.signBlock()}</div>`;
      body.querySelector('[data-items]').addEventListener('click', () =>
        UI.exportCSV(`payroll-summary-items_${run.pk}.csv`, [{ label: 'หมวด', get: (x) => x.g }, { label: 'รายการ', get: (x) => x.name }, { label: 'จำนวนคน', get: (x) => x.n || '' }, { label: 'จำนวนเงิน', get: (x) => x.amount }], [
          ...A.earn.map((e) => ({ g: 'เงินได้', ...e })), ...A.time.map((e) => ({ g: 'หักขาด/ลา/สาย', ...e })),
          ...stat.map(([name, amount]) => ({ g: 'เงินหักตามกฎหมาย', name, amount })), ...A.ded.map((d) => ({ g: 'เงินหักอื่น', ...d })),
          { g: 'สุทธิ', name: 'จ่ายสุทธิให้พนักงาน', n: T.n, amount: T.net }, { g: 'ส่วนนายจ้าง', name: 'ประกันสังคม (นายจ้าง)', amount: T.ssoEr },
          { g: 'ส่วนนายจ้าง', name: 'กองทุนสำรองฯ (นายจ้าง)', amount: T.pvdEr }, { g: 'ต้นทุน', name: 'ต้นทุนเงินเดือนรวม', amount: T.cost },
        ])
      );
      return {
        rows: A.lines, file: `payroll-journal_${run.pk}.csv`,
        cols: [
          { label: 'วันที่', get: () => run.payDate }, { label: 'รหัสบัญชี', get: (l) => l.code }, { label: 'ชื่อบัญชี', get: (l) => l.name },
          { label: 'คำอธิบาย', get: (l) => `เงินเดือนงวด ${U.fmtPeriodShort(run.pk)}${l.memo.length ? ' - ' + l.memo.join(', ') : ''}` }, { label: 'เดบิต', get: (l) => l.dr || '' }, { label: 'เครดิต', get: (l) => l.cr || '' },
        ],
      };
    },

    sso(body, run) {
      const s = Store.s, S = s.pay.settings;
      const rows = run.rows.filter((r) => r.sso > 0).map((r, i) => ({ ...r, no: i + 1, ...splitName(r.name) }));
      const sum = (f) => U.sum(rows, f);
      body.innerHTML = `<div class="card">${this.head('รายละเอียดการนำส่งเงินสมทบ (สปส.1-10 ส่วนที่ 2)', [
        ['งวดค่าจ้าง', U.fmtPeriod(run.pk)], ['เลขที่บัญชีนายจ้าง', esc(S.ssoAccount || '– (ระบุที่ตั้งค่าเงินเดือน)')],
        ['จำนวนผู้ประกันตน', `${rows.length} คน`], ['ค่าจ้างที่ใช้คำนวณรวม', m2(sum((r) => r.ssoBase))],
        ['เงินสมทบผู้ประกันตน', m2(sum((r) => r.sso))], ['เงินสมทบนายจ้าง', m2(sum((r) => r.ssoEr))],
        ['รวมเงินที่ต้องนำส่ง', `<b>${m2(sum((r) => r.sso + r.ssoEr))}</b>`], ['กำหนดนำส่ง', `ภายใน ${U.fmtDate(nextMonthDay(run.pk, 15))}`],
      ], `อัตรา ${S.ssoRate}% ฐานค่าจ้างขั้นต่ำ ${U.num(S.ssoMin)} สูงสุด ${U.num(S.ssoMax)} บาท · ค่าจ้างจริงที่สูงกว่าเพดานจะคำนวณที่ ${U.num(S.ssoMax)} บาท`)}<div data-tbl></div></div>`;
      const cols = [
        { key: 'no', label: 'ลำดับ', align: 'r' },
        { key: 'taxId', label: 'เลขประจำตัวประชาชน', render: (r) => `<span class="mono">${esc(r.taxId || '—')}</span>` },
        { key: 'name', label: 'ชื่อ-สกุล', render: (r) => `${esc(r.name)} <span class="muted">${esc(r.code)}</span>` },
        { key: 'ssoWage', label: 'ค่าจ้างที่จ่ายจริง', align: 'r', render: (r) => m2(r.ssoWage) },
        { key: 'ssoBase', label: 'ค่าจ้างที่ใช้คำนวณ', align: 'r', render: (r) => m2(r.ssoBase) },
        { key: 'sso', label: 'สมทบลูกจ้าง', align: 'r', render: (r) => m2(r.sso) },
        { key: 'ssoEr', label: 'สมทบนายจ้าง', align: 'r', render: (r) => m2(r.ssoEr) },
      ];
      const table = this.table(body, cols, rows, (rs) => `<tr><td colspan="3">รวม ${rs.length} คน</td><td class="r">${m2(U.sum(rs, (r) => r.ssoWage))}</td><td class="r">${m2(U.sum(rs, (r) => r.ssoBase))}</td><td class="r">${m2(U.sum(rs, (r) => r.sso))}</td><td class="r">${m2(U.sum(rs, (r) => r.ssoEr))}</td></tr>`);
      return {
        table, rows, file: `sso-1-10_${run.pk}.csv`,
        cols: [
          { label: 'ลำดับ', get: (r) => r.no }, { label: 'เลขประจำตัวประชาชน', get: (r) => r.taxId }, { label: 'คำนำหน้า', get: (r) => r.prefix },
          { label: 'ชื่อ', get: (r) => r.first }, { label: 'สกุล', get: (r) => r.last }, { label: 'ค่าจ้างที่จ่ายจริง', get: (r) => r.ssoWage },
          { label: 'ค่าจ้างที่ใช้คำนวณ', get: (r) => r.ssoBase }, { label: 'เงินสมทบผู้ประกันตน', get: (r) => r.sso }, { label: 'เงินสมทบนายจ้าง', get: (r) => r.ssoEr },
        ],
      };
    },

    pnd1(body, run) {
      const s = Store.s, S = s.pay.settings;
      const rows = run.rows.filter((r) => r.taxIncome > 0 && (!st.taxOnly || r.tax > 0)).map((r, i) => ({ ...r, no: i + 1, ...splitName(r.name) }));
      body.innerHTML = `<div class="card">${this.head('ใบแนบ ภ.ง.ด.1 — ภาษีเงินได้หัก ณ ที่จ่าย (มาตรา 40(1))', [
        ['เดือนที่จ่าย', U.fmtPeriod(run.payDate.slice(0, 7))], ['เลขประจำตัวผู้เสียภาษีผู้จ่าย', `${esc(S.companyTaxId || '– (ระบุที่ตั้งค่าเงินเดือน)')} สาขา ${esc(S.companyBranch || '00000')}`],
        ['จำนวนราย', `${rows.length} ราย`], ['เงินได้ที่จ่ายรวม', m2(U.sum(rows, (r) => r.taxIncome))],
        ['ภาษีที่หักและนำส่ง', `<b>${m2(U.sum(rows, (r) => r.tax))}</b>`], ['กำหนดยื่น', `ภายใน ${U.fmtDate(nextMonthDay(run.payDate.slice(0, 7), 7))} (ยื่นออนไลน์ขยายถึง ${U.fmtDate(nextMonthDay(run.payDate.slice(0, 7), 15))})`],
      ], `<label class="check"><input type="checkbox" data-taxonly ${st.taxOnly ? 'checked' : ''}> แสดงเฉพาะรายที่มีภาษีหัก</label> · เงื่อนไขการหักภาษี 1 = หัก ณ ที่จ่าย${this.taxNote(run.rows)}`)}<div data-tbl></div></div>`;
      body.querySelector('[data-taxonly]').addEventListener('change', (e) => {
        st.taxOnly = e.target.checked;
        PL.App.rerender();
      });
      const cols = [
        { key: 'no', label: 'ลำดับ', align: 'r' },
        { key: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี', render: (r) => `<span class="mono">${esc(r.taxId || '—')}</span>` },
        { key: 'name', label: 'ชื่อ-สกุล', render: (r) => `${esc(r.name)} <span class="muted">${esc(r.code)}</span>` },
        { key: 'payDate', label: 'วันที่จ่าย', sort: false, render: () => U.fmtDateNum(run.payDate) },
        { key: 'taxIncome', label: 'เงินได้ที่จ่าย', align: 'r', render: (r) => m2(r.taxIncome) },
        { key: 'tax', label: 'ภาษีที่หัก', align: 'r', render: (r) => (r.tax ? `<b>${m2(r.tax)}</b>` : '<span class="muted">0.00</span>') },
        { key: 'cond', label: 'เงื่อนไข', sort: false, align: 'r', render: () => '1' },
      ];
      const table = this.table(body, cols, rows, (rs) => `<tr><td colspan="4">รวม ${rs.length} ราย</td><td class="r">${m2(U.sum(rs, (r) => r.taxIncome))}</td><td class="r">${m2(U.sum(rs, (r) => r.tax))}</td><td></td></tr>`);
      return {
        table, rows, file: `pnd1_${run.payDate.slice(0, 7)}.csv`,
        cols: [
          { label: 'ลำดับ', get: (r) => r.no }, { label: 'เลขประจำตัวผู้เสียภาษี', get: (r) => r.taxId }, { label: 'คำนำหน้า', get: (r) => r.prefix },
          { label: 'ชื่อ', get: (r) => r.first }, { label: 'สกุล', get: (r) => r.last }, { label: 'วันที่จ่าย', get: () => U.fmtDateNum(run.payDate) },
          { label: 'เงินได้ที่จ่าย', get: (r) => r.taxIncome }, { label: 'ภาษีที่หัก', get: (r) => r.tax }, { label: 'เงื่อนไข', get: () => 1 },
        ],
      };
    },

    bank(body, run) {
      const s = Store.s, S = s.pay.settings;
      const pay = run.rows.filter((r) => r.net > 0);
      const rows = pay.filter((r) => r.acct).map((r, i) => ({ ...r, no: i + 1 }));
      const missing = pay.filter((r) => !r.acct);
      const byBank = {};
      rows.forEach((r) => {
        const b = (byBank[r.bank || '-'] = byBank[r.bank || '-'] || { n: 0, amt: 0 });
        b.n++;
        b.amt += r.net;
      });
      body.innerHTML = `<div class="card">${this.head('รายการโอนเงินเดือนเข้าบัญชีพนักงาน', [
        ['วันที่โอน', U.fmtDate(run.payDate)], ['บัญชีบริษัท', esc(S.companyBank ? `${S.companyBank} ${S.companyAccount}` : '– (ระบุที่ตั้งค่าเงินเดือน)')],
        ['จำนวนรายการ', `${rows.length} รายการ`], ['ยอดโอนรวม', `<b>${m2(U.sum(rows, (r) => r.net))}</b>`],
        ...Object.entries(byBank).map(([b, x]) => [`ธนาคาร${esc(b)}`, `${x.n} ราย · ${m2(x.amt)}`]),
      ], missing.length ? `<span style="color:var(--bad)">${UI.icon('alert', 14)} ไม่มีบัญชีธนาคาร ${missing.length} คน (จ่ายเงินสด/เช็ค ${m2(U.sum(missing, (r) => r.net))} บาท): ${missing.map((r) => esc(`${r.code} ${r.name}`)).join(', ')} — <a href="#/paysetup">เพิ่มบัญชี</a></span>` : '')}<div data-tbl></div></div>`;
      const cols = [
        { key: 'no', label: 'ลำดับ', align: 'r' },
        { key: 'bank', label: 'ธนาคาร' },
        { key: 'acct', label: 'เลขที่บัญชี', render: (r) => `<span class="mono">${esc(r.acct)}</span>` },
        { key: 'name', label: 'ชื่อบัญชี', render: (r) => `${esc(r.name)} <span class="muted">${esc(r.code)}</span>` },
        { key: 'net', label: 'จำนวนเงิน', align: 'r', render: (r) => `<b>${m2(r.net)}</b>` },
      ];
      const table = this.table(body, cols, rows, (rs) => `<tr><td colspan="4">รวม ${rs.length} รายการ</td><td class="r">${m2(U.sum(rs, (r) => r.net))}</td></tr>`);
      return {
        table, rows, file: `bank-transfer_${run.pk}.csv`,
        cols: [
          { label: 'ลำดับ', get: (r) => r.no }, { label: 'ธนาคาร', get: (r) => r.bank }, { label: 'เลขที่บัญชี', get: (r) => String(r.acct).replace(/\D/g, '') },
          { label: 'ชื่อบัญชี', get: (r) => r.name }, { label: 'จำนวนเงิน', get: (r) => r.net.toFixed(2) }, { label: 'รหัสพนักงาน', get: (r) => r.code },
        ],
      };
    },

    dept(body, run) {
      const by = {};
      run.rows.forEach((r) => {
        const d = (by[r.dept] = by[r.dept] || { dept: r.dept, n: 0, gross: 0, otPay: 0, timeDed: 0, sso: 0, tax: 0, pvd: 0, other: 0, net: 0, ssoEr: 0, pvdEr: 0 });
        d.n++;
        Object.keys(d).forEach((k) => typeof r[k] === 'number' && k !== 'n' && (d[k] += r[k]));
      });
      const rows = Object.values(by).map((d) => ({ ...d, cost: d.gross - d.timeDed + d.ssoEr + d.pvdEr }));
      const T = run.totals;
      body.innerHTML = `<div class="grid"><div class="card span-8">${this.head(`สรุปเงินเดือนตามแผนก · ${U.fmtPeriod(run.pk)}`, [['ต้นทุนนายจ้างรวม', `<b>${m2(T.cost)}</b>`], ['จ่ายสุทธิรวม', m2(T.net)]])}<div data-tbl></div></div>
        <div class="card span-4 no-print"><div class="card-head"><h3>${UI.icon('bars', 18)} ต้นทุนตามแผนก</h3></div>${UI.hbars(rows.sort((a, b) => b.cost - a.cost).map((r) => ({ label: r.dept, value: r.cost, sub: `${r.n} คน` })), { fmt: (v) => U.num(v) })}</div></div>`;
      const c = (key, label) => ({ key, label, align: 'r', render: (r) => m2(r[key]) });
      const cols = [{ key: 'dept', label: 'แผนก' }, { key: 'n', label: 'คน', align: 'r' }, c('gross', 'รวมเงินได้'), c('otPay', 'ค่าล่วงเวลา'), c('timeDed', 'หักขาด/สาย'), c('sso', 'ปกส.ลูกจ้าง'), c('tax', 'ภาษี'), c('pvd', 'กองทุนฯ'), c('other', 'หักอื่น'), c('net', 'สุทธิ'), c('ssoEr', 'ปกส.นายจ้าง'), c('pvdEr', 'กองทุนฯ นายจ้าง'), c('cost', 'ต้นทุนรวม')];
      const keys = ['gross', 'otPay', 'timeDed', 'sso', 'tax', 'pvd', 'other', 'net', 'ssoEr', 'pvdEr', 'cost'];
      const table = this.table(body, cols, rows, (rs) => `<tr><td>รวม</td><td class="r">${U.sum(rs, (r) => r.n)}</td>${keys.map((k) => `<td class="r">${m2(U.sum(rs, (r) => r[k]))}</td>`).join('')}</tr>`);
      return { table, rows, file: `payroll-by-dept_${run.pk}.csv`, cols: [{ label: 'แผนก', get: (r) => r.dept }, { label: 'จำนวนคน', get: (r) => r.n }, ...keys.map((k) => ({ label: cols.find((x) => x.key === k).label, get: (r) => U.r2(r[k]) }))] };
    },

    year(body) {
      const s = Store.s;
      if (!st.year) st.year = Store.pk.slice(0, 4);
      const ys = Pay.yearSummary(s, st.year);
      body.innerHTML = `<div class="card">
        <div class="card-head"><h3>สรุปเงินได้และภาษีทั้งปี</h3><span class="spacer"></span>${yearSelect(s)}</div>
        <div class="print-only"><b>${esc(s.company.name)}</b> · สรุปเงินได้และภาษีปี ${+st.year + 543}</div>
        <div class="kv kv-wide"><span>งวดที่ปิดแล้ว</span><span>${ys.periods.length ? ys.periods.map(U.fmtPeriodShort).join(', ') : '–'}</span>
          <span>เงินได้รวม</span><span>${m2(U.sum(ys.rows, (r) => r.taxIncome))}</span><span>ภาษีหัก ณ ที่จ่ายรวม</span><span>${m2(U.sum(ys.rows, (r) => r.tax))}</span></div>
        <p class="muted" style="font-size:12.5px;margin:10px 0 14px">นับเฉพาะงวดที่ปิดแล้ว — ใช้เป็นข้อมูลสำหรับหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) และ ภ.ง.ด.1ก</p><div data-tbl></div></div>`;
      bindYear(body);
      const c = (key, label) => ({ key, label, align: 'r', render: (r) => m2(r[key]) });
      const cols = [
        { key: 'code', label: 'พนักงาน', render: (r) => `<div class="emp-name nowrap">${esc(r.name)}</div><div class="emp-code">${esc(r.code)}</div>` },
        { key: 'taxId', label: 'เลขผู้เสียภาษี', render: (r) => `<span class="mono">${esc(r.taxId || '—')}</span>` },
        { key: 'months', label: 'จำนวนงวด', align: 'r', sv: (r) => r.months.length, render: (r) => r.months.length },
        c('taxIncome', 'เงินได้พึงประเมิน'), c('tax', 'ภาษีหัก ณ ที่จ่าย'), c('sso', 'ประกันสังคม'), c('pvd', 'กองทุนสำรองฯ'), c('net', 'รับสุทธิ'),
      ];
      const table = new UI.DataTable({ pageSize: 50, compact: true, columns: cols, sortKey: 'code' });
      table.setRows(ys.rows);
      body.querySelector('[data-tbl]').appendChild(table.el);
      return {
        table, rows: ys.rows, file: `payroll-year_${st.year}.csv`,
        cols: [
          { label: 'รหัสพนักงาน', get: (r) => r.code }, { label: 'ชื่อ-สกุล', get: (r) => r.name }, { label: 'เลขประจำตัวผู้เสียภาษี', get: (r) => r.taxId },
          { label: 'จำนวนงวด', get: (r) => r.months.length }, { label: 'เงินได้พึงประเมิน', get: (r) => r.taxIncome }, { label: 'ภาษีหัก ณ ที่จ่าย', get: (r) => r.tax },
          { label: 'ประกันสังคม', get: (r) => r.sso }, { label: 'กองทุนสำรองเลี้ยงชีพ', get: (r) => r.pvd }, { label: 'รับสุทธิ', get: (r) => r.net },
        ],
      };
    },

    // คำเตือนก่อนใช้เอกสารรายปี
    yearWarn(s, A) {
      const S = s.pay.settings;
      const w = [];
      if (!A.complete) w.push(`ยังไม่ได้ปิดงวด ธ.ค. ${+st.year + 543} — ตัวเลขยังไม่ครบทั้งปี (ปิดแล้ว: ${A.periods.map(U.fmtPeriodShort).join(', ') || '–'})`);
      if (!U.taxIdValid(S.companyTaxId)) w.push('เลขประจำตัวผู้เสียภาษีบริษัทยังไม่ได้กรอกหรือไม่ถูกต้อง — <a href="#/paysetup?tab=rates">ตั้งค่าเงินเดือน > อัตรา</a>');
      if (!s.company.address) w.push('ยังไม่มีที่อยู่บริษัท — <a href="#/settings">ตั้งค่า > ทั่วไป</a>');
      const badId = A.rows.filter((r) => !U.taxIdValid(r.taxId)).length;
      const noAddr = A.rows.filter((r) => !r.address).length;
      if (badId) w.push(`เลขผู้เสียภาษีพนักงานไม่มี/ไม่ถูกต้อง ${badId} คน`);
      if (noAddr) w.push(`ยังไม่มีที่อยู่พนักงาน ${noAddr} คน — <a href="#/paysetup">ตั้งค่าเงินเดือน</a>`);
      return w.length ? UI.banner('warn', w.join('<br>')) : '';
    },

    pnd1k(body) {
      const s = Store.s, S = s.pay.settings;
      if (!st.year) st.year = Store.pk.slice(0, 4);
      const A = annual(s, st.year), rows = A.rows;
      const y = +st.year;
      body.innerHTML = `${this.yearWarn(s, A)}<div class="card">
        <div class="card-head"><h3>ภ.ง.ด.1ก — แบบยื่นรายการภาษีเงินได้หัก ณ ที่จ่าย (ประจำปี)</h3><span class="spacer"></span>${yearSelect(s)}</div>
        <div class="print-only" style="margin-bottom:6px"><b>${esc(s.company.name)}</b> · ใบแนบ ภ.ง.ด.1ก ปีภาษี ${y + 543}</div>
        <div class="kv kv-wide">
          <span>ปีภาษี</span><span>${y + 543}</span><span>เลขประจำตัวผู้เสียภาษีผู้มีหน้าที่หักภาษี</span><span class="mono">${esc(U.fmtTaxId(S.companyTaxId) || '–')} สาขา ${esc(S.companyBranch || '00000')}</span>
          <span>จำนวนราย</span><span>${rows.length} ราย</span><span>เงินได้ตามมาตรา 40(1) รวม</span><span>${m2(U.sum(rows, (r) => r.taxIncome))}</span>
          <span>ภาษีที่หักนำส่งรวม</span><span><b>${m2(U.sum(rows, (r) => r.tax))}</b></span><span>กำหนดยื่น</span><span>ภายใน ${U.fmtDate(`${y + 1}-02-28`)} (ตรวจกำหนดล่าสุดกับกรมสรรพากร)</span></div>
        <p class="muted" style="font-size:12.5px;margin:10px 0 14px">นับจากงวดที่ปิดแล้วในปีภาษี · ไม่รวมเงินได้จากนายจ้างเดิม · เงื่อนไขการหักภาษี 1 = หัก ณ ที่จ่าย</p><div data-tbl></div></div>`;
      bindYear(body);
      const cols = [
        { key: 'no', label: 'ลำดับ', align: 'r' },
        { key: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี', render: (r) => `<span class="mono">${esc(U.fmtTaxId(r.taxId) || '—')}</span>${r.taxId && !U.taxIdValid(r.taxId) ? ' ' + UI.pill('ไม่ถูกต้อง', 'bad') : ''}` },
        { key: 'name', label: 'ชื่อ-สกุล', render: (r) => `${esc(r.name)} <span class="muted">${esc(r.code)}</span>` },
        { key: 'address', label: 'ที่อยู่', render: (r) => (r.address ? `<span style="font-size:12px">${esc(r.address)}</span>` : '<span class="muted">–</span>') },
        { key: 'taxIncome', label: 'เงินได้ทั้งปี', align: 'r', render: (r) => m2(r.taxIncome) },
        { key: 'tax', label: 'ภาษีที่หักทั้งปี', align: 'r', render: (r) => (r.tax ? `<b>${m2(r.tax)}</b>` : '<span class="muted">0.00</span>') },
        { key: 'cond', label: 'เงื่อนไข', sort: false, align: 'r', render: () => '1' },
      ];
      const table = this.table(body, cols, rows, (rs) => `<tr><td colspan="4">รวม ${rs.length} ราย</td><td class="r">${m2(U.sum(rs, (r) => r.taxIncome))}</td><td class="r">${m2(U.sum(rs, (r) => r.tax))}</td><td></td></tr>`);
      return {
        table, rows, file: `pnd1k_${st.year}.csv`,
        cols: [
          { label: 'ลำดับ', get: (r) => r.no }, { label: 'เลขประจำตัวผู้เสียภาษี', get: (r) => r.taxId }, { label: 'คำนำหน้า', get: (r) => r.prefix },
          { label: 'ชื่อ', get: (r) => r.first }, { label: 'สกุล', get: (r) => r.last }, { label: 'ที่อยู่', get: (r) => r.address },
          { label: 'เงินได้ทั้งปี', get: (r) => r.taxIncome }, { label: 'ภาษีที่หักทั้งปี', get: (r) => r.tax }, { label: 'เงื่อนไข', get: () => 1 },
        ],
      };
    },

    cert(body) {
      const s = Store.s;
      if (!st.year) st.year = Store.pk.slice(0, 4);
      const A = annual(s, st.year);
      const list = A.rows;
      if (!list.some((r) => r.e === st.cert)) st.cert = list[0] ? list[0].e : '';
      const cur = list.find((r) => r.e === st.cert);
      body.innerHTML = `${this.yearWarn(s, A)}<div class="slip-layout">
        <div class="card slip-list"><div class="row" style="margin-bottom:8px">${yearSelect(s)}<input class="input sm" data-q placeholder="ค้นหา" value="${esc(st.q)}" style="flex:1;min-width:0"></div>
          <button class="btn primary sm" data-all style="width:100%;margin-bottom:8px">${UI.icon('printer', 15)} พิมพ์ทั้งหมด (${list.length} ฉบับ)</button>
          ${list.map((r) => `<button class="slip-item ${r.e === st.cert ? 'active' : ''}" data-e="${esc(r.e)}" ${st.q && !`${r.code} ${r.name}`.toLowerCase().includes(st.q.toLowerCase()) ? 'style="display:none"' : ''}><span>${esc(r.name)}<small>${esc(r.code)}${r.end ? ' · ลาออก' : ''}</small></span><small>${m2(r.tax)}</small></button>`).join('') || '<p class="muted">ยังไม่มีงวดที่ปิดแล้วในปีนี้</p>'}</div>
        <div class="card slip-preview">${cur ? `<div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn sm" data-one>${UI.icon('printer', 15)} พิมพ์ฉบับนี้</button></div>${certHtml(s, st.year, cur)}` : UI.empty('ไม่มีข้อมูล')}</div></div>`;
      bindYear(body);
      // กรองรายชื่อในที่ (ไม่ render ใหม่ เพื่อไม่ให้ช่องค้นหาเสียโฟกัส)
      body.querySelector('[data-q]').addEventListener('input', (e) => {
        st.q = e.target.value.trim();
        const qq = st.q.toLowerCase();
        body.querySelectorAll('[data-e]').forEach((b) => (b.style.display = !qq || b.textContent.toLowerCase().includes(qq) ? '' : 'none'));
      });
      body.querySelectorAll('[data-e]').forEach((b) => b.addEventListener('click', () => {
        st.cert = b.dataset.e;
        PL.App.rerender();
      }));
      const print = (rows) => {
        if (!rows.length) return UI.toast('ไม่มีหนังสือรับรองให้พิมพ์', 'info');
        let root = document.getElementById('print-root');
        if (!root) {
          root = document.createElement('div');
          root.id = 'print-root';
          document.body.appendChild(root);
        }
        root.innerHTML = `<div class="certs-print">${rows.map((r) => certHtml(s, st.year, r)).join('')}</div>`;
        document.body.classList.add('printing-slips');
        const prev = document.title;
        document.title = rows.length === 1 ? `50ทวิ_${+st.year + 543}_${rows[0].code}` : `50ทวิ_${+st.year + 543}`;
        window.print();
        document.title = prev;
        document.body.classList.remove('printing-slips');
        root.innerHTML = '';
      };
      body.querySelector('[data-all]').addEventListener('click', () => print(list));
      const one = body.querySelector('[data-one]');
      if (one) one.addEventListener('click', () => print([cur]));
      return {
        print: () => print(cur ? [cur] : []), rows: list, file: `50tawi_${st.year}.csv`,
        cols: [
          { label: 'เลขที่', get: (r) => r.no }, { label: 'รหัสพนักงาน', get: (r) => r.code }, { label: 'ชื่อ-สกุล', get: (r) => r.name },
          { label: 'เลขประจำตัวผู้เสียภาษี', get: (r) => r.taxId }, { label: 'ที่อยู่', get: (r) => r.address }, { label: 'เงินได้ 40(1)', get: (r) => r.taxIncome },
          { label: 'ภาษีที่หัก', get: (r) => r.tax }, { label: 'ประกันสังคม', get: (r) => r.sso }, { label: 'กองทุนสำรองเลี้ยงชีพ', get: (r) => r.pvd },
        ],
      };
    },
  };
})(window);

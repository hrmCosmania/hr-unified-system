/* เงินเดือน: ตั้งค่า — ข้อมูลเงินเดือนพนักงาน / รายการเงินได้-เงินหัก / อัตราภาษีและประกันสังคม */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, UI = PL.UI, Store = PL.Store, Pay = PL.Payroll;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const st = { tab: 'emps', dept: '', q: '', missing: false };
  const MODE = { RECUR: 'ประจำทุกเดือน', ONCE: 'รายงวด' };
  const ACCT_USE = {
    EXP: 'Dr เงินเดือน ค่าแรง ตกเบิก (หักขาด/สายลดยอด) และเงินได้ระบบอื่น', OT: 'Dr ค่าล่วงเวลา', ALLOW: 'Dr เงินได้อื่นที่ไม่ได้ระบุบัญชี (ค่าตำแหน่ง ค่าเดินทาง ฯลฯ)',
    BONUS: 'Dr โบนัส / ค่าคอมมิชชั่น', SSO_ER: 'Dr ประกันสังคมส่วนนายจ้าง', PVD_ER: 'Dr กองทุนสำรองฯ ส่วนนายจ้าง',
    TAX_PAY: 'Cr ภาษีหัก ณ ที่จ่ายรอนำส่ง', SSO_PAY: 'Cr ประกันสังคมรอนำส่ง (ลูกจ้าง + นายจ้าง)', PVD_PAY: 'Cr กองทุนสำรองฯ รอนำส่ง (ลูกจ้าง + นายจ้าง)',
    DED: 'Cr เงินหักอื่นที่ไม่ได้ระบุบัญชี', NET_PAY: 'Cr เงินเดือนค้างจ่าย (ยอดโอนสุทธิ)',
  };

  const changed = (msg, detail) => {
    Pay.touch(Store.s);
    Store.commit(msg, detail);
  };

  PL.Views.paysetup = {
    render(el, params) {
      if (params.tab) st.tab = params.tab;
      el.innerHTML = `${UI.stepHeader('paysetup')}
        ${UI.tabs([
          { key: 'emps', label: 'ข้อมูลเงินเดือนพนักงาน', icon: 'users' },
          { key: 'items', label: 'รายการเงินได้ / เงินหัก', icon: 'list' },
          { key: 'rates', label: 'อัตราภาษีและประกันสังคม', icon: 'calculator' },
        ], st.tab)}<div data-body></div>`;
      el.querySelector('.tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (b) PL.App.go('paysetup', { tab: b.dataset.tab });
      });
      this[st.tab](el.querySelector('[data-body]'));
    },

    /* ---------- ข้อมูลเงินเดือนพนักงาน ---------- */
    emps(body) {
      const s = Store.s, items = Pay.itemMap(s);
      const missing = (e) => !e.pay.acct || !e.pay.taxId || !U.taxIdValid(e.pay.taxId);
      const recurTxt = (e) => Object.entries(e.pay.recur || {}).filter(([, v]) => +v).map(([k, v]) => `${(items[k] || {}).name || k} ${U.num(v)}`).join(' · ');
      const allowTxt = (p) => [p.spouse && 'คู่สมรส', p.children && `บุตร ${p.children}`, p.parents && `บิดามารดา ${p.parents}`, p.life && `ประกันชีวิต ${U.num(p.life)}`, p.health && `ประกันสุขภาพ ${U.num(p.health)}`].filter(Boolean).join(' · ');
      const nMissing = s.employees.filter((e) => e.active !== false && missing(e)).length;
      body.innerHTML = `${nMissing ? UI.banner('warn', `ข้อมูลไม่ครบ ${nMissing} คน (ไม่มีเลขบัญชี หรือเลขผู้เสียภาษีไม่มี/ไม่ถูกต้อง)`) : ''}
        <div class="card"><div class="toolbar">
          <select class="input sm" data-dept>${UI.deptOptions(st.dept)}</select>
          <input class="input sm search-in" data-q placeholder="ค้นหาพนักงาน" value="${esc(st.q)}">
          <label class="check"><input type="checkbox" data-missing ${st.missing ? 'checked' : ''}> เฉพาะข้อมูลไม่ครบ</label>
          <span class="spacer"></span><span class="muted" style="font-size:12.5px">คลิกแถวเพื่อแก้ไข</span></div><div data-tbl></div></div>`;
      const t = new UI.DataTable({
        pageSize: 50,
        compact: true,
        sortKey: 'code',
        onRow: (e) => this.empForm(e),
        columns: [
          { key: 'code', label: 'พนักงาน', render: (e) => `<div class="emp-name nowrap">${esc(e.name)}</div><div class="emp-code">${esc(e.code)} · ${esc(e.dept)}</div>` },
          { key: 'salary', label: 'อัตรา', align: 'r', render: (e) => `${U.num(e.salary)} <small class="muted">${e.payType === 'D' ? '/วัน' : '/เดือน'}</small>` },
          { key: 'recur', label: 'เงินได้/หักประจำ', sort: false, render: (e) => `<span style="font-size:12.5px">${esc(recurTxt(e)) || '<span class="muted">–</span>'}</span>` },
          { key: 'pvd', label: 'กองทุนฯ', align: 'r', sv: (e) => +e.pay.pvd, render: (e) => (+e.pay.pvd ? `${e.pay.pvd}%` : '<span class="muted">–</span>') },
          { key: 'sso', label: 'ปกส.', sort: false, render: (e) => (e.pay.sso !== false ? UI.icon('check', 15) : '<span class="muted">ไม่หัก</span>') },
          { key: 'dilig', label: 'เบี้ยขยัน', sort: false, render: (e) => (e.pay.dilig ? UI.icon('check', 15) : '') },
          { key: 'allow', label: 'ลดหย่อน', sort: false, render: (e) => `<span class="muted" style="font-size:12px">${esc(allowTxt(e.pay)) || 'ส่วนตัว'}</span>` },
          { key: 'bank', label: 'บัญชีธนาคาร', sort: false, render: (e) => (e.pay.acct ? `<span class="nowrap" style="font-size:12.5px">${esc(e.pay.bank)} <span class="mono">${esc(Pay.maskAcct(e.pay.acct))}</span></span>` : UI.pill('ไม่มีบัญชี', 'bad')) },
          { key: 'taxId', label: 'เลขผู้เสียภาษี', sort: false, render: (e) => (!e.pay.taxId ? UI.pill('ไม่มี', 'bad') : U.taxIdValid(e.pay.taxId) ? UI.icon('check', 15) : UI.pill('ไม่ถูกต้อง', 'bad')) },
        ],
      });
      body.querySelector('[data-tbl]').appendChild(t.el);
      const apply = () => {
        const q = st.q.toLowerCase();
        t.setRows(s.employees.filter((e) => e.active !== false && (!st.dept || e.dept === st.dept) && (!q || `${e.code} ${e.name}`.toLowerCase().includes(q)) && (!st.missing || missing(e))));
      };
      apply();
      body.querySelector('[data-dept]').addEventListener('change', (e) => ((st.dept = e.target.value), apply()));
      body.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((st.q = e.target.value.trim()), apply()), 150));
      body.querySelector('[data-missing]').addEventListener('change', (e) => ((st.missing = e.target.checked), apply()));
    },
    empForm(emp) {
      const s = Store.s, p = Object.assign(Pay.profile(), emp.pay);
      const recurItems = s.pay.items.filter((x) => x.mode === 'RECUR');
      const num = (name, label, val, hint = '') => `<label class="field"><span class="lbl">${label}</span><input class="input" type="number" min="0" step="any" name="${name}" value="${esc(val || 0)}">${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
      const m = UI.modal({
        title: `ข้อมูลเงินเดือน · ${esc(emp.name)}`,
        sub: `${esc(emp.code)} · ${esc(emp.dept)} · ${esc(emp.position || '')}`,
        size: 'lg',
        body: `<div class="form-sec">อัตราค่าจ้าง</div><div class="form-grid g3">
            <label class="field"><span class="lbl">ประเภทการจ้าง</span><select class="input" name="payType"><option value="M" ${emp.payType !== 'D' ? 'selected' : ''}>รายเดือน</option><option value="D" ${emp.payType === 'D' ? 'selected' : ''}>รายวัน</option></select></label>
            ${num('salary', 'เงินเดือน / ค่าแรงต่อวัน (บาท)', emp.salary)}
            <label class="field"><span class="lbl">อัตราใหม่มีผลตั้งแต่</span><input class="input" type="date" name="rateFrom" value="${esc(Store.range().start)}"><span class="hint">ใช้เมื่อแก้อัตรา · ย้อนไปงวดที่ปิดแล้ว = ตกเบิก</span></label>
            ${num('pvd', 'กองทุนสำรองเลี้ยงชีพ (% ของเงินเดือน)', p.pvd, 'นายจ้างสมทบเท่ากัน')}
            <label class="check"><input type="checkbox" name="sso" ${p.sso !== false ? 'checked' : ''}> หักประกันสังคม</label>
            <label class="check"><input type="checkbox" name="dilig" ${p.dilig ? 'checked' : ''}> มีสิทธิ์เบี้ยขยัน</label></div>
          ${(emp.rates || []).length ? `<div class="hint" style="margin:-4px 0 8px">ประวัติอัตรา: ${emp.rates.map((h) => `${U.fmtDate(h.from)} ${U.num(h.old)} → <b>${U.num(h.salary)}</b>`).join(' · ')}</div>` : ''}
          ${emp.start || emp.end ? `<div class="hint" style="margin:-4px 0 8px">${emp.start ? `เริ่มงาน ${U.fmtDate(emp.start)}` : ''}${emp.end ? ` · ทำงานวันสุดท้าย ${U.fmtDate(emp.end)}` : ''} (แก้ที่ ตั้งค่า > พนักงาน)</div>` : ''}
          <div class="form-sec">เงินได้ / เงินหักประจำทุกเดือน</div><div class="form-grid g3">
            ${recurItems.map((it) => num('r_' + it.code, `${esc(it.name)} ${it.kind === 'DED' ? '<span class="muted">(หัก)</span>' : ''}`, (p.recur || {})[it.code])).join('')}</div>
          <div class="form-sec">ภาษีและค่าลดหย่อน</div><div class="form-grid g3">
            <label class="field"><span class="lbl">เลขประจำตัวผู้เสียภาษี (13 หลัก)</span><input class="input" name="taxId" maxlength="17" value="${esc(p.taxId)}"></label>
            ${num('children', 'บุตร (คน)', p.children, '30,000 บาท/คน')}
            ${num('parents', 'บิดามารดาที่อุปการะ (คน)', p.parents, '30,000 บาท/คน')}
            <label class="check"><input type="checkbox" name="spouse" ${p.spouse ? 'checked' : ''}> คู่สมรสไม่มีเงินได้ (60,000)</label>
            ${num('life', 'เบี้ยประกันชีวิต/ปี', p.life, 'ไม่เกิน 100,000')}
            ${num('health', 'เบี้ยประกันสุขภาพ/ปี', p.health, 'ไม่เกิน 25,000')}
            ${num('otherDed', 'ค่าลดหย่อนอื่น/ปี', p.otherDed, 'เช่น ดอกเบี้ยบ้าน RMF SSF')}
            <label class="field full"><span class="lbl">ที่อยู่ (สำหรับ 50 ทวิ / ภ.ง.ด.1ก)</span><input class="input" name="address" value="${esc(p.address || '')}"></label></div>
          <div class="form-sec">เงินได้จากนายจ้างเดิมในปีนี้ <span class="muted" style="font-weight:400">(เข้างานระหว่างปี — ดูจาก 50 ทวิ ของนายจ้างเดิม)</span></div><div class="form-grid g3">
            <label class="field"><span class="lbl">ปีภาษี (ค.ศ.)</span><input class="input" type="number" name="prevYear" value="${esc(p.prevYear || '')}" placeholder="${Store.pk.slice(0, 4)}"><span class="hint">ใช้เฉพาะปีที่ตรงกัน</span></label>
            ${num('prevIncome', 'เงินได้ 40(1)', p.prevIncome)}
            ${num('prevTax', 'ภาษีที่ถูกหักแล้ว', p.prevTax)}
            ${num('prevSso', 'ประกันสังคมที่จ่ายแล้ว', p.prevSso)}
            ${num('prevPvd', 'กองทุนสำรองฯ ที่จ่ายแล้ว', p.prevPvd)}
            <span class="hint" style="grid-column:1/-1">ใช้กับวิธีคำนวณแบบสะสม (YTD) และการปรับภาษีปลายปี · ไม่แสดงใน 50 ทวิ / ภ.ง.ด.1ก ของบริษัท</span></div>
          <div class="form-sec">บัญชีรับเงินเดือน</div><div class="form-grid">
            <label class="field"><span class="lbl">ธนาคาร</span><input class="input" name="bank" list="bankList" value="${esc(p.bank)}"><datalist id="bankList">${Pay.BANKS.map((b) => `<option value="${b}">`).join('')}</datalist></label>
            <label class="field"><span class="lbl">เลขที่บัญชี</span><input class="input" name="acct" value="${esc(p.acct)}" placeholder="xxx-x-xxxxx-x"></label></div>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>บันทึก</button>`,
      });
      m.$('[data-ok]').addEventListener('click', () => {
        const f = UI.formData(m.el);
        const taxId = f.taxId.replace(/\D/g, '');
        const tErr = U.taxIdError(taxId);
        if (tErr) return UI.toast('เลขประจำตัวผู้เสียภาษี: ' + tErr, 'warn');
        if (+emp.salary !== +f.salary && !f.rateFrom) return UI.toast('กรุณาระบุวันที่อัตราใหม่มีผล', 'warn');
        const recur = {};
        recurItems.forEach((it) => +f['r_' + it.code] > 0 && (recur[it.code] = U.r2(+f['r_' + it.code])));
        emp.pay = Object.assign(p, {
          recur, sso: f.sso, dilig: f.dilig, pvd: Math.min(15, +f.pvd || 0), taxId, spouse: f.spouse,
          children: +f.children || 0, parents: Math.min(4, +f.parents || 0), life: +f.life || 0, health: +f.health || 0, otherDed: +f.otherDed || 0,
          bank: f.bank, acct: f.acct, address: (f.address || '').trim(),
          prevYear: +f.prevYear ? String(+f.prevYear) : '', prevIncome: +f.prevIncome || 0, prevTax: +f.prevTax || 0, prevSso: +f.prevSso || 0, prevPvd: +f.prevPvd || 0,
        });
        if (emp.payType !== f.payType || +emp.salary !== +f.salary) {
          emp.payType = f.payType;
          if (+emp.salary !== +f.salary) Pay.setRate(emp, f.salary, f.rateFrom);
          Store.touch('config');
        }
        changed('แก้ไขข้อมูลเงินเดือน', emp.code);
        m.close();
        UI.toast('บันทึกแล้ว — งวดที่ยังไม่ปิดต้องคำนวณเงินเดือนใหม่');
        PL.App.rerender();
      });
    },

    /* ---------- รายการเงินได้ / เงินหัก ---------- */
    items(body) {
      const s = Store.s;
      const used = (code) => s.employees.some((e) => e.pay && e.pay.recur && +e.pay.recur[code]) || Object.values(s.pay.inputs).some((l) => l.some((i) => i.code === code));
      const yes = (v) => (v ? UI.icon('check', 15) : '<span class="muted">–</span>');
      body.innerHTML = `<div class="card"><div class="card-head"><h3>${UI.icon('list', 18)} รายการเงินได้และเงินหัก</h3><span class="spacer"></span><button class="btn primary sm" data-add>${UI.icon('plus', 15)} เพิ่มรายการ</button></div>
        <div data-tbl></div>
        <p class="muted" style="font-size:12.5px;margin:12px 0 0"><b>คิดภาษี</b> — เงินได้: นับเป็นเงินได้พึงประเมิน แสดงใน ภ.ง.ด.1 / 50 ทวิ / ภ.ง.ด.1ก (ไม่คิดภาษี = ไม่แสดงในแบบภาษี) · เงินหัก: <b>หักก่อนภาษี</b> ลดเงินได้พึงประเมินในแบบภาษี / <b>หักหลังภาษี</b> หักจากเงินสุทธิเท่านั้น ไม่แสดงในแบบภาษี · ตอนบันทึกรายการประจำงวดเปลี่ยนได้รายบรรทัด<br><b>คิดประกันสังคม</b> = เป็นค่าจ้างตามกฎหมายประกันสังคม · <b>เงินได้แน่นอน</b> = จ่ายเท่ากันทุกเดือน ใช้ประมาณการภาษีทั้งปี (×12) ส่วนเงินได้ไม่แน่นอนหักภาษีส่วนเพิ่มในเดือนที่จ่าย</p></div>`;
      const t = new UI.DataTable({
        pageSize: 50,
        columns: [
          { key: 'code', label: 'รหัส', render: (x) => `<span class="mono">${esc(x.code)}</span>` },
          { key: 'name', label: 'ชื่อรายการ' },
          { key: 'kind', label: 'ประเภท', render: (x) => UI.pill(x.kind === 'DED' ? 'เงินหัก' : 'เงินได้', x.kind === 'DED' ? 'bad' : 'ok') },
          { key: 'mode', label: 'รูปแบบ', render: (x) => (x.sys ? UI.pill('ระบบคำนวณ', 'brand') : esc(MODE[x.mode] || '')) },
          { key: 'taxable', label: 'คิดภาษี', sort: false, render: (x) => (x.kind === 'DED' ? (Pay.itemTaxable(x) ? UI.pill('หักก่อนภาษี', 'info') : '<span class="muted" style="font-size:12px">หักหลังภาษี</span>') : Pay.itemTaxable(x) ? UI.icon('check', 15) : UI.pill('ไม่คิดภาษี', 'warn')) },
          { key: 'sso', label: 'คิดประกันสังคม', sort: false, render: (x) => (x.kind === 'DED' ? '' : yes(x.sso)) },
          { key: 'regular', label: 'เงินได้แน่นอน', sort: false, render: (x) => (x.kind === 'DED' ? '' : yes(x.regular)) },
          { key: 'acct', label: 'บัญชี', sort: false, render: (x) => (x.acct ? `<span class="mono">${esc(x.acct)}</span>` : '<span class="muted" style="font-size:12px">ตั้งต้น</span>') },
          { key: '_', label: '', sort: false, align: 'r', render: (x) => `<div class="row-actions"><button class="btn xs icon" data-act="edit">${UI.icon('edit', 14)}</button>${x.sys ? '' : `<button class="btn xs icon danger-ghost" data-act="del">${UI.icon('trash', 14)}</button>`}</div>` },
        ],
        onRow: (x) => this.itemForm(x),
        onAction: async (a, x) => {
          if (a === 'edit') return this.itemForm(x);
          if (used(x.code)) return UI.toast('รายการนี้ถูกใช้อยู่ ลบไม่ได้', 'warn');
          if (!(await UI.confirm(`ลบรายการ ${esc(x.name)}?`, { danger: true, ok: 'ลบ' }))) return;
          s.pay.items = s.pay.items.filter((y) => y !== x);
          changed('ลบรายการเงินได้/เงินหัก', x.code);
          PL.App.rerender();
        },
      });
      t.setRows(s.pay.items);
      body.querySelector('[data-tbl]').appendChild(t.el);
      body.querySelector('[data-add]').addEventListener('click', () => this.itemForm(null));
    },
    itemForm(it) {
      const s = Store.s;
      const x = it || { code: '', name: '', kind: 'EARN', mode: 'ONCE', taxable: true, sso: false, regular: false };
      const m = UI.modal({
        title: it ? `แก้ไขรายการ ${esc(it.code)}` : 'เพิ่มรายการเงินได้ / เงินหัก',
        body: `<div class="form-grid">
          <label class="field"><span class="lbl req">รหัส</span><input class="input" name="code" value="${esc(x.code)}" ${it ? 'readonly' : ''} maxlength="8"></label>
          <label class="field"><span class="lbl req">ชื่อรายการ</span><input class="input" name="name" value="${esc(x.name)}"></label>
          <label class="field"><span class="lbl">ประเภท</span><select class="input" name="kind" ${x.sys ? 'disabled' : ''}><option value="EARN" ${x.kind !== 'DED' ? 'selected' : ''}>เงินได้</option><option value="DED" ${x.kind === 'DED' ? 'selected' : ''}>เงินหัก</option></select></label>
          <label class="field"><span class="lbl">รูปแบบ</span><select class="input" name="mode" ${x.sys ? 'disabled' : ''}>${x.sys ? '<option>ระบบคำนวณ</option>' : Object.entries(MODE).map(([k, v]) => `<option value="${k}" ${x.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="check full"><input type="checkbox" name="taxable" ${Pay.itemTaxable(x) ? 'checked' : ''}> <span data-taxlbl></span></label>
          <label class="check" data-earn><input type="checkbox" name="sso" ${x.sso ? 'checked' : ''}> คิดประกันสังคม</label>
          <label class="check" data-earn><input type="checkbox" name="regular" ${x.regular ? 'checked' : ''}> เงินได้แน่นอน (×12)</label>
          <label class="field"><span class="lbl">รหัสบัญชี (บันทึกบัญชี)</span><input class="input" name="acct" value="${esc(x.acct || '')}" placeholder="เว้นว่าง = ตามผังบัญชีตั้งต้น"></label>
          <label class="field"><span class="lbl">ชื่อบัญชี</span><input class="input" name="acctName" value="${esc(x.acctName || '')}" placeholder="เช่น ลูกหนี้เงินกู้พนักงาน"></label></div>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>บันทึก</button>`,
      });
      // ป้ายตัวเลือกภาษีเปลี่ยนตามประเภท (เงินหักไม่มีประกันสังคม/เงินได้แน่นอน)
      const kindSel = m.$('[name="kind"]');
      const syncKind = () => {
        const isDed = kindSel.value === 'DED';
        m.$('[data-taxlbl]').innerHTML = isDed
          ? '<b>หักก่อนคำนวณภาษี</b> <span class="muted">— ลดเงินได้พึงประเมินในแบบภาษี (ไม่ติ๊ก = หักหลังภาษี ไม่แสดงในแบบภาษี)</span>'
          : '<b>คำนวณภาษี</b> <span class="muted">— นับเป็นเงินได้พึงประเมิน แสดงใน ภ.ง.ด.1 / 50 ทวิ (ไม่ติ๊ก = ไม่คิดภาษี ไม่แสดงในแบบภาษี)</span>';
        m.el.querySelectorAll('[data-earn]').forEach((el) => (el.style.display = isDed ? 'none' : ''));
      };
      kindSel.addEventListener('change', () => {
        m.$('[name="taxable"]').checked = kindSel.value !== 'DED'; // ค่าตั้งต้นตามประเภท
        syncKind();
      });
      syncKind();
      m.$('[data-ok]').addEventListener('click', () => {
        const f = UI.formData(m.el);
        const code = U.normCode(f.code);
        if (!code || !f.name) return UI.toast('กรุณาระบุรหัสและชื่อ', 'warn');
        if (!it && s.pay.items.some((y) => y.code === code)) return UI.toast('รหัสนี้มีอยู่แล้ว', 'warn');
        const obj = it || { code };
        const isDed = (obj.sys ? obj.kind : f.kind) === 'DED';
        Object.assign(obj, { name: f.name, taxable: f.taxable, sso: isDed ? false : f.sso, regular: isDed ? false : f.regular, acct: (f.acct || '').trim(), acctName: (f.acctName || '').trim() });
        if (!obj.acct) delete obj.acct;
        if (!obj.acctName) delete obj.acctName;
        if (!obj.sys) Object.assign(obj, { kind: f.kind, mode: f.mode });
        if (!it) s.pay.items.push(obj);
        changed(it ? 'แก้ไขรายการเงินได้/เงินหัก' : 'เพิ่มรายการเงินได้/เงินหัก', code);
        m.close();
        PL.App.rerender();
      });
    },

    /* ---------- อัตรา ---------- */
    rates(body) {
      const s = Store.s, S = s.pay.settings;
      const num = (name, label, hint = '', step = 'any') => `<label class="field"><span class="lbl">${label}</span><input class="input" type="number" step="${step}" min="0" name="${name}" value="${esc(S[name])}">${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
      const txt = (name, label, hint = '') => `<label class="field"><span class="lbl">${label}</span><input class="input" name="${name}" value="${esc(S[name] || '')}">${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
      body.innerHTML = `<div class="grid">
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('users', 18)} ประกันสังคม (มาตรา 33)</h3></div><div class="form-grid">
          ${num('ssoRate', 'อัตราลูกจ้าง (%)')}${num('ssoErRate', 'อัตรานายจ้าง (%)')}
          ${num('ssoMin', 'ฐานค่าจ้างขั้นต่ำ (บาท)')}${num('ssoMax', 'ฐานค่าจ้างสูงสุด (บาท)', 'ปี 2569–2571: 17,500 · 2572–2574: 20,000 · 2575 เป็นต้นไป: 23,000')}
          ${txt('ssoAccount', 'เลขที่บัญชีนายจ้าง (ประกันสังคม)')}</div></div>
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('file', 18)} ภาษีเงินได้หัก ณ ที่จ่าย</h3></div><div class="form-grid">
          ${num('expensePct', 'หักค่าใช้จ่าย (%)')}${num('expenseMax', 'ค่าใช้จ่ายสูงสุด (บาท)')}
          ${num('personal', 'ลดหย่อนส่วนตัว')}${num('spouse', 'ลดหย่อนคู่สมรส')}${num('child', 'ลดหย่อนบุตร/คน')}${num('parent', 'ลดหย่อนบิดามารดา/คน')}
          ${num('lifeMax', 'ประกันชีวิตสูงสุด')}${num('healthMax', 'ประกันสุขภาพสูงสุด')}
          <label class="field full"><span class="lbl">วิธีคำนวณภาษีหัก ณ ที่จ่ายรายเดือน</span><select class="input" name="taxMethod">
            <option value="ANNUAL12" ${S.taxMethod !== 'YTD' ? 'selected' : ''}>เงินได้แน่นอน × 12 ÷ 12 (วิธีกรมสรรพากร)</option>
            <option value="YTD" ${S.taxMethod === 'YTD' ? 'selected' : ''}>สะสมจริงตั้งแต่ต้นปี + ประมาณการเดือนที่เหลือ (YTD)</option></select>
            <span class="hint">YTD เหมาะกับคนเข้างานระหว่างปี / มีเงินได้จากนายจ้างเดิม / เงินเดือนเปลี่ยนบ่อย</span></label>
          <label class="check full"><input type="checkbox" name="trueUp" ${S.trueUp !== false ? 'checked' : ''}> ปรับภาษีปลายปี (true-up) ในงวด ธ.ค. และงวดสุดท้ายของคนที่ลาออก ให้ภาษีหักทั้งปีเท่าภาษีที่ต้องเสียจริง</label>
          <label class="check full"><input type="checkbox" name="trueUpRefund" ${S.trueUpRefund !== false ? 'checked' : ''}> ถ้าหักไว้เกิน คืนให้พนักงานในงวดนั้น (ไม่เกินภาษีที่บริษัทหักไว้ในปี)</label>
          ${txt('companyTaxId', 'เลขประจำตัวผู้เสียภาษีบริษัท', S.companyTaxId ? (U.taxIdValid(S.companyTaxId) ? '✓ หลักตรวจสอบถูกต้อง' : '⚠ หลักตรวจสอบไม่ถูกต้อง') : '13 หลัก — ต้องกรอกก่อนใช้งานจริง')}${txt('companyBranch', 'สาขา', '00000 = สำนักงานใหญ่')}</div></div>
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('bars', 18)} อัตราภาษีก้าวหน้า</h3></div>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>เงินได้สุทธิไม่เกิน (บาท)</th><th class="r">อัตรา (%)</th></tr></thead><tbody>
          ${S.brackets.map(([cap, rate], i) => `<tr><td><input class="input sm" type="number" data-cap="${i}" value="${cap || ''}" placeholder="ไม่จำกัด"></td><td class="r"><input class="input sm" type="number" data-rate="${i}" value="${rate}" style="width:90px;text-align:right"></td></tr>`).join('')}
          </tbody></table></div></div>
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('timer', 18)} สวัสดิการและการจ่าย</h3></div><div class="form-grid">
          ${num('nightRate', 'ค่ากะดึก (บาท/คืน)')}${txt('nightCodes', 'รหัสกะที่ได้ค่ากะดึก', 'คั่นด้วยจุลภาค เช่น N')}
          ${num('diligAmount', 'เบี้ยขยัน (บาท/เดือน)', 'ได้เมื่อไม่สาย ไม่ขาด ไม่กลับก่อน ไม่ลา')}
          <div class="field"><span class="lbl">ประเภทลาที่ไม่ตัดเบี้ยขยัน</span><div class="row">${s.leaveTypes.map((l) => `<label class="check"><input type="checkbox" data-dl="${l.code}" ${(S.diligAllowLeave || []).includes(l.code) ? 'checked' : ''}> ${esc(l.name)}</label>`).join('')}</div></div>
          ${num('payDay', 'วันที่จ่ายเงินเดือน', '0 = วันสุดท้ายของรอบ', '1')}
          <label class="check"><input type="checkbox" name="pvdErMatch" ${S.pvdErMatch ? 'checked' : ''}> นายจ้างสมทบกองทุนฯ เท่ากับลูกจ้าง</label>
          ${txt('companyBank', 'ธนาคารบัญชีบริษัท')}${txt('companyAccount', 'เลขที่บัญชีบริษัท')}</div></div>
        <div class="card span-12"><div class="card-head"><h3>${UI.icon('list', 18)} ผังบัญชีสำหรับบันทึกบัญชีเงินเดือน</h3></div>
          <p class="muted" style="font-size:12.5px;margin-top:0">ใช้ในรายงานสรุปเงินเดือนสำหรับฝ่ายบัญชี — รายการเงินได้/เงินหักแต่ละตัวกำหนดรหัสบัญชีเองได้ที่แท็บ "รายการเงินได้ / เงินหัก"</p>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>ใช้กับ</th><th style="width:140px">รหัสบัญชี</th><th>ชื่อบัญชี</th></tr></thead><tbody>
          ${Object.entries(Pay.accounts(s)).map(([k, a]) => `<tr><td class="muted" style="font-size:12.5px">${ACCT_USE[k] || k}</td><td><input class="input sm" data-acode="${k}" value="${esc(a.code)}"></td><td><input class="input sm" data-aname="${k}" value="${esc(a.name)}" style="width:100%"></td></tr>`).join('')}
          </tbody></table></div></div>
      </div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-save>${UI.icon('check', 16)} บันทึกอัตรา</button></div>`;
      body.querySelector('[data-save]').addEventListener('click', () => {
        const f = UI.formData(body);
        f.companyTaxId = String(f.companyTaxId || '').replace(/\D/g, '');
        const tErr = U.taxIdError(f.companyTaxId);
        if (tErr) return UI.toast('เลขประจำตัวผู้เสียภาษีบริษัท: ' + tErr, 'warn');
        Object.entries(f).forEach(([k, v]) => {
          if (!(k in S)) return;
          S[k] = typeof S[k] === 'number' ? +v || 0 : v;
        });
        S.brackets = S.brackets.map((_, i) => [+body.querySelector(`[data-cap="${i}"]`).value || 0, +body.querySelector(`[data-rate="${i}"]`).value || 0]);
        S.diligAllowLeave = [...body.querySelectorAll('[data-dl]')].filter((c) => c.checked).map((c) => c.dataset.dl);
        // ผังบัญชี: เก็บเฉพาะที่ต่างจากค่าตั้งต้น
        const accts = {};
        Object.entries(Pay.ACCOUNTS).forEach(([k, [code, name]]) => {
          const c = body.querySelector(`[data-acode="${k}"]`).value.trim(), n = body.querySelector(`[data-aname="${k}"]`).value.trim();
          if ((c && c !== code) || (n && n !== name)) accts[k] = { code: c || code, name: n || name };
        });
        S.accounts = accts;
        changed('แก้ไขอัตราเงินเดือน');
        UI.toast('บันทึกแล้ว — งวดที่ยังไม่ปิดต้องคำนวณเงินเดือนใหม่');
        PL.App.rerender();
      });
    },
  };
})(window);

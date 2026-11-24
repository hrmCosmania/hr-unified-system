/* ตั้งค่า: บริษัท / พนักงาน / กฎการคำนวณ / ประเภทการลา / ข้อมูลระบบ */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const st = { tab: 'general', q: '', dept: '' };

  PL.Views.settings = {
    render(el, params) {
      if (params.tab) st.tab = params.tab;
      const n = PL.NAV.find((x) => x.key === 'settings');
      const tabs = Store.can('hr')
        ? [
            { key: 'general', label: 'ทั่วไป', icon: 'home' },
            { key: 'employees', label: 'พนักงาน', icon: 'users' },
            { key: 'rules', label: 'กฎการคำนวณ', icon: 'calculator' },
            { key: 'leave', label: 'ประเภทการลา', icon: 'calendar' },
            { key: 'system', label: 'ข้อมูลระบบ', icon: 'database' },
            ...(Store.cloud && Store.can('admin') ? [{ key: 'users', label: 'ผู้ใช้และสิทธิ์', icon: 'user' }] : []),
            ...(Store.cloud ? [{ key: 'audit', label: 'ประวัติการแก้ไข', icon: 'list' }] : []),
          ]
        : [{ key: 'me', label: 'บัญชีของฉัน', icon: 'user' }];
      if (!tabs.some((t) => t.key === st.tab)) st.tab = tabs[0].key;
      el.innerHTML = `<div class="page-head"><div class="ph-left"><div class="ph-icon">${UI.icon('settings', 26)}</div>
        <div><div class="ph-kicker">${n.en}</div><h1>${n.th}</h1><div class="ph-sub">${n.desc}</div></div></div></div>
        ${UI.tabs(tabs, st.tab)}<div data-body></div>`;
      el.querySelector('.tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (b) PL.App.go('settings', { tab: b.dataset.tab });
      });
      this[st.tab](el.querySelector('[data-body]'));
    },

    general(body) {
      const s = Store.s;
      body.innerHTML = `<div class="grid"><div class="card span-7"><div class="card-head"><h3>ข้อมูลบริษัทและผู้ใช้</h3></div>
        <div class="form-grid">
          <label class="field full"><span class="lbl req">ชื่อบริษัท</span><input class="input" name="company" value="${esc(s.company.name)}"></label>
          <label class="field full"><span class="lbl">ที่อยู่บริษัท</span><input class="input" name="address" value="${esc(s.company.address || '')}"><span class="hint">แสดงในหนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)</span></label>
          ${Store.cloud ? '' : `<label class="field"><span class="lbl">ชื่อผู้ใช้</span><input class="input" name="user" value="${esc(s.user.name)}"></label>
          <label class="field"><span class="lbl">ตำแหน่ง</span><input class="input" name="role" value="${esc(s.user.role)}"></label>`}
          <label class="field"><span class="lbl">วันตัดรอบเงินเดือน</span><select class="input" name="cutoff">
            <option value="0" ${!s.settings.cutoffDay ? 'selected' : ''}>สิ้นเดือน (1 – สิ้นเดือน)</option>
            ${[15, 20, 21, 25, 26].map((d) => `<option value="${d}" ${+s.settings.cutoffDay === d ? 'selected' : ''}>วันที่ ${d} (${d + 1} เดือนก่อน – ${d})</option>`).join('')}</select>
            <span class="hint">เปลี่ยนแล้วช่วงวันที่ของทุกรอบจะเปลี่ยน ต้องโอน/คำนวณใหม่</span></label>
          <label class="field"><span class="lbl">แผนก (คั่นด้วย ,)</span><input class="input" name="depts" value="${esc(s.depts.join(', '))}"></label>
        </div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" data-save>${UI.icon('check', 16)} บันทึก</button></div></div>
        <div class="card span-5"><div class="card-head"><h3>เกี่ยวกับระบบ</h3></div>
          <div class="kv"><span>เวอร์ชัน</span><span>2.0</span><span>จัดเก็บข้อมูล</span><span>${Store.cloud ? 'ฐานข้อมูลคลาวด์ (Supabase)' : 'ในเบราว์เซอร์เครื่องนี้'}</span>${Store.cloud ? `<span>ผู้ใช้</span><span>${esc(s.user.name)} · ${esc(s.user.role)}</span>` : `<span>ขนาดข้อมูล</span><span>${U.num((Store.bytes || Store.serialize(s).length) / 1024)} KB</span>`}</div>
          <p class="muted" style="font-size:12.5px">${Store.cloud ? 'ข้อมูลเก็บในฐานข้อมูลกลาง ใช้งานได้หลายคนหลายเครื่อง สิทธิ์ตามบทบาท และสำรองอัตโนมัติวันละครั้ง — ดูที่แท็บ "ข้อมูลระบบ"' : 'ข้อมูลทั้งหมดเก็บใน localStorage ของเบราว์เซอร์ ไม่ส่งออกไปที่ใด — ควรสำรองข้อมูลเป็นไฟล์ JSON สม่ำเสมอที่แท็บ "ข้อมูลระบบ"'}</p></div></div>`;
      body.querySelector('[data-save]').addEventListener('click', () => {
        const f = UI.formData(body);
        if (!f.company) return UI.toast('กรุณาระบุชื่อบริษัท', 'warn');
        s.company.name = f.company;
        s.company.address = f.address || '';
        if (!Store.cloud) {
          s.user.name = f.user || s.user.name;
          s.user.role = f.role;
        }
        s.depts = f.depts.split(',').map((x) => x.trim()).filter(Boolean);
        if (+f.cutoff !== +s.settings.cutoffDay) {
          s.settings.cutoffDay = +f.cutoff;
          Store.touch('config');
        }
        Store.commit('แก้ไขข้อมูลทั่วไป');
        UI.toast('บันทึกแล้ว');
        PL.App.rerender();
      });
    },

    employees(body) {
      const s = Store.s, ix = Store.ix();
      body.innerHTML = `<div class="card"><div class="toolbar">
          <select class="input sm" data-dept>${UI.deptOptions(st.dept)}</select>
          <input class="input sm search-in" data-q placeholder="ค้นหารหัส / ชื่อ / เลขบัตร" value="${esc(st.q)}">
          <span class="spacer"></span>
          <label class="btn sm">${UI.icon('upload', 15)} นำเข้า CSV<input type="file" accept=".csv,.txt" hidden data-imp></label>
          <button class="btn sm" data-act="tpl">${UI.icon('download', 15)} ไฟล์ต้นแบบ</button>
          ${Store.cloud ? `<button class="btn sm" data-act="hru">${UI.icon('refresh', 15)} ดึงจาก HR Unified</button>` : ''}
          <button class="btn primary sm" data-act="add">${UI.icon('plus', 15)} เพิ่มพนักงาน</button></div><div data-tbl></div></div>`;
      const t = new UI.DataTable({
        pageSize: 50,
        compact: true,
        sortKey: 'code',
        columns: [
          { key: 'code', label: 'รหัส', render: (r) => `<span class="mono">${esc(r.code)}</span>` },
          { key: 'card', label: 'เลขบัตร/สแกน', render: (r) => `<span class="mono">${esc(r.card || '')}</span>` },
          { key: 'name', label: 'ชื่อ-สกุล', render: (r) => `${esc(r.name)}${r.end ? ' ' + UI.pill(`พ้นสภาพ ${U.fmtDate(U.addDays(r.end, 1))}`, 'orange') : r.active === false ? ' ' + UI.pill('ไม่ใช้งาน', 'off') : ''}` },
          { key: 'start', label: 'เริ่มงาน', render: (r) => `<span class="muted" style="font-size:12px">${r.start ? U.fmtDate(r.start) : '–'}</span>` },
          { key: 'dept', label: 'แผนก' },
          { key: 'position', label: 'ตำแหน่ง' },
          { key: 'payType', label: 'จ้าง', render: (r) => (r.payType === 'D' ? 'รายวัน' : 'รายเดือน') },
          { key: 'salary', label: 'อัตรา', align: 'r', render: (r) => U.num(r.salary) },
          { key: 'shift', label: 'กะประจำ', render: (r) => UI.shiftChip(r.shift, ix) },
          { key: 'pattern', label: 'รูปแบบกะ', render: (r) => `<span class="muted" style="font-size:12px">${esc(E.PATTERNS[r.pattern] || '')}${r.pattern === 'ROTATE' ? ` · ทีม ${esc(r.team || 'A')}` : ''}</span>` },
          { key: '_', label: '', sort: false, align: 'r', render: () => `<button class="btn xs icon" data-act="edit">${UI.icon('edit', 14)}</button>` },
        ],
        onAction: (a, r) => a === 'edit' && this.empForm(r),
        onRow: (r) => this.empForm(r),
      });
      body.querySelector('[data-tbl]').appendChild(t.el);
      const apply = () => {
        const q = st.q.toLowerCase();
        t.setRows(s.employees.filter((e) => (!st.dept || e.dept === st.dept) && (!q || `${e.code} ${e.name} ${e.card}`.toLowerCase().includes(q))));
      };
      apply();
      body.querySelector('[data-dept]').addEventListener('change', (e) => ((st.dept = e.target.value), apply()));
      body.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((st.q = e.target.value.trim()), apply()), 150));
      body.querySelector('[data-act="add"]').addEventListener('click', () => this.empForm(null));
      const hru = body.querySelector('[data-act="hru"]');
      if (hru) hru.addEventListener('click', () => this.hruSync());
      body.querySelector('[data-act="tpl"]').addEventListener('click', () =>
        U.download('employees-template.csv', U.csv(['code', 'card', 'name', 'dept', 'position', 'payType(M/D)', 'salary', 'shift', 'pattern(OFFICE5/SIX/ROTATE)', 'team(A/B)', 'start(YYYY-MM-DD)', 'end(YYYY-MM-DD)'], [['EMP1001', '2001', 'นายตัวอย่าง ทดสอบ', 'ผลิต', 'พนักงานฝ่ายผลิต', 'D', '420', 'D', 'ROTATE', 'A', '2026-11-16', '']]))
      );
      body.querySelector('[data-imp]').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const lines = (await U.readFile(f)).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
        let add = 0, upd = 0;
        const next = () => 'E' + U.pad(s.employees.reduce((m, x) => Math.max(m, +String(x.id).replace(/\D/g, '') || 0), 0) + 1, 4);
        lines.forEach((l, i) => {
          const c = l.split(',').map((x) => x.replace(/^"|"$/g, '').trim());
          if (i === 0 && /code|รหัส/i.test(c[0])) return;
          if (!c[0] || !c[2]) return;
          const rec = { code: U.normCode(c[0]), card: c[1] || '', name: c[2], dept: c[3] || '-', position: c[4] || '', payType: (c[5] || 'M').toUpperCase() === 'D' ? 'D' : 'M', salary: +c[6] || 0, shift: c[7] || 'D', pattern: E.PATTERNS[c[8]] ? c[8] : 'SIX', team: c[9] === 'B' ? 'B' : 'A' };
          const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
          if (isDate(c[10])) rec.start = c[10];
          if (isDate(c[11])) rec.end = c[11];
          const ex = s.employees.find((x) => x.code === rec.code);
          if (ex) {
            Object.assign(ex, rec);
            upd++;
          } else {
            s.employees.push({ id: next(), active: true, ...rec });
            add++;
          }
          if (rec.dept && !s.depts.includes(rec.dept)) s.depts.push(rec.dept);
        });
        PL.Payroll.ensure(s);
        Store.touch('config');
        PL.Payroll.touch(s);
        Store.commit('นำเข้าพนักงาน', `เพิ่ม ${add} แก้ไข ${upd}`);
        UI.toast(`นำเข้าพนักงาน: เพิ่ม ${add} คน, อัปเดต ${upd} คน`);
        PL.App.rerender();
      });
    },
    /* ---------- ดึงรายชื่อพนักงานจาก HR Unified System ---------- */
    async hruSync() {
      const s = Store.s;
      let dir;
      try {
        dir = await PL.Cloud.hruDirectory();
      } catch (err) {
        return UI.toast('อ่านรายชื่อจาก HR Unified ไม่สำเร็จ: ' + esc(err.message), 'bad');
      }
      const list = dir.employees;
      if (!list.length) return UI.toast(dir.from === 'app' ? 'HR Unified ยังไม่มีรายชื่อพนักงาน' : 'ไม่พบรายชื่อ — เปิด Payroll Full Loop จากเมนูใน HR Unified เพื่อดึงรายชื่อจากแอปโดยตรง', 'warn', 6000);
      const companies = [...new Set(list.map((r) => r.company).filter(Boolean))].sort();
      const opt = { company: companies.length > 1 ? companies[0] : '', update: true };
      const preview = () => {
        const tmp = { employees: JSON.parse(JSON.stringify(s.employees)), depts: s.depts.slice(), shifts: s.shifts };
        return Store.syncEmployees(tmp, list, opt);
      };
      const m = UI.modal({
        title: 'ดึงรายชื่อพนักงานจาก HR Unified',
        sub: dir.from === 'app' ? 'อ่านจากแอป HR Unified ที่เปิดอยู่' : 'อ่านจากตาราง hru_employee',
        size: 'md',
        body: `<div class="form-grid">
            ${companies.length ? `<label class="field"><span class="lbl">บริษัท</span><select class="input" data-co><option value="">ทุกบริษัท</option>${companies.map((c) => `<option ${c === opt.company ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>` : ''}
            <label class="check full"><input type="checkbox" data-up checked> อัปเดตชื่อ แผนก ตำแหน่ง ของพนักงานที่มีอยู่แล้วให้ตรงกับ HR Unified</label></div>
          <div data-prev style="margin-top:12px"></div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">จับคู่ด้วยรหัสพนักงาน · คนใหม่เพิ่มเป็นรายเดือน อัตรา 0 กะ/รูปแบบตั้งต้น — <b>ต้องกรอกเงินเดือน กะ และเลขบัตรสแกนเอง</b> · ไม่แตะเงินเดือน บัญชี ภาษี · ไม่ปิดคนที่ไม่อยู่ใน HR Unified (แสดงให้ตรวจ)</p>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>นำเข้า</button>`,
      });
      const show = () => {
        const p = preview();
        m.$('[data-prev]').innerHTML = `<div class="kv"><span>เพิ่มใหม่</span><span><b>${p.added.length}</b> คน${p.added.length ? ` <small class="muted">${p.added.slice(0, 6).map((e) => esc(e.code)).join(', ')}${p.added.length > 6 ? ' …' : ''}</small>` : ''}</span>
          <span>อัปเดต</span><span><b>${p.updated.length}</b> คน${p.updated.length ? ` <small class="muted">${p.updated.slice(0, 4).map((u) => esc(`${u.code}: ${Object.keys(u.to).join('/')}`)).join(', ')}${p.updated.length > 4 ? ' …' : ''}</small>` : ''}</span>
          <span>ตรงกันอยู่แล้ว</span><span>${p.same} คน</span>
          <span>มีใน Payroll Full Loop แต่ไม่อยู่ใน HR Unified</span><span>${p.missing.length ? `${p.missing.length} คน <small class="muted">${p.missing.slice(0, 6).map(esc).join(', ')}${p.missing.length > 6 ? ' …' : ''}</small>` : '–'}</span></div>`;
        m.$('[data-ok]').disabled = !p.added.length && !p.updated.length;
      };
      const co = m.$('[data-co]');
      if (co) co.addEventListener('change', () => ((opt.company = co.value), show()));
      m.$('[data-up]').addEventListener('change', (e) => ((opt.update = e.target.checked), show()));
      show();
      m.$('[data-ok]').addEventListener('click', () => {
        const r = Store.syncEmployees(s, list, opt);
        PL.Payroll.ensure(s);
        Store.touch('config');
        PL.Payroll.touch(s);
        Store.commit('ดึงพนักงานจาก HR Unified', `${opt.company || 'ทุกบริษัท'}: เพิ่ม ${r.added.length} อัปเดต ${r.updated.length}`);
        m.close();
        UI.toast(`เพิ่ม ${r.added.length} คน อัปเดต ${r.updated.length} คน${r.added.length ? ' — อย่าลืมกรอกเงินเดือนและจัดกะให้คนใหม่' : ''}`, 'ok', 6000);
        PL.App.rerender();
      });
    },

    empForm(emp) {
      const s = Store.s;
      const x = emp || { code: '', card: '', name: '', dept: s.depts[0] || '', position: '', payType: 'M', salary: 15000, shift: 'D', pattern: 'SIX', team: 'A', active: true };
      const work = s.shifts.filter((y) => (y.type || 'WORK') === 'WORK');
      const m = UI.modal({
        title: emp ? `แก้ไขพนักงาน ${esc(emp.code)}` : 'เพิ่มพนักงาน',
        size: 'md',
        body: `<div class="form-grid">
          <label class="field"><span class="lbl req">รหัสพนักงาน</span><input class="input" name="code" value="${esc(x.code)}"></label>
          <label class="field"><span class="lbl">เลขบัตร/รหัสเครื่องสแกน</span><input class="input" name="card" value="${esc(x.card || '')}"></label>
          <label class="field full"><span class="lbl req">ชื่อ-สกุล</span><input class="input" name="name" value="${esc(x.name)}"></label>
          <label class="field"><span class="lbl">แผนก</span><input class="input" name="dept" list="deptList" value="${esc(x.dept)}"><datalist id="deptList">${s.depts.map((d) => `<option value="${esc(d)}">`).join('')}</datalist></label>
          <label class="field"><span class="lbl">ตำแหน่ง</span><input class="input" name="position" value="${esc(x.position || '')}"></label>
          <label class="field"><span class="lbl">ประเภทการจ้าง</span><select class="input" name="payType"><option value="M" ${x.payType !== 'D' ? 'selected' : ''}>รายเดือน</option><option value="D" ${x.payType === 'D' ? 'selected' : ''}>รายวัน</option></select></label>
          <label class="field"><span class="lbl">เงินเดือน / ค่าแรงต่อวัน (บาท)</span><input class="input" type="number" min="0" name="salary" value="${esc(x.salary)}"></label>
          ${emp ? `<label class="field"><span class="lbl">อัตราใหม่มีผลตั้งแต่</span><input class="input" type="date" name="rateFrom" value="${esc(Store.range().start)}"><span class="hint">ใช้เมื่อแก้อัตรา · ย้อนไปงวดที่ปิดแล้ว = ตกเบิกในงวดถัดไป</span></label>` : ''}
          <label class="field"><span class="lbl">วันเริ่มงาน</span><input class="input" type="date" name="start" value="${esc(x.start || '')}"><span class="hint">เข้าระหว่างงวด = คิดเงินเดือนตามสัดส่วนวัน</span></label>
          <label class="field"><span class="lbl">วันทำงานวันสุดท้าย (พ้นสภาพ)</span><input class="input" type="date" name="end" value="${esc(x.end || '')}"><span class="hint">เว้นว่าง = ยังทำงานอยู่</span></label>
          <label class="field"><span class="lbl">กะประจำ</span><select class="input" name="shift">${work.map((y) => `<option value="${esc(y.code)}" ${x.shift === y.code ? 'selected' : ''}>${esc(y.code)} · ${esc(y.name)} ${UI.shiftTime(y)}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">รูปแบบการจัดกะ</span><select class="input" name="pattern">${Object.entries(E.PATTERNS).map(([k, v]) => `<option value="${k}" ${x.pattern === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">ทีม (กะหมุนเวียน)</span><select class="input" name="team"><option ${x.team !== 'B' ? 'selected' : ''}>A</option><option ${x.team === 'B' ? 'selected' : ''}>B</option></select></label>
          <label class="check"><input type="checkbox" name="active" ${x.active !== false ? 'checked' : ''}> ใช้งานอยู่</label></div>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>บันทึก</button>`,
      });
      m.$('[data-ok]').addEventListener('click', () => {
        const f = UI.formData(m.el);
        f.code = U.normCode(f.code);
        if (!f.code || !f.name) return UI.toast('กรุณากรอกรหัสและชื่อ', 'warn');
        if (s.employees.some((y) => y !== emp && (y.code === f.code || (f.card && y.card === f.card)))) return UI.toast('รหัสพนักงานหรือเลขบัตรซ้ำกับคนอื่น', 'warn');
        if (f.start && f.end && f.end < f.start) return UI.toast('วันพ้นสภาพต้องไม่ก่อนวันเริ่มงาน', 'warn');
        const { rateFrom, ...rest } = f;
        const rec = { ...rest, salary: +f.salary || 0 };
        if (emp && +emp.salary !== rec.salary && rateFrom) {
          PL.Payroll.setRate(emp, rec.salary, rateFrom);
          delete rec.salary;
        }
        if (!rec.start) delete rec.start;
        if (!rec.end) {
          delete rec.end;
          if (emp) delete emp.end;
        }
        if (emp) Object.assign(emp, rec);
        else s.employees.push({ id: 'E' + U.pad(s.employees.reduce((mx, y) => Math.max(mx, +String(y.id).replace(/\D/g, '') || 0), 0) + 1, 4), ...rec });
        if (f.dept && !s.depts.includes(f.dept)) s.depts.push(f.dept);
        PL.Payroll.ensure(s);
        Store.touch('config');
        PL.Payroll.touch(s);
        Store.commit(emp ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน', f.code);
        m.close();
        UI.toast(emp ? 'บันทึกแล้ว' : 'เพิ่มพนักงานแล้ว — อย่าลืมจัดกะให้พนักงานใหม่');
        PL.App.rerender();
      });
    },

    rules(body) {
      const S = Store.s.settings;
      const num = (name, label, hint, unit = 'นาที') => `<label class="field"><span class="lbl">${label}</span><div class="row" style="flex-wrap:nowrap"><input class="input" type="number" min="0" name="${name}" value="${esc(S[name])}" style="flex:1"><span class="muted">${unit}</span></div>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
      body.innerHTML = `<div class="grid">
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('refresh', 18)} การโอนบันทึกเวลาเทียบกะ (ขั้นตอนที่ 3)</h3></div><div class="form-grid">
          ${num('mapBefore', 'รับเวลาก่อนเข้ากะได้', 'สแกนก่อนเวลาเข้ากะไม่เกินนี้ นับเป็นของวันนั้น')}
          ${num('mapAfter', 'รับเวลาหลังเลิกกะได้', 'รองรับการทำ OT ต่อเนื่อง')}
          ${num('dupMinutes', 'สแกนซ้ำภายใน', 'นับเป็นการสแกนครั้งเดียว')}
          ${num('minPairGap', 'เข้า-ออกต้องห่างกันอย่างน้อย', 'ถ้าห่างน้อยกว่านี้ ถือว่าสแกนครั้งเดียว')}</div></div>
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('timer', 18)} การทำงานล่วงเวลา (OT)</h3></div><div class="form-grid">
          <label class="check full"><input type="checkbox" name="otRequireApproval" ${S.otRequireApproval ? 'checked' : ''}> นับ OT เฉพาะที่มีคำขอ OT อนุมัติแล้ว (แนะนำ)</label>
          ${num('otMinMinutes', 'OT ขั้นต่ำ', 'น้อยกว่านี้ไม่นับ')}
          ${num('otRoundBlock', 'ปัดเศษ OT ลงทุก', 'เช่น 15 = ปัดลงทุก 15 นาที')}
          ${num('holidayRegularCap', 'ชั่วโมงปกติในวันหยุดสูงสุด', 'เกินนี้นับเป็น OT วันหยุด 3 เท่า')}</div></div>
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('calculator', 18)} อัตราค่าจ้าง (สำหรับประมาณการ)</h3></div><div class="form-grid">
          ${num('monthDivisor', 'หารเงินเดือนเป็นรายวันด้วย', 'ตามกฎหมายแรงงานใช้ 30', 'วัน')}
          ${num('hoursPerDay', 'ชั่วโมงทำงานต่อวัน', '', 'ชม.')}
          <label class="field full"><span class="lbl">พนักงานรายเดือนเข้า/ออกระหว่างงวด คิดเงินเดือนตามสัดส่วน</span><select class="input" name="prorateBy">
            <option value="CAL" ${S.prorateBy !== 'DIV' ? 'selected' : ''}>เงินเดือน × วันที่อยู่ในสภาพการจ้าง ÷ วันปฏิทินของงวด</option>
            <option value="DIV" ${S.prorateBy === 'DIV' ? 'selected' : ''}>เงินเดือน ÷ ${esc(S.monthDivisor || 30)} × วันที่อยู่ในสภาพการจ้าง (ไม่เกินเงินเดือน)</option></select></label>
          <label class="check full"><input type="checkbox" name="deductLate" ${S.deductLate ? 'checked' : ''}> หักค่าจ้างตามเวลาที่มาสาย (ตามสัดส่วนเวลาที่ไม่ได้ทำงาน)</label>
          <label class="check full"><input type="checkbox" name="deductEarly" ${S.deductEarly ? 'checked' : ''}> หักค่าจ้างตามเวลาที่กลับก่อน</label></div></div>
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('info', 18)} อัตรา OT ตามกฎหมายแรงงาน</h3></div>
          <div class="kv"><span>ทำงานเกินเวลาในวันทำงาน</span><span>1.5 เท่า</span><span>ทำงานในวันหยุด (ลูกจ้างรายเดือน)</span><span>1 เท่า (เพิ่มจากเงินเดือน)</span>
          <span>ทำงานในวันหยุด (ลูกจ้างรายวัน)</span><span>2 เท่า</span><span>ทำงานเกินเวลาในวันหยุด</span><span>3 เท่า</span></div>
          <p class="muted" style="font-size:12.5px">การมาสาย: ถ้าสายไม่เกินเวลาผ่อนผันของกะ ไม่นับสาย ถ้าเกินนับเต็มจำนวนนาที — ตั้งเวลาผ่อนผันได้ที่ "ประกาศกะ > ข้อมูลกะ"</p></div>
      </div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-save>${UI.icon('check', 16)} บันทึกกฎการคำนวณ</button></div>`;
      body.querySelector('[data-save]').addEventListener('click', () => {
        const f = UI.formData(body);
        Object.keys(f).forEach((k) => (S[k] = typeof f[k] === 'boolean' || k === 'prorateBy' ? f[k] : +f[k] || 0));
        if (!S.monthDivisor) S.monthDivisor = 30;
        if (!S.hoursPerDay) S.hoursPerDay = 8;
        Store.touch('config');
        Store.commit('แก้ไขกฎการคำนวณ');
        UI.toast('บันทึกกฎแล้ว — ต้องโอนบันทึกเวลาและคำนวณใหม่ในรอบที่ยังไม่ล็อก', 'ok', 4500);
        PL.App.rerender();
      });
    },

    leave(body) {
      const s = Store.s;
      body.innerHTML = `<div class="card"><div class="card-head"><h3>${UI.icon('calendar', 18)} ประเภทการลา</h3><span class="spacer"></span><button class="btn sm" data-add>${UI.icon('plus', 15)} เพิ่มประเภท</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ</th><th class="r">สิทธิ์ต่อปี (วัน)</th><th>ได้รับค่าจ้าง</th><th></th></tr></thead><tbody>
        ${s.leaveTypes.map((l, i) => `<tr data-i="${i}"><td class="mono">${esc(l.code)}</td><td><input class="input sm" data-f="name" value="${esc(l.name)}"></td>
          <td class="r"><input class="input sm" type="number" min="0" data-f="quota" value="${esc(l.quota)}" style="width:90px;text-align:right"></td>
          <td><label class="check"><input type="checkbox" data-f="paid" ${l.paid ? 'checked' : ''}> ได้รับ</label></td>
          <td class="r"><button class="btn xs icon danger-ghost" data-del="${i}">${UI.icon('trash', 14)}</button></td></tr>`).join('')}
        </tbody></table></div><p class="muted" style="font-size:12.5px">สิทธิ์ 0 = ไม่จำกัด/ไม่ตรวจสอบ · ลาที่ไม่ได้รับค่าจ้างจะถูกหักในข้อมูลส่งเงินเดือน (ลูกจ้างรายเดือน)</p>
        <div class="row" style="justify-content:flex-end"><button class="btn primary" data-save>${UI.icon('check', 16)} บันทึก</button></div></div>`;
      body.querySelector('[data-save]').addEventListener('click', () => {
        body.querySelectorAll('tr[data-i]').forEach((tr) => {
          const l = s.leaveTypes[+tr.dataset.i];
          l.name = tr.querySelector('[data-f="name"]').value.trim() || l.name;
          l.quota = +tr.querySelector('[data-f="quota"]').value || 0;
          l.paid = tr.querySelector('[data-f="paid"]').checked;
        });
        Store.touch('config');
        Store.commit('แก้ไขประเภทการลา');
        UI.toast('บันทึกแล้ว');
      });
      body.querySelector('[data-add]').addEventListener('click', () => {
        const code = U.normCode(prompt('รหัสประเภทการลา (ภาษาอังกฤษ เช่น MATERNITY)') || '');
        if (!code) return;
        if (s.leaveTypes.some((l) => l.code === code)) return UI.toast('รหัสนี้มีอยู่แล้ว', 'warn');
        s.leaveTypes.push({ code, name: code, paid: true, quota: 0 });
        Store.commit('เพิ่มประเภทการลา', code);
        PL.App.rerender();
      });
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-del]');
        if (!b) return;
        const l = s.leaveTypes[+b.dataset.del];
        if (s.requests.some((r) => r.leaveType === l.code)) return UI.toast('มีคำขอลาที่ใช้ประเภทนี้อยู่ ลบไม่ได้', 'warn');
        if (!(await UI.confirm(`ลบประเภทการลา ${esc(l.name)}?`, { danger: true, ok: 'ลบ' }))) return;
        s.leaveTypes.splice(+b.dataset.del, 1);
        Store.commit('ลบประเภทการลา', l.code);
        PL.App.rerender();
      });
    },

    system(body) {
      const s = Store.s;
      const bytes = Store.serialize(s).length;
      const pct = Math.min(100, (bytes / (5 * 1024 * 1024)) * 100);
      const old = Object.entries(s.periods).filter(([, P]) => P.locked && P.mapping).map(([k]) => k);
      body.innerHTML = `<div class="grid">
        ${Store.cloud ? `<div class="card span-12"><div class="card-head"><h3>${UI.icon('database', 18)} สำรองข้อมูลบนคลาวด์</h3><span class="spacer"></span><button class="btn sm primary" data-act="cbackup">${UI.icon('download', 15)} สำรองตอนนี้</button></div>
          <p class="muted" style="font-size:12.5px;margin-top:0">สำรองอัตโนมัติวันละครั้งเมื่อ HR/บัญชี/ผู้ดูแลเปิดระบบ (เก็บ 14 ชุดล่าสุด) · สำรองเองเก็บ 20 ชุด · กู้คืนได้เฉพาะผู้ดูแลระบบ และระบบสำรองสถานะปัจจุบันไว้ก่อนกู้คืนทุกครั้ง</p>
          <div data-cbk><div class="muted">กำลังโหลด…</div></div></div>` : ''}
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('database', 18)} ${Store.cloud ? 'ไฟล์สำรอง (JSON)' : 'สำรอง / กู้คืนข้อมูล'}</h3></div>
          <div class="kv">${Store.cloud ? '' : `<span>ขนาดข้อมูล</span><span>${U.num(bytes / 1024)} KB (${U.num(pct, 1)}% ของพื้นที่โดยประมาณ)</span>`}
          <span>พนักงาน</span><span>${U.num(s.employees.length)}</span><span>บันทึกเวลา</span><span>${U.num(s.punches.length)}</span><span>คำขอ</span><span>${U.num(s.requests.length)}</span><span>รอบที่มีข้อมูล</span><span>${Object.keys(s.periods).length}</span></div>
          ${Store.cloud ? '<div style="height:12px"></div>' : `<div class="hbar-track" style="margin:12px 0"><div class="hbar-fill" style="width:${pct}%;background:${pct > 70 ? 'var(--bad)' : 'var(--brand)'}"></div></div>`}
          <div class="row"><button class="btn" data-act="backup">${UI.icon('download', 16)} สำรองข้อมูล (JSON)</button>
          <label class="btn">${UI.icon('upload', 16)} กู้คืนจากไฟล์<input type="file" accept=".json" hidden data-restore></label>
          ${old.length ? `<button class="btn" data-act="compact" title="ลบผลโอนเทียบกะของรอบที่ล็อกแล้ว (ผลคำนวณยังอยู่)">${UI.icon('trash', 16)} ลดขนาดรอบที่ล็อกแล้ว (${old.length})</button>` : ''}</div></div>
        <div class="card span-6"><div class="card-head"><h3>${UI.icon('alert', 18)} เริ่มต้นใหม่</h3></div>
          <p class="muted" style="font-size:13px;margin-top:0">ใช้เมื่อต้องการเริ่มใช้งานจริง หรือกลับไปใช้ข้อมูลตัวอย่าง — ควรสำรองข้อมูลก่อน</p>
          <div class="stack"><button class="btn danger-ghost" data-act="fresh">${UI.icon('trash', 16)} ล้างข้อมูลตัวอย่าง เริ่มใช้งานจริง (เก็บกะ วันหยุด กฎ ไว้)</button>
          <button class="btn danger-ghost" data-act="demo">${UI.icon('refresh', 16)} โหลดข้อมูลตัวอย่างใหม่ทั้งหมด</button></div></div>
        <div class="card span-12"><div class="card-head"><h3>${UI.icon('list', 18)} ประวัติการทำงาน (ล่าสุด 100 รายการ)</h3></div>
          <div class="tbl-wrap" style="max-height:420px"><table class="tbl compact"><thead><tr><th>เมื่อ</th><th>ผู้ทำ</th><th>รายการ</th><th>รายละเอียด</th></tr></thead><tbody>
          ${s.log.slice(0, 100).map((l) => `<tr><td class="nowrap">${U.fmtStamp(l.at)}</td><td>${esc(l.by)}</td><td>${esc(l.action)}</td><td class="muted">${esc(l.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="dt-empty">ยังไม่มีประวัติ</td></tr>'}
          </tbody></table></div></div></div>`;
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const a = b.dataset.act;
        if (a === 'cbackup') {
          b.disabled = true;
          try {
            const r = await PL.Cloud.backupNow();
            UI.toast(r && r.empty ? 'ยังไม่มีข้อมูลให้สำรอง' : `สำรองข้อมูลแล้ว (${U.num((r.bytes || 0) / 1024)} KB)`, 'ok');
            Store.log('สำรองข้อมูลบนคลาวด์');
            Store.save();
            this.cloudBackups(body);
          } catch (err) {
            UI.toast('สำรองไม่สำเร็จ: ' + esc(err.message), 'bad');
          }
          b.disabled = false;
        }
        if (a === 'backup') U.download(`payroll-full-loop-backup_${U.todayStr()}.json`, Store.serialize(s), 'application/json');
        if (a === 'compact') {
          if (!(await UI.confirm(`ลบผลโอนเทียบกะของรอบที่ล็อกแล้ว: ${old.map(U.fmtPeriodShort).join(', ')}?<br><span class="muted">ผลคำนวณและรายงานยังอยู่ครบ</span>`))) return;
          old.forEach((k) => (s.periods[k].mapping = null));
          Store.commit('ลดขนาดข้อมูล', old.join(', '));
          PL.App.rerender();
        }
        if (a === 'fresh') {
          if (!(await UI.confirm('ล้างพนักงาน บันทึกเวลา ตารางกะ คำขอ และผลคำนวณทั้งหมด?<br>การตั้งค่า กะ วันหยุด และประเภทการลาจะยังอยู่<br><b>ไม่สามารถย้อนกลับได้</b> (ยกเว้นมีไฟล์สำรอง)', { danger: true, ok: 'ล้างข้อมูล' }))) return;
          const keep = PL.Seed.empty();
          Object.assign(keep, { company: s.company, user: s.user, shifts: s.shifts, holidays: s.holidays, leaveTypes: s.leaveTypes, depts: s.depts });
          keep.pay = Object.assign(PL.Payroll.base(), { settings: s.pay.settings, items: s.pay.items });
          keep.settings = Object.assign({}, s.settings, { period: U.todayStr().slice(0, 7) });
          keep.log = [{ at: U.nowISO(), by: s.user.name, action: 'ล้างข้อมูลตัวอย่าง', detail: 'เริ่มใช้งานจริง' }];
          Store.replace(keep);
          UI.toast('ล้างข้อมูลแล้ว — เริ่มจากเพิ่มพนักงานที่แท็บ "พนักงาน"', 'ok', 5000);
          PL.App.go('settings', { tab: 'employees' });
        }
        if (a === 'demo') {
          if (!(await UI.confirm('แทนที่ข้อมูลทั้งหมดด้วยข้อมูลตัวอย่าง?<br><b>ข้อมูลปัจจุบันจะหายทั้งหมด</b>', { danger: true, ok: 'โหลดข้อมูลตัวอย่าง' }))) return;
          Store.replace(PL.Seed.build());
          UI.toast('โหลดข้อมูลตัวอย่างแล้ว');
          PL.App.go('dashboard');
        }
      });
      if (Store.cloud) this.cloudBackups(body);
      body.querySelector('[data-restore]').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const data = JSON.parse(await U.readFile(f));
          if (data.version !== 1 || !Array.isArray(data.employees)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
          if (!(await UI.confirm(`กู้คืนข้อมูลจาก <b>${esc(f.name)}</b>?<br>พนักงาน ${data.employees.length} คน · บันทึกเวลา ${U.num((data.punches || []).length)} รายการ<br><b>ข้อมูลปัจจุบันจะถูกแทนที่</b>`, { danger: true, ok: 'กู้คืน' }))) return;
          Store.replace(data);
          Store.commit('กู้คืนข้อมูล', f.name);
          UI.toast('กู้คืนข้อมูลแล้ว');
          PL.App.go('dashboard');
        } catch (err) {
          UI.toast('อ่านไฟล์ไม่สำเร็จ: ' + esc(err.message), 'bad');
        }
      });
    },

    /* ---------- คลาวด์: รายการสำรองข้อมูล ---------- */
    async cloudBackups(body) {
      const host = body.querySelector('[data-cbk]');
      if (!host) return;
      const KIND = { auto: ['อัตโนมัติ', 'info'], manual: ['สำรองเอง', 'ok'], 'pre-restore': ['ก่อนกู้คืน', 'warn'] };
      try {
        const list = await PL.Cloud.backups();
        host.innerHTML = list.length
          ? `<div class="tbl-wrap" style="max-height:320px"><table class="tbl compact"><thead><tr><th>#</th><th>เมื่อ</th><th>ประเภท</th><th>โดย</th><th class="r">ขนาด</th><th class="r">เอกสาร</th><th></th></tr></thead><tbody>
            ${list.map((b) => `<tr><td class="mono">${b.id}</td><td class="nowrap">${U.fmtStamp(b.at)}</td><td>${UI.pill(...(KIND[b.kind] || [b.kind, 'off']))}</td><td>${esc(b.by_name || '')}</td><td class="r">${U.num(b.bytes / 1024)} KB</td><td class="r">${b.docs}</td>
              <td class="r nowrap"><button class="btn xs" data-dl="${b.id}">${UI.icon('download', 13)} JSON</button>${Store.can('admin') ? ` <button class="btn xs danger-ghost" data-rs="${b.id}">กู้คืน</button>` : ''}</td></tr>`).join('')}
            </tbody></table></div>`
          : '<div class="muted">ยังไม่มีชุดสำรอง</div>';
      } catch (err) {
        host.innerHTML = `<div class="muted">โหลดรายการสำรองไม่สำเร็จ: ${esc(err.message)}</div>`;
        return;
      }
      host.onclick = async (e) => {
        const dl = e.target.closest('[data-dl]'), rs = e.target.closest('[data-rs]');
        if (dl) {
          try {
            const f = await PL.Cloud.backupFile(+dl.dataset.dl);
            U.download(`payroll-full-loop-cloud-backup-${dl.dataset.dl}_${f.at.slice(0, 10)}.json`, f.json, 'application/json');
          } catch (err) {
            UI.toast('ดาวน์โหลดไม่สำเร็จ: ' + esc(err.message), 'bad');
          }
        }
        if (rs) {
          if (!(await UI.confirm(`กู้คืนข้อมูลทั้งระบบจากชุดสำรอง #${rs.dataset.rs}?<br>ข้อมูลปัจจุบันของ<b>ทุกผู้ใช้</b>จะถูกแทนที่ — ระบบจะสำรองสถานะปัจจุบันไว้ให้ก่อน (ประเภท "ก่อนกู้คืน")`, { danger: true, ok: 'กู้คืน' }))) return;
          try {
            await PL.Cloud.restore(+rs.dataset.rs);
            Store.log('กู้คืนข้อมูลจากชุดสำรองบนคลาวด์', '#' + rs.dataset.rs);
            Store.save();
            UI.toast('กู้คืนข้อมูลแล้ว', 'ok');
            PL.App.go('dashboard');
          } catch (err) {
            UI.toast('กู้คืนไม่สำเร็จ: ' + esc(err.message), 'bad');
          }
        }
      };
    },

    /* ---------- บัญชีของฉัน (บทบาทที่ไม่ใช่ HR) ---------- */
    me(body) {
      const s = Store.s;
      body.innerHTML = `<div class="card" style="max-width:640px"><div class="card-head"><h3>${UI.icon('user', 18)} บัญชีของฉัน</h3></div>
        <div class="kv"><span>ชื่อ</span><span>${esc(s.user.name)}</span><span>อีเมล</span><span>${esc(s.user.email || '')}</span><span>บทบาท</span><span>${esc(s.user.role)}</span><span>บริษัท</span><span>${esc(s.company.name)}</span></div>
        <p class="muted" style="font-size:12.5px">${Store.role === 'manager' ? 'หัวหน้างาน: ดูบันทึกเวลา จัดตารางกะ และอนุมัติคำขอได้ — ไม่เห็นข้อมูลเงินเดือน' : 'ฝ่ายบัญชี/เงินเดือน: คำนวณ ปิดงวด และออกรายงานเงินเดือนได้ — แก้ทะเบียนพนักงาน/การตั้งค่าบันทึกเวลาไม่ได้'}<br>ต้องการสิทธิ์เพิ่ม ติดต่อผู้ดูแลระบบ</p>
        ${Store.cloud ? `<button class="btn" data-lo>${UI.icon('logout', 16)} ออกจากระบบ</button>` : ''}</div>`;
      const lo = body.querySelector('[data-lo]');
      if (lo) lo.addEventListener('click', () => PL.Cloud.logout());
    },

    /* ---------- ผู้ใช้และสิทธิ์ (admin) ---------- */
    async users(body) {
      const s = Store.s, C = PL.Cloud;
      const ROLES = ['admin', 'hr', 'accountant', 'manager', 'employee', 'pending', 'disabled'];
      const DESC = {
        admin: 'ทุกอย่าง + กำหนดสิทธิ์ผู้ใช้ + กู้คืนข้อมูล',
        hr: 'ทุกอย่าง ยกเว้นกำหนดสิทธิ์และกู้คืน',
        accountant: 'เงินเดือนทั้งหมด (ดูบันทึกเวลาได้ แก้ไม่ได้)',
        manager: 'บันทึกเวลา ตารางกะ อนุมัติคำขอ — ไม่เห็นเงินเดือน',
        employee: 'ยังไม่เปิด (ESS รอบถัดไป)',
        pending: 'สมัครแล้ว รอกำหนดสิทธิ์ — เข้าไม่ได้',
        disabled: 'ระงับการใช้งาน',
      };
      body.innerHTML = `<div class="card"><div class="card-head"><h3>${UI.icon('user', 18)} ผู้ใช้และสิทธิ์</h3></div>
        <p class="muted" style="font-size:12.5px;margin-top:0">${C.embedded ? 'เปิดผ่าน HR Unified: ใช้บัญชีของ HR Unified — Owner = ผู้ดูแลระบบ, HR Admin = HR, Payroll = บัญชี/เงินเดือน โดยอัตโนมัติ (คนอื่นต้องกำหนดที่นี่) · ผู้ใช้ขึ้นในรายการหลังเปิดเมนูนี้ครั้งแรก' : 'ผู้ใช้ใหม่สมัครเองที่หน้าเข้าสู่ระบบ (เมนู "สมัครบัญชีใหม่") แล้วขึ้นในรายการนี้เป็น "รอกำหนดสิทธิ์" · บัญชี Owner / HR Admin / Payroll ของ HR Unified ได้สิทธิ์อัตโนมัติ'} — กำหนดบทบาทที่นี่จะทับสิทธิ์จาก HR Unified (เช่น ตั้ง "ระงับการใช้งาน") · สิทธิ์ถูกบังคับที่ฐานข้อมูล (Row Level Security) ไม่ใช่แค่ซ่อนเมนู</p>
        <div class="kv" style="margin-bottom:12px">${ROLES.slice(0, 5).map((r) => `<span><b>${esc(C.ROLE_TH[r])}</b></span><span class="muted">${DESC[r]}</span>`).join('')}</div>
        <div data-list><div class="muted">กำลังโหลด…</div></div></div>`;
      const host = body.querySelector('[data-list]');
      let list;
      try {
        list = await C.users();
      } catch (err) {
        host.innerHTML = `<div class="muted">โหลดไม่สำเร็จ: ${esc(err.message)}</div>`;
        return;
      }
      const empOpt = (sel) => `<option value="">–</option>${s.employees.map((e) => `<option value="${esc(e.id)}" ${e.id === sel ? 'selected' : ''}>${esc(e.code)} ${esc(e.name)}</option>`).join('')}`;
      const HRU_TH = { owner: 'Owner', hr_admin: 'HR Admin', payroll: 'Payroll', recruiter: 'Recruiter', manager: 'Manager', supervisor: 'Supervisor', employee: 'Officer' };
      const who = (email) => (/@hru\.invalid$/.test(email) ? `รหัสพนักงาน ${esc(email.replace(/^emp\./, '').replace(/@hru\.invalid$/, '').toUpperCase())}` : esc(email));
      host.innerHTML = `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>บัญชี</th><th>ชื่อที่แสดง</th><th>กำหนดใน Payroll Full Loop</th><th>สิทธิ์ที่ใช้จริง</th><th>ผูกกับพนักงาน</th><th>เข้าครั้งแรก</th><th></th></tr></thead><tbody>
        ${list.map((u) => `<tr data-u="${esc(u.user_id)}"><td>${who(u.email)}${u.user_id === C.profile.user_id ? ' ' + UI.pill('คุณ', 'info') : ''}</td>
          <td><input class="input sm" data-f="name" value="${esc(u.name)}" style="width:150px"></td>
          <td><select class="input sm" data-f="role">${ROLES.map((r) => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${r === 'pending' ? 'ตามสิทธิ์ HR Unified / รอกำหนด' : esc(C.ROLE_TH[r])}</option>`).join('')}</select></td>
          <td class="nowrap">${UI.pill(C.ROLE_TH[u.effective] || u.effective, ['admin', 'hr', 'accountant', 'manager'].includes(u.effective) ? 'ok' : 'off')}${u.source === 'hru' ? ` <small class="muted">จาก HR Unified (${esc(HRU_TH[u.hru_role] || u.hru_role)})</small>` : ''}</td>
          <td><select class="input sm" data-f="emp" style="max-width:200px">${empOpt(u.emp_id)}</select></td>
          <td class="nowrap muted">${U.fmtStamp(u.created_at)}</td>
          <td class="r"><button class="btn xs primary" data-save>บันทึก</button></td></tr>`).join('')}
        </tbody></table></div>`;
      host.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-save]');
        if (!b) return;
        const tr = b.closest('tr'), get = (f) => tr.querySelector(`[data-f="${f}"]`).value;
        const u = list.find((x) => x.user_id === tr.dataset.u);
        if (u.user_id === C.profile.user_id && get('role') !== 'admin' && !(await UI.confirm('ลดสิทธิ์ตัวเอง? คุณจะจัดการผู้ใช้ไม่ได้อีก', { danger: true, ok: 'ยืนยัน' }))) return;
        try {
          const r = await C.setUser(u.user_id, get('role'), get('name'), get('emp'));
          Object.assign(u, r);
          UI.toast(`บันทึกสิทธิ์ ${esc(u.email)} เป็น ${esc(C.ROLE_TH[r.role])} แล้ว`, 'ok');
          if (u.user_id === C.profile.user_id) location.reload();
        } catch (err) {
          UI.toast('บันทึกไม่สำเร็จ: ' + esc(err.message), 'bad');
        }
      });
    },

    /* ---------- ประวัติการแก้ไขระดับรายการ (จาก trigger ในฐานข้อมูล) ---------- */
    async audit(body) {
      const s = Store.s, C = PL.Cloud;
      st.audit = st.audit || { doc: '', q: '' };
      const A = st.audit;
      const empName = {};
      s.employees.forEach((e) => (empName[e.id] = `${e.code} ${e.name}`));
      const DOCS = [['', 'ทุกข้อมูล'], ['employees', 'ทะเบียนพนักงาน'], ['pay_profiles', 'ข้อมูลเงินเดือนพนักงาน'], ['pay_config', 'ตั้งค่าเงินเดือน'], ['pay_run:', 'งวดเงินเดือน'], ['config', 'การตั้งค่า'], ['requests', 'คำขอ'], ['roster', 'ตารางกะ'], ['period:', 'ผลบันทึกเวลา'], ['punches:', 'บันทึกเวลา'], ['users', 'สิทธิ์ผู้ใช้']];
      body.innerHTML = `<div class="card"><div class="toolbar">
          <select class="input sm" data-doc>${DOCS.map(([k, l]) => `<option value="${k}" ${k === A.doc ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <input class="input sm search-in" data-q placeholder="ค้นหาฟิลด์ เช่น salary, taxId, E0012" value="${esc(A.q)}">
          <span class="spacer"></span><span class="muted" style="font-size:12.5px">300 รายการล่าสุด · บันทึกโดยฐานข้อมูล แก้ไขหรือลบจากหน้าเว็บไม่ได้</span></div>
        <div data-list><div class="muted">กำลังโหลด…</div></div></div>`;
      const show = (v) => {
        if (v == null) return '<span class="muted">–</span>';
        const t = typeof v === 'string' ? v : JSON.stringify(v);
        return `<span class="mono" style="font-size:12px;word-break:break-all">${esc(t.length > 160 ? t.slice(0, 160) + '…' : t)}</span>`;
      };
      const pathTh = (doc, p) => {
        if (!p) return '';
        const parts = p.split('.').filter(Boolean);
        if (['employees', 'pay_profiles', 'requests'].includes(doc) && empName[parts[0]]) parts[0] = empName[parts[0]];
        return parts.join(' › ');
      };
      const load = async () => {
        const host = body.querySelector('[data-list]');
        try {
          const rows = await C.audit({ doc: A.doc, q: A.q });
          const OP = { insert: ['สร้าง', 'ok'], update: ['แก้ไข', 'info'], delete: ['ลบ', 'bad'], role: ['สิทธิ์', 'warn'] };
          host.innerHTML = rows.length
            ? `<div class="tbl-wrap" style="max-height:600px"><table class="tbl compact"><thead><tr><th>เมื่อ</th><th>ผู้แก้ไข</th><th>ข้อมูล</th><th></th><th>รายการ / ฟิลด์</th><th>ค่าเดิม</th><th>ค่าใหม่</th></tr></thead><tbody>
              ${rows.map((r) => `<tr><td class="nowrap">${U.fmtStamp(r.at)}</td><td>${esc(r.user_name || '–')}</td><td class="nowrap">${esc(r.doc === 'users' ? 'สิทธิ์ผู้ใช้' : C.DOC_TH(r.doc))}</td>
                <td>${UI.pill(...(OP[r.op] || [r.op, 'off']))}</td><td>${esc(pathTh(r.doc, r.path))}</td><td>${show(r.old)}</td><td>${show(r.new)}</td></tr>`).join('')}
              </tbody></table></div>`
            : '<div class="muted" style="padding:12px 0">ไม่พบรายการ</div>';
        } catch (err) {
          host.innerHTML = `<div class="muted">โหลดไม่สำเร็จ: ${esc(err.message)}</div>`;
        }
      };
      body.querySelector('[data-doc]').addEventListener('change', (e) => ((A.doc = e.target.value), load()));
      body.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((A.q = e.target.value.trim()), load()), 400));
      load();
    },
  };
})(window);

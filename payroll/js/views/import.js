/* ขั้นตอนที่ 1: ดึงบันทึกเวลา (Time Data Import) */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const st = { q: '', src: '', only: '' };
  let pending = null; // ผลการอ่านไฟล์ที่รอยืนยัน

  const SRC = { import: ['นำเข้า', 'brand'], manual: ['เพิ่มเอง', 'purple'], demo: ['ตัวอย่าง', 'off'] };

  PL.Views.import = {
    render(el) {
      const s = Store.s, pk = Store.pk, R = Store.range(), ix = Store.ix();
      const t0 = R.start + ' 00:00', t1 = U.addDays(R.end, 1) + ' 00:00';
      const rows = [];
      s.punches.forEach((p, i) => {
        if (p.t >= t0 && p.t < t1) rows.push({ ...p, _i: i, eid: E.resolveCode(ix, p.c) });
      });
      const unknown = [...new Set(rows.filter((r) => !r.eid).map((r) => r.c))];
      const empWith = new Set(rows.filter((r) => r.eid).map((r) => r.eid)).size;
      const act = s.employees.filter((e) => e.active !== false).length;
      const manual = rows.filter((r) => r.src === 'manual').length;
      const locked = Store.isLocked();
      const imports = s.imports.slice(-6).reverse();

      el.innerHTML = `${UI.stepHeader(
        'import',
        `<button class="btn" data-act="template">${UI.icon('download', 16)} ไฟล์ต้นแบบ</button>
         <button class="btn" data-act="demo" ${locked ? 'disabled' : ''}>${UI.icon('zap', 16)} สร้างข้อมูลตัวอย่าง</button>
         <button class="btn primary" data-act="manual" ${locked ? 'disabled' : ''}>${UI.icon('plus', 16)} เพิ่มบันทึกเวลา</button>`
      )}
      ${locked ? UI.banner('info', 'รอบนี้ส่งข้อมูลให้ฝ่ายเงินเดือนแล้ว — ดูข้อมูลได้แต่แก้ไขไม่ได้') : ''}
      <div class="grid">
        <div class="card span-7">
          <div class="card-head"><h3>${UI.icon('upload', 18)} นำเข้าไฟล์จากเครื่องบันทึกเวลา</h3></div>
          <div class="dropzone" data-dz>
            ${UI.icon('upload', 34)}
            <div><b>ลากไฟล์มาวางที่นี่</b> หรือ <label class="link" style="cursor:pointer;color:var(--brand-600);font-weight:600">เลือกไฟล์<input type="file" accept=".csv,.txt,.dat,.log" hidden data-file ${locked ? 'disabled' : ''}></label></div>
            <div class="hint">รองรับ .csv .txt .dat — <code>รหัส,วันที่,เวลา</code> หรือไฟล์ attlog จากเครื่องสแกนนิ้ว (รหัสพนักงานหรือเลขบัตร)</div>
          </div>
          <div class="row" style="margin-top:12px">
            <label class="field" style="flex:1;min-width:200px"><span class="lbl">ชื่อเครื่อง / แหล่งข้อมูล</span><input class="input" data-dev value="FP-01 สำนักงาน"></label>
            <button class="btn" style="align-self:flex-end" data-act="paste" ${locked ? 'disabled' : ''}>${UI.icon('file', 16)} วางข้อความ</button>
          </div>
          <div data-preview></div>
        </div>
        <div class="card span-5">
          <div class="card-head"><h3>${UI.icon('database', 18)} สรุปข้อมูลรอบนี้</h3></div>
          <div class="kv">
            <span>บันทึกเวลาทั้งหมด</span><span>${U.num(rows.length)} รายการ</span>
            <span>พนักงานที่มีบันทึกเวลา</span><span>${U.num(empWith)} / ${U.num(act)} คน</span>
            <span>เพิ่มด้วยตนเอง</span><span>${U.num(manual)} รายการ</span>
            <span>รหัสที่ไม่รู้จัก</span><span>${unknown.length ? `<a href="#" data-act="onlyUnknown" style="color:var(--bad)">${unknown.length} รหัส (${esc(unknown.slice(0, 4).join(', '))})</a>` : '<span style="color:var(--ok)">ไม่มี</span>'}</span>
          </div>
          <h4 style="margin:18px 0 8px;font-size:13.5px">ประวัติการนำเข้า</h4>
          ${
            imports.length
              ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>เมื่อ</th><th>ไฟล์</th><th class="r">เพิ่ม</th><th class="r">ซ้ำ</th></tr></thead><tbody>
            ${imports.map((x) => `<tr><td class="nowrap">${U.fmtStamp(x.at)}</td><td>${esc(x.file)}</td><td class="r">${U.num(x.added)}</td><td class="r">${U.num(x.dup || 0)}</td></tr>`).join('')}</tbody></table></div>`
              : '<div class="muted">ยังไม่มีการนำเข้า</div>'
          }
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>${UI.icon('list', 18)} บันทึกเวลาในรอบ</h3><span class="spacer"></span>
          ${!locked && rows.length ? `<button class="btn sm danger-ghost" data-act="clear">${UI.icon('trash', 15)} ลบทั้งหมดในรอบ</button>` : ''}</div>
        <div class="toolbar">
          <input class="input search-in" placeholder="ค้นหารหัส / ชื่อ / แผนก" data-q value="${esc(st.q)}">
          <select class="input" data-src><option value="">ทุกแหล่งที่มา</option>${Object.entries(SRC).map(([k, [l]]) => `<option value="${k}" ${st.src === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <label class="check"><input type="checkbox" data-only ${st.only ? 'checked' : ''}> เฉพาะรหัสที่ไม่รู้จัก</label>
        </div>
        <div data-tbl></div>
      </div>
      ${UI.stepNav('import')}`;

      const table = new UI.DataTable({
        pageSize: 25,
        sortKey: 't',
        compact: true,
        columns: [
          { key: 't', label: 'วันเวลา', render: (r) => `<span class="nowrap">${U.fmtDay(r.t.slice(0, 10))}</span> <b class="mono">${r.t.slice(11)}</b>` },
          { key: 'c', label: 'รหัส/บัตร', render: (r) => `<span class="mono">${esc(r.c)}</span>` },
          { key: 'name', label: 'พนักงาน', sv: (r) => (r.eid ? ix.emps[r.eid].name : 'ฮฮ'), render: (r) => (r.eid ? `${esc(ix.emps[r.eid].name)} <span class="muted">${esc(ix.emps[r.eid].code)}</span>` : UI.pill('ไม่รู้จักรหัสนี้', 'bad')) },
          { key: 'dept', label: 'แผนก', sv: (r) => (r.eid ? ix.emps[r.eid].dept : ''), render: (r) => esc(r.eid ? ix.emps[r.eid].dept : '') },
          { key: 'dv', label: 'เครื่อง', render: (r) => esc(r.dv || '') },
          { key: 'src', label: 'ที่มา', render: (r) => UI.pill(...(SRC[r.src] || [r.src || '-', 'off'])) + (r.note ? ` <span class="muted" title="${esc(r.note)}">${UI.icon('info', 14)}</span>` : '') },
          { key: '_a', label: '', sort: false, align: 'r', render: () => (locked ? '' : `<button class="btn xs icon danger-ghost" data-act="del" title="ลบ">${UI.icon('trash', 14)}</button>`) },
        ],
        onAction: async (a, r) => {
          if (a !== 'del') return;
          if (!Store.guard([r.t.slice(0, 10)])) return;
          if (!(await UI.confirm(`ลบบันทึกเวลา <b>${esc(r.c)}</b> เวลา ${U.fmtDT(r.t)} ?`, { danger: true, ok: 'ลบ' }))) return;
          s.punches.splice(r._i, 1);
          Store.touch('punches', [r.t.slice(0, 10)]);
          Store.commit('ลบบันทึกเวลา', `${r.c} ${r.t}`);
          PL.App.rerender();
        },
      });
      el.querySelector('[data-tbl]').appendChild(table.el);
      const apply = () => {
        const q = st.q.toLowerCase();
        table.setRows(
          rows.filter((r) => {
            if (st.src && r.src !== st.src) return false;
            if (st.only && r.eid) return false;
            if (q) {
              const e = r.eid && ix.emps[r.eid];
              if (!`${r.c} ${e ? e.name + ' ' + e.code + ' ' + e.dept : ''}`.toLowerCase().includes(q)) return false;
            }
            return true;
          })
        );
      };
      apply();

      el.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((st.q = e.target.value.trim()), apply()), 150));
      el.querySelector('[data-src]').addEventListener('change', (e) => ((st.src = e.target.value), apply()));
      el.querySelector('[data-only]').addEventListener('change', (e) => ((st.only = e.target.checked ? '1' : ''), apply()));

      // ไฟล์
      const dz = el.querySelector('[data-dz]');
      const handleFile = async (file) => {
        if (!file || locked) return;
        const text = await U.readFile(file);
        this.preview(el, text, file.name);
      };
      el.querySelector('[data-file]').addEventListener('change', (e) => handleFile(e.target.files[0]));
      ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => (e.preventDefault(), dz.classList.add('over'))));
      ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, (e) => (e.preventDefault(), dz.classList.remove('over'))));
      dz.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
      if (pending) this.showPreview(el);

      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const a = b.dataset.act;
        if (a === 'template') this.template();
        if (a === 'manual') this.manualForm();
        if (a === 'demo') this.demo();
        if (a === 'onlyUnknown') {
          e.preventDefault();
          st.only = '1';
          el.querySelector('[data-only]').checked = true;
          apply();
        }
        if (a === 'paste') {
          const m = UI.modal({
            title: 'วางข้อมูลบันทึกเวลา',
            sub: 'คัดลอกจาก Excel หรือไฟล์ข้อความ — 1 บรรทัดต่อ 1 ครั้งที่สแกน',
            size: 'lg',
            body: `<textarea class="input" rows="12" style="width:100%;font-family:var(--mono)" placeholder="EMP0001,2026-10-01,07:55&#10;EMP0001,2026-10-01,17:04&#10;1003	2026-10-01 07:48:10"></textarea>`,
            footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>อ่านข้อมูล</button>`,
          });
          m.$('[data-ok]').addEventListener('click', () => {
            const text = m.$('textarea').value;
            m.close();
            this.preview(el, text, 'วางข้อความ');
          });
        }
        if (a === 'clear') {
          if (!Store.guard(R.days)) return;
          if (!(await UI.confirm(`ลบบันทึกเวลาทั้งหมด <b>${U.num(rows.length)}</b> รายการในรอบ ${U.fmtPeriod(pk)}?<br><span class="muted">คำขอและตารางกะจะไม่ถูกลบ</span>`, { danger: true, ok: 'ลบทั้งหมด' }))) return;
          const del = new Set(rows.map((r) => r._i));
          s.punches = s.punches.filter((_, i) => !del.has(i));
          Store.touch('punches', R.days);
          Store.commit('ลบบันทึกเวลาทั้งรอบ', `${rows.length} รายการ ${U.fmtPeriodShort(pk)}`);
          UI.toast(`ลบแล้ว ${U.num(rows.length)} รายการ`);
          PL.App.rerender();
        }
        if (a === 'doImport') this.doImport(el);
        if (a === 'cancelImport') {
          pending = null;
          el.querySelector('[data-preview]').innerHTML = '';
        }
      });
    },

    preview(el, text, file) {
      const s = Store.s, ix = Store.ix();
      const res = E.parsePunchText(text);
      const exist = new Set(s.punches.map((p) => U.normCode(p.c) + '|' + p.t));
      const seen = new Set();
      const fresh = [];
      let dup = 0;
      for (const r of res.rows) {
        const k = r.c + '|' + r.t;
        if (exist.has(k) || seen.has(k)) {
          dup++;
          continue;
        }
        seen.add(k);
        fresh.push(r);
      }
      const unknown = [...new Set(fresh.filter((r) => !E.resolveCode(ix, r.c)).map((r) => r.c))];
      const lockedRows = fresh.filter((r) => Store.isLocked(E.periodOf(s, r.t.slice(0, 10))));
      const dates = fresh.map((r) => r.t.slice(0, 10)).sort();
      const pks = [...new Set(dates.map((d) => E.periodOf(s, d)))];
      pending = { file, fresh, dup, errors: res.errors, unknown, lockedRows: lockedRows.length, from: dates[0], to: dates[dates.length - 1], pks };
      this.showPreview(el);
    },
    showPreview(el) {
      const p = pending;
      const box = el.querySelector('[data-preview]');
      const ok = p.fresh.length - p.lockedRows;
      box.innerHTML = `<div class="preview-box">
        <div class="row" style="justify-content:space-between"><b>${UI.icon('file', 16)} ${esc(p.file)}</b>${p.from ? `<span class="muted">${U.fmtDate(p.from)} – ${U.fmtDate(p.to)}</span>` : ''}</div>
        <div class="kv" style="margin-top:10px">
          <span>รายการใหม่ที่จะนำเข้า</span><span style="color:var(--ok)">${U.num(ok)}</span>
          <span>ซ้ำกับที่มีอยู่ (ข้าม)</span><span>${U.num(p.dup)}</span>
          ${p.lockedRows ? `<span>อยู่ในรอบที่ล็อกแล้ว (ข้าม)</span><span style="color:var(--warn)">${U.num(p.lockedRows)}</span>` : ''}
          <span>บรรทัดที่อ่านไม่ได้</span><span style="color:${p.errors.length ? 'var(--bad)' : 'inherit'}">${U.num(p.errors.length)}</span>
          <span>รหัสที่ไม่พบในทะเบียน</span><span style="color:${p.unknown.length ? 'var(--warn)' : 'inherit'}">${p.unknown.length ? esc(p.unknown.slice(0, 6).join(', ')) + (p.unknown.length > 6 ? ' …' : '') : '0'}</span>
          <span>ครอบคลุมรอบ</span><span>${p.pks.map(U.fmtPeriodShort).join(', ') || '-'}</span>
        </div>
        ${p.errors.length ? `<details style="margin-top:8px"><summary class="muted">ดูบรรทัดที่อ่านไม่ได้</summary><pre class="code">${p.errors.slice(0, 10).map((x) => `บรรทัด ${x.line}: ${esc(x.text)}`).join('\n')}</pre></details>` : ''}
        <div class="row" style="justify-content:flex-end;margin-top:12px">
          <button class="btn" data-act="cancelImport">ยกเลิก</button>
          <button class="btn primary" data-act="doImport" ${ok ? '' : 'disabled'}>${UI.icon('import', 16)} นำเข้า ${U.num(ok)} รายการ</button>
        </div></div>`;
    },
    doImport(el) {
      const s = Store.s, p = pending;
      if (!p) return;
      const dv = el.querySelector('[data-dev]').value.trim();
      const rows = p.fresh.filter((r) => !Store.isLocked(E.periodOf(s, r.t.slice(0, 10))));
      rows.forEach((r) => s.punches.push({ c: r.c, t: r.t, dv, src: 'import' }));
      s.punches.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
      s.imports.push({ at: U.nowISO(), file: p.file, added: rows.length, dup: p.dup, errors: p.errors.length, by: s.user.name });
      Store.touch('punches', [...new Set(rows.map((r) => r.t.slice(0, 10)))]);
      pending = null;
      Store.commit('นำเข้าบันทึกเวลา', `${p.file}: ${rows.length} รายการ`);
      UI.toast(`นำเข้าแล้ว ${U.num(rows.length)} รายการ — ขั้นต่อไป: ตรวจตารางกะ แล้วโอนบันทึกเวลาเทียบกะ`, 'ok', 5000);
      PL.App.rerender();
    },

    manualForm() {
      const R = Store.range();
      const m = UI.modal({
        title: 'เพิ่มบันทึกเวลาด้วยตนเอง',
        sub: 'ใช้ในกรณีเครื่องบันทึกเวลาขัดข้อง — ถ้าพนักงานลืมสแกน แนะนำให้ใช้ "คำขอแก้ไขเวลา" เพื่อให้มีการอนุมัติ',
        body: `<div class="form-grid">
          <label class="field full"><span class="lbl req">พนักงาน</span><select class="input" name="e">${UI.empOptions()}</select></label>
          <label class="field"><span class="lbl req">วันที่</span><input class="input" type="date" name="d" value="${R.start}"></label>
          <label class="field"><span class="lbl req">เวลา</span><input class="input" type="time" name="t" value="08:00"></label>
          <label class="field full"><span class="lbl">หมายเหตุ</span><input class="input" name="note" placeholder="เช่น เครื่องสแกนเสีย"></label></div>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>บันทึก</button>`,
      });
      m.$('[data-ok]').addEventListener('click', () => {
        const f = UI.formData(m.el);
        if (!f.e || !f.d || !f.t) return UI.toast('กรุณากรอกข้อมูลให้ครบ', 'warn');
        if (!Store.guard([f.d])) return;
        const emp = Store.emp(f.e);
        Store.s.punches.push({ c: emp.code, t: `${f.d} ${f.t}`, dv: 'บันทึกด้วยมือ', src: 'manual', note: f.note, by: Store.s.user.name });
        Store.touch('punches', [f.d]);
        Store.commit('เพิ่มบันทึกเวลา', `${emp.code} ${f.d} ${f.t}`);
        m.close();
        UI.toast('เพิ่มบันทึกเวลาแล้ว');
        PL.App.rerender();
      });
    },

    template() {
      const R = Store.range();
      const emps = Store.s.employees.slice(0, 3);
      const rows = [];
      emps.forEach((e) => {
        rows.push([e.code, R.start, '07:52', 'FP-01']);
        rows.push([e.code, R.start, '17:06', 'FP-01']);
      });
      U.download('time-import-template.csv', U.csv(['รหัสพนักงาน', 'วันที่ (YYYY-MM-DD หรือ DD/MM/YYYY)', 'เวลา (HH:MM)', 'เครื่อง'], rows));
    },

    async demo() {
      const s = Store.s, pk = Store.pk, R = Store.range();
      if (!Store.guard(R.days)) return;
      const t0 = R.start + ' 00:00', t1 = U.addDays(R.end, 1) + ' 00:00';
      if (s.punches.some((p) => p.t >= t0 && p.t < t1)) return UI.toast('รอบนี้มีบันทึกเวลาอยู่แล้ว — ลบข้อมูลในรอบก่อนถ้าต้องการสร้างใหม่', 'warn', 4500);
      if (!s.employees.length) return UI.toast('ยังไม่มีพนักงาน — เพิ่มพนักงานที่หน้า ตั้งค่า ก่อน', 'warn');
      const today = U.todayStr();
      if (R.start > today) return UI.toast('รอบนี้ยังไม่เริ่ม จึงยังไม่มีเวลาให้จำลอง', 'warn');
      if (!(await UI.confirm(`สร้างบันทึกเวลาและคำขอตัวอย่างสำหรับรอบ <b>${U.fmtPeriod(pk)}</b>${R.end > today ? ` (ถึงวันนี้ ${U.fmtDate(today)})` : ''}?<br><span class="muted">ถ้ายังไม่มีตารางกะ ระบบจะจัดกะตามรูปแบบของพนักงานให้ก่อน</span>`))) return;
      const ids = s.employees.filter((e) => e.active !== false).map((e) => e.id);
      const n = E.applyPattern(s, ids, R.days, null, false);
      if (n) Store.touch('roster', R.days);
      const added = PL.Seed.genPeriod(s, pk, U.rng(Date.now() % 1e9), { until: R.end > today ? U.addDays(today, -1) : null, src: 'demo', strays: false });
      s.punches.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
      s.imports.push({ at: U.nowISO(), file: 'ข้อมูลตัวอย่าง', added, dup: 0, errors: 0, by: s.user.name });
      Store.touch('punches', R.days);
      Store.touch('requests', R.days);
      Store.commit('สร้างข้อมูลตัวอย่าง', `${added} รายการ รอบ ${U.fmtPeriodShort(pk)}`);
      UI.toast(`สร้างบันทึกเวลาตัวอย่าง ${U.num(added)} รายการ${n ? ' และจัดกะให้แล้ว (ยังไม่ประกาศ)' : ''}`, 'ok', 5000);
      PL.App.rerender();
    },
  };
})(window);

/* ขั้นตอนที่ 2: ประกาศกะ (Shift Schedule) */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const st = { tab: 'roster', dept: '', q: '', brush: 'D', year: '' };
  const TYPE = { WORK: 'วันทำงาน', OFF: 'วันหยุดประจำสัปดาห์', HOLIDAY: 'วันหยุดนักขัตฤกษ์' };
  document.addEventListener('mouseup', () => PL.Views.schedule && PL.Views.schedule._stop && PL.Views.schedule._stop());

  PL.Views.schedule = {
    render(el, params) {
      if (params.tab) st.tab = params.tab;
      const s = Store.s;
      const p = E.pipeline(s, Store.pk);
      const P = p.P;
      const pubTxt = !p.published
        ? UI.pill('ยังไม่ประกาศ', 'warn', 'alert')
        : p.rosterDirty
          ? UI.pill(`แก้ไขหลังประกาศ (${U.fmtStamp(P.publishedAt)})`, 'warn', 'alert')
          : UI.pill(`ประกาศแล้ว ${U.fmtStamp(P.publishedAt)}`, 'ok', 'checkCircle');
      el.innerHTML = `${UI.stepHeader(
        'schedule',
        `${pubTxt}<button class="btn primary" data-act="publish" ${Store.isLocked() ? 'disabled' : ''}>${UI.icon('send', 16)} ประกาศกะ</button>`
      )}
      ${UI.tabs(
        [
          { key: 'roster', label: 'ตารางกะรายวัน', icon: 'calendarGrid', count: p.empty ? U.num(p.empty) : '' },
          { key: 'shifts', label: 'ข้อมูลกะ', icon: 'clock' },
          { key: 'holidays', label: 'วันหยุดบริษัท', icon: 'calendar' },
        ],
        st.tab
      )}
      <div data-body></div>${UI.stepNav('schedule')}`;
      const body = el.querySelector('[data-body]');
      if (st.tab === 'shifts') this.shifts(body);
      else if (st.tab === 'holidays') this.holidays(body);
      else this.roster(body, p);

      el.querySelector('.tabs').addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]');
        if (t) {
          st.tab = t.dataset.tab;
          PL.App.rerender();
        }
      });
      el.querySelector('[data-act="publish"]').addEventListener('click', () => this.publish());
    },

    async publish() {
      const s = Store.s, pk = Store.pk, R = Store.range();
      if (!Store.guard(R.days)) return;
      const p = E.pipeline(s, pk);
      if (p.empty && !(await UI.confirm(`ยังมีช่องที่ไม่ได้กำหนดกะ <b>${U.num(p.empty)}</b> ช่อง วันเหล่านั้นจะถูกแจ้งเป็น "ไม่มีกะ" ตอนคำนวณ<br>ต้องการประกาศต่อหรือไม่?`, { ok: 'ประกาศต่อ' }))) return;
      const P = Store.P();
      P.publishedSeq = E.bump(s);
      P.publishedAt = U.nowISO();
      Store.commit('ประกาศกะ', `รอบ ${U.fmtPeriodShort(pk)}`);
      UI.toast(`ประกาศกะรอบ ${U.fmtPeriod(pk)} แล้ว`);
      PL.App.rerender();
    },

    /* ---------- ตารางกะ ---------- */
    roster(body, p) {
      const s = Store.s, R = Store.range(), ix = Store.ix();
      const locked = Store.isLocked();
      const shifts = s.shifts;
      if (!ix.shifts[st.brush]) st.brush = shifts[0] ? shifts[0].code : '';
      const emps = s.employees.filter((e) => E.activeIn(e, R) && (!st.dept || e.dept === st.dept) && (!st.q || `${e.code} ${e.name}`.toLowerCase().includes(st.q.toLowerCase())));
      const sel = new Set();
      const head = R.days
        .map((d) => {
          const dw = U.dow(d);
          const hol = ix.hol[d];
          return `<th class="${hol ? 'hol' : dw === 0 || dw === 6 ? 'we' : ''}" title="${esc(U.fmtDate(d, true))}${hol ? ' — ' + esc(hol) : ''}">${+d.slice(8)}<span class="dw">${U.DOW[dw]}</span></th>`;
        })
        .join('');
      const cell = (emp, d) => {
        const code = s.roster[emp.id + '|' + d] || '';
        const sh = ix.shifts[code];
        const c = sh ? sh.color : '';
        return `<td class="cell ${code ? '' : 'empty'}" data-e="${emp.id}" data-d="${d}" style="${c ? `background:color-mix(in srgb, ${c} 16%, white);color:${c}` : ''}">${esc(code)}</td>`;
      };
      const workCount = (emp) => R.days.filter((d) => {
        const sh = ix.shifts[s.roster[emp.id + '|' + d]];
        return sh && (sh.type || 'WORK') === 'WORK';
      }).length;
      body.innerHTML = `<div class="card">
        <div class="toolbar">
          <select class="input" data-dept>${UI.deptOptions(st.dept)}</select>
          <input class="input search-in" placeholder="ค้นหาพนักงาน" data-q value="${esc(st.q)}">
          <span class="spacer"></span>
          <button class="btn sm" data-act="pattern" ${locked ? 'disabled' : ''}>${UI.icon('zap', 15)} จัดกะตามรูปแบบ</button>
          <button class="btn sm" data-act="holfill" ${locked ? 'disabled' : ''} title="ตั้งวันหยุดนักขัตฤกษ์ในรอบนี้ให้ทุกคน">${UI.icon('calendar', 15)} ใส่วันหยุดบริษัท</button>
        </div>
        <div class="toolbar">
          <span class="muted" style="display:inline-flex;gap:6px;align-items:center">${UI.icon('brush', 16)} แปรงกะ:</span>
          <div class="brushes">${shifts
            .map((x) => `<button class="brush ${st.brush === x.code ? 'active' : ''}" data-brush="${esc(x.code)}" title="${esc(x.name)} ${UI.shiftTime(x)}">${UI.shiftChip(x.code, ix)} <span>${esc(x.name)}</span></button>`)
            .join('')}<button class="brush ${st.brush === '' ? 'active' : ''}" data-brush="">${UI.icon('eraser', 15)} ลบกะ</button></div>
          <span class="muted" style="font-size:12.5px">คลิกหรือลากบนตารางเพื่อระบายกะ</span>
        </div>
        ${p.empty ? UI.banner('warn', `ยังไม่ได้กำหนดกะ <b>${U.num(p.empty)}</b> ช่อง (ช่องลายแดง) — ใช้ "จัดกะตามรูปแบบ" เพื่อเติมอัตโนมัติ`) : ''}
        <div class="roster-wrap"><table class="roster">
          <thead><tr><th class="stick0"><input type="checkbox" data-all title="เลือกทั้งหมด"></th><th class="stick stick1">พนักงาน (${emps.length})</th>${head}<th>วันทำงาน</th></tr></thead>
          <tbody>${emps
            .map(
              (e) => `<tr data-row="${e.id}"><td class="stick0"><input type="checkbox" data-sel="${e.id}"></td>
              <td class="stick stick1"><div class="rn">${esc(e.name)}</div><div class="rc">${esc(e.code)} · ${esc(e.dept)} · ${esc(E.PATTERNS[e.pattern] ? e.pattern : '')}</div></td>
              ${R.days.map((d) => cell(e, d)).join('')}<td class="cnt" data-cnt>${workCount(e)} วัน</td></tr>`
            )
            .join('')}</tbody></table></div>
        <div class="legend inline" style="margin-top:12px">${shifts.map((x) => `<span>${UI.shiftChip(x.code, ix)} ${esc(x.name)} ${x.start ? `<span class="muted">${UI.shiftTime(x)}</span>` : ''}</span>`).join('')}</div>
      </div>`;

      // filters
      body.querySelector('[data-dept]').addEventListener('change', (e) => {
        st.dept = e.target.value;
        PL.App.rerender();
      });
      body.querySelector('[data-q]').addEventListener('input', U.debounce((e) => {
        st.q = e.target.value.trim();
        PL.App.rerender();
        const i = document.querySelector('[data-q]');
        if (i) {
          i.focus();
          i.setSelectionRange(i.value.length, i.value.length);
        }
      }, 300));
      body.querySelectorAll('[data-brush]').forEach((b) =>
        b.addEventListener('click', () => {
          st.brush = b.dataset.brush;
          body.querySelectorAll('[data-brush]').forEach((x) => x.classList.toggle('active', x === b));
        })
      );
      body.querySelector('[data-all]').addEventListener('change', (e) => {
        body.querySelectorAll('[data-sel]').forEach((c) => {
          c.checked = e.target.checked;
          e.target.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel);
        });
      });
      body.querySelectorAll('[data-sel]').forEach((c) => c.addEventListener('change', () => (c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel))));

      // painting
      let painting = false;
      const changed = new Set();
      const paint = (td) => {
        const k = td.dataset.e + '|' + td.dataset.d;
        const code = st.brush;
        if ((s.roster[k] || '') === code) return;
        if (code) s.roster[k] = code;
        else delete s.roster[k];
        changed.add(td.dataset.d);
        const sh = ix.shifts[code];
        td.textContent = code;
        td.classList.toggle('empty', !code);
        td.style.cssText = sh ? `background:color-mix(in srgb, ${sh.color} 16%, white);color:${sh.color}` : '';
        const tr = td.parentElement;
        const emp = ix.emps[td.dataset.e];
        tr.querySelector('[data-cnt]').textContent = `${workCount(emp)} วัน`;
      };
      const tbl = body.querySelector('.roster');
      tbl.addEventListener('mousedown', (e) => {
        const td = e.target.closest('td.cell');
        if (!td || e.button !== 0) return;
        if (locked) return Store.guard([td.dataset.d]);
        e.preventDefault();
        painting = true;
        paint(td);
      });
      tbl.addEventListener('mouseover', (e) => {
        if (!painting) return;
        const td = e.target.closest('td.cell');
        if (td) paint(td);
      });
      const stop = () => {
        if (!painting) return;
        painting = false;
        if (changed.size) {
          Store.touch('roster', [...changed]);
          Store.commit();
          changed.clear();
        }
      };
      PL.Views.schedule._stop = stop;

      body.querySelector('[data-act="pattern"]').addEventListener('click', () => this.patternForm(sel.size ? [...sel] : emps.map((e) => e.id), sel.size ? 'selected' : 'filtered'));
      body.querySelector('[data-act="holfill"]').addEventListener('click', async () => {
        const hs = R.days.filter((d) => ix.hol[d]);
        if (!hs.length) return UI.toast('ไม่มีวันหยุดบริษัทในรอบนี้', 'info');
        if (!Store.guard(R.days)) return;
        if (!(await UI.confirm(`ตั้งกะ <b>HOL</b> ให้พนักงานทุกคนในวันที่ ${hs.map((d) => U.fmtDate(d)).join(', ')}?`))) return;
        s.employees.filter((e) => e.active !== false).forEach((e) => hs.forEach((d) => (s.roster[e.id + '|' + d] = 'HOL')));
        Store.touch('roster', hs);
        Store.commit('ใส่วันหยุดในตารางกะ', hs.join(', '));
        PL.App.rerender();
      });
    },

    patternForm(ids, scope) {
      const s = Store.s, R = Store.range();
      const m = UI.modal({
        title: 'จัดกะตามรูปแบบ',
        sub: `ใช้กับพนักงาน ${ids.length} คน (${scope === 'selected' ? 'ที่เลือก' : 'ตามตัวกรอง'})`,
        body: `<div class="form-grid">
          <label class="field full"><span class="lbl">รูปแบบ</span><select class="input" name="pattern">
            <option value="">ตามรูปแบบประจำตัวพนักงานแต่ละคน (แนะนำ)</option>
            ${Object.entries(E.PATTERNS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
            <span class="hint">กะทำงานใช้ "กะประจำ" ของพนักงาน · วันหยุดบริษัทจะเป็น HOL อัตโนมัติ · หมุนเวียนใช้กะ D/N ตามทีม A/B</span></label>
          <label class="field"><span class="lbl">ตั้งแต่วันที่</span><input class="input" type="date" name="from" value="${R.start}" min="${R.start}" max="${R.end}"></label>
          <label class="field"><span class="lbl">ถึงวันที่</span><input class="input" type="date" name="to" value="${R.end}" min="${R.start}" max="${R.end}"></label>
          <label class="check full"><input type="checkbox" name="overwrite" checked> เขียนทับกะที่กำหนดไว้แล้ว</label></div>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>จัดกะ</button>`,
      });
      m.$('[data-ok]').addEventListener('click', () => {
        const f = UI.formData(m.el);
        if (!f.from || !f.to || f.to < f.from) return UI.toast('ช่วงวันที่ไม่ถูกต้อง', 'warn');
        const days = U.daysBetween(f.from, f.to);
        if (!Store.guard(days)) return;
        const n = E.applyPattern(s, ids, days, f.pattern || null, f.overwrite);
        Store.touch('roster', days);
        Store.commit('จัดกะตามรูปแบบ', `${ids.length} คน ${f.from}–${f.to}`);
        m.close();
        UI.toast(`จัดกะแล้ว ${U.num(n)} ช่อง — อย่าลืมกด "ประกาศกะ"`);
        PL.App.rerender();
      });
    },

    /* ---------- ข้อมูลกะ ---------- */
    shifts(body) {
      const s = Store.s, ix = Store.ix();
      const used = {};
      Object.values(s.roster).forEach((c) => (used[c] = (used[c] || 0) + 1));
      body.innerHTML = `<div class="card"><div class="card-head"><h3>${UI.icon('clock', 18)} ข้อมูลกะการทำงาน</h3><span class="spacer"></span>
        <button class="btn primary sm" data-act="add">${UI.icon('plus', 15)} เพิ่มกะ</button></div><div data-tbl></div>
        <p class="muted" style="font-size:12.5px;margin:12px 0 0">การแก้ไขเวลากะมีผลกับทุกรอบที่ยังไม่ล็อก — ต้องโอนบันทึกเวลาและคำนวณใหม่</p></div>`;
      const t = new UI.DataTable({
        pageSize: 50,
        columns: [
          { key: 'code', label: 'รหัส', render: (r) => UI.shiftChip(r.code, ix) },
          { key: 'name', label: 'ชื่อกะ' },
          { key: 'type', label: 'ประเภท', render: (r) => esc(TYPE[r.type || 'WORK']) },
          { key: 'start', label: 'เวลา', render: (r) => (r.start ? `<span class="mono">${r.start}–${r.end}</span>${U.hm(r.end) <= U.hm(r.start) ? ' ' + UI.pill('ข้ามวัน', 'info') : ''}` : '–') },
          { key: 'brS', label: 'พัก', render: (r) => (r.brS ? `<span class="mono">${r.brS}–${r.brE}</span>` : '–') },
          { key: 'hrs', label: 'ชม.ทำงาน', align: 'r', sv: (r) => E.shiftHours(r), render: (r) => (r.start ? U.dur(E.shiftHours(r)) : '–') },
          { key: 'grace', label: 'ผ่อนผันสาย', align: 'r', render: (r) => (r.start ? `${r.grace || 0} นาที` : '–') },
          { key: 'used', label: 'ใช้งาน', align: 'r', sv: (r) => used[r.code] || 0, render: (r) => U.num(used[r.code] || 0) },
          { key: '_', label: '', sort: false, align: 'r', render: () => `<div class="row-actions"><button class="btn xs icon" data-act="edit">${UI.icon('edit', 14)}</button><button class="btn xs icon danger-ghost" data-act="del">${UI.icon('trash', 14)}</button></div>` },
        ],
        onAction: async (a, r) => {
          if (a === 'edit') this.shiftForm(r);
          if (a === 'del') {
            if (used[r.code] && !(await UI.confirm(`กะ <b>${esc(r.code)}</b> ถูกใช้ในตารางกะ ${U.num(used[r.code])} ช่อง ช่องเหล่านั้นจะกลายเป็น "ไม่มีกะ" ลบต่อหรือไม่?`, { danger: true, ok: 'ลบ' }))) return;
            if (!used[r.code] && !(await UI.confirm(`ลบกะ <b>${esc(r.code)}</b>?`, { danger: true, ok: 'ลบ' }))) return;
            s.shifts = s.shifts.filter((x) => x !== r);
            Store.touch('config');
            Store.commit('ลบกะ', r.code);
            PL.App.rerender();
          }
        },
      });
      t.setRows(s.shifts);
      body.querySelector('[data-tbl]').appendChild(t.el);
      body.querySelector('[data-act="add"]').addEventListener('click', () => this.shiftForm(null));
    },
    shiftForm(sh) {
      const s = Store.s;
      const x = sh || { code: '', name: '', type: 'WORK', start: '08:00', end: '17:00', brS: '12:00', brE: '13:00', grace: 5, color: '#0ea5e9' };
      const m = UI.modal({
        title: sh ? `แก้ไขกะ ${esc(sh.code)}` : 'เพิ่มกะ',
        body: `<div class="form-grid">
          <label class="field"><span class="lbl req">รหัสกะ</span><input class="input" name="code" value="${esc(x.code)}" maxlength="5" ${sh ? 'readonly' : ''}></label>
          <label class="field"><span class="lbl req">ชื่อกะ</span><input class="input" name="name" value="${esc(x.name)}"></label>
          <label class="field"><span class="lbl">ประเภท</span><select class="input" name="type">${Object.entries(TYPE).map(([k, v]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">สี</span><input class="input" type="color" name="color" value="${esc(x.color || '#0ea5e9')}"></label>
          <label class="field"><span class="lbl">เวลาเข้า</span><input class="input" type="time" name="start" value="${esc(x.start || '')}"></label>
          <label class="field"><span class="lbl">เวลาออก</span><input class="input" type="time" name="end" value="${esc(x.end || '')}"><span class="hint">ถ้าน้อยกว่าเวลาเข้า = ข้ามไปวันถัดไป</span></label>
          <label class="field"><span class="lbl">เริ่มพัก</span><input class="input" type="time" name="brS" value="${esc(x.brS || '')}"></label>
          <label class="field"><span class="lbl">สิ้นสุดพัก</span><input class="input" type="time" name="brE" value="${esc(x.brE || '')}"></label>
          <label class="field"><span class="lbl">ผ่อนผันมาสาย (นาที)</span><input class="input" type="number" min="0" name="grace" value="${esc(x.grace || 0)}"><span class="hint">สายไม่เกินนี้ไม่นับสาย เกินนี้นับเต็มจำนวน</span></label></div>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>บันทึก</button>`,
      });
      m.$('[data-ok]').addEventListener('click', () => {
        const f = UI.formData(m.el);
        f.code = U.normCode(f.code);
        if (!f.code || !f.name) return UI.toast('กรุณากรอกรหัสและชื่อกะ', 'warn');
        if (!sh && s.shifts.some((y) => y.code === f.code)) return UI.toast('รหัสกะนี้มีอยู่แล้ว', 'warn');
        if (f.type === 'WORK' && (!f.start || !f.end)) return UI.toast('กะทำงานต้องมีเวลาเข้าและออก', 'warn');
        const obj = { code: f.code, name: f.name, type: f.type, color: f.color, grace: +f.grace || 0 };
        if (f.type === 'WORK') Object.assign(obj, { start: f.start, end: f.end, brS: f.brS, brE: f.brE });
        if (sh) Object.keys(sh).forEach((k) => delete sh[k]), Object.assign(sh, obj);
        else s.shifts.push(obj);
        Store.touch('config');
        Store.commit(sh ? 'แก้ไขกะ' : 'เพิ่มกะ', f.code);
        m.close();
        PL.App.rerender();
      });
    },

    /* ---------- วันหยุด ---------- */
    holidays(body) {
      const s = Store.s;
      const years = [...new Set(s.holidays.map((h) => h.date.slice(0, 4)).concat(Store.pk.slice(0, 4)))].sort();
      if (!st.year) st.year = Store.pk.slice(0, 4);
      const list = s.holidays.filter((h) => h.date.startsWith(st.year)).sort((a, b) => a.date.localeCompare(b.date));
      body.innerHTML = `<div class="grid"><div class="card span-8"><div class="card-head"><h3>${UI.icon('calendar', 18)} วันหยุดประจำปี</h3><span class="spacer"></span>
        <select class="input sm" data-year>${years.map((y) => `<option value="${y}" ${y === st.year ? 'selected' : ''}>พ.ศ. ${+y + 543}</option>`).join('')}</select></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>วัน</th><th>ชื่อวันหยุด</th><th></th></tr></thead><tbody>
        ${list.length ? list.map((h) => `<tr><td>${U.fmtDate(h.date)}</td><td>${U.DOW_FULL[U.dow(h.date)]}</td><td>${esc(h.name)}</td><td class="r"><button class="btn xs icon danger-ghost" data-del="${h.date}">${UI.icon('trash', 14)}</button></td></tr>`).join('') : `<tr><td colspan="4" class="dt-empty">ยังไม่มีวันหยุดในปีนี้</td></tr>`}
        </tbody></table></div>
        <p class="muted" style="font-size:12.5px">วันหยุดตัวอย่างเป็นวันหยุดราชการทั่วไป — โปรดตรวจสอบกับประกาศวันหยุดประจำปีของบริษัท</p></div>
        <div class="card span-4"><div class="card-head"><h3>${UI.icon('plus', 18)} เพิ่มวันหยุด</h3></div>
          <div class="stack"><label class="field"><span class="lbl req">วันที่</span><input class="input" type="date" data-hd></label>
          <label class="field"><span class="lbl req">ชื่อวันหยุด</span><input class="input" data-hn placeholder="เช่น วันหยุดพิเศษบริษัท"></label>
          <button class="btn primary" data-add>${UI.icon('plus', 16)} เพิ่ม</button>
          <p class="muted" style="font-size:12.5px;margin:0">หลังเพิ่มวันหยุด ไปที่แท็บ "ตารางกะรายวัน" แล้วกด "ใส่วันหยุดบริษัท" เพื่ออัปเดตกะของรอบปัจจุบัน</p></div></div></div>`;
      body.querySelector('[data-year]').addEventListener('change', (e) => {
        st.year = e.target.value;
        PL.App.rerender();
      });
      body.querySelector('[data-add]').addEventListener('click', () => {
        const d = body.querySelector('[data-hd]').value, n = body.querySelector('[data-hn]').value.trim();
        if (!d || !n) return UI.toast('กรุณากรอกวันที่และชื่อวันหยุด', 'warn');
        if (s.holidays.some((h) => h.date === d)) return UI.toast('มีวันหยุดวันนี้อยู่แล้ว', 'warn');
        s.holidays.push({ date: d, name: n });
        st.year = d.slice(0, 4);
        Store.commit('เพิ่มวันหยุด', `${d} ${n}`);
        PL.App.rerender();
      });
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-del]');
        if (!b) return;
        if (!(await UI.confirm(`ลบวันหยุด ${U.fmtDate(b.dataset.del)}?`, { danger: true, ok: 'ลบ' }))) return;
        s.holidays = s.holidays.filter((h) => h.date !== b.dataset.del);
        Store.commit('ลบวันหยุด', b.dataset.del);
        PL.App.rerender();
      });
    },
  };
})(window);

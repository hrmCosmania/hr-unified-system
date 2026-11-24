/* ขั้นตอนที่ 3: โอนบันทึกเวลาเทียบกะ (Time Mapping) */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const st = { f: 'ISSUE', dept: '', q: '' };

  PL.Views.mapping = {
    render(el) {
      const s = Store.s, pk = Store.pk, S = s.settings, ix = Store.ix();
      const P = Store.P(), p = E.pipeline(s, pk);
      const locked = Store.isLocked();
      const rows = P.mapping || [];
      const c = (P.mapStats && P.mapStats.counts) || {};
      const banner = locked
        ? UI.banner('info', 'รอบนี้ถูกล็อกแล้ว — แสดงผลการโอนครั้งสุดท้าย')
        : !P.mappedSeq
          ? UI.banner('info', 'ยังไม่ได้โอนบันทึกเวลาสำหรับรอบนี้ — กด <b>โอนบันทึกเวลาเทียบกะ</b> เพื่อเริ่ม')
          : p.mapStale
            ? UI.banner('warn', `มีการเปลี่ยนแปลงบันทึกเวลา ตารางกะ หรือการตั้งค่า หลังการโอนครั้งล่าสุด (${U.fmtStamp(P.mappedAt)}) — กรุณาโอนใหม่`, `<button class="btn sm primary" data-act="run">${UI.icon('refresh', 15)} โอนใหม่</button>`)
            : UI.banner('ok', `โอนบันทึกเวลาเทียบกะล่าสุดเมื่อ ${U.fmtStamp(P.mappedAt)} — ข้อมูลเป็นปัจจุบัน`);

      const issue = (c.MISS_IN || 0) + (c.MISS_OUT || 0) + (c.NO_PUNCH || 0) + (c.NO_SHIFT || 0) + (c.OFF_PARTIAL || 0);
      const chip = (key, label, n, cls) => `<div class="mini clickable ${cls} ${st.f === key ? 'active' : ''}" data-f="${key}"><div class="m-label">${label}</div><div class="m-val">${U.num(n || 0)}</div></div>`;
      const ms = P.mapStats || {};

      el.innerHTML = `${UI.stepHeader('mapping', `<button class="btn primary" data-act="run" ${locked ? 'disabled' : ''}>${UI.icon('play', 16)} โอนบันทึกเวลาเทียบกะ</button>`)}
        ${banner}
        <div class="card" style="padding:14px 18px;margin-bottom:18px">
          <div class="row" style="font-size:13px;color:var(--text-2)">${UI.icon('info', 16)} กติกาการจับคู่:
            ${UI.pill(`รับเวลาก่อนเข้ากะ ${S.mapBefore / 60} ชม.`, 'brand')} ${UI.pill(`หลังเลิกกะ ${S.mapAfter / 60} ชม.`, 'brand')}
            ${UI.pill(`สแกนซ้ำภายใน ${S.dupMinutes} นาทีนับครั้งเดียว`, 'brand')} ${UI.pill(`เข้า-ออกห่างกัน ≥ ${S.minPairGap} นาที`, 'brand')}
            <span class="muted">· สแกนแรก = เข้า, สแกนสุดท้าย = ออก</span> <a href="#/settings?tab=rules">แก้ไขกติกา</a></div>
        </div>
        ${
          rows.length
            ? `<div class="mini-stats">
          ${chip('ISSUE', 'ต้องตรวจสอบ', issue, 'm-orange')}
          ${chip('OK', 'ครบเข้า-ออก', c.OK, 'm-ok')}
          ${chip('MISS_IN', 'ไม่มีขาเข้า', c.MISS_IN, 'm-orange')}
          ${chip('MISS_OUT', 'ไม่มีขาออก', c.MISS_OUT, 'm-orange')}
          ${chip('NO_PUNCH', 'ไม่มีบันทึก (วันทำงาน)', c.NO_PUNCH, 'm-bad')}
          ${chip('OFF_WORK', 'มาทำงานวันหยุด', (c.OFF_WORK || 0) + (c.OFF_PARTIAL || 0), 'm-purple')}
          ${chip('ALL', 'ทั้งหมด', rows.length, '')}
        </div>
        ${ms.orphanCount ? UI.banner('warn', `มีเวลาสแกน <b>${U.num(ms.orphanCount)}</b> ครั้งที่อยู่นอกช่วงเวลาของกะใดๆ จึงไม่ถูกนำไปใช้ (เช่น ${ms.orphans.slice(0, 3).map((o) => `${esc((ix.emps[o.e] || {}).code || o.e)} ${U.fmtDT(o.t)}`).join(', ')})`) : ''}
        ${ms.unknownCount ? UI.banner('bad', `พบรหัสที่ไม่มีในทะเบียนพนักงาน ${ms.unknownCount} รหัส: ${esc(Object.keys(ms.unknown).join(', '))} — เพิ่มพนักงาน/เลขบัตรที่หน้าตั้งค่า แล้วโอนใหม่`) : ''}
        <div class="card">
          <div class="toolbar">
            <select class="input" data-dept>${UI.deptOptions(st.dept)}</select>
            <input class="input search-in" data-q placeholder="ค้นหาพนักงาน" value="${esc(st.q)}">
          </div>
          <div data-tbl></div>
        </div>`
            : UI.empty('ยังไม่มีผลการโอน', locked ? '' : `<button class="btn primary" data-act="run">${UI.icon('play', 16)} โอนบันทึกเวลาเทียบกะ</button>`)
        }
        ${UI.stepNav('mapping')}`;

      if (rows.length) {
        const t = new UI.DataTable({
          pageSize: 25,
          compact: true,
          onRow: (r) => this.detail(r),
          columns: [
            { key: 'd', label: 'วันที่', render: (r) => `<span class="nowrap">${U.fmtDay(r.d)}</span>` },
            { key: 'e', label: 'พนักงาน', sv: (r) => (ix.emps[r.e] || {}).code, render: (r) => UI.empCell(ix.emps[r.e]) },
            { key: 'dept', label: 'แผนก', sv: (r) => (ix.emps[r.e] || {}).dept, render: (r) => esc((ix.emps[r.e] || {}).dept) },
            { key: 'code', label: 'กะ', render: (r) => UI.shiftChip(r.code, ix) },
            { key: 'ps', label: 'เวลากะ', render: (r) => (r.type === 'WORK' ? `<span class="mono">${U.clock(r.ps)}–${U.clock(r.pe)}</span>` : `<span class="muted">${esc(E.DAY_TYPE[r.type])}</span>`) },
            { key: 'in', label: 'เข้า', render: (r) => (r.in != null ? `<b class="mono">${U.clock(r.in)}</b>${r.in < r.ps - 0 && r.type === 'WORK' ? '' : ''}` : r.type === 'WORK' && r.out != null ? '<span class="miss">--:--</span>' : '') },
            { key: 'out', label: 'ออก', render: (r) => (r.out != null ? `<b class="mono">${U.clock(r.out)}</b>${r.out >= (U.dnum(r.d) + 1) * 1440 ? ' <small class="muted">+1</small>' : ''}` : r.type === 'WORK' && r.in != null ? '<span class="miss">--:--</span>' : '') },
            { key: 'n', label: 'สแกน', align: 'r', render: (r) => (r.n ? `${r.n}` : '') },
            { key: 'st', label: 'สถานะ', render: (r) => UI.mapStatus(r.st) },
          ],
        });
        el.querySelector('[data-tbl]').appendChild(t.el);
        const apply = () => {
          const q = st.q.toLowerCase();
          const F = {
            ISSUE: (r) => ['MISS_IN', 'MISS_OUT', 'NO_PUNCH', 'NO_SHIFT', 'OFF_PARTIAL'].includes(r.st),
            OFF_WORK: (r) => r.st === 'OFF_WORK' || r.st === 'OFF_PARTIAL',
            ALL: () => true,
          }[st.f] || ((r) => r.st === st.f);
          t.setRows(
            rows.filter((r) => {
              const e = ix.emps[r.e];
              if (!e || !F(r)) return false;
              if (st.dept && e.dept !== st.dept) return false;
              if (q && !`${e.code} ${e.name}`.toLowerCase().includes(q)) return false;
              return true;
            })
          );
        };
        apply();
        el.querySelectorAll('[data-f]').forEach((x) =>
          x.addEventListener('click', () => {
            st.f = x.dataset.f;
            el.querySelectorAll('[data-f]').forEach((y) => y.classList.toggle('active', y === x));
            apply();
          })
        );
        el.querySelector('[data-dept]').addEventListener('change', (e) => ((st.dept = e.target.value), apply()));
        el.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((st.q = e.target.value.trim()), apply()), 150));
      }
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="run"]')) this.run();
      });
    },
    run() {
      const s = Store.s, pk = Store.pk;
      if (!Store.guard([Store.range().start])) return;
      const p = E.pipeline(s, pk);
      if (!p.punches) return UI.toast('ยังไม่มีบันทึกเวลาในรอบนี้', 'warn');
      const res = E.mapPeriod(s, pk);
      const c = res.stats.counts;
      Store.commit('โอนบันทึกเวลาเทียบกะ', `รอบ ${U.fmtPeriodShort(pk)}: ${res.rows.length} รายการ`);
      const bad = (c.MISS_IN || 0) + (c.MISS_OUT || 0);
      UI.toast(`โอนแล้ว ${U.num(res.rows.length)} วัน-คน · ครบ ${U.num(c.OK || 0)} · ไม่ครบ ${U.num(bad)} · ไม่มีบันทึก ${U.num(c.NO_PUNCH || 0)}`, bad ? 'info' : 'ok', 5000);
      PL.App.rerender();
    },
    detail(r) {
      const ix = Store.ix(), emp = ix.emps[r.e];
      const sh = ix.shifts[r.code];
      const m = UI.modal({
        title: `${esc(emp.name)} · ${U.fmtDate(r.d, true)}`,
        sub: `${esc(emp.code)} · กะ ${esc(r.code || '-')} ${sh && sh.start ? `(${UI.shiftTime(sh)})` : ''}`,
        body: `<div class="kv">
          <span>ประเภทวัน</span><span>${esc(E.DAY_TYPE[r.type])}</span>
          <span>เวลาตามกะ</span><span>${r.ps != null ? `${U.fmtDT(U.tstr(r.ps))} – ${U.fmtDT(U.tstr(r.pe))}` : '-'}</span>
          <span>เวลาเข้า (ใช้คำนวณ)</span><span>${r.in != null ? U.fmtDT(U.tstr(r.in)) : '-'}</span>
          <span>เวลาออก (ใช้คำนวณ)</span><span>${r.out != null ? U.fmtDT(U.tstr(r.out)) : '-'}</span>
          <span>สถานะ</span><span>${UI.mapStatus(r.st)}</span></div>
          <h4 style="margin:16px 0 8px;font-size:13.5px">เวลาสแกนทั้งหมดในช่วงของวันนี้ (${r.p.length})</h4>
          ${r.p.length ? `<div class="row">${r.p.map((m) => UI.pill(U.fmtDT(U.tstr(m)), m === r.in || m === r.out ? 'brand' : 'off')).join('')}</div>` : '<div class="muted">ไม่มี</div>'}
          ${['MISS_IN', 'MISS_OUT'].includes(r.st) && !Store.isLocked() ? `<div style="margin-top:16px"><button class="btn primary sm" data-fix>${UI.icon('edit', 15)} สร้างคำขอแก้ไขเวลา</button></div>` : ''}`,
        footer: `<button class="btn" data-close>ปิด</button><button class="btn" data-tc>${UI.icon('calendar', 15)} บัตรลงเวลาทั้งเดือน</button>`,
      });
      m.el.addEventListener('click', (e) => {
        if (e.target.closest('[data-fix]')) {
          m.close();
          PL.Forms.request('ADJ', { e: r.e, date: r.d });
        }
        if (e.target.closest('[data-tc]')) {
          m.close();
          UI.timecard(r.e);
        }
      });
    },
  };
})(window);

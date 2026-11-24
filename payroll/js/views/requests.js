/* ขั้นตอนที่ 4: จัดการคำขอลา / OT / แก้ไขเวลา */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;
  const st = { kind: 'LEAVE', status: null, dept: '', q: '', scope: 'period' };

  /* ---------- ฟอร์มคำขอ (ใช้ร่วมกับหน้าอื่น) ---------- */
  const Forms = (PL.Forms = {
    request(kind, pre = {}, existing = null, onDone) {
      const s = Store.s, ix = Store.ix();
      const R = Store.range();
      const x = existing || {};
      const v = (k, d = '') => esc(x[k] != null ? x[k] : pre[k] != null ? pre[k] : d);
      const approveBox = existing ? '' : `<label class="check full"><input type="checkbox" name="approveNow"> อนุมัติทันที (HR บันทึกแทนหัวหน้างาน)</label>`;
      let fields = '';
      if (kind === 'LEAVE') {
        fields = `
          <label class="field"><span class="lbl req">ประเภทการลา</span><select class="input" name="leaveType">${s.leaveTypes.map((l) => `<option value="${l.code}" ${(x.leaveType || pre.leaveType) === l.code ? 'selected' : ''}>${esc(l.name)}${l.paid ? '' : ' (ไม่รับค่าจ้าง)'}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">ช่วงเวลา</span><select class="input" name="part">${Object.entries(E.LEAVE_PART).map(([k, l]) => `<option value="${k}" ${(x.part || pre.part) === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="hint">ครึ่งวันใช้ได้เมื่อลาวันเดียว</span></label>
          <label class="field"><span class="lbl req">ตั้งแต่วันที่</span><input class="input" type="date" name="date" value="${v('date', R.start)}"></label>
          <label class="field"><span class="lbl req">ถึงวันที่</span><input class="input" type="date" name="dateTo" value="${v('dateTo', x.date || pre.date || R.start)}"></label>
          <div class="full" data-info></div>`;
      } else if (kind === 'OT') {
        fields = `
          <label class="field"><span class="lbl req">วันที่ทำงาน (ตามกะ)</span><input class="input" type="date" name="date" value="${v('date', R.start)}"></label>
          <div class="field"><span class="lbl">&nbsp;</span><div data-shift class="muted" style="padding-top:8px"></div></div>
          <label class="field"><span class="lbl req">เริ่ม OT</span><input class="input" type="time" name="start" value="${esc(x.otStart ? x.otStart.slice(11) : pre.start || '')}"></label>
          <label class="field"><span class="lbl req">สิ้นสุด OT</span><input class="input" type="time" name="end" value="${esc(x.otEnd ? x.otEnd.slice(11) : pre.end || '')}"><span class="hint">ถ้าน้อยกว่าเวลาเริ่ม = วันถัดไป</span></label>
          <div class="full" data-info></div>`;
      } else {
        fields = `
          <label class="field"><span class="lbl req">วันที่ (ตามกะ)</span><input class="input" type="date" name="date" value="${v('date', R.start)}"></label>
          <div class="field"><span class="lbl">&nbsp;</span><div data-shift class="muted" style="padding-top:8px"></div></div>
          <label class="field"><span class="lbl">เวลาเข้าที่ถูกต้อง</span><input class="input" type="time" name="inT" value="${esc(x.adjIn ? x.adjIn.slice(11) : pre.inT || '')}"><span class="hint">เว้นว่าง = ใช้เวลาเดิม</span></label>
          <label class="field"><span class="lbl">เวลาออกที่ถูกต้อง</span><input class="input" type="time" name="outT" value="${esc(x.adjOut ? x.adjOut.slice(11) : pre.outT || '')}"><span class="hint">กะข้ามวัน ระบบใส่วันถัดไปให้อัตโนมัติ</span></label>
          <div class="full" data-info></div>`;
      }
      const m = UI.modal({
        title: `${existing ? 'แก้ไข' : 'สร้าง'}${E.KIND[kind]}${existing ? ' ' + esc(existing.id) : ''}`,
        size: 'md',
        body: `<div class="form-grid">
          <label class="field full"><span class="lbl req">พนักงาน</span><select class="input" name="e">${UI.empOptions(x.e || pre.e)}</select></label>
          ${fields}
          <label class="field full"><span class="lbl ${kind === 'ADJ' ? 'req' : ''}">เหตุผล</span><input class="input" name="reason" value="${v('reason')}" placeholder="${kind === 'ADJ' ? 'เช่น ลืมสแกนนิ้วตอนออกงาน' : ''}"></label>
          ${approveBox}</div>`,
        footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn primary" data-ok>${UI.icon('check', 16)} บันทึกคำขอ</button>`,
      });
      const $ = (n) => m.$(`[name="${n}"]`);
      const info = m.$('[data-info]');
      const dayOf = () => {
        const emp = ix.emps[$('e').value];
        const d = $('date').value;
        return emp && d ? { emp, d, di: E.dayInfo(s, ix, emp, d) } : null;
      };
      const mapRow = (eid, d) => {
        const P = s.periods[E.periodOf(s, d)];
        return P && P.mapping ? P.mapping.find((r) => r.e === eid && r.d === d) : null;
      };
      const resolveT = (d, t, sh, ref) => {
        // หาวันของเวลา t ตามกะ (กะข้ามเที่ยงคืน หรือเวลาออกน้อยกว่าเวลาเข้า → วันถัดไป)
        if (!t) return '';
        const crosses = sh && sh.start && U.hm(sh.end) <= U.hm(sh.start);
        let day = d;
        if (ref && U.hm(t) <= U.hm(ref)) day = U.addDays(d, 1);
        else if (!ref && crosses && U.hm(t) < U.hm(sh.start) - 180) day = U.addDays(d, 1);
        return `${day} ${t}`;
      };
      const update = () => {
        const o = dayOf();
        const sh = o && o.di.ref;
        const shEl = m.$('[data-shift]');
        if (shEl) shEl.innerHTML = o ? `กะ ${UI.shiftChip(o.di.code, ix)} ${esc(E.DAY_TYPE[o.di.type])} ${o.di.type === 'WORK' ? `<span class="mono">${UI.shiftTime(o.di.sh)}</span>` : ''}` : '';
        if (kind === 'LEAVE') {
          const single = $('date').value && $('date').value === $('dateTo').value;
          $('part').disabled = !single;
          if (!single) $('part').value = 'FULL';
          if (o && $('dateTo').value >= $('date').value) {
            const lt = ix.leaveTypes[$('leaveType').value];
            const tmp = { e: o.emp.id, date: $('date').value, dateTo: $('dateTo').value, part: $('part').value, kind: 'LEAVE' };
            const days = E.leaveDays(s, tmp, ix);
            const used = E.leaveUsed(s, o.emp.id, $('date').value.slice(0, 4), lt.code, x.id);
            const quota = +lt.quota || 0;
            const over = quota && used + days > quota;
            info.innerHTML = UI.banner(over ? 'warn' : 'info', `ลา <b>${U.num(days, days % 1 ? 1 : 0)}</b> วันทำงาน · ${esc(lt.name)} ปี ${+$('date').value.slice(0, 4) + 543}: ใช้ไปแล้ว ${U.num(used, used % 1 ? 1 : 0)}${quota ? ` / สิทธิ์ ${quota} วัน (คงเหลือ ${U.num(Math.max(0, quota - used), 1)})` : ' วัน'}${over ? ' — <b>เกินสิทธิ์</b>' : ''}`);
          } else info.innerHTML = '';
        } else if (kind === 'OT') {
          if (o && sh && !$('start').value && !existing) {
            if (o.di.type === 'WORK') {
              $('start').value = sh.end;
              $('end').value = U.hmStr(U.hm(sh.end) + 120);
            } else {
              $('start').value = sh.start;
              $('end').value = sh.end;
            }
          }
          if (o && $('start').value && $('end').value) {
            const a = U.tmin(`${o.d} ${$('start').value}`);
            let b = U.tmin(`${o.d} ${$('end').value}`);
            if (b <= a) b += 1440;
            const pl = o.di.plan;
            const len = b - a;
            let txt;
            if (o.di.type === 'WORK') {
              const net = len - (pl ? U.overlap(a, b, pl.ps, pl.pe) : 0);
              txt = `วันทำงาน → OT <b>1.5 เท่า</b> ${U.dur(net)} ชม.${net < len ? ' (ไม่นับช่วงที่ทับเวลากะ)' : ''}`;
            } else {
              const inS = pl ? U.overlap(a, b, pl.ps, pl.pe) - (pl.bs != null ? U.overlap(a, b, pl.bs, pl.be) : 0) : 0;
              txt = `${esc(E.DAY_TYPE[o.di.type])} → ทำงานวันหยุด <b>${o.emp.payType === 'D' ? '2' : '1'} เท่า</b> ${U.dur(Math.max(0, inS))} ชม. + OT วันหยุด <b>3 เท่า</b> ${U.dur(len - (pl ? U.overlap(a, b, pl.ps, pl.pe) : len))} ชม.`;
            }
            info.innerHTML = UI.banner('info', `${txt}<br><span class="muted">ระบบนับ OT ตามเวลาสแกนจริงที่ทับกับช่วงที่ขอ ปัดลงทุก ${s.settings.otRoundBlock} นาที ขั้นต่ำ ${s.settings.otMinMinutes} นาที</span>`);
          } else info.innerHTML = '';
        } else {
          const mr = o && mapRow(o.emp.id, o.d);
          if (o && sh && !existing && !$('inT').value && !$('outT').value && mr) {
            if (mr.in == null) $('inT').value = sh.start;
            if (mr.out == null) $('outT').value = sh.end;
          }
          info.innerHTML = o
            ? UI.banner('info', `เวลาที่ระบบมี: เข้า <b>${mr && mr.in != null ? U.clock(mr.in) : '--:--'}</b> ออก <b>${mr && mr.out != null ? U.clock(mr.out) : '--:--'}</b>${mr ? ` (สแกน ${mr.n} ครั้ง)` : ' — ยังไม่ได้โอนเทียบกะ'}`)
            : '';
        }
      };
      m.el.addEventListener('change', update);
      update();

      m.$('[data-ok]').addEventListener('click', () => {
        const f = UI.formData(m.el);
        if (!f.e || !f.date) return UI.toast('กรุณาเลือกพนักงานและวันที่', 'warn');
        const o = dayOf();
        const r = existing || { id: E.nextId(s, kind), kind, createdAt: U.nowISO(), createdBy: s.user.name, status: 'PENDING' };
        const oldDates = existing ? E.reqDates(existing) : [];
        const upd = { e: f.e, date: f.date, reason: f.reason };
        if (kind === 'LEAVE') {
          if (!f.dateTo || f.dateTo < f.date) return UI.toast('วันที่สิ้นสุดต้องไม่น้อยกว่าวันเริ่มลา', 'warn');
          Object.assign(upd, { dateTo: f.dateTo, leaveType: f.leaveType, part: f.date === f.dateTo ? f.part || 'FULL' : 'FULL' });
          if (!E.leaveDays(s, { ...upd, kind }, ix)) return UI.toast('ช่วงที่ลาไม่มีวันทำงานตามกะ', 'warn');
        } else if (kind === 'OT') {
          if (!f.start || !f.end) return UI.toast('กรุณาระบุเวลาเริ่มและสิ้นสุด OT', 'warn');
          const a = `${f.date} ${f.start}`;
          let b = `${f.date} ${f.end}`;
          if (U.tmin(b) <= U.tmin(a)) b = `${U.addDays(f.date, 1)} ${f.end}`;
          Object.assign(upd, { otStart: a, otEnd: b });
        } else {
          if (!f.inT && !f.outT) return UI.toast('กรุณาระบุเวลาเข้าหรือเวลาออกอย่างน้อย 1 ช่อง', 'warn');
          if (!f.reason) return UI.toast('กรุณาระบุเหตุผลการแก้ไขเวลา', 'warn');
          const sh = o && o.di.ref;
          const adjIn = f.inT ? resolveT(f.date, f.inT, null, null) : '';
          const adjOut = f.outT ? resolveT(f.date, f.outT, sh, f.inT || (o && o.di.type === 'WORK' ? sh.start : null)) : '';
          Object.assign(upd, { adjIn, adjOut });
        }
        const newDates = E.reqDates({ ...upd, kind });
        if (!Store.guard(oldDates.concat(newDates))) return;
        Object.assign(r, upd);
        if (!existing) {
          if (f.approveNow) Object.assign(r, { status: 'APPROVED', decidedAt: U.nowISO(), decidedBy: s.user.name });
          s.requests.push(r);
        }
        Store.touch('requests', oldDates.concat(newDates));
        Store.commit(existing ? 'แก้ไขคำขอ' : 'สร้างคำขอ', `${r.id} ${(ix.emps[r.e] || {}).code} ${r.date}`);
        m.close();
        UI.toast(`${existing ? 'บันทึก' : 'สร้าง'}${E.KIND[kind]} ${r.id} แล้ว${r.status === 'APPROVED' && !existing ? ' (อนุมัติแล้ว)' : ''} — อย่าลืมคำนวณบันทึกเวลาใหม่`, 'ok', 4500);
        if (onDone) onDone(r);
        else PL.App.rerender();
      });
      return m;
    },
  });

  /* ---------- หน้าจัดการคำขอ ---------- */
  PL.Views.requests = {
    render(el, params) {
      const s = Store.s, pk = Store.pk, ix = Store.ix();
      if (params.kind) st.kind = params.kind;
      const inP = (r) => st.scope === 'all' || E.reqInPeriod(s, r, pk);
      const pendBy = { LEAVE: 0, OT: 0, ADJ: 0 };
      s.requests.forEach((r) => r.status === 'PENDING' && inP(r) && pendBy[r.kind]++);
      if (!st.status) st.status = pendBy.LEAVE + pendBy.OT + pendBy.ADJ ? 'PENDING' : 'ALL';
      const list = s.requests.filter((r) => r.kind === st.kind && inP(r));
      const cnt = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
      list.forEach((r) => cnt[r.status]++);
      const locked = Store.isLocked();

      el.innerHTML = `${UI.stepHeader('requests', `<button class="btn primary" data-act="new" ${locked ? 'disabled' : ''}>${UI.icon('plus', 16)} สร้าง${E.KIND[st.kind]}</button>`)}
        ${UI.tabs(
          [
            { key: 'LEAVE', label: 'คำขอลา', icon: 'calendar', count: pendBy.LEAVE || '' },
            { key: 'OT', label: 'คำขอล่วงเวลา (OT)', icon: 'timer', count: pendBy.OT || '' },
            { key: 'ADJ', label: 'คำขอแก้ไขเวลา', icon: 'edit', count: pendBy.ADJ || '' },
          ],
          st.kind
        )}
        <div class="card">
          <div class="toolbar">
            ${UI.seg('status', [
              { key: 'PENDING', label: `รออนุมัติ (${cnt.PENDING})` },
              { key: 'APPROVED', label: `อนุมัติ (${cnt.APPROVED})` },
              { key: 'REJECTED', label: `ไม่อนุมัติ (${cnt.REJECTED})` },
              { key: 'ALL', label: `ทั้งหมด (${list.length})` },
            ], st.status)}
            <select class="input sm" data-dept>${UI.deptOptions(st.dept)}</select>
            <input class="input sm search-in" data-q placeholder="ค้นหาเลขที่ / พนักงาน" value="${esc(st.q)}">
            ${UI.seg('scope', [{ key: 'period', label: 'รอบนี้' }, { key: 'all', label: 'ทุกรอบ' }], st.scope)}
            <span class="spacer"></span>
            <button class="btn sm ok" data-act="bulkApprove" disabled>${UI.icon('check', 15)} อนุมัติที่เลือก</button>
            <button class="btn sm danger-ghost" data-act="bulkReject" disabled>${UI.icon('x', 15)} ไม่อนุมัติ</button>
          </div>
          <div data-tbl></div>
        </div>
        ${UI.banner('info', 'คำขอที่อนุมัติจะมีผลเมื่อ <b>คำนวณบันทึกเวลา</b> (ขั้นตอนที่ 5) — คำขอแก้ไขเวลาจะแทนเวลาสแกนเดิม, คำขอ OT กำหนดช่วงเวลาที่นับเป็น OT')}
        ${UI.stepNav('requests')}`;

      const emp = (r) => ix.emps[r.e] || {};
      const common = [
        { key: 'id', label: 'เลขที่', render: (r) => `<span class="mono">${esc(r.id)}</span>` },
        { key: 'e', label: 'พนักงาน', sv: (r) => emp(r).code, render: (r) => UI.empCell(ix.emps[r.e]) },
        { key: 'dept', label: 'แผนก', sv: (r) => emp(r).dept, render: (r) => esc(emp(r).dept) },
      ];
      const perKind = {
        LEAVE: [
          { key: 'leaveType', label: 'ประเภท', render: (r) => esc((ix.leaveTypes[r.leaveType] || {}).name || r.leaveType) },
          { key: 'date', label: 'วันที่ลา', render: (r) => `<span class="nowrap">${U.fmtDate(r.date)}${r.dateTo && r.dateTo !== r.date ? ' – ' + U.fmtDate(r.dateTo) : ''}</span>` },
          { key: 'part', label: 'ช่วง', render: (r) => esc(E.LEAVE_PART[r.part || 'FULL']) },
          { key: 'days', label: 'วัน', align: 'r', sv: (r) => E.leaveDays(s, r, ix), render: (r) => U.num(E.leaveDays(s, r, ix), 1) },
        ],
        OT: [
          { key: 'date', label: 'วันที่', render: (r) => `<span class="nowrap">${U.fmtDay(r.date)}</span>` },
          { key: 'otStart', label: 'ช่วงเวลา', render: (r) => `<span class="mono">${r.otStart.slice(11)}–${r.otEnd.slice(11)}</span>${r.otEnd.slice(0, 10) !== r.date ? ' <small class="muted">+1</small>' : ''}` },
          { key: 'hrs', label: 'ชม.', align: 'r', sv: (r) => U.tmin(r.otEnd) - U.tmin(r.otStart), render: (r) => U.dur(U.tmin(r.otEnd) - U.tmin(r.otStart)) },
          { key: 'dtype', label: 'ประเภทวัน', render: (r) => {
            const e = ix.emps[r.e];
            const di = e && E.dayInfo(s, ix, e, r.date);
            return di ? UI.pill(di.type === 'WORK' ? 'วันทำงาน' : 'วันหยุด', di.type === 'WORK' ? 'off' : 'purple') : '';
          } },
        ],
        ADJ: [
          { key: 'date', label: 'วันที่', render: (r) => `<span class="nowrap">${U.fmtDay(r.date)}</span>` },
          { key: 'adjIn', label: 'เวลาเข้าใหม่', render: (r) => (r.adjIn ? `<b class="mono">${r.adjIn.slice(11)}</b>` : '<span class="muted">–</span>') },
          { key: 'adjOut', label: 'เวลาออกใหม่', render: (r) => (r.adjOut ? `<b class="mono">${r.adjOut.slice(11)}</b>${r.adjOut.slice(0, 10) !== r.date ? ' <small class="muted">+1</small>' : ''}` : '<span class="muted">–</span>') },
        ],
      };
      const tail = [
        { key: 'reason', label: 'เหตุผล', render: (r) => `<span class="muted">${esc(r.reason || '')}</span>` },
        { key: 'status', label: 'สถานะ', render: (r) => UI.reqStatus(r.status) + (r.decidedBy && r.status !== 'PENDING' ? `<div class="emp-code">${esc(r.decidedBy)}</div>` : '') },
        {
          key: '_', label: '', sort: false, align: 'r',
          render: (r) => {
            const lk = E.reqDates(r).some((d) => Store.isLocked(E.periodOf(s, d)));
            if (lk) return UI.icon('lock', 15, 'muted');
            return `<div class="row-actions">${r.status === 'PENDING' ? `<button class="btn xs ok" data-act="approve" title="อนุมัติ">${UI.icon('check', 14)}</button><button class="btn xs danger-ghost" data-act="reject" title="ไม่อนุมัติ">${UI.icon('x', 14)}</button><button class="btn xs icon" data-act="edit" title="แก้ไข">${UI.icon('edit', 14)}</button>` : `<button class="btn xs" data-act="revert" title="ย้อนกลับเป็นรออนุมัติ">ย้อนสถานะ</button>`}<button class="btn xs icon danger-ghost" data-act="del" title="ลบ">${UI.icon('trash', 14)}</button></div>`;
          },
        },
      ];
      const t = new UI.DataTable({
        pageSize: 25,
        compact: true,
        selectable: true,
        rowKey: (r) => r.id,
        canSelect: (r) => r.status === 'PENDING',
        sortKey: 'date',
        columns: common.concat(perKind[st.kind], tail),
        onSelect: (sel) => {
          el.querySelector('[data-act="bulkApprove"]').disabled = !sel.length;
          el.querySelector('[data-act="bulkReject"]').disabled = !sel.length;
        },
        onAction: async (a, r) => {
          if (a === 'approve') this.decide([r], 'APPROVED');
          if (a === 'reject') this.decide([r], 'REJECTED');
          if (a === 'revert') this.decide([r], 'PENDING');
          if (a === 'edit') Forms.request(r.kind, {}, r);
          if (a === 'del') {
            if (!Store.guard(E.reqDates(r))) return;
            if (!(await UI.confirm(`ลบ${E.KIND[r.kind]} <b>${esc(r.id)}</b>?`, { danger: true, ok: 'ลบ' }))) return;
            Store.s.requests = Store.s.requests.filter((x) => x !== r);
            Store.touch('requests', E.reqDates(r));
            Store.commit('ลบคำขอ', r.id);
            PL.App.rerender();
          }
        },
      });
      el.querySelector('[data-tbl]').appendChild(t.el);
      const apply = () => {
        const q = st.q.toLowerCase();
        t.setRows(
          list.filter((r) => {
            if (st.status !== 'ALL' && r.status !== st.status) return false;
            const e = ix.emps[r.e] || {};
            if (st.dept && e.dept !== st.dept) return false;
            if (q && !`${r.id} ${e.code} ${e.name}`.toLowerCase().includes(q)) return false;
            return true;
          })
        );
        t.o.onSelect(t.selected());
      };
      apply();

      el.querySelector('.tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        st.kind = b.dataset.tab;
        PL.App.go('requests', { kind: st.kind });
      });
      el.querySelectorAll('[data-seg]').forEach((sg) =>
        sg.addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (!b) return;
          st[sg.dataset.seg] = b.dataset.v;
          PL.App.rerender();
        })
      );
      el.querySelector('[data-dept]').addEventListener('change', (e) => ((st.dept = e.target.value), apply()));
      el.querySelector('[data-q]').addEventListener('input', U.debounce((e) => ((st.q = e.target.value.trim()), apply()), 150));
      el.querySelector('[data-act="new"]').addEventListener('click', () => Forms.request(st.kind));
      el.querySelector('[data-act="bulkApprove"]').addEventListener('click', () => this.decide(t.selected(), 'APPROVED'));
      el.querySelector('[data-act="bulkReject"]').addEventListener('click', () => this.decide(t.selected(), 'REJECTED'));

      if (params.new && !locked) {
        history.replaceState(null, '', `#/requests?kind=${st.kind}`);
        Forms.request(st.kind, { e: params.e, date: params.date });
      }
    },
    decide(list, status) {
      if (!list.length) return;
      const s = Store.s;
      const dates = list.flatMap(E.reqDates);
      if (!Store.guard(dates)) return;
      list.forEach((r) => {
        r.status = status;
        r.decidedAt = status === 'PENDING' ? null : U.nowISO();
        r.decidedBy = status === 'PENDING' ? null : s.user.name;
      });
      Store.touch('requests', dates);
      const label = { APPROVED: 'อนุมัติ', REJECTED: 'ไม่อนุมัติ', PENDING: 'ย้อนสถานะ' }[status];
      Store.commit(`${label}คำขอ`, list.map((r) => r.id).join(', '));
      UI.toast(`${label} ${list.length} รายการแล้ว${status === 'APPROVED' ? ' — ผลจะอัปเดตเมื่อคำนวณบันทึกเวลาใหม่' : ''}`, 'ok', 4000);
      PL.App.rerender();
    },
  };
})(window);

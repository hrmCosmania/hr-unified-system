/* Payroll Full Loop — ส่วนประกอบหน้าจอที่ใช้ร่วมกัน */
(function (g) {
  'use strict';
  const PL = (g.PL = g.PL || {});
  const U = PL.U, E = PL.Engine;
  const esc = U.esc;

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    calendarGrid: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01M16.5 17h.01"/>',
    import: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 7.5v6.5"/><path d="m8.5 11 3.5 3.5 3.5-3.5"/><path d="M8 17.5h8"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>',
    upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.9L3 9.5"/><path d="M3 4v5.5h5.5"/><path d="M4 13a8 8 0 0 0 14.9 3.9L21 14.5"/><path d="M21 20v-5.5h-5.5"/>',
    fileCheck: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/><path d="m9 14 2 2 4-4"/>',
    file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    calculator: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8v3H8z"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01"/>',
    chart: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    bars: '<path d="M4 20h16"/><path d="M7 16v-5M11.5 16V7M16 16v-3"/>',
    alert: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    userClock: '<circle cx="9" cy="7.5" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6 1.2 0 2.3.3 3.2.9"/><circle cx="17" cy="16.5" r="4.5"/><path d="M17 14.5v2l1.3 1"/>',
    exportClock: '<path d="M20.5 12.5A8.5 8.5 0 1 1 15 4.3"/><path d="M12 7.5V12l3 2"/><path d="M16.5 3.5h4v4"/><path d="m20.5 3.5-4.5 4.5"/>',
    send: '<path d="M21.5 2.5 10.5 13.5"/><path d="m21.5 2.5-7 19-4-8-8-4z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 13.8c2 .8 3.5 3 3.5 6.2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 3 3"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    unlock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.7-1.5"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M10 17l5-5-5-5"/><path d="M15 12H4"/>',
    database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    brush: '<path d="M18.5 3.5a2.1 2.1 0 0 1 3 3L12 16l-4-4z"/><path d="M8 12c-2.5 0-4 1.5-4 4 0 1.5-1 2.5-2 3 4 1 8 0 8-3"/>',
    eraser: '<path d="m7 21-4-4 11-11 7 7-7 7.5z"/><path d="M7 21h13"/><path d="m9.5 10.5 7 7"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2 1.5"/><path d="M9.5 2.5h5M12 2.5V6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    banknote: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    receipt: '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5-2 1.5-2.5-1.5L5 21z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
    wallet: '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h14a1.5 1.5 0 0 0 1.5-1.5V9a2 2 0 0 0-2-2H5.5"/><path d="M16.5 13.5h.01"/>',
  };

  const UI = (PL.UI = {
    ICONS,
    icon(name, size = 18, cls = '') {
      return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
    },
    h(html) {
      const t = document.createElement('template');
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },
    on(root, type, sel, fn) {
      root.addEventListener(type, (ev) => {
        const t = ev.target.closest(sel);
        if (t && root.contains(t)) fn(ev, t);
      });
    },

    /* ---------- toast ---------- */
    toast(msg, type = 'ok', ms = 3200) {
      const root = document.getElementById('toast-root');
      if (!root) return;
      const ic = { ok: 'checkCircle', warn: 'alert', bad: 'xCircle', info: 'info' }[type] || 'info';
      const el = UI.h(`<div class="toast t-${type}" role="status">${UI.icon(ic, 18)}<span>${msg}</span></div>`);
      root.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
      }, ms);
    },

    /* ---------- modal ---------- */
    modal({ title, sub = '', body = '', footer = '', size = 'md', onClose } = {}) {
      const root = document.getElementById('modal-root');
      const el = UI.h(`<div class="modal-back"><div class="modal m-${size}" role="dialog" aria-modal="true">
        <div class="modal-head"><div><h3>${title}</h3>${sub ? `<div class="modal-sub">${sub}</div>` : ''}</div>
        <button class="icon-btn" data-close aria-label="ปิด">${UI.icon('x', 18)}</button></div>
        <div class="modal-body"></div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}</div></div>`);
      const bodyEl = el.querySelector('.modal-body');
      if (typeof body === 'string') bodyEl.innerHTML = body;
      else bodyEl.appendChild(body);
      const close = () => {
        el.classList.remove('show');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => el.remove(), 180);
        onClose && onClose();
      };
      const onKey = (e) => {
        if (e.key === 'Escape' && root.lastElementChild === el) close();
      };
      document.addEventListener('keydown', onKey);
      el.addEventListener('mousedown', (e) => {
        if (e.target === el) el._downOnBack = true;
      });
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]') || (e.target === el && el._downOnBack)) close();
        el._downOnBack = false;
      });
      root.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      const first = el.querySelector('input:not([type=hidden]):not([disabled]),select,textarea');
      if (first) setTimeout(() => first.focus(), 60);
      return { el, close, $: (s) => el.querySelector(s), $$: (s) => [...el.querySelectorAll(s)] };
    },
    confirm(message, { title = 'ยืนยันการทำรายการ', ok = 'ยืนยัน', cancel = 'ยกเลิก', danger = false } = {}) {
      return new Promise((resolve) => {
        let done = false;
        const m = UI.modal({
          title,
          size: 'sm',
          body: `<div class="confirm-msg">${message}</div>`,
          footer: `<button class="btn" data-close>${cancel}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${ok}</button>`,
          onClose: () => {
            if (!done) resolve(false);
          },
        });
        m.$('[data-ok]').addEventListener('click', () => {
          done = true;
          resolve(true);
          m.close();
        });
        setTimeout(() => m.$('[data-ok]').focus(), 60);
      });
    },

    /* ---------- badges ---------- */
    pill(label, cls = 'off', icon) {
      return `<span class="pill p-${cls}">${icon ? UI.icon(icon, 13) : ''}${esc(label)}</span>`;
    },
    status(st) {
      const m = E.STATUS[st] || { label: st, cls: 'off' };
      return UI.pill(m.label, m.cls);
    },
    mapStatus(st) {
      const m = E.MAP_STATUS[st] || { label: st, cls: 'off' };
      return UI.pill(m.label, m.cls);
    },
    reqStatus(st) {
      const m = E.REQ_STATUS[st] || { label: st, cls: 'off' };
      return UI.pill(m.label, m.cls);
    },
    shiftChip(code, ix) {
      if (!code) return '<span class="shift-chip empty">–</span>';
      const sh = ix.shifts[code];
      const c = (sh && sh.color) || '#94a3b8';
      return `<span class="shift-chip" style="--c:${c}" title="${esc(sh ? sh.name : code)}">${esc(code)}</span>`;
    },
    shiftTime(sh) {
      return sh && sh.start ? `${sh.start}–${sh.end}` : '';
    },
    empCell(emp) {
      if (!emp) return '<span class="muted">ไม่พบพนักงาน</span>';
      return `<div class="emp-cell"><span class="avatar sm">${esc(U.initials(emp.name))}</span><div><div class="emp-name">${esc(emp.name)}</div><div class="emp-code">${esc(emp.code)}</div></div></div>`;
    },
    banner(type, html, actions = '') {
      const ic = { ok: 'checkCircle', warn: 'alert', bad: 'xCircle', info: 'info' }[type] || 'info';
      return `<div class="banner b-${type}">${UI.icon(ic, 20)}<div class="banner-text">${html}</div>${actions ? `<div class="banner-act">${actions}</div>` : ''}</div>`;
    },
    empty(msg, action = '') {
      return `<div class="empty">${UI.icon('database', 34)}<div>${msg}</div>${action}</div>`;
    },
    delta(cur, prev, { invert = false, unit = '%' } = {}) {
      if (prev == null || !isFinite(prev) || prev === 0 || cur == null) return '';
      const d = ((cur - prev) / Math.abs(prev)) * 100;
      if (!isFinite(d)) return '';
      const up = d >= 0;
      const good = invert ? !up : up;
      return `<span class="delta ${good ? 'up' : 'down'}">${UI.icon(up ? 'arrowUp' : 'arrowDown', 12)}${up ? '+' : ''}${U.num(d, 1)}${unit}</span>`;
    },

    /* ---------- form helpers ---------- */
    empOptions(selected, { all = false, onlyActive = true } = {}) {
      const s = PL.Store.s;
      const byDept = {};
      s.employees.filter((e) => !onlyActive || e.active !== false || e.id === selected).forEach((e) => (byDept[e.dept] = byDept[e.dept] || []).push(e));
      let html = all ? '<option value="">พนักงานทั้งหมด</option>' : '<option value="">— เลือกพนักงาน —</option>';
      for (const [d, list] of Object.entries(byDept)) {
        html += `<optgroup label="${esc(d)}">${list.map((e) => `<option value="${e.id}" ${e.id === selected ? 'selected' : ''}>${esc(e.code)} · ${esc(e.name)}</option>`).join('')}</optgroup>`;
      }
      return html;
    },
    deptOptions(selected, allLabel = 'ทุกแผนก') {
      const s = PL.Store.s;
      const depts = [...new Set(s.depts.concat(s.employees.map((e) => e.dept)))];
      return `<option value="">${allLabel}</option>` + depts.map((d) => `<option ${d === selected ? 'selected' : ''}>${esc(d)}</option>`).join('');
    },
    formData(root) {
      const o = {};
      root.querySelectorAll('[name]').forEach((el) => {
        if (el.type === 'checkbox') o[el.name] = el.checked;
        else if (el.type === 'radio') {
          if (el.checked) o[el.name] = el.value;
        } else o[el.name] = el.value.trim();
      });
      return o;
    },

    /* ---------- step header / nav ---------- */
    stepHeader(key, actions = '', extra = '') {
      const n = PL.NAV.find((x) => x.key === key);
      const pk = PL.Store.pk, R = PL.Store.range();
      return `<div class="page-head">
        <div class="ph-left">
          <div class="ph-icon">${UI.icon(n.icon, 26)}</div>
          <div>
            <div class="ph-kicker">${n.step ? `ขั้นตอนที่ ${n.step} / 9 · ` : ''}${esc(n.en)}</div>
            <h1>${esc(n.th)}</h1>
            <div class="ph-sub">${n.desc || ''} <span class="ph-period">${UI.icon('calendar', 14)} รอบ ${U.fmtPeriod(pk)} (${U.fmtDate(R.start)} – ${U.fmtDate(R.end)})${PL.Store.isLocked() ? ` · ${UI.icon('lock', 13)} ล็อกแล้ว` : ''}</span></div>
          </div>
        </div>
        <div class="ph-actions">${actions}</div>
      </div>${extra}`;
    },
    stepNav(key) {
      const steps = PL.NAV.filter((x) => x.step);
      const i = steps.findIndex((x) => x.key === key);
      const prev = steps[i - 1], next = steps[i + 1];
      return `<div class="step-nav">
        ${prev ? `<a class="btn ghost" href="#/${prev.key}">${UI.icon('chevronLeft', 16)} ${prev.step}. ${esc(prev.th)}</a>` : '<span></span>'}
        ${next ? `<a class="btn ghost" href="#/${next.key}">${next.step}. ${esc(next.th)} ${UI.icon('chevronRight', 16)}</a>` : `<a class="btn ghost" href="#/payroll">คำนวณเงินเดือน ${UI.icon('chevronRight', 16)}</a>`}
      </div>`;
    },
    tabs(items, active, attr = 'data-tab') {
      return `<div class="tabs" role="tablist">${items
        .map((t) => `<button class="tab ${t.key === active ? 'active' : ''}" ${attr}="${t.key}" role="tab">${t.icon ? UI.icon(t.icon, 16) : ''}${esc(t.label)}${t.count ? `<span class="tab-count">${t.count}</span>` : ''}</button>`)
        .join('')}</div>`;
    },
    seg(name, items, active) {
      return `<div class="seg" data-seg="${name}">${items.map((t) => `<button class="${t.key === active ? 'active' : ''}" data-v="${t.key}">${esc(t.label)}</button>`).join('')}</div>`;
    },

    /* ---------- charts (SVG) ---------- */
    donut(segs, { size = 170, thick = 20, center = '', sub = '' } = {}) {
      const r = (size - thick) / 2, C = 2 * Math.PI * r;
      const total = segs.reduce((t, x) => t + x.value, 0) || 1;
      let off = 0;
      const arcs = segs
        .map((x) => {
          const len = (x.value / total) * C;
          const a = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${x.color}" stroke-width="${thick}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"><title>${esc(x.label)}: ${U.num(x.value)}</title></circle>`;
          off += len;
          return a;
        })
        .join('');
      return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
        <g transform="rotate(-90 ${size / 2} ${size / 2})"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--border-2)" stroke-width="${thick}"/>${arcs}</g>
        <text x="50%" y="48%" text-anchor="middle" class="donut-val">${center}</text>
        <text x="50%" y="62%" text-anchor="middle" class="donut-sub">${sub}</text></svg>`;
    },
    line(points, { w = 560, h = 210, min, max, fmt = (v) => U.num(v), suffix = '', color = 'var(--brand)' } = {}) {
      if (!points.length) return UI.empty('ยังไม่มีข้อมูล');
      const pl = 40, pr = 16, pt = 22, pb = 26;
      const vals = points.map((p) => p.value);
      let lo = min != null ? min : Math.min(...vals), hi = max != null ? max : Math.max(...vals);
      if (hi === lo) {
        hi += 1;
        lo = Math.max(0, lo - 1);
      }
      const X = (i) => pl + (points.length === 1 ? (w - pl - pr) / 2 : (i * (w - pl - pr)) / (points.length - 1));
      const Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (h - pt - pb);
      const ticks = 5;
      let grid = '';
      for (let i = 0; i <= ticks; i++) {
        const v = lo + ((hi - lo) * i) / ticks;
        const y = Y(v);
        grid += `<line x1="${pl}" x2="${w - pr}" y1="${y}" y2="${y}" class="grid"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end" class="axis">${fmt(v)}${suffix}</text>`;
      }
      const step = Math.ceil(points.length / 12);
      const xl = points.map((p, i) => (i % step === 0 || i === points.length - 1 ? `<text x="${X(i)}" y="${h - 6}" text-anchor="middle" class="axis">${esc(p.label)}</text>` : '')).join('');
      const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(' ');
      const area = `${path} L${X(points.length - 1)},${h - pb} L${X(0)},${h - pb} Z`;
      const dots = points.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.value)}" r="3.2" class="dot"><title>${esc(p.title || p.label)}: ${fmt(p.value)}${suffix}</title></circle>`).join('');
      const li = points.length - 1, lv = points[li];
      const bx = Math.min(X(li), w - pr - 30);
      const bubble = `<g class="bubble"><rect x="${bx - 30}" y="${Y(lv.value) - 30}" width="60" height="22" rx="6"/><text x="${bx}" y="${Y(lv.value) - 15}" text-anchor="middle">${fmt(lv.value)}${suffix}</text></g>`;
      const gid = 'g' + Math.random().toString(36).slice(2, 7);
      return `<svg class="linechart" viewBox="0 0 ${w} ${h}" role="img" style="--lc:${color}">
        <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
        ${grid}<path d="${area}" fill="url(#${gid})"/><path d="${path}" class="ln"/>${dots}${xl}${bubble}</svg>`;
    },
    hbars(items, { fmt = (v) => U.num(v), color = 'var(--brand)' } = {}) {
      if (!items.length) return UI.empty('ไม่มีข้อมูล');
      const max = Math.max(...items.map((x) => x.value)) || 1;
      return `<div class="hbars">${items
        .map(
          (x) => `<div class="hbar"><div class="hbar-label" title="${esc(x.label)}">${esc(x.label)}</div>
          <div class="hbar-track"><div class="hbar-fill" style="width:${(x.value / max) * 100}%;background:${x.color || color}"></div></div>
          <div class="hbar-val">${fmt(x.value)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</div></div>`
        )
        .join('')}</div>`;
    },

    /* ---------- timecard (บัตรลงเวลารายพนักงาน) ---------- */
    timecard(empId, pk) {
      const s = PL.Store.s;
      pk = pk || PL.Store.pk;
      const emp = PL.Store.emp(empId);
      if (!emp) return;
      const P = PL.Store.P(pk), ix = E.idx(s);
      const rows = (P.calc || []).filter((r) => r.e === empId);
      const sm = E.summary(s, pk);
      const x = sm && sm.emps[empId];
      const lt = ix.leaveTypes;
      const body = !rows.length
        ? UI.empty('ยังไม่มีผลคำนวณสำหรับรอบนี้ — ไปที่ขั้นตอนที่ 5 เพื่อคำนวณ')
        : `<div class="tc-summary">
            <div><b>${x.sched}</b><span>วันทำงานตามกะ</span></div>
            <div><b>${U.num(x.present, 1)}</b><span>มาทำงาน (วัน)</span></div>
            <div><b>${U.num(x.absent, 1)}</b><span>ขาดงาน (วัน)</span></div>
            <div><b>${x.lateCnt}</b><span>สาย (${x.lateMin} นาที)</span></div>
            <div><b>${U.num(x.leaveDays, 1)}</b><span>ลา (วัน)</span></div>
            <div><b>${U.hrs(x.ot)}</b><span>OT รวม (ชม.)</span></div>
            <div><b>${x.inc}</b><span>ไม่สมบูรณ์</span></div>
          </div>
          <div class="tbl-wrap tc"><table class="tbl compact">
          <thead><tr><th>วันที่</th><th>กะ</th><th>เข้า</th><th>ออก</th><th class="r">ชม.ทำงาน</th><th class="r">สาย</th><th class="r">กลับก่อน</th><th class="r">OT</th><th>ลา</th><th>สถานะ</th><th>หมายเหตุ</th><th></th></tr></thead>
          <tbody>${rows
            .map((r) => {
              const ot = r.ot1 + r.ot15 + r.ot2 + r.ot3;
              const we = r.type !== 'WORK';
              return `<tr class="${we ? 'row-off' : ''}">
              <td class="nowrap">${U.fmtDay(r.d)}</td><td>${UI.shiftChip(r.code, ix)}</td>
              <td class="mono">${U.clock(r.in) || '<span class="miss">--:--</span>'.repeat(r.inc === 'IN' ? 1 : 0)}</td>
              <td class="mono">${U.clock(r.out) || '<span class="miss">--:--</span>'.repeat(r.inc === 'OUT' ? 1 : 0)}</td>
              <td class="r mono">${U.dur(r.work)}</td><td class="r mono">${r.late || ''}</td><td class="r mono">${r.early || ''}</td>
              <td class="r mono">${U.dur(ot)}</td><td>${r.leave ? esc((lt[r.lt] || {}).name || r.lt) + (r.leave < 1 ? ' ½' : '') : ''}</td>
              <td>${UI.status(r.st)}</td><td class="notes">${r.notes.map(esc).join('<br>')}</td>
              <td>${r.inc && !PL.Store.isLocked(pk) ? `<button class="btn xs" data-fix="${r.d}">แก้ไขเวลา</button>` : ''}</td></tr>`;
            })
            .join('')}</tbody></table></div>`;
      const m = UI.modal({
        title: `บัตรลงเวลา · ${esc(emp.name)}`,
        sub: `${esc(emp.code)} · ${esc(emp.dept)} · ${esc(emp.position || '')} · ${emp.payType === 'D' ? 'รายวัน' : 'รายเดือน'} · รอบ ${U.fmtPeriod(pk)}`,
        size: 'xl',
        body,
        footer: `<button class="btn" data-print>${UI.icon('printer', 16)} พิมพ์</button><button class="btn primary" data-close>ปิด</button>`,
      });
      m.el.addEventListener('click', (e) => {
        const f = e.target.closest('[data-fix]');
        if (f) {
          m.close();
          PL.Forms.request('ADJ', { e: empId, date: f.dataset.fix });
        }
        if (e.target.closest('[data-print]')) UI.printEl(m.$('.modal'), `บัตรลงเวลา ${emp.name}`);
      });
    },
    printEl(el, title) {
      document.body.classList.add('printing-modal');
      el.classList.add('print-target');
      const prev = document.title;
      document.title = title || prev;
      window.print();
      document.title = prev;
      el.classList.remove('print-target');
      document.body.classList.remove('printing-modal');
    },
  });

  /* ---------- ตารางข้อมูล: เรียง/แบ่งหน้า/เลือกแถว ---------- */
  class DataTable {
    constructor(o) {
      this.o = Object.assign({ pageSize: 25, rows: [], empty: 'ไม่พบข้อมูล', rowKey: (r, i) => i }, o);
      this.page = 1;
      this.sortKey = o.sortKey || null;
      this.sortDir = o.sortDir || 1;
      this.sel = new Set();
      this.el = document.createElement('div');
      this.el.className = 'dt';
      this.el.addEventListener('click', (e) => this.onClick(e));
      this.el.addEventListener('change', (e) => this.onChange(e));
    }
    setRows(rows, keepPage) {
      this.o.rows = rows;
      if (!keepPage) this.page = 1;
      const keys = new Set(rows.map(this.o.rowKey));
      [...this.sel].forEach((k) => !keys.has(k) && this.sel.delete(k));
      this.render();
      return this;
    }
    selected() {
      return this.o.rows.filter((r, i) => this.sel.has(this.o.rowKey(r, i)));
    }
    sorted() {
      const rows = this.o.rows.slice();
      const col = this.o.columns.find((c) => c.key === this.sortKey);
      if (!col) return rows;
      const f = col.sv || ((r) => r[col.key]);
      const d = this.sortDir;
      return rows.sort((a, b) => {
        const x = f(a), y = f(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'th')) * d;
      });
    }
    render() {
      const o = this.o;
      this._rows = this.sorted();
      const n = this._rows.length;
      const ps = o.pageSize;
      const pages = Math.max(1, Math.ceil(n / ps));
      if (this.page > pages) this.page = pages;
      const a = (this.page - 1) * ps, b = Math.min(n, a + ps);
      const slice = this._rows.slice(a, b);
      const selCol = !!o.selectable;
      const allOnPage = selCol && slice.length && slice.every((r) => this.sel.has(o.rowKey(r)));
      const th = o.columns
        .map((c) => {
          const s = c.sort !== false;
          const act = this.sortKey === c.key;
          return `<th class="${c.align === 'r' ? 'r' : ''} ${c.cls || ''} ${s ? 'sortable' : ''} ${act ? 'sorted' : ''}" ${s ? `data-sort="${c.key}"` : ''} ${c.width ? `style="width:${c.width}"` : ''}>${c.label}${act ? UI.icon(this.sortDir > 0 ? 'arrowUp' : 'arrowDown', 12) : ''}</th>`;
        })
        .join('');
      const body = slice.length
        ? slice
            .map((r, i) => {
              const k = o.rowKey(r);
              const cls = o.rowClass ? o.rowClass(r) : '';
              return `<tr data-i="${a + i}" class="${cls} ${o.onRow ? 'clickable' : ''} ${this.sel.has(k) ? 'selected' : ''}">${selCol ? `<td class="sel"><input type="checkbox" data-sel ${this.sel.has(k) ? 'checked' : ''} ${o.canSelect && !o.canSelect(r) ? 'disabled' : ''}></td>` : ''}${o.columns
                .map((c) => `<td class="${c.align === 'r' ? 'r' : ''} ${c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`)
                .join('')}</tr>`;
            })
            .join('')
        : `<tr><td colspan="${o.columns.length + (selCol ? 1 : 0)}" class="dt-empty">${o.empty}</td></tr>`;
      const foot = o.footer ? `<tfoot>${o.footer(this._rows)}</tfoot>` : '';
      const pager =
        n > ps
          ? `<div class="pager"><button class="btn xs" data-pg="${this.page - 1}" ${this.page <= 1 ? 'disabled' : ''}>${UI.icon('chevronLeft', 14)}</button>
           <span>หน้า ${this.page} / ${pages}</span>
           <button class="btn xs" data-pg="${this.page + 1}" ${this.page >= pages ? 'disabled' : ''}>${UI.icon('chevronRight', 14)}</button></div>`
          : '';
      this.el.innerHTML = `<div class="tbl-wrap"><table class="tbl ${o.compact ? 'compact' : ''}">
        <thead><tr>${selCol ? `<th class="sel"><input type="checkbox" data-selall ${allOnPage ? 'checked' : ''} title="เลือกทั้งหน้า"></th>` : ''}${th}</tr></thead>
        <tbody>${body}</tbody>${foot}</table></div>
        <div class="dt-foot"><span class="muted">${n ? `แสดง ${U.num(a + 1)}–${U.num(b)} จาก ${U.num(n)} รายการ` : ''}${selCol && this.sel.size ? ` · <b>เลือก ${this.sel.size} รายการ</b>` : ''}</span>
        <div class="dt-right"><select data-ps class="input xs">${[10, 25, 50, 100, 500].map((x) => `<option ${x === ps ? 'selected' : ''}>${x}</option>`).join('')}</select>${pager}</div></div>`;
      return this;
    }
    rowAt(tr) {
      return this._rows[+tr.dataset.i];
    }
    onClick(e) {
      const sort = e.target.closest('[data-sort]');
      if (sort) {
        const k = sort.dataset.sort;
        if (this.sortKey === k) this.sortDir *= -1;
        else {
          this.sortKey = k;
          this.sortDir = 1;
        }
        return this.render();
      }
      const pg = e.target.closest('[data-pg]');
      if (pg) {
        this.page = +pg.dataset.pg;
        this.render();
        this.el.scrollIntoView({ block: 'nearest' });
        return;
      }
      const act = e.target.closest('[data-act]');
      const tr = e.target.closest('tr[data-i]');
      if (act && tr && this.o.onAction) {
        e.stopPropagation();
        return this.o.onAction(act.dataset.act, this.rowAt(tr), act);
      }
      if (e.target.closest('input,button,a,select,label')) return;
      if (tr && this.o.onRow) this.o.onRow(this.rowAt(tr));
    }
    onChange(e) {
      if (e.target.matches('[data-ps]')) {
        this.o.pageSize = +e.target.value;
        this.page = 1;
        return this.render();
      }
      if (e.target.matches('[data-selall]')) {
        const on = e.target.checked;
        this.el.querySelectorAll('tbody tr[data-i]').forEach((tr) => {
          const r = this.rowAt(tr);
          if (this.o.canSelect && !this.o.canSelect(r)) return;
          const k = this.o.rowKey(r);
          on ? this.sel.add(k) : this.sel.delete(k);
        });
        this.render();
        this.o.onSelect && this.o.onSelect(this.selected());
        return;
      }
      if (e.target.matches('[data-sel]')) {
        const r = this.rowAt(e.target.closest('tr'));
        const k = this.o.rowKey(r);
        e.target.checked ? this.sel.add(k) : this.sel.delete(k);
        this.render();
        this.o.onSelect && this.o.onSelect(this.selected());
      }
    }
  }
  UI.DataTable = DataTable;

  // ส่งออก CSV จากคอลัมน์ที่กำหนด
  UI.exportCSV = (name, cols, rows) => {
    U.download(name, U.csv(cols.map((c) => c.label), rows.map((r) => cols.map((c) => c.get(r)))));
    UI.toast(`ดาวน์โหลด ${name} แล้ว (${U.num(rows.length)} แถว)`);
  };
})(typeof window !== 'undefined' ? window : globalThis);

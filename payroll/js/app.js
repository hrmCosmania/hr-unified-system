/* Payroll Full Loop — โครงหน้าจอหลัก: เมนู, เส้นทาง, ค้นหา, แจ้งเตือน */
(function (g) {
  'use strict';
  const PL = g.PL, U = PL.U, E = PL.Engine, UI = PL.UI, Store = PL.Store;
  PL.Views = PL.Views || {};
  const esc = U.esc;

  const NAV = [
    { key: 'dashboard', th: 'หน้าหลัก', en: 'Dashboard', icon: 'home' },
    { key: 'employees', th: 'ฐานข้อมูลพนักงาน', en: 'Employee Database', icon: 'users', desc: 'รายชื่อพนักงานชุดเดียวกับระบบ HR — ตรวจให้ครบก่อนเริ่มบันทึกเวลา และกำหนดเลขบัตรตอกบัตร กะ รูปแบบวันทำงาน' },
    { key: 'import', step: 1, th: 'ดึงบันทึกเวลา', en: 'Time Data Import', icon: 'import', short: 'ดึงบันทึกเวลา', desc: 'นำเข้าข้อมูลการสแกนนิ้ว/บัตรจากเครื่องบันทึกเวลา' },
    { key: 'schedule', step: 2, th: 'ประกาศกะ', en: 'Shift Schedule', icon: 'calendarGrid', short: 'ประกาศกะ', desc: 'จัดตารางกะของพนักงานแต่ละวัน แล้วประกาศให้มีผล' },
    { key: 'mapping', step: 3, th: 'โอนบันทึกเวลาเทียบกะ', en: 'Time Mapping', icon: 'refresh', short: 'โอนบันทึกเวลา<br>เทียบกะ', desc: 'จับคู่เวลาสแกนกับกะของแต่ละวัน เพื่อหาเวลาเข้า-ออกจริง' },
    { key: 'requests', step: 4, th: 'จัดการคำขอ', en: 'Leave / OT / Time Adjust', icon: 'fileCheck', short: 'จัดการคำขอลา<br>คำขอโอที/แก้ไขเวลา', desc: 'อนุมัติคำขอลา คำขอทำงานล่วงเวลา และคำขอแก้ไขเวลา' },
    { key: 'calc', step: 5, th: 'คำนวณบันทึกเวลา', en: 'Time Calculation', icon: 'calculator', short: 'คำนวณบันทึกเวลา', desc: 'คำนวณสาย กลับก่อน ขาดงาน ลา และชั่วโมง OT ตามกฎของบริษัท' },
    { key: 'report', step: 6, th: 'รายงานบันทึกเวลา', en: 'Time Report', icon: 'chart', short: 'รายงานบันทึกเวลา', desc: 'รายงานบันทึกเวลารายวัน สรุปรายพนักงาน และรายงาน OT' },
    { key: 'incomplete', step: 7, th: 'รายงานบันทึกเวลาไม่สมบูรณ์', en: 'Incomplete Time', icon: 'alert', short: 'รายงานบันทึกเวลา<br>ไม่สมบูรณ์', desc: 'รายการที่สแกนไม่ครบขาเข้าหรือขาออก ต้องแก้ไขก่อนส่งเงินเดือน' },
    { key: 'absence', step: 8, th: 'รายงานขาด ลา มาสาย', en: 'Absence & Late Report', icon: 'userClock', short: 'รายงานขาด ลา<br>มาสาย', desc: 'สรุปการขาดงาน การลา การมาสาย และกลับก่อนของพนักงาน' },
    { key: 'export', step: 9, th: 'โอนผลบันทึกเวลา', en: 'Export to Payroll', icon: 'exportClock', short: 'โอนผลบันทึกเวลา<br>เพื่อคำนวณเงินเดือน', desc: 'ตรวจความพร้อม แล้วส่งผลบันทึกเวลาไปคำนวณเงินเดือน' },
  ];
  const NAV_PAY = [
    { key: 'payroll', th: 'คำนวณเงินเดือน', en: 'Payroll Run', icon: 'banknote', desc: 'คำนวณเงินได้ เงินหัก ภาษี ประกันสังคม แล้วอนุมัติปิดงวด' },
    { key: 'payslip', th: 'สลิปเงินเดือน', en: 'Payslips', icon: 'receipt', desc: 'ดูและพิมพ์สลิปเงินเดือนรายคนหรือทั้งหมด' },
    { key: 'payreports', th: 'รายงานเงินเดือน', en: 'Payroll Reports', icon: 'file', desc: 'ประกันสังคม ภ.ง.ด.1 ไฟล์โอนเงิน สรุปตามแผนก และสรุปรายปี' },
    { key: 'paysetup', th: 'ตั้งค่าเงินเดือน', en: 'Payroll Setup', icon: 'wallet', desc: 'ข้อมูลเงินเดือนพนักงาน รายการเงินได้/เงินหัก อัตราภาษีและประกันสังคม' },
  ];
  const NAV2 = [
    { key: 'settings', th: 'ตั้งค่า', en: 'Settings', icon: 'settings', desc: 'ข้อมูลบริษัท พนักงาน กฎการคำนวณ และข้อมูลระบบ' },
    { key: 'help', th: 'ช่วยเหลือ', en: 'Help', icon: 'help', desc: 'ขั้นตอนการทำงาน รูปแบบไฟล์ และกฎการคำนวณ' },
  ];
  PL.NAV = NAV.concat(NAV_PAY, NAV2);

  const App = (PL.App = {
    current: null,
    params: {},
    async init() {
      const Cloud = PL.Cloud;
      if (Cloud && Cloud.embedded) document.body.classList.add('embedded'); // เมนูซ้ายใช้ของระบบ HR รวมศูนย์แทน
      if (Cloud && Cloud.enabled) {
        if (!(await Cloud.start())) return; // หน้าเข้าสู่ระบบ / รอสิทธิ์ / ตั้งค่าครั้งแรก
        Cloud.ready();
      } else Store.load();
      this.mountChrome();
      window.addEventListener('hashchange', () => this.route());
      this.route();
      this.autoSyncHR();
      if (Store.firstRun) setTimeout(() => UI.toast('โหลดข้อมูลตัวอย่างแล้ว (ก.ย.–ต.ค. 2569) — ทดลองทำตาม 9 ขั้นตอนได้เลย', 'info', 6000), 400);
    },
    /* แอปย่อยของระบบ HR รวมศูนย์: ดึงรายชื่อพนักงาน (รหัส ชื่อ แผนก ตำแหน่ง วันเริ่มงาน) ให้ตรงกับฐานข้อมูลพนักงานของระบบหลักอัตโนมัติ
       ไม่แตะเงินเดือน/บัญชี · ทำเฉพาะผู้ที่มีสิทธิ์แก้ข้อมูลพนักงาน (ผู้ดูแล / HR) */
    async autoSyncHR() {
      const Cloud = PL.Cloud;
      if (!Cloud || !Cloud.enabled || !(Cloud.embedded || (window.PL_CONFIG && window.PL_CONFIG.hostApp)) || !Store.can('hr')) return;
      try {
        const dir = await Cloud.hruDirectory();
        if (!dir.employees.length) return;
        const s = Store.s;
        const r = Store.syncEmployees(s, dir.employees, { company: '', update: true });
        if (!r.added.length && !r.updated.length) return;
        PL.Payroll.ensure(s);
        Store.touch('config');
        PL.Payroll.touch(s);
        Store.commit('ซิงก์พนักงานจากระบบ HR', `เพิ่ม ${r.added.length} อัปเดต ${r.updated.length}`);
        UI.toast(`อัปเดตรายชื่อพนักงานจากระบบ HR: เพิ่ม ${r.added.length} คน แก้ไข ${r.updated.length} คน${r.added.length ? ' — กรอกเงินเดือนของคนใหม่ที่ ตั้งค่าเงินเดือน' : ''}`);
        this.route(true);
      } catch (e) { console.warn('auto sync HR', e); }
    },
    parseHash() {
      const h = location.hash.replace(/^#\/?/, '');
      const [path, qs] = h.split('?');
      return { key: path || 'dashboard', params: Object.fromEntries(new URLSearchParams(qs || '')) };
    },
    go(key, params) {
      const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
      const h = `#/${key}${qs}`;
      if (location.hash === h) this.route();
      else location.hash = h;
    },
    route(keepScroll) {
      const { key, params } = this.parseHash();
      if (params.pk && /^\d{4}-\d{2}$/.test(params.pk) && params.pk !== Store.s.settings.period) {
        Store.s.settings.period = params.pk;
        Store.save();
      }
      let k = PL.Views[key] ? key : 'dashboard';
      if (NAV_PAY.some((n) => n.key === k) && !Store.can('pay')) {
        UI.toast('บทบาทของคุณไม่มีสิทธิ์ดูข้อมูลเงินเดือน', 'warn');
        k = 'dashboard';
      }
      const changed = k !== this.current;
      this.current = k;
      this.params = params;
      const host = document.createElement('div');
      host.className = 'page';
      try {
        PL.Views[k].render(host, params);
      } catch (e) {
        console.error(e);
        host.innerHTML = UI.banner('bad', 'เกิดข้อผิดพลาดในการแสดงผล: ' + esc(e.message));
      }
      const y = window.scrollY;
      document.getElementById('view').replaceChildren(host);
      document.body.classList.remove('nav-open');
      if (changed && !keepScroll) window.scrollTo(0, 0);
      else window.scrollTo(0, y);
      const nav = PL.NAV.find((n) => n.key === k);
      document.title = (nav && k !== 'dashboard' ? nav.th + ' · ' : '') + 'Payroll Full Loop';
      this.refreshChrome();
    },
    rerender() {
      this.route(true);
    },

    /* ---------- chrome ---------- */
    mountChrome() {
      document.getElementById('menuBtn').innerHTML = UI.icon('menu', 22);
      document.getElementById('searchIc').innerHTML = UI.icon('search', 18, 's-ic');
      document.getElementById('periodIc').innerHTML = UI.icon('calendar', 18);
      document.getElementById('menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
      document.addEventListener('click', (e) => {
        if (document.body.classList.contains('nav-open') && !e.target.closest('.sidebar,#menuBtn')) document.body.classList.remove('nav-open');
        if (!e.target.closest('.bell-wrap')) document.getElementById('bellPop').hidden = true;
        if (!e.target.closest('.search')) document.getElementById('searchPop').hidden = true;
      });
      document.getElementById('periodSel').addEventListener('change', (e) => {
        Store.s.settings.period = e.target.value;
        Store.save();
        UI.toast(`เปลี่ยนเป็นรอบ ${U.fmtPeriod(e.target.value)}`, 'info');
        this.rerender();
      });
      document.getElementById('bellBtn').addEventListener('click', () => {
        const pop = document.getElementById('bellPop');
        pop.hidden = !pop.hidden;
        if (!pop.hidden) pop.innerHTML = this.notifHTML(this.notifications(), true);
      });
      document.getElementById('bellPop').addEventListener('click', (e) => {
        if (e.target.closest('a')) document.getElementById('bellPop').hidden = true;
      });
      this.mountSearch();
    },
    refreshChrome() {
      const s = Store.s, pk = Store.pk;
      const p = E.pipeline(s, pk);
      const st = {};
      p.steps.forEach((x) => (st[x.key] = x));
      const ps = PL.Payroll.status(s, pk);
      const payState = ps.key === 'APPROVED' ? 'done' : ['READY', 'DRAFT', 'STALE'].includes(ps.key) ? 'warn' : 'todo';
      st.payroll = { state: payState };
      st.payslip = { state: ps.key === 'APPROVED' ? 'done' : 'todo' };
      const item = (n) => {
        const step = st[n.key];
        let badge = '';
        if (n.key === 'requests' && p.pending && !p.locked) badge = `<span class="ni-badge">${p.pending}</span>`;
        if (n.key === 'incomplete' && p.inc && !p.locked) badge = `<span class="ni-badge bad">${p.inc}</span>`;
        return `<a class="nav-item ${this.current === n.key ? 'active' : ''}" href="#/${n.key}" title="${n.step ? `ขั้นตอนที่ ${n.step}: ` : ''}${esc(n.th)}">
          <span class="ni-icon">${UI.icon(n.icon, 19)}${step && step.state !== 'todo' ? `<span class="ni-dot ${step.state}"></span>` : ''}</span>
          <span class="ni-text"><span class="ni-th">${esc(n.th)}</span><span class="ni-en">(${esc(n.en)})</span></span>${badge}</a>`;
      };
      document.getElementById('nav').innerHTML =
        NAV.map(item).join('') +
        (Store.can('pay') ? '<div class="nav-sep"></div><div class="nav-group">เงินเดือน · Payroll</div>' + NAV_PAY.map(item).join('') : '') +
        '<div class="nav-sep"></div>' + NAV2.map(item).join('');
      const Cloud = Store.cloud ? PL.Cloud : null;
      document.getElementById('sideUser').innerHTML = `<span class="avatar">${esc(this.userInitials())}</span>
        <div style="min-width:0"><div class="su-name">${esc(s.user.name)}</div><div class="su-role">${esc(s.user.role)}${Cloud ? ' · ' + Cloud.statusHTML() : ''}</div></div>
        ${Cloud ? `<button class="icon-btn" data-logout title="ออกจากระบบ">${UI.icon('logout', 18)}</button>` : `<a class="icon-btn" href="#/settings" title="ตั้งค่าผู้ใช้">${UI.icon('logout', 18)}</a>`}`;
      const lo = document.querySelector('#sideUser [data-logout]');
      if (lo)
        lo.addEventListener('click', async () => {
          if (await UI.confirm('ออกจากระบบ?', { ok: 'ออกจากระบบ' })) Cloud.logout();
        });
      document.getElementById('companyName').innerHTML = `${esc(s.company.name)}`;
      // รอบเงินเดือน
      const now = U.todayStr().slice(0, 7);
      const keys = new Set(Object.keys(s.periods));
      for (let k = -12; k <= 2; k++) keys.add(U.periodShift(now, k));
      keys.add(pk);
      document.getElementById('periodSel').innerHTML = [...keys]
        .sort()
        .reverse()
        .map((k) => {
          const P = s.periods[k];
          const tag = P && P.locked ? ' 🔒' : P && P.calc ? ' •' : '';
          return `<option value="${k}" ${k === pk ? 'selected' : ''}>รอบ ${U.fmtPeriodShort(k)}${tag}</option>`;
        })
        .join('');
      const notes = this.notifications().filter((n) => n.type !== 'ok');
      document.getElementById('bellBtn').innerHTML = UI.icon('bell', 21) + (notes.length ? `<span class="dot-badge">${notes.length}</span>` : '');
    },
    userInitials() {
      const n = Store.s.user.name || '?';
      const parts = n.split(/\s+/).filter(Boolean);
      return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    },

    /* ---------- notifications ---------- */
    notifications() {
      const s = Store.s, pk = Store.pk;
      const p = E.pipeline(s, pk), P = p.P;
      const out = [];
      const ps = PL.Payroll.status(s, pk), run = ps.run;
      const pay = Store.can('pay') && {
        READY: { type: 'info', icon: 'banknote', title: 'พร้อมคำนวณเงินเดือน', sub: `ได้รับผลบันทึกเวลารอบ ${U.fmtPeriodShort(pk)} แล้ว`, link: 'payroll' },
        DRAFT: run && { type: 'warn', icon: 'banknote', title: 'เงินเดือนรออนุมัติปิดงวด', sub: `${run.rows.length} คน · สุทธิ ${U.money(run.totals.net)} บาท`, link: 'payroll', time: run.at },
        STALE: { type: 'warn', icon: 'banknote', title: 'เงินเดือนต้องคำนวณใหม่', sub: 'มีการเปลี่ยนแปลงหลังคำนวณ', link: 'payroll' },
        APPROVED: run && { type: 'ok', icon: 'receipt', title: 'ปิดงวดเงินเดือนแล้ว', sub: `จ่าย ${U.fmtDate(run.payDate)} · สุทธิ ${U.money(run.totals.net)} บาท`, link: 'payslip', time: run.approvedAt },
      }[ps.key];
      if (pay) out.push(pay);
      if (p.locked) {
        out.push({ type: 'ok', icon: 'lock', title: 'ส่งผลบันทึกเวลาให้ฝ่ายเงินเดือนแล้ว', sub: `ส่งเมื่อ ${U.fmtStamp(p.last && p.last.at)} · ข้อมูลเวลาถูกล็อก`, link: 'export', time: p.last && p.last.at });
        return out;
      }
      if (p.inc) {
        const sm = E.summary(s, pk);
        out.push({ type: 'warn', icon: 'alert', title: 'พบข้อมูลบันทึกเวลาไม่ครบถ้วน', sub: `พนักงาน ${sm.T.incEmp} คน | ${p.inc} รายการ`, link: 'incomplete', time: P.calcAt });
      }
      if (p.pending) {
        const last = p.pendingList.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
        const emp = last && Store.emp(last.e);
        out.push({ type: 'info', icon: 'info', title: `มีคำขอรออนุมัติ ${p.pending} รายการ`, sub: last && emp ? `ล่าสุด: ${emp.name} · ${E.KIND[last.kind]} ${U.fmtDate(last.date)}` : '', link: 'requests', time: last && last.createdAt });
      }
      if (P.mappedSeq && p.mapStale) out.push({ type: 'warn', icon: 'refresh', title: 'มีข้อมูลเปลี่ยนหลังโอนบันทึกเวลา', sub: 'บันทึกเวลา/ตารางกะ/การตั้งค่าเปลี่ยน — ควรโอนเทียบกะใหม่', link: 'mapping' });
      else if (P.calcSeq && p.calcStale) out.push({ type: 'warn', icon: 'calculator', title: 'ผลคำนวณไม่เป็นปัจจุบัน', sub: 'มีคำขอหรือการตั้งค่าเปลี่ยนแปลง — ควรคำนวณใหม่', link: 'calc' });
      if (p.unknown) out.push({ type: 'bad', icon: 'xCircle', title: `พบรหัสพนักงานที่ไม่รู้จัก ${p.unknown} รหัส`, sub: 'ตรวจสอบทะเบียนพนักงานหรือไฟล์ที่นำเข้า', link: 'import' });
      if (!p.punches) out.push({ type: 'warn', icon: 'import', title: 'ยังไม่มีบันทึกเวลาในรอบนี้', sub: 'เริ่มที่ขั้นตอนที่ 1 ดึงบันทึกเวลา', link: 'import' });
      if (!p.published) out.push({ type: 'warn', icon: 'calendarGrid', title: 'ยังไม่ได้ประกาศกะ', sub: p.empty ? `ยังไม่กำหนดกะ ${U.num(p.empty)} ช่อง` : 'จัดกะครบแล้ว รอประกาศ', link: 'schedule' });
      if (P.calcSeq && !p.calcStale) out.push({ type: 'ok', icon: 'check', title: 'คำนวณบันทึกเวลาเสร็จสิ้น', sub: `ประจำรอบ ${U.fmtPeriodShort(pk)}`, link: 'calc', time: P.calcAt });
      return out;
    },
    notifHTML(list, compact) {
      if (!list.length) return UI.empty('ไม่มีการแจ้งเตือน');
      const t = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const today = new Date().toDateString() === d.toDateString();
        return today ? `${U.pad(d.getHours())}:${U.pad(d.getMinutes())}` : `${d.getDate()} ${U.MON[d.getMonth()]}`;
      };
      return `<div class="notif-list">${list
        .slice(0, compact ? 8 : 5)
        .map(
          (n) => `<a class="notif n-${n.type}" href="#/${n.link}"><span class="n-ic">${UI.icon(n.icon, 16)}</span>
          <div style="min-width:0"><div class="n-title">${esc(n.title)}</div><div class="n-sub">${esc(n.sub || '')}</div></div><span class="n-time">${t(n.time)}</span></a>`
        )
        .join('')}</div>`;
    },

    /* ---------- global search (Ctrl+K) ---------- */
    mountSearch() {
      const inp = document.getElementById('gsearch'), pop = document.getElementById('searchPop');
      let items = [], active = 0;
      const render = () => {
        const q = inp.value.trim().toLowerCase();
        if (!q) {
          pop.hidden = true;
          return;
        }
        const s = Store.s;
        const emps = s.employees.filter((e) => `${e.code} ${e.card} ${e.name} ${e.dept} ${e.position}`.toLowerCase().includes(q)).slice(0, 8);
        const depts = [...new Set(s.employees.map((e) => e.dept))].filter((d) => d.toLowerCase().includes(q)).slice(0, 4);
        const pages = PL.NAV.filter((n) => `${n.th} ${n.en}`.toLowerCase().includes(q)).slice(0, 5);
        items = [
          ...emps.map((e) => ({ type: 'emp', id: e.id, html: `${UI.icon('user', 16)}<span><b>${esc(e.name)}</b> <span class="muted">${esc(e.code)}</span></span><small>${esc(e.dept)}</small>` })),
          ...depts.map((d) => ({ type: 'dept', id: d, html: `${UI.icon('users', 16)}<span>แผนก${esc(d)}</span><small>ดูรายงาน</small>` })),
          ...pages.map((n) => ({ type: 'page', id: n.key, html: `${UI.icon(n.icon, 16)}<span>${esc(n.th)}</span><small>${n.step ? 'ขั้นตอนที่ ' + n.step : esc(n.en)}</small>` })),
        ];
        active = 0;
        if (!items.length) {
          pop.innerHTML = '<div class="sp-group">ไม่พบผลลัพธ์</div>';
          pop.hidden = false;
          return;
        }
        let last = '';
        const label = { emp: 'พนักงาน (เปิดบัตรลงเวลา)', dept: 'แผนก', page: 'เมนู' };
        pop.innerHTML = items
          .map((it, i) => {
            const head = it.type !== last ? `<div class="sp-group">${label[it.type]}</div>` : '';
            last = it.type;
            return `${head}<div class="sp-item ${i === active ? 'active' : ''}" data-i="${i}">${it.html}</div>`;
          })
          .join('');
        pop.hidden = false;
      };
      const pickItem = (it) => {
        pop.hidden = true;
        inp.value = '';
        inp.blur();
        if (it.type === 'emp') UI.timecard(it.id);
        else if (it.type === 'dept') this.go('report', { view: 'summary', dept: it.id });
        else this.go(it.id);
      };
      inp.addEventListener('input', U.debounce(render, 120));
      inp.addEventListener('focus', render);
      inp.addEventListener('keydown', (e) => {
        if (pop.hidden || !items.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          pop.querySelectorAll('.sp-item').forEach((el) => el.classList.toggle('active', +el.dataset.i === active));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          pickItem(items[active]);
        } else if (e.key === 'Escape') pop.hidden = true;
      });
      pop.addEventListener('mousedown', (e) => {
        const el = e.target.closest('.sp-item');
        if (el) {
          e.preventDefault();
          pickItem(items[+el.dataset.i]);
        }
      });
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          inp.focus();
          inp.select();
        }
      });
    },

    /* ---------- ประมวลผลทั้งลูป (ขั้น 3 + 5) ---------- */
    runLoop() {
      const s = Store.s, pk = Store.pk;
      if (Store.isLocked()) return UI.toast('รอบนี้ถูกล็อกแล้ว (ส่งเงินเดือนแล้ว)', 'warn');
      const p = E.pipeline(s, pk);
      if (!p.punches) return UI.toast('ยังไม่มีบันทึกเวลาในรอบนี้ — เริ่มที่ขั้นตอนที่ 1', 'warn');
      E.mapPeriod(s, pk);
      E.calcPeriod(s, pk);
      Store.commit('ประมวลผลทั้งลูป', `โอนเทียบกะ + คำนวณ รอบ ${U.fmtPeriodShort(pk)}`);
      const v = E.validate(s, pk);
      if (!v.errors && !v.warns) UI.toast('ประมวลผลเสร็จ — พร้อมส่งข้อมูลเพื่อคำนวณเงินเดือน', 'ok', 4500);
      else UI.toast(`ประมวลผลเสร็จ — มีรายการต้องตรวจสอบ ${v.errors + v.warns} รายการ`, v.errors ? 'warn' : 'info', 4500);
      this.rerender();
    },
  });

  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);

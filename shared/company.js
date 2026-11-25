/* บริษัทที่ทำงาน (CMN / CIL) — ใช้ร่วมกันทุกแอปย่อยของระบบ HR รวมศูนย์ (/payroll/, /training/, /performance/)
   ทำงานแบบเดียวกับแอปหลัก (index.html · company-select-script) และใช้คีย์เดียวกัน:
   - sessionStorage 'hru_company' = บริษัทที่เลือกในแท็บนี้ (เลือกที่แอปหลักแล้ว ไปแอปย่อยในแท็บเดียวกัน = บริษัทเดียวกัน)
   - localStorage  'hru_company' = บริษัทล่าสุด (เลือกไว้ล่วงหน้าในหน้าต่างเลือก)
   API: window.HRUCompany = { list, get(), set(c), meta(c), ensure(), change(), mount(el), onChange(fn) }
   เปลี่ยนบริษัท → event 'hru-company-change' (detail = 'CMN' | 'CIL') ให้แอปกรองข้อมูลใหม่ */
(function () {
  'use strict';
  if (window.HRUCompany) return;
  var KEY = 'hru_company';
  var LIST = [
    { c: 'CMN', th: 'CMN', en: 'บริษัท CMN', color: '#2563eb' },
    { c: 'CIL', th: 'CIL', en: 'บริษัท CIL', color: '#0d9488' }
  ];
  var meta = function (c) { return LIST.filter(function (x) { return x.c === c; })[0] || null; };
  var ss = {
    get: function () { try { var v = sessionStorage.getItem(KEY); return meta(v) ? v : ''; } catch (e) { return ''; } },
    set: function (v) { try { sessionStorage.setItem(KEY, v); } catch (e) {} }
  };
  var last = function () { try { var v = localStorage.getItem(KEY); return meta(v) ? v : ''; } catch (e) { return ''; } };
  var chips = [];

  var css = '.hruc-chip{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;line-height:1.2;color:inherit;white-space:nowrap}'
    + '.hruc-label{display:inline-flex;align-items:center;gap:7px}'
    + '.hruc-dot{width:24px;height:24px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;color:#fff;background:var(--hruc-c,#64748b)}'
    + '.hruc-btn{font-family:inherit;font-size:12.5px;font-weight:500;line-height:1;cursor:pointer;border:1px solid rgba(100,116,139,.35);background:rgba(255,255,255,.75);color:#1e293b;border-radius:8px;padding:6px 10px;white-space:nowrap}'
    + '.hruc-btn:hover{border-color:#3b82f6}'
    + '.hruc-modal{position:fixed;inset:0;z-index:2147483000;background:rgba(5,8,15,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}'
    + '.hruc-box{background:#fff;color:#0f172a;border-radius:20px;padding:22px;width:min(420px,100%);box-shadow:0 30px 80px rgba(0,0,0,.35)}'
    + '.hruc-box h3{margin:0 0 4px;font-size:19px}.hruc-box p{margin:0 0 16px;color:#64748b;font-size:13.5px;line-height:1.5}'
    + '.hruc-pick{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    + '.hruc-opt{font-family:inherit;cursor:pointer;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;border-radius:14px;padding:14px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:14px;font-weight:700}'
    + '.hruc-opt small{font-weight:500;font-size:11.5px;color:#64748b}.hruc-opt .hruc-dot{width:36px;height:36px;font-size:12px;border-radius:10px}'
    + '.hruc-opt.on{border-color:var(--hruc-c);box-shadow:0 0 0 3px color-mix(in srgb,var(--hruc-c) 25%,transparent)}'
    + '.hruc-note{margin-top:12px;font-size:13px;color:#64748b;min-height:18px}'
    + '.hruc-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}'
    + '.hruc-act{font-family:inherit;font-size:14px;font-weight:600;line-height:1;cursor:pointer;border-radius:10px;padding:10px 16px;border:1px solid #e2e8f0;background:#fff;color:#0f172a}'
    + '.hruc-act.primary{background:#2563eb;border-color:#2563eb;color:#fff}.hruc-act:disabled{opacity:.45;cursor:not-allowed}';
  function addCss() {
    if (document.getElementById('hruc-style')) return;
    var st = document.createElement('style'); st.id = 'hruc-style'; st.textContent = css; document.head.appendChild(st);
  }

  function get() { return ss.get(); }
  function set(c) {
    if (!meta(c)) return;
    var before = ss.get();
    ss.set(c); try { localStorage.setItem(KEY, c); } catch (e) {}
    renderChips();
    if (before !== c) window.dispatchEvent(new CustomEvent('hru-company-change', { detail: c }));
  }

  function renderChips() {
    var m = meta(get());
    chips.forEach(function (ch) {
      ch.style.setProperty('--hruc-c', m ? m.color : '#64748b');
      ch.firstChild.innerHTML = m ? '<span class="hruc-dot">' + m.c + '</span>บริษัท ' + m.c : '<span class="hruc-dot">?</span>ยังไม่ได้เลือกบริษัท';
    });
  }

  /* หน้าต่างเลือกบริษัท: required = ต้องเลือกก่อนใช้งาน (ปิดไม่ได้) · ไม่ required = เปลี่ยนบริษัท (ต้องกดยืนยัน) */
  function dialog(required) {
    if (document.querySelector('.hruc-modal')) return;
    addCss();
    var now = required ? '' : get(), pick = required ? (get() || last()) : now;
    var m = document.createElement('div'); m.className = 'hruc-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="hruc-box">'
      + (required ? '<h3>เลือกบริษัทที่จะทำงาน</h3><p>ข้อมูลในแอปนี้จะแสดงเฉพาะบริษัทที่เลือก — เปลี่ยนภายหลังได้ที่ปุ่ม "เปลี่ยนบริษัท"</p>'
        : '<h3>เปลี่ยนบริษัท</h3><p>ตอนนี้กำลังทำงานที่ <b>บริษัท ' + now + '</b> — เลือกบริษัทที่ต้องการ แล้วกดยืนยัน</p>')
      + '<div class="hruc-pick">' + LIST.map(function (x) {
          return '<button type="button" class="hruc-opt' + (x.c === pick ? ' on' : '') + '" data-c="' + x.c + '" style="--hruc-c:' + x.color + '"><span class="hruc-dot">' + x.c + '</span>' + x.th + '<small>' + x.en + '</small></button>';
        }).join('') + '</div><div class="hruc-note"></div>'
      + '<div class="hruc-actions">' + (required ? '' : '<button type="button" class="hruc-act" data-x="cancel">ยกเลิก</button>')
      + '<button type="button" class="hruc-act primary" data-x="ok">' + (required ? 'เข้าใช้งาน' : 'ยืนยันเปลี่ยนบริษัท') + '</button></div></div>';
    document.body.appendChild(m);
    var ok = m.querySelector('[data-x="ok"]'), note = m.querySelector('.hruc-note');
    var refresh = function () {
      ok.disabled = !pick || (!required && pick === now);
      note.textContent = !pick ? 'กรุณาเลือกบริษัท' : (!required && pick === now ? 'เป็นบริษัทที่ใช้อยู่แล้ว' : 'ข้อมูลจะแสดงเฉพาะบริษัท ' + pick);
    };
    var close = function () { document.removeEventListener('keydown', onKey); m.remove(); };
    var onKey = function (e) { if (e.key === 'Escape' && !required) close(); };
    document.addEventListener('keydown', onKey);
    [].forEach.call(m.querySelectorAll('.hruc-opt'), function (b) {
      b.addEventListener('click', function () {
        [].forEach.call(m.querySelectorAll('.hruc-opt'), function (x) { x.classList.toggle('on', x === b); });
        pick = b.dataset.c; refresh();
      });
    });
    if (!required) {
      m.querySelector('[data-x="cancel"]').onclick = close;
      m.addEventListener('click', function (e) { if (e.target === m) close(); });
    }
    ok.onclick = function () { if (ok.disabled) return; close(); set(pick); };
    refresh();
  }

  window.HRUCompany = {
    list: LIST,
    meta: meta,
    get: get,
    set: set,
    /** เรียกเมื่อรู้แล้วว่าล็อกอินอยู่: ยังไม่ได้เลือกบริษัทในแท็บนี้ → หน้าต่างให้เลือก */
    ensure: function () { if (!get()) dialog(true); },
    change: function () { if (!get()) dialog(true); else dialog(false); },
    /** ใส่ป้ายบริษัท + ปุ่มเปลี่ยนบริษัท ลงใน element */
    mount: function (el) {
      if (!el || el.querySelector('.hruc-chip')) return;
      addCss();
      var ch = document.createElement('span'); ch.className = 'hruc-chip';
      ch.appendChild(document.createElement('span')).className = 'hruc-label';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'hruc-btn'; b.textContent = '⇄ เปลี่ยนบริษัท';
      b.onclick = function () { window.HRUCompany.change(); };
      ch.appendChild(b); el.appendChild(ch); chips.push(ch); renderChips();
    },
    onChange: function (fn) {
      var h = function (e) { fn(e.detail); };
      window.addEventListener('hru-company-change', h);
      return function () { window.removeEventListener('hru-company-change', h); };
    }
  };
})();

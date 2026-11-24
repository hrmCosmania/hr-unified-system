/* Payroll Full Loop — ฟังก์ชันช่วยทั่วไป (วันที่ เวลา รูปแบบตัวเลข CSV) */
(function (g) {
  'use strict';
  const PL = (g.PL = g.PL || {});

  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  // วันที่ 'YYYY-MM-DD' <-> เลขวัน (นับจาก 1970-01-01, ไม่ขึ้นกับ timezone)
  const dnum = (d) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5);
  const dstr = (n) => {
    const x = new Date(n * 864e5);
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  };

  const U = (PL.U = {
    pad, MONTHS, MON, DOW, DOW_FULL, dnum, dstr,

    addDays: (d, k) => dstr(dnum(d) + k),
    dow: (d) => (((dnum(d) + 4) % 7) + 7) % 7, // 1970-01-01 = วันพฤหัสบดี
    daysBetween(a, b) {
      const out = [];
      for (let n = dnum(a), e = dnum(b); n <= e; n++) out.push(dstr(n));
      return out;
    },

    // วันเวลา 'YYYY-MM-DD HH:MM' <-> นาทีสัมบูรณ์
    tmin: (t) => dnum(t) * 1440 + +t.slice(11, 13) * 60 + +t.slice(14, 16),
    tstr: (m) => `${dstr(Math.floor(m / 1440))} ${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`,
    hm: (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5),
    hmStr(m) {
      m = ((Math.round(m) % 1440) + 1440) % 1440;
      return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    },
    clock: (m) => (m == null ? '' : U.hmStr(m)),
    overlap: (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1)),

    // รอบเงินเดือน: pk = 'YYYY-MM' ; cutoff = 0 (ตามเดือนปฏิทิน) หรือวันตัดรอบ 1–28
    periodRange(pk, cutoff) {
      const y = +pk.slice(0, 4), m = +pk.slice(5, 7);
      let start, end;
      if (!cutoff) {
        start = `${y}-${pad(m)}-01`;
        const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
        end = dstr(dnum(`${ny}-${pad(nm)}-01`) - 1);
      } else {
        const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
        start = dstr(dnum(`${py}-${pad(pm)}-${pad(cutoff)}`) + 1);
        end = `${y}-${pad(m)}-${pad(cutoff)}`;
      }
      return { pk, start, end, days: U.daysBetween(start, end) };
    },
    periodOf(d, cutoff) {
      if (!cutoff || +d.slice(8, 10) <= cutoff) return d.slice(0, 7);
      return U.periodShift(d.slice(0, 7), 1);
    },
    periodShift(pk, k) {
      let y = +pk.slice(0, 4), m = +pk.slice(5, 7) - 1 + k;
      y += Math.floor(m / 12);
      m = ((m % 12) + 12) % 12;
      return `${y}-${pad(m + 1)}`;
    },

    // การแสดงผลแบบไทย (พ.ศ.)
    fmtPeriod: (pk) => `${MONTHS[+pk.slice(5, 7) - 1]} ${+pk.slice(0, 4) + 543}`,
    fmtPeriodShort: (pk) => `${MON[+pk.slice(5, 7) - 1]} ${+pk.slice(0, 4) + 543}`,
    fmtDate(d, withDow) {
      if (!d) return '';
      const s = `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${+d.slice(0, 4) + 543}`;
      return withDow ? `${DOW[U.dow(d)]} ${s}` : s;
    },
    fmtDay: (d) => `${DOW[U.dow(d)]} ${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}`,
    fmtDateNum: (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${+d.slice(0, 4) + 543}` : ''),
    fmtDT: (t) => (t ? `${U.fmtDate(t.slice(0, 10))} ${t.slice(11, 16)}` : ''),
    fmtStamp(iso) {
      if (!iso) return '';
      const x = new Date(iso);
      return `${x.getDate()} ${MON[x.getMonth()]} ${x.getFullYear() + 543} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
    },
    // ระยะเวลาเป็นนาที -> 'ชม:นาที'
    dur: (min) => (!min ? '' : `${Math.floor(min / 60)}:${pad(Math.round(min % 60))}`),
    hrs: (min, dp = 2) => U.num((min || 0) / 60, dp),
    num(n, dp = 0) {
      return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    },
    money: (n) => U.num(n, 2),
    r2: (n) => Math.round((n + Number.EPSILON) * 100) / 100,

    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    normCode: (c) => String(c == null ? '' : c).trim().toUpperCase(),

    // เลขประจำตัวประชาชน / ผู้เสียภาษี 13 หลัก: หลักสุดท้าย = (11 − Σ dᵢ × (13 − i) mod 11) mod 10
    taxIdDigit(first12) {
      const d = String(first12).replace(/\D/g, '');
      if (d.length !== 12) return null;
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += +d[i] * (13 - i);
      return (11 - (sum % 11)) % 10;
    },
    taxIdValid(id) {
      const d = String(id == null ? '' : id).replace(/\D/g, '');
      return d.length === 13 && U.taxIdDigit(d.slice(0, 12)) === +d[12];
    },
    // ข้อความแจ้งปัญหาเลข 13 หลัก ('' = ถูกต้อง)
    taxIdError(id) {
      const d = String(id == null ? '' : id).replace(/\D/g, '');
      if (!d) return '';
      if (d.length !== 13) return `ต้องมี 13 หลัก (กรอก ${d.length} หลัก)`;
      return U.taxIdValid(d) ? '' : `หลักตรวจสอบไม่ถูกต้อง (หลักสุดท้ายควรเป็น ${U.taxIdDigit(d.slice(0, 12))})`;
    },
    fmtTaxId: (id) => {
      const d = String(id || '').replace(/\D/g, '');
      return d.length === 13 ? `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}` : String(id || '');
    },

    csv(headers, rows) {
      const q = (v) => {
        const s = String(v == null ? '' : v);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      return '﻿' + [headers, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
    },
    download(name, content, mime = 'text/csv;charset=utf-8') {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    },

    // ตัวสุ่มแบบกำหนด seed (ใช้สร้างข้อมูลตัวอย่างให้ได้ผลเหมือนเดิมทุกครั้ง)
    rng(seed) {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    todayStr() {
      const x = new Date();
      return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    },
    nowISO: () => new Date().toISOString(),
    debounce(fn, ms = 200) {
      let t;
      return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
      };
    },
    initials(name) {
      const s = String(name || '').replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').trim();
      return s.slice(0, 1) || '?';
    },
    sum: (arr, f) => arr.reduce((t, x) => t + (+f(x) || 0), 0),
    readFile(file) {
      return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(fr.error);
        fr.readAsText(file);
      });
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);

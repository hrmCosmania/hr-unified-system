/* Payroll Full Loop — เอนจินคำนวณ (ไม่มี DOM: ทดสอบด้วย Node ได้)
 *  - โอนบันทึกเวลาเทียบกะ (mapping)
 *  - คำนวณบันทึกเวลา (สาย/กลับก่อน/ขาด/ลา/OT)
 *  - สรุปผลรายพนักงาน และข้อมูลส่งเงินเดือน
 *  - สถานะของแต่ละขั้นตอน (pipeline) และการตรวจสอบก่อนส่ง
 */
(function (g) {
  'use strict';
  const PL = (g.PL = g.PL || {});
  const U = PL.U;

  const STATUS = {
    NORMAL: { label: 'ปกติ', cls: 'ok' },
    LATE: { label: 'มาสาย', cls: 'warn' },
    EARLY: { label: 'กลับก่อน', cls: 'warn' },
    LATE_EARLY: { label: 'สาย/กลับก่อน', cls: 'warn' },
    HALF_LEAVE: { label: 'ลาครึ่งวัน', cls: 'info' },
    LEAVE: { label: 'ลา', cls: 'info' },
    ABSENT: { label: 'ขาดงาน', cls: 'bad' },
    INCOMPLETE: { label: 'ไม่สมบูรณ์', cls: 'orange' },
    OFF: { label: 'วันหยุด', cls: 'off' },
    HOLIDAY: { label: 'นักขัตฤกษ์', cls: 'hol' },
    HOLIDAY_WORK: { label: 'ทำงานวันหยุด', cls: 'purple' },
    NO_SHIFT: { label: 'ไม่มีกะ', cls: 'orange' },
  };
  const MAP_STATUS = {
    OK: { label: 'ครบเข้า-ออก', cls: 'ok' },
    MISS_IN: { label: 'ไม่มีขาเข้า', cls: 'orange' },
    MISS_OUT: { label: 'ไม่มีขาออก', cls: 'orange' },
    NO_PUNCH: { label: 'ไม่มีบันทึก', cls: 'bad' },
    OFF_WORK: { label: 'วันหยุด-มาทำงาน', cls: 'purple' },
    OFF_PARTIAL: { label: 'วันหยุด-สแกนครั้งเดียว', cls: 'warn' },
    OFF: { label: 'วันหยุด', cls: 'off' },
    NO_SHIFT: { label: 'ไม่มีกะ', cls: 'orange' },
  };
  const PATTERNS = {
    OFFICE5: 'จันทร์–ศุกร์ (หยุด เสาร์–อาทิตย์)',
    SIX: 'จันทร์–เสาร์ (หยุด อาทิตย์)',
    ROTATE: 'หมุนเวียนกะเช้า/กะดึก รายสัปดาห์ (หยุด อาทิตย์)',
  };
  const LEAVE_PART = { FULL: 'เต็มวัน', AM: 'ครึ่งวันเช้า', PM: 'ครึ่งวันบ่าย' };
  const REQ_STATUS = {
    PENDING: { label: 'รออนุมัติ', cls: 'warn' },
    APPROVED: { label: 'อนุมัติ', cls: 'ok' },
    REJECTED: { label: 'ไม่อนุมัติ', cls: 'bad' },
  };
  const KIND = { LEAVE: 'คำขอลา', OT: 'คำขอล่วงเวลา (OT)', ADJ: 'คำขอแก้ไขเวลา' };
  const KIND_PREFIX = { LEAVE: 'LV', OT: 'OT', ADJ: 'AJ' };
  const DAY_TYPE = { WORK: 'วันทำงาน', OFF: 'วันหยุดประจำสัปดาห์', HOLIDAY: 'วันหยุดนักขัตฤกษ์', NONE: 'ไม่มีกะ' };

  const E = (PL.Engine = { STATUS, MAP_STATUS, PATTERNS, LEAVE_PART, REQ_STATUS, KIND, KIND_PREFIX, DAY_TYPE, _cache: {} });

  /* ---------------- state helpers ---------------- */
  E.bump = (s) => ++s.seq;
  E.P = (s, pk) =>
    s.periods[pk] ||
    (s.periods[pk] = { stamps: {}, mappedSeq: 0, calcSeq: 0, publishedSeq: 0, transfers: [], locked: false, mapping: null, calc: null, mapStats: null });
  E.range = (s, pk) => U.periodRange(pk || s.settings.period, s.settings.cutoffDay);
  E.periodOf = (s, d) => U.periodOf(d, s.settings.cutoffDay);

  /* ---------------- สภาพการจ้าง (วันเริ่มงาน / วันพ้นสภาพ / ประวัติอัตราค่าจ้าง) ---------------- */
  // emp.start = วันเริ่มงาน, emp.end = วันทำงานวันสุดท้าย (พ้นสภาพวันถัดไป)
  E.employed = (emp, d) => (!emp.start || d >= emp.start) && (!emp.end || d <= emp.end);
  // ต้องประมวลผลในงวดนี้หรือไม่: ยังทำงานอยู่ หรือพ้นสภาพระหว่าง/หลังงวด และเริ่มงานก่อนสิ้นงวด
  E.activeIn = (emp, R) => {
    if (emp.start && emp.start > R.end) return false;
    if (emp.end) return emp.end >= R.start;
    return emp.active !== false;
  };
  E.empDays = (emp, R) => R.days.filter((d) => E.employed(emp, d));
  // อัตราค่าจ้าง ณ วันที่ d จาก emp.rates = [{ from, old, salary, at }] (emp.salary = อัตราปัจจุบัน)
  E.rateOn = (emp, d) => {
    const h = (emp.rates || []).slice().sort((a, b) => a.from.localeCompare(b.from));
    if (!h.length) return +emp.salary || 0;
    let v = +h[0].old || 0;
    for (const x of h) if (x.from <= d) v = +x.salary || 0;
    return v;
  };
  // บันทึกว่าข้อมูลประเภทใดเปลี่ยน เพื่อรู้ว่าขั้นตอนไหนต้องทำซ้ำ (kind: punches | roster | requests | config)
  E.touch = (s, kind, dates) => {
    const seq = E.bump(s);
    const pks = dates && dates.length ? [...new Set(dates.map((d) => E.periodOf(s, d)))] : [...new Set(Object.keys(s.periods).concat(s.settings.period))];
    pks.forEach((pk) => (E.P(s, pk).stamps[kind] = seq));
  };
  E.nextId = (s, kind) => {
    const p = KIND_PREFIX[kind] || kind;
    s.counters[p] = (s.counters[p] || 0) + 1;
    return `${p}-${U.pad(s.counters[p], 4)}`;
  };

  E.idx = (s) => {
    const shifts = {};
    s.shifts.forEach((x) => (shifts[x.code] = x));
    const emps = {};
    const byCode = {};
    s.employees.forEach((e) => {
      emps[e.id] = e;
      [e.code, e.card].forEach((c) => {
        const k = U.normCode(c);
        if (!k) return;
        byCode[k] = e.id;
        if (/^\d+$/.test(k)) byCode[String(+k)] = e.id;
      });
    });
    const hol = {};
    s.holidays.forEach((h) => (hol[h.date] = h.name));
    const leaveTypes = {};
    s.leaveTypes.forEach((l) => (leaveTypes[l.code] = l));
    return { shifts, emps, byCode, hol, leaveTypes };
  };
  E.resolveCode = (ix, c) => {
    const k = U.normCode(c);
    return ix.byCode[k] || (/^\d+$/.test(k) ? ix.byCode[String(+k)] : null) || null;
  };

  // เวลาตามกะของวัน d เป็นนาทีสัมบูรณ์ (รองรับกะข้ามเที่ยงคืน)
  E.plan = (sh, d) => {
    if (!sh || !sh.start || !sh.end) return null;
    const base = U.dnum(d) * 1440;
    const ps = base + U.hm(sh.start);
    let pe = base + U.hm(sh.end);
    if (pe <= ps) pe += 1440;
    let bs = null, be = null;
    if (sh.brS && sh.brE) {
      bs = base + U.hm(sh.brS);
      if (bs < ps) bs += 1440;
      be = base + U.hm(sh.brE);
      if (be <= bs) be += 1440;
    }
    return { ps, pe, bs, be };
  };
  E.shiftHours = (sh) => {
    const p = E.plan(sh, '2000-01-01');
    if (!p) return 0;
    return p.pe - p.ps - (p.bs != null ? U.overlap(p.ps, p.pe, p.bs, p.be) : 0);
  };
  E.defaultWorkShift = (s, ix, emp) => ix.shifts[emp.shift] || s.shifts.find((x) => (x.type || 'WORK') === 'WORK');

  E.dayInfo = (s, ix, emp, d) => {
    const code = s.roster[emp.id + '|' + d] || '';
    const sh = code ? ix.shifts[code] : null;
    const type = sh ? sh.type || 'WORK' : 'NONE';
    const ref = type === 'WORK' ? sh : E.defaultWorkShift(s, ix, emp);
    return { code, type, sh, ref, plan: E.plan(ref, d) };
  };

  /* ---------------- ประกาศกะตามรูปแบบ ---------------- */
  E.patternCode = (ix, emp, d, pattern) => {
    if (ix.hol[d] && ix.shifts.HOL) return 'HOL';
    const dw = U.dow(d);
    const p = pattern || emp.pattern || 'SIX';
    const work = ix.shifts[emp.shift] ? emp.shift : Object.keys(ix.shifts).find((c) => (ix.shifts[c].type || 'WORK') === 'WORK');
    if (p === 'OFFICE5') return dw === 0 || dw === 6 ? 'OFF' : work;
    if (p === 'ROTATE') {
      if (dw === 0) return 'OFF';
      const wk = Math.floor((U.dnum(d) - 4) / 7); // สัปดาห์เริ่มวันจันทร์
      const teamA = (emp.team || 'A') === 'A';
      const day = ix.shifts.D ? 'D' : work, night = ix.shifts.N ? 'N' : work;
      return wk % 2 === 0 === teamA ? day : night;
    }
    return dw === 0 ? 'OFF' : work; // SIX
  };
  E.applyPattern = (s, empIds, days, pattern, overwrite = true) => {
    const ix = E.idx(s);
    let n = 0;
    for (const id of empIds) {
      const emp = ix.emps[id];
      if (!emp) continue;
      for (const d of days) {
        const k = id + '|' + d;
        if (!overwrite && s.roster[k]) continue;
        s.roster[k] = E.patternCode(ix, emp, d, pattern);
        n++;
      }
    }
    return n;
  };

  /* ---------------- ขั้นตอนที่ 1: แปลงไฟล์บันทึกเวลา ---------------- */
  // รองรับ: รหัส,YYYY-MM-DD,HH:MM[:SS] | รหัส,DD/MM/YYYY(พ.ศ./ค.ศ.),HH:MM | รหัส<TAB>YYYY-MM-DD HH:MM:SS (attlog)
  E.parsePunchText = (text) => {
    const rows = [];
    const errors = [];
    const lines = String(text || '').split(/\r?\n/);
    const reISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/;
    const reDMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
    const reT = /^(\d{1,2})[:.](\d{2})(?::\d{2})?$/;
    lines.forEach((line, i) => {
      const raw = line.trim();
      if (!raw) return;
      const toks = raw
        .split(/[,\t;|]+|\s+/)
        .map((t) => t.replace(/^"|"$/g, '').trim())
        .filter(Boolean);
      let date = null, time = null, code = null;
      for (let j = 0; j < toks.length; j++) {
        const t = toks[j];
        let m;
        if (!date && (m = t.match(reISO))) {
          date = [+m[1], +m[2], +m[3]];
          if (m[4] != null) time = [+m[4], +m[5]];
          continue;
        }
        if (!date && (m = t.match(reDMY))) {
          date = [+m[3], +m[2], +m[1]];
          continue;
        }
        if (date && !time && (m = t.match(reT))) {
          time = [+m[1], +m[2]];
          continue;
        }
        if (!code && !date) code = t;
      }
      if (!code || !date || !time) {
        if (i === 0) return; // แถวหัวตาราง
        errors.push({ line: i + 1, text: raw.slice(0, 80) });
        return;
      }
      let [y, mo, d] = date;
      if (y > 2400) y -= 543;
      const [h, mi] = time;
      if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) {
        errors.push({ line: i + 1, text: raw.slice(0, 80) });
        return;
      }
      rows.push({ c: U.normCode(code), t: `${y}-${U.pad(mo)}-${U.pad(d)} ${U.pad(h)}:${U.pad(mi)}` });
    });
    return { rows, errors };
  };

  /* ---------------- ขั้นตอนที่ 3: โอนบันทึกเวลาเทียบกะ ---------------- */
  E.runMapping = (s, pk) => {
    const S = s.settings, ix = E.idx(s), R = E.range(s, pk);
    const ext0 = U.addDays(R.start, -1), ext1 = U.addDays(R.end, 1);
    const lo = U.dnum(ext0) * 1440, hi = (U.dnum(ext1) + 2) * 1440;
    const pStart = U.dnum(R.start) * 1440, pEnd = (U.dnum(R.end) + 1) * 1440;
    const byEmp = {};
    const unknown = {};
    for (const p of s.punches) {
      const m = U.tmin(p.t);
      if (m < lo || m >= hi) continue;
      const id = E.resolveCode(ix, p.c);
      if (!id) {
        if (m >= pStart && m < pEnd) unknown[p.c] = (unknown[p.c] || 0) + 1;
        continue;
      }
      (byEmp[id] || (byEmp[id] = [])).push(m);
    }
    const rows = [];
    const orphans = [];
    const extDays = [ext0, ...R.days, ext1];
    for (const emp of s.employees) {
      if (!E.activeIn(emp, R)) continue;
      const sorted = (byEmp[emp.id] || []).sort((a, b) => a - b);
      const pun = [];
      for (const m of sorted) if (!pun.length || m - pun[pun.length - 1] > (S.dupMinutes || 0)) pun.push(m);

      const info = extDays.map((d) => {
        const di = E.dayInfo(s, ix, emp, d);
        const work = di.type === 'WORK';
        let ws, we;
        if (work) {
          ws = di.plan.ps - S.mapBefore;
          we = di.plan.pe + S.mapAfter;
        } else {
          ws = U.dnum(d) * 1440 + 240; // วันหยุด: 04:00 ถึง 04:00 วันถัดไป
          we = ws + 1440;
        }
        return { d, di, work, ws, we };
      });
      // แก้ช่วงเวลาที่ซ้อนกันระหว่างวันติดกัน
      // แบ่งที่จุดกึ่งกลางระหว่างเวลาเลิกกะวันก่อนกับเวลาเข้ากะวันถัดไป (วันหยุดใช้กะประจำเป็นตัวอ้างอิง)
      for (let k = 0; k < info.length - 1; k++) {
        const a = info[k], b = info[k + 1];
        if (a.we <= b.ws) continue;
        const pa = a.di.plan, pb = b.di.plan;
        let m;
        if (pa && pb && pb.ps > pa.pe) m = Math.floor((pa.pe + pb.ps) / 2);
        else if (a.work && !b.work) m = a.we;
        else if (!a.work && b.work) m = b.ws;
        else m = pb ? pb.ps - 1 : b.ws;
        // วันหยุด/ยังไม่มีกะ ต่อจากวันทำงาน: รับสแกนไปก็ต่อเมื่อเป็นคู่เข้า-ออกที่ครบ
        // ไม่เช่นนั้นถือเป็นเวลาออกของวันทำงาน (เช่น กะดึกทำ OT ถึงเช้า)
        if (a.work && !b.work) {
          if (b.di.type === 'NONE') m = a.we;
          else {
            const inB = pun.filter((x) => x >= m && x < b.we);
            if (!(inB.length >= 2 && inB[inB.length - 1] - inB[0] >= S.minPairGap)) m = a.we;
          }
        }
        m = Math.max(b.ws, Math.min(a.we, m));
        a.we = m;
        b.ws = m;
      }
      const used = new Uint8Array(pun.length);
      for (let k = 0; k < info.length; k++) {
        const it = info[k];
        const arr = [];
        for (let i = 0; i < pun.length; i++) {
          if (pun[i] >= it.ws && pun[i] < it.we) {
            arr.push(pun[i]);
            used[i] = 1;
          }
        }
        if (k === 0 || k === info.length - 1) continue; // วันนอกรอบ ใช้กันเวลาไม่ให้ถูกจับผิดวันเท่านั้น
        if (!E.employed(emp, it.d)) continue; // ก่อนเริ่มงาน / หลังพ้นสภาพ: ไม่นับเป็นวันทำงานหรือขาดงาน
        const { di } = it;
        const pl = di.plan;
        let inM = null, outM = null;
        if (arr.length) {
          const f = arr[0], l = arr[arr.length - 1];
          if (arr.length >= 2 && l - f >= S.minPairGap) {
            inM = f;
            outM = l;
          } else if (pl) {
            if (Math.abs(f - pl.ps) <= Math.abs(l - pl.pe)) inM = f;
            else outM = l;
          } else inM = f;
        }
        let st;
        if (di.type === 'NONE') st = 'NO_SHIFT';
        else if (it.work) st = inM != null && outM != null ? 'OK' : inM != null ? 'MISS_OUT' : outM != null ? 'MISS_IN' : 'NO_PUNCH';
        else st = inM != null && outM != null ? 'OFF_WORK' : inM != null || outM != null ? 'OFF_PARTIAL' : 'OFF';
        rows.push({
          e: emp.id, d: it.d, code: di.code, type: di.type,
          ps: pl ? pl.ps : null, pe: pl ? pl.pe : null, bs: pl ? pl.bs : null, be: pl ? pl.be : null,
          in: inM, out: outM, n: arr.length, p: arr, st,
        });
      }
      for (let i = 0; i < pun.length; i++) if (!used[i] && pun[i] >= pStart && pun[i] < pEnd) orphans.push({ e: emp.id, t: U.tstr(pun[i]) });
    }
    const counts = {};
    rows.forEach((r) => (counts[r.st] = (counts[r.st] || 0) + 1));
    return { rows, stats: { counts, unknown, unknownCount: Object.keys(unknown).length, orphans: orphans.slice(0, 500), orphanCount: orphans.length } };
  };
  E.mapPeriod = (s, pk) => {
    const res = E.runMapping(s, pk);
    const P = E.P(s, pk);
    P.mapping = res.rows;
    P.mapStats = res.stats;
    P.mappedSeq = E.bump(s);
    P.mappedAt = U.nowISO();
    return res;
  };

  /* ---------------- คำขอ ---------------- */
  E.reqDates = (r) => (r.kind === 'LEAVE' ? U.daysBetween(r.date, r.dateTo && r.dateTo >= r.date ? r.dateTo : r.date) : [r.date]);
  E.reqIndex = (s) => {
    const I = { LEAVE: {}, OT: {}, ADJ: {}, pending: {} };
    for (const r of s.requests) {
      if (r.status === 'REJECTED') continue;
      for (const d of E.reqDates(r)) {
        const k = r.e + '|' + d;
        const bucket = r.status === 'APPROVED' ? I[r.kind] : I.pending;
        (bucket[k] || (bucket[k] = [])).push(r);
      }
    }
    return I;
  };
  E.reqInPeriod = (s, r, pk) => {
    const R = E.range(s, pk);
    const a = r.date, b = r.kind === 'LEAVE' && r.dateTo ? r.dateTo : r.date;
    return a <= R.end && b >= R.start;
  };
  // จำนวนวันลา (นับเฉพาะวันทำงานตามกะ; ถ้ายังไม่มีกะ นับ จ.–ส.)
  E.leaveDays = (s, r, ix) => {
    ix = ix || E.idx(s);
    const days = E.reqDates(r);
    let n = 0;
    for (const d of days) {
      const code = s.roster[r.e + '|' + d];
      const sh = code && ix.shifts[code];
      const work = sh ? (sh.type || 'WORK') === 'WORK' : U.dow(d) !== 0;
      if (work) n += days.length === 1 && r.part && r.part !== 'FULL' ? 0.5 : 1;
    }
    return n;
  };
  E.leaveUsed = (s, empId, year, type, excludeId) => {
    const ix = E.idx(s);
    let n = 0;
    for (const r of s.requests) {
      if (r.kind !== 'LEAVE' || r.e !== empId || r.leaveType !== type || r.status === 'REJECTED' || r.id === excludeId) continue;
      if (r.date.slice(0, 4) !== String(year)) continue;
      n += E.leaveDays(s, r, ix);
    }
    return n;
  };
  E.otMinutes = (r, plan) => {
    const a = U.tmin(r.otStart), b = U.tmin(r.otEnd);
    return Math.max(0, b - a - (plan ? U.overlap(a, b, plan.ps, plan.pe) : 0));
  };

  /* ---------------- ขั้นตอนที่ 5: คำนวณบันทึกเวลา ---------------- */
  E.runCalc = (s, pk) => {
    const S = s.settings, ix = E.idx(s), P = E.P(s, pk);
    const RI = E.reqIndex(s);
    const block = Math.max(1, +S.otRoundBlock || 1);
    const roundOT = (m) => {
      m = Math.floor(m / block) * block;
      return m >= (+S.otMinMinutes || 0) ? m : 0;
    };
    const rows = [];
    for (const m of P.mapping || []) {
      const emp = ix.emps[m.e];
      if (!emp) continue;
      const k = m.e + '|' + m.d;
      const sh = ix.shifts[m.code];
      const r = {
        e: m.e, d: m.d, code: m.code, type: m.type, ps: m.ps, pe: m.pe, in: m.in, out: m.out,
        adj: '', st: '', late: 0, early: 0, work: 0, absent: 0, leave: 0, lt: '', lpart: '',
        ot1: 0, ot15: 0, ot2: 0, ot3: 0, inc: '', notes: [], pend: (RI.pending[k] || []).length,
      };
      for (const a of RI.ADJ[k] || []) {
        if (a.adjIn) r.in = U.tmin(a.adjIn);
        if (a.adjOut) r.out = U.tmin(a.adjOut);
        if (a.adjIn || a.adjOut) r.adj = a.id;
      }
      if (r.adj) r.notes.push(`แก้ไขเวลาตามคำขอ ${r.adj}`);
      const lv = RI.LEAVE[k];
      let frac = 0, part = '';
      if (lv && m.type === 'WORK') {
        const parts = new Set(lv.map((x) => (x.dateTo && x.dateTo !== x.date ? 'FULL' : x.part || 'FULL')));
        frac = parts.has('FULL') || (parts.has('AM') && parts.has('PM')) ? 1 : 0.5;
        part = frac === 1 ? 'FULL' : [...parts][0];
        r.leave = frac;
        r.lt = lv[0].leaveType;
        r.lpart = part;
      }
      const ots = RI.OT[k] || [];
      const inM = r.in, outM = r.out;

      if (m.type === 'NONE') {
        r.st = 'NO_SHIFT';
        r.notes.push('ยังไม่ได้กำหนดกะในวันนี้');
      } else if (m.type === 'WORK') {
        const grace = sh && sh.grace != null && sh.grace !== '' ? +sh.grace : 0;
        const hasBr = m.bs != null && m.be != null;
        let es = m.ps, ee = m.pe;
        if (frac === 0.5) {
          const mid = m.ps + Math.round((m.pe - m.ps) / 2);
          if (part === 'AM') es = hasBr ? m.be : mid;
          else ee = hasBr ? m.bs : mid;
        }
        if (frac === 1) r.st = 'LEAVE';
        else if (inM == null && outM == null) {
          r.absent = 1 - frac;
          r.st = 'ABSENT';
        } else {
          if (inM != null && inM - es > grace) r.late = inM - es;
          if (outM != null && ee - outM > 0) r.early = ee - outM;
          if (inM == null || outM == null) {
            r.inc = inM == null ? 'IN' : 'OUT';
            r.st = 'INCOMPLETE';
          } else {
            r.work = Math.max(0, U.overlap(inM, outM, es, ee) - (hasBr ? U.overlap(inM, outM, Math.max(m.bs, es), Math.min(m.be, ee)) : 0));
            r.st = r.late && r.early ? 'LATE_EARLY' : r.late ? 'LATE' : r.early ? 'EARLY' : frac ? 'HALF_LEAVE' : 'NORMAL';
            let ot = 0;
            if (S.otRequireApproval) {
              let asked = 0;
              for (const o of ots) {
                const a = Math.max(inM, U.tmin(o.otStart)), b = Math.min(outM, U.tmin(o.otEnd));
                if (b > a) ot += b - a - U.overlap(a, b, m.ps, m.pe);
                asked += E.otMinutes(o, m);
              }
              if (ots.length && roundOT(ot) < roundOT(asked)) r.notes.push(`OT ตามเวลาจริง ${U.dur(roundOT(ot)) || '0:00'} จากที่ขอ ${U.dur(asked)} ชม.`);
              if (!ots.length && outM - m.pe >= 60) r.notes.push(`อยู่เกินเวลา ${U.dur(outM - m.pe)} ชม. แต่ไม่มีคำขอ OT ที่อนุมัติ`);
            } else ot = Math.max(0, outM - m.pe);
            r.ot15 = roundOT(ot);
          }
        }
      } else {
        // วันหยุดประจำสัปดาห์ / นักขัตฤกษ์
        if (inM != null && outM != null) {
          let segs = [];
          if (S.otRequireApproval) {
            for (const o of ots) {
              const a = Math.max(inM, U.tmin(o.otStart)), b = Math.min(outM, U.tmin(o.otEnd));
              if (b > a) segs.push([a, b]);
            }
            if (!ots.length) r.notes.push('มาทำงานวันหยุดแต่ไม่มีคำขอ OT ที่อนุมัติ (ยังไม่นับชั่วโมง)');
          } else segs = [[inM, outM]];
          let reg = 0, ext = 0;
          for (const [a, b] of segs) {
            const inShift = m.ps != null ? U.overlap(a, b, m.ps, m.pe) : 0;
            const br = m.bs != null ? U.overlap(a, b, m.bs, m.be) : 0;
            reg += Math.max(0, inShift - br);
            ext += b - a - inShift;
          }
          const cap = +S.holidayRegularCap || 480;
          if (reg > cap) {
            ext += reg - cap;
            reg = cap;
          }
          reg = roundOT(reg);
          if (emp.payType === 'D') r.ot2 = reg;
          else r.ot1 = reg;
          r.ot3 = roundOT(ext);
          r.st = 'HOLIDAY_WORK';
        } else {
          r.st = m.type === 'HOLIDAY' ? 'HOLIDAY' : 'OFF';
          if (inM != null || outM != null) r.notes.push('มีการสแกนเพียงครั้งเดียวในวันหยุด');
        }
      }
      if (r.pend) r.notes.push(`มีคำขอรออนุมัติ ${r.pend} รายการ`);
      rows.push(r);
    }
    return rows;
  };
  E.mapStale = (s, pk) => {
    const P = E.P(s, pk), st = P.stamps;
    return !P.mappedSeq || P.mappedSeq < Math.max(st.punches || 0, st.roster || 0, st.config || 0);
  };
  E.calcStale = (s, pk) => {
    const P = E.P(s, pk), st = P.stamps;
    return E.mapStale(s, pk) || !P.calcSeq || P.calcSeq < Math.max(P.mappedSeq, st.requests || 0, st.config || 0);
  };
  E.calcPeriod = (s, pk) => {
    let remapped = false;
    if (E.mapStale(s, pk)) {
      E.mapPeriod(s, pk);
      remapped = true;
    }
    const P = E.P(s, pk);
    P.calc = E.runCalc(s, pk);
    P.calcSeq = E.bump(s);
    P.calcAt = U.nowISO();
    return { rows: P.calc, remapped };
  };

  /* ---------------- สรุปผล ---------------- */
  const zero = (e) => ({
    e, sched: 0, attended: 0, complete: 0, present: 0, absent: 0, lateCnt: 0, lateMin: 0, earlyCnt: 0, earlyMin: 0,
    inc: 0, leave: {}, leaveDays: 0, ot1: 0, ot15: 0, ot2: 0, ot3: 0, ot: 0, work: 0, holidays: 0, holWork: 0, noShift: 0,
  });
  E.summary = (s, pk) => {
    const P = s.periods[pk];
    if (!P || !P.calc) return null;
    const key = pk + ':' + P.calcSeq + ':' + s.employees.length;
    if (E._cache[key]) return E._cache[key];
    const emps = {};
    const daily = {};
    for (const r of P.calc) {
      const x = emps[r.e] || (emps[r.e] = zero(r.e));
      const dd = daily[r.d] || (daily[r.d] = { sched: 0, attended: 0, complete: 0, late: 0, absent: 0, ot: 0, leave: 0 });
      if (r.type === 'WORK') {
        x.sched++;
        dd.sched++;
      }
      if (r.type === 'HOLIDAY') x.holidays++;
      const attended = r.type === 'WORK' && (r.in != null || r.out != null) && r.leave < 1;
      if (attended) {
        x.attended++;
        x.present += 1 - r.leave;
        dd.attended++;
        if (!r.inc) {
          x.complete++;
          dd.complete++;
        }
      }
      x.absent += r.absent;
      dd.absent += r.absent;
      if (r.late) {
        x.lateCnt++;
        x.lateMin += r.late;
        dd.late++;
      }
      if (r.early) {
        x.earlyCnt++;
        x.earlyMin += r.early;
      }
      if (r.inc) x.inc++;
      if (r.leave) {
        x.leave[r.lt] = (x.leave[r.lt] || 0) + r.leave;
        x.leaveDays += r.leave;
        dd.leave += r.leave;
      }
      x.ot1 += r.ot1;
      x.ot15 += r.ot15;
      x.ot2 += r.ot2;
      x.ot3 += r.ot3;
      const ot = r.ot1 + r.ot15 + r.ot2 + r.ot3;
      x.ot += ot;
      dd.ot += ot;
      x.work += r.work;
      if (r.st === 'HOLIDAY_WORK') x.holWork++;
      if (r.st === 'NO_SHIFT') x.noShift++;
    }
    const T = zero('ALL');
    let lateEmp = 0, absentEmp = 0, lateOrAbsentEmp = 0, incEmp = 0;
    for (const x of Object.values(emps)) {
      for (const k of Object.keys(T)) if (typeof T[k] === 'number') T[k] += x[k];
      for (const [lt, v] of Object.entries(x.leave)) T.leave[lt] = (T.leave[lt] || 0) + v;
      if (x.lateCnt) lateEmp++;
      if (x.absent) absentEmp++;
      if (x.lateCnt || x.absent) lateOrAbsentEmp++;
      if (x.inc) incEmp++;
    }
    T.completeRate = T.attended ? (T.complete / T.attended) * 100 : 0;
    T.attendRate = T.sched ? ((T.sched - T.absent - T.leaveDays) / T.sched) * 100 : 0;
    Object.assign(T, { lateEmp, absentEmp, lateOrAbsentEmp, incEmp, empCount: Object.keys(emps).length });
    const res = { emps, daily, T };
    E._cache = { [key]: res, ...(Object.keys(E._cache).length > 8 ? {} : E._cache) };
    return res;
  };

  /* ---------------- ขั้นตอนที่ 9: ข้อมูลส่งเงินเดือน ---------------- */
  // ฐานเงินเดือน/ค่าแรงของงวด ตามวันที่อยู่ในสภาพการจ้างและอัตราที่มีผลแต่ละช่วง
  //  - รายเดือน: ทำงานเต็มงวด อัตราเดียว = เงินเดือนเต็ม · เปลี่ยนอัตรากลางงวด = เฉลี่ยตามวันปฏิทิน
  //    เข้า/ออกระหว่างงวด = อัตรา × วันที่อยู่ในสภาพการจ้าง ÷ (วันปฏิทินของงวด | ตัวหารรายวัน) ตาม settings.prorateBy
  //  - รายวัน: วันที่ได้ค่าจ้างแต่ละวัน × อัตราของวันนั้น
  E.payBase = (s, pk, emp, x) => {
    const S = s.settings, R = E.range(s, pk);
    const daily = emp.payType === 'D';
    const div = +S.monthDivisor || 30;
    const days = E.empDays(emp, R);
    const segs = [];
    for (const d of days) {
      const rate = E.rateOn(emp, d), last = segs[segs.length - 1];
      if (last && last.rate === rate && U.dnum(d) - U.dnum(last.to) === 1) {
        last.to = d;
        last.days++;
      } else segs.push({ from: d, to: d, days: 1, rate });
    }
    const lastRate = segs.length ? segs[segs.length - 1].rate : E.rateOn(emp, R.end);
    const perDay = daily ? lastRate : lastRate / div;
    const full = days.length === R.days.length;
    const prorate = full ? null : { days: days.length, total: R.days.length, by: S.prorateBy === 'DIV' ? 'DIV' : 'CAL', div };
    let base = 0, payDays = null;
    if (daily) {
      const unpaid = new Set(s.leaveTypes.filter((l) => !l.paid).map((l) => l.code));
      const P = s.periods[pk];
      payDays = 0;
      for (const r of (P && P.calc) || []) {
        if (r.e !== emp.id) continue;
        let paid = 0;
        if (r.type === 'HOLIDAY') paid = 1;
        else if (r.type === 'WORK') {
          if ((r.in != null || r.out != null) && r.leave < 1) paid += 1 - r.leave;
          if (r.leave && !unpaid.has(r.lt)) paid += r.leave;
        }
        if (!paid) continue;
        payDays += paid;
        base += paid * E.rateOn(emp, r.d);
      }
      // ไม่มีแถวรายวัน (ข้อมูลทดสอบ/สรุป) → ใช้ยอดสรุป
      if (!payDays && x) {
        const paidLeave = x.leaveDays - [...unpaid].reduce((t, c) => t + (x.leave[c] || 0), 0);
        payDays = x.present + paidLeave + x.holidays;
        base = payDays * lastRate;
      }
    } else if (full && segs.length === 1) base = segs[0].rate;
    else if (full) base = U.sum(segs, (g) => (g.rate * g.days) / R.days.length);
    else {
      const d = prorate.by === 'DIV' ? div : R.days.length;
      base = Math.min(U.sum(segs, (g) => (g.rate * g.days) / d), Math.max(0, ...segs.map((g) => g.rate)));
    }
    return { base: U.r2(base), payDays, perDay, segs, prorate, rateChanged: segs.length > 1 };
  };

  E.payroll = (s, pk) => {
    const sm = E.summary(s, pk);
    if (!sm) return [];
    const S = s.settings, ix = E.idx(s);
    const unpaidTypes = s.leaveTypes.filter((l) => !l.paid).map((l) => l.code);
    return s.employees
      .filter((e) => sm.emps[e.id])
      .map((emp) => {
        const x = sm.emps[emp.id];
        const daily = emp.payType === 'D';
        const pb = E.payBase(s, pk, emp, x);
        const perDay = pb.perDay;
        const hourly = perDay / (+S.hoursPerDay || 8);
        const unpaid = unpaidTypes.reduce((t, c) => t + (x.leave[c] || 0), 0);
        const paidLeave = x.leaveDays - unpaid;
        const otPay = ((x.ot1 * 1 + x.ot15 * 1.5 + x.ot2 * 2 + x.ot3 * 3) / 60) * hourly;
        const dAbsent = daily ? 0 : x.absent * perDay;
        const dUnpaid = daily ? 0 : unpaid * perDay;
        const dLate = S.deductLate ? (x.lateMin / 60) * hourly : 0;
        const dEarly = S.deductEarly ? (x.earlyMin / 60) * hourly : 0;
        const payDays = pb.payDays;
        const base = pb.base;
        const deduct = dAbsent + dUnpaid + dLate + dEarly;
        return {
          emp, x, perDay: U.r2(perDay), hourly: U.r2(hourly), unpaid, paidLeave, payDays,
          base: U.r2(base), otPay: U.r2(otPay), dAbsent: U.r2(dAbsent), dUnpaid: U.r2(dUnpaid),
          dLate: U.r2(dLate), dEarly: U.r2(dEarly), deduct: U.r2(deduct), gross: U.r2(base + otPay - deduct),
          shift: ix.shifts[emp.shift], segs: pb.segs, prorate: pb.prorate, rateChanged: pb.rateChanged,
        };
      });
  };

  /* ---------------- สถานะขั้นตอน และการตรวจสอบ ---------------- */
  E.pipeline = (s, pk) => {
    const P = E.P(s, pk), st = P.stamps, R = E.range(s, pk);
    const t0 = R.start + ' 00:00', t1 = U.addDays(R.end, 1) + ' 00:00';
    let punches = 0;
    for (const p of s.punches) if (p.t >= t0 && p.t < t1) punches++;
    const act = s.employees.filter((e) => E.activeIn(e, R));
    let empty = 0;
    for (const e of act) for (const d of R.days) if (E.employed(e, d) && !s.roster[e.id + '|' + d]) empty++;
    const published = P.publishedSeq > 0;
    const rosterDirty = published && (st.roster || 0) > P.publishedSeq;
    const mapStale = E.mapStale(s, pk);
    const pendingList = s.requests.filter((r) => r.status === 'PENDING' && E.reqInPeriod(s, r, pk));
    const pending = pendingList.length;
    const calcStale = E.calcStale(s, pk);
    const sm = E.summary(s, pk);
    const inc = sm ? sm.T.inc : 0;
    const last = P.transfers[P.transfers.length - 1] || null;
    const transferred = !!last && last.seq === P.calcSeq && !calcStale;
    const unknown = P.mapStats ? P.mapStats.unknownCount : 0;
    const L = P.locked;
    const n = (x) => U.num(x);
    const steps = [
      { n: 1, key: 'import', state: L || punches ? 'done' : 'todo', note: punches ? `${n(punches)} รายการ` : 'ยังไม่มีข้อมูล' },
      { n: 2, key: 'schedule', state: L ? 'done' : !published || empty ? 'todo' : rosterDirty ? 'warn' : 'done', note: !published ? 'ยังไม่ประกาศ' : empty ? `ขาดกะ ${n(empty)} ช่อง` : rosterDirty ? 'แก้ไขหลังประกาศ' : 'ประกาศแล้ว' },
      { n: 3, key: 'mapping', state: L ? 'done' : !P.mappedSeq ? 'todo' : mapStale ? 'warn' : 'done', note: !P.mappedSeq ? 'ยังไม่โอน' : mapStale ? 'ต้องโอนใหม่' : 'เป็นปัจจุบัน' },
      { n: 4, key: 'requests', state: L || !pending ? 'done' : 'warn', note: pending ? `รออนุมัติ ${n(pending)}` : 'ไม่มีค้าง' },
      { n: 5, key: 'calc', state: L ? 'done' : !P.calcSeq ? 'todo' : calcStale ? 'warn' : 'done', note: !P.calcSeq ? 'ยังไม่คำนวณ' : calcStale ? 'ต้องคำนวณใหม่' : 'เป็นปัจจุบัน' },
      { n: 6, key: 'report', state: P.calc ? 'done' : 'todo', note: P.calc ? 'พร้อมดู' : 'รอคำนวณ' },
      { n: 7, key: 'incomplete', state: !P.calc ? 'todo' : inc && !L ? 'warn' : 'done', note: !P.calc ? 'รอคำนวณ' : inc ? `${n(inc)} รายการ` : 'ครบถ้วน' },
      { n: 8, key: 'absence', state: P.calc ? 'done' : 'todo', note: P.calc ? 'พร้อมดู' : 'รอคำนวณ' },
      { n: 9, key: 'export', state: transferred || L ? 'done' : 'todo', note: L ? 'ส่งแล้ว (ล็อก)' : transferred ? 'ส่งแล้ว' : 'รอส่ง' },
    ];
    return { punches, empty, published, rosterDirty, mapStale, pending, pendingList, calcStale, inc, hasCalc: !!P.calc, transferred, locked: L, last, unknown, steps, P };
  };

  E.validate = (s, pk) => {
    const p = E.pipeline(s, pk);
    const c = [];
    const add = (ok, level, label, detail, link) => c.push({ ok, level, label, detail, link });
    add(p.punches > 0, 'error', 'มีบันทึกเวลาในรอบนี้', p.punches ? `${U.num(p.punches)} รายการ` : 'ยังไม่ได้ดึงบันทึกเวลา', 'import');
    add(p.empty === 0, 'error', 'กำหนดกะครบทุกวัน', p.empty ? `ยังไม่ได้กำหนดกะ ${U.num(p.empty)} ช่อง` : 'ครบทุกคนทุกวัน', 'schedule');
    add(p.published && !p.rosterDirty, p.published ? 'warn' : 'error', 'ประกาศกะแล้ว', !p.published ? 'ยังไม่ได้ประกาศกะ' : p.rosterDirty ? 'มีการแก้ไขตารางกะหลังประกาศ' : 'ประกาศแล้ว', 'schedule');
    add(!p.mapStale, 'error', 'โอนบันทึกเวลาเทียบกะเป็นปัจจุบัน', p.mapStale ? 'มีข้อมูลเปลี่ยนแปลงหลังการโอน' : 'เป็นปัจจุบัน', 'mapping');
    add(p.pending === 0, 'warn', 'ไม่มีคำขอค้างอนุมัติ', p.pending ? `รออนุมัติ ${p.pending} รายการ` : 'อนุมัติครบแล้ว', 'requests');
    add(p.hasCalc && !p.calcStale, 'error', 'คำนวณบันทึกเวลาเป็นปัจจุบัน', !p.hasCalc ? 'ยังไม่ได้คำนวณ' : p.calcStale ? 'มีข้อมูลเปลี่ยนแปลงหลังการคำนวณ' : 'เป็นปัจจุบัน', 'calc');
    add(p.inc === 0, 'warn', 'ไม่มีบันทึกเวลาไม่สมบูรณ์', p.inc ? `ไม่ครบเข้า-ออก ${p.inc} รายการ` : 'ครบถ้วนทุกรายการ', 'incomplete');
    add(p.unknown === 0, 'warn', 'ไม่มีรหัสพนักงานที่ไม่รู้จัก', p.unknown ? `${p.unknown} รหัส` : 'ตรงกับทะเบียนพนักงานทั้งหมด', 'import');
    const errors = c.filter((x) => !x.ok && x.level === 'error').length;
    const warns = c.filter((x) => !x.ok && x.level === 'warn').length;
    return { checks: c, errors, warns, pipe: p };
  };
})(typeof window !== 'undefined' ? window : globalThis);

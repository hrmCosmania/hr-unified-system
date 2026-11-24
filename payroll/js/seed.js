/* Payroll Full Loop — ข้อมูลตั้งต้นและข้อมูลตัวอย่าง */
(function (g) {
  'use strict';
  const PL = (g.PL = g.PL || {});
  const U = PL.U, E = PL.Engine;

  const SHIFTS = [
    { code: 'D', name: 'กะเช้า', type: 'WORK', start: '08:00', end: '17:00', brS: '12:00', brE: '13:00', grace: 5, color: '#0ea5e9' },
    { code: 'S', name: 'กะบ่าย', type: 'WORK', start: '13:00', end: '22:00', brS: '17:00', brE: '18:00', grace: 5, color: '#f59e0b' },
    { code: 'N', name: 'กะดึก', type: 'WORK', start: '20:00', end: '05:00', brS: '00:00', brE: '01:00', grace: 5, color: '#6366f1' },
    { code: 'O', name: 'กะสำนักงาน', type: 'WORK', start: '08:30', end: '17:30', brS: '12:00', brE: '13:00', grace: 10, color: '#14b8a6' },
    { code: 'OFF', name: 'วันหยุดประจำสัปดาห์', type: 'OFF', color: '#94a3b8' },
    { code: 'HOL', name: 'วันหยุดนักขัตฤกษ์', type: 'HOLIDAY', color: '#a855f7' },
  ];
  const LEAVE_TYPES = [
    { code: 'SICK', name: 'ลาป่วย', paid: true, quota: 30 },
    { code: 'PERSONAL', name: 'ลากิจ', paid: true, quota: 6 },
    { code: 'VACATION', name: 'ลาพักร้อน', paid: true, quota: 6 },
    { code: 'UNPAID', name: 'ลาไม่รับค่าจ้าง', paid: false, quota: 0 },
    { code: 'OTHER', name: 'ลาอื่นๆ', paid: true, quota: 0 },
  ];
  // วันหยุดตัวอย่าง (โปรดตรวจสอบกับประกาศวันหยุดของบริษัท)
  const HOLIDAYS = [
    ['2026-01-01', 'วันขึ้นปีใหม่'], ['2026-03-03', 'วันมาฆบูชา'], ['2026-04-06', 'วันจักรี'],
    ['2026-04-13', 'วันสงกรานต์'], ['2026-04-14', 'วันสงกรานต์'], ['2026-04-15', 'วันสงกรานต์'],
    ['2026-05-01', 'วันแรงงานแห่งชาติ'], ['2026-05-04', 'วันฉัตรมงคล'], ['2026-06-01', 'ชดเชยวันวิสาขบูชา'],
    ['2026-06-03', 'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี'], ['2026-07-28', 'วันเฉลิมพระชนมพรรษา ร.10'],
    ['2026-07-29', 'วันอาสาฬหบูชา'], ['2026-08-12', 'วันแม่แห่งชาติ'], ['2026-10-13', 'วันนวมินทรมหาราช'],
    ['2026-10-23', 'วันปิยมหาราช'], ['2026-12-07', 'ชดเชยวันพ่อแห่งชาติ'], ['2026-12-10', 'วันรัฐธรรมนูญ'],
    ['2026-12-31', 'วันสิ้นปี'], ['2027-01-01', 'วันขึ้นปีใหม่'],
  ].map(([date, name]) => ({ date, name }));

  const DEFAULT_SETTINGS = {
    period: '2026-10',
    cutoffDay: 0,
    mapBefore: 180, // นาทีก่อนเข้ากะที่ยอมรับเป็นเวลาเข้า
    mapAfter: 360, // นาทีหลังเลิกกะที่ยอมรับเป็นเวลาออก
    dupMinutes: 3, // สแกนซ้ำภายใน x นาที นับเป็นครั้งเดียว
    minPairGap: 30, // เข้า-ออกต้องห่างกันอย่างน้อย x นาที
    otRequireApproval: true,
    otMinMinutes: 30,
    otRoundBlock: 15,
    holidayRegularCap: 480,
    monthDivisor: 30,
    prorateBy: 'CAL', // เข้า/ออกระหว่างงวด: CAL = ÷ วันปฏิทินของงวด, DIV = ÷ monthDivisor
    hoursPerDay: 8,
    deductLate: true,
    deductEarly: true,
  };

  const base = () => ({
    version: 1,
    seq: 1,
    company: { name: 'บริษัท ตัวอย่าง จำกัด' },
    user: { name: 'Nattapon P.', role: 'HR Manager' },
    settings: { ...DEFAULT_SETTINGS },
    shifts: SHIFTS.map((x) => ({ ...x })),
    leaveTypes: LEAVE_TYPES.map((x) => ({ ...x })),
    holidays: HOLIDAYS.map((x) => ({ ...x })),
    depts: ['ผลิต', 'คลังสินค้า', 'ซ่อมบำรุง', 'ควบคุมคุณภาพ', 'บัญชี', 'บุคคล', 'ขาย', 'ไอที'],
    employees: [],
    roster: {},
    punches: [],
    imports: [],
    requests: [],
    periods: {},
    counters: {},
    log: [],
  });

  const FIRST = [
    ['สมชาย', 'M'], ['สุดารัตน์', 'F'], ['วิชัย', 'M'], ['กมลวรรณ', 'F'], ['ประเสริฐ', 'M'], ['พรทิพย์', 'F'], ['ธนากร', 'M'], ['นภาพร', 'F'],
    ['อนุชา', 'M'], ['จิราพร', 'F'], ['ชัยวัฒน์', 'M'], ['ปิยะนุช', 'F'], ['ณัฐพล', 'M'], ['วรรณา', 'F'], ['ศักดิ์ชัย', 'M'], ['สุภาวดี', 'F'],
    ['กิตติพงษ์', 'M'], ['รัตนา', 'F'], ['ธีรวัฒน์', 'M'], ['มณีรัตน์', 'F'], ['อำนาจ', 'M'], ['ศิริพร', 'F'], ['พีระพงษ์', 'M'], ['อรุณี', 'F'],
    ['สุริยา', 'M'], ['ดวงใจ', 'F'], ['เกียรติศักดิ์', 'M'], ['พิมพ์ชนก', 'F'], ['ณรงค์', 'M'], ['ลัดดา', 'F'], ['ไพโรจน์', 'M'], ['สายสุนีย์', 'F'],
    ['ยุทธนา', 'M'], ['กาญจนา', 'F'], ['บุญเลิศ', 'M'], ['ทิพวรรณ', 'F'], ['ประพันธ์', 'M'], ['อัญชลี', 'F'], ['วีระ', 'M'], ['ปวีณา', 'F'],
    ['สุรเชษฐ์', 'M'], ['สุกัญญา', 'F'], ['ชาตรี', 'M'], ['ภัทรา', 'F'], ['เอกชัย', 'M'], ['นันทนา', 'F'], ['มานพ', 'M'], ['จันทร์เพ็ญ', 'F'],
  ];
  const LAST = ['ใจดี', 'ศรีสุข', 'มีสุข', 'ทองดี', 'แสงทอง', 'บุญมา', 'วงศ์ใหญ่', 'รักไทย', 'สุขเจริญ', 'พงษ์พันธ์', 'ศรีวงศ์', 'คงมั่น', 'ทองคำ', 'แก้วมณี', 'ปัญญาดี', 'สมบูรณ์', 'เพชรรัตน์', 'อินทรสุข', 'ชัยมงคล', 'บุญประเสริฐ'];
  // [แผนก, จำนวน, ตำแหน่ง, ประเภทจ้าง, กะ, รูปแบบ, เงินเดือน/ค่าจ้าง min-max]
  const DEPTS = [
    ['ผลิต', 16, 'พนักงานฝ่ายผลิต', 'D', 'D', 'ROTATE', [400, 460]],
    ['คลังสินค้า', 8, 'พนักงานคลังสินค้า', 'D', 'S', 'SIX', [400, 440]],
    ['ซ่อมบำรุง', 5, 'ช่างซ่อมบำรุง', 'M', 'D', 'SIX', [16000, 24000]],
    ['ควบคุมคุณภาพ', 5, 'เจ้าหน้าที่ QC', 'M', 'D', 'SIX', [15000, 22000]],
    ['บัญชี', 4, 'เจ้าหน้าที่บัญชี', 'M', 'O', 'OFFICE5', [18000, 35000]],
    ['บุคคล', 4, 'เจ้าหน้าที่บุคคล', 'M', 'O', 'OFFICE5', [18000, 32000]],
    ['ขาย', 3, 'เจ้าหน้าที่ขาย', 'M', 'O', 'OFFICE5', [17000, 30000]],
    ['ไอที', 3, 'เจ้าหน้าที่ไอที', 'M', 'O', 'OFFICE5', [22000, 38000]],
  ];

  function addEmployees(s, rnd) {
    let i = 0;
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    for (const [dept, n, pos, payType, shift, pattern, [lo, hi]] of DEPTS) {
      for (let k = 0; k < n; k++, i++) {
        const [fn, sex] = FIRST[i % FIRST.length];
        const prefix = sex === 'M' ? 'นาย' : 'นางสาว';
        const salary = payType === 'D' ? ri(lo / 5, hi / 5) * 5 : ri(lo / 500, hi / 500) * 500;
        s.employees.push({
          id: 'E' + U.pad(i + 1, 4),
          code: 'EMP' + U.pad(i + 1, 4),
          card: String(1000 + i + 1),
          name: `${prefix}${fn} ${LAST[(i * 7) % LAST.length]}`,
          dept,
          position: k === 0 && n > 3 ? `หัวหน้า${dept}` : pos,
          payType,
          salary,
          shift: k % 2 === 1 && dept === 'คลังสินค้า' ? 'D' : shift,
          pattern,
          team: k % 2 === 0 ? 'A' : 'B',
          active: true,
          start: `20${U.pad(18 + (i % 7))}-0${1 + (i % 9)}-01`,
        });
      }
    }
  }

  const REASONS = {
    SICK: ['ไม่สบาย มีไข้', 'ปวดท้อง', 'ไปพบแพทย์', 'เป็นหวัด'],
    PERSONAL: ['ธุระส่วนตัว', 'ติดต่อราชการ', 'พาบุตรไปโรงเรียน'],
    VACATION: ['ท่องเที่ยวกับครอบครัว', 'พักผ่อนประจำปี'],
    UNPAID: ['ธุระต่างจังหวัด'],
    OT: ['เร่งผลิตตามแผน', 'ตรวจนับสต็อก', 'ซ่อมเครื่องจักร', 'ปิดงบประจำเดือน', 'จัดส่งสินค้าด่วน'],
  };

  // สร้างบันทึกเวลา + คำขอ ตามตารางกะของรอบ
  function genPeriod(s, pk, rnd, opt = {}) {
    const ix = E.idx(s), R = E.range(s, pk);
    const hist = !!opt.historical;
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const wpick = (pairs) => {
      let r = rnd();
      for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
      return pairs[pairs.length - 1][0];
    };
    const plantDept = ['ผลิต', 'คลังสินค้า', 'ซ่อมบำรุง', 'ควบคุมคุณภาพ'];
    let added = 0;
    const punch = (emp, m) => {
      s.punches.push({ c: emp.card, t: U.tstr(Math.round(m)), dv: plantDept.includes(emp.dept) ? 'FP-02 โรงงาน' : 'FP-01 สำนักงาน', src: opt.src || 'import' });
      added++;
    };
    const req = (kind, f, status, d) => {
      if (!status) return;
      const at = new Date(`${d}T${U.pad(ri(8, 17))}:${U.pad(ri(0, 59))}:00`).toISOString();
      s.requests.push({
        id: E.nextId(s, kind), kind, status, ...f,
        createdAt: at, createdBy: 'พนักงาน (ESS)',
        decidedAt: status === 'PENDING' ? null : at, decidedBy: status === 'PENDING' ? null : 'หัวหน้างาน',
      });
    };
    const decide = (pApproved, pPending) => (hist ? 'APPROVED' : rnd() < pApproved ? 'APPROVED' : rnd() < pPending ? 'PENDING' : null);

    for (const emp of s.employees) {
      for (const d of R.days) {
        if (opt.until && d > opt.until) continue;
        const di = E.dayInfo(s, ix, emp, d);
        const pl = di.plan;
        if (!pl) continue;
        if (di.type === 'WORK') {
          const r = rnd();
          if (r < 0.02) continue; // ขาดงาน
          let part = null;
          if (r < 0.058) {
            const lt = wpick([['SICK', 0.5], ['PERSONAL', 0.25], ['VACATION', 0.2], ['UNPAID', 0.05]]);
            const pr = rnd();
            part = pr < 0.75 ? 'FULL' : pr < 0.88 ? 'AM' : 'PM';
            req('LEAVE', { e: emp.id, date: d, dateTo: d, leaveType: lt, part, reason: pick(REASONS[lt]) }, hist ? 'APPROVED' : rnd() < 0.85 ? 'APPROVED' : 'PENDING', d);
            if (part === 'FULL') continue;
          }
          let inM = pl.ps + (rnd() < 0.085 ? ri(6, 45) : ri(-28, 3));
          let outM = pl.pe + ri(0, 18);
          if (part === 'AM') inM = pl.be + ri(-25, 3);
          if (part === 'PM') outM = pl.bs + ri(0, 12);
          if (!part) {
            if (rnd() < 0.04) outM = pl.pe - ri(10, 70);
            else if (rnd() < 0.13) {
              const len = pick([60, 90, 120, 150, 180]);
              outM = pl.pe + len + ri(0, 12);
              req('OT', { e: emp.id, date: d, otStart: U.tstr(pl.pe), otEnd: U.tstr(pl.pe + len), reason: pick(REASONS.OT) }, decide(0.8, 0.6), d);
            }
          }
          const mr = rnd();
          const missOut = mr < 0.02, missIn = !missOut && mr < 0.032;
          if (!missIn) {
            punch(emp, inM);
            if (rnd() < 0.03) punch(emp, inM + 1); // สแกนซ้ำ
          }
          if (!missOut) punch(emp, outM);
          if (missIn || missOut) {
            req('ADJ', {
              e: emp.id, date: d,
              adjIn: missIn ? U.tstr(pl.ps - ri(5, 20)) : '',
              adjOut: missOut ? U.tstr(outM) : '',
              reason: missIn ? 'ลืมสแกนนิ้วตอนเข้างาน' : 'ลืมสแกนนิ้วตอนออกงาน',
            }, decide(0.4, 0.45), d);
          }
        } else if (emp.payType === 'D' && rnd() < 0.05) {
          // มาทำงานวันหยุด
          const extra = rnd() < 0.4 ? 120 : 0;
          punch(emp, pl.ps + ri(-20, 0));
          punch(emp, pl.pe + extra + ri(0, 10));
          req('OT', { e: emp.id, date: d, otStart: U.tstr(pl.ps), otEnd: U.tstr(pl.pe + extra), reason: 'ทำงานวันหยุดเพื่อเร่งการผลิต' }, hist ? 'APPROVED' : rnd() < 0.8 ? 'APPROVED' : 'PENDING', d);
        }
      }
    }
    if (opt.strays) {
      const d = R.days[Math.min(4, R.days.length - 1)];
      s.punches.push({ c: '9999', t: `${d} 07:41`, dv: 'FP-02 โรงงาน', src: opt.src || 'import' });
      s.punches.push({ c: '9999', t: `${d} 17:12`, dv: 'FP-02 โรงงาน', src: opt.src || 'import' });
      s.punches.push({ c: 'TMP01', t: `${R.days[Math.min(9, R.days.length - 1)]} 08:02`, dv: 'FP-01 สำนักงาน', src: opt.src || 'import' });
      added += 3;
    }
    return added;
  }

  // ข้อมูลเงินเดือนตัวอย่าง (เลขบัญชี/เลขผู้เสียภาษีขึ้นต้นด้วย 999 = ข้อมูลสมมติ)
  function seedPay(s) {
    const Pay = PL.Payroll;
    Pay.ensure(s);
    const rnd = U.rng(77001);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const office = ['บัญชี', 'บุคคล', 'ขาย', 'ไอที'];
    s.employees.forEach((e, i) => {
      const p = Object.assign(Pay.profile(), e.pay);
      const head = String(e.position || '').startsWith('หัวหน้า');
      p.recur = {};
      if (head) p.recur.POS = e.payType === 'D' ? 1500 : 3000;
      if (e.payType === 'M' && +e.salary < 20000) p.recur.COL = 1000;
      if (office.includes(e.dept)) p.recur.TRAVEL = 800;
      if (i % 11 === 3) p.recur.LOAN = 1000;
      if (i % 17 === 5) p.recur.STU = 1200;
      p.pvd = e.payType === 'M' && +e.salary >= 18000 ? (i % 2 ? 5 : 3) : 0;
      p.dilig = e.payType === 'D';
      p.sso = true;
      p.spouse = rnd() < 0.3;
      p.children = rnd() < 0.45 ? ri(1, 2) : 0;
      p.parents = rnd() < 0.35 ? ri(1, 2) : 0;
      p.life = rnd() < 0.3 ? ri(12, 30) * 1000 : 0;
      p.health = rnd() < 0.15 ? ri(5, 15) * 1000 : 0;
      const id12 = `99999${U.pad(i + 1, 6)}0`;
      p.taxId = id12 + U.taxIdDigit(id12);
      p.bank = Pay.BANKS[i % 5];
      p.acct = `999-${ri(0, 9)}-${U.pad(ri(0, 99999), 5)}-${ri(0, 9)}`;
      e.pay = p;
    });
    if (s.employees.length > 40) s.employees[40].pay.acct = ''; // ตัวอย่างพนักงานที่ยังไม่มีบัญชี
  }
  function seedPayInputs(s, pk) {
    const add = (code, empIdx, amount, note) => {
      const e = s.employees[empIdx];
      if (!e) return;
      (s.pay.inputs[pk] = s.pay.inputs[pk] || []).push({ id: E.nextId(s, 'PI'), e: e.id, code, amount, note });
    };
    s.employees.forEach((e, i) => {
      if (e.dept === 'ขาย') add('COMM', i, 2500 + i * 350, 'ยอดขาย ' + U.fmtPeriodShort(pk));
    });
    add('ADV', 2, 2000, 'เบิกล่วงหน้า 15 ' + U.fmtPeriodShort(pk));
    add('ADV', 20, 1500, '');
    add('INC', 30, 1000, 'รางวัลพนักงานดีเด่น');
  }

  PL.Seed = {
    DEFAULT_SETTINGS,
    base,
    genPeriod,
    seedPay,
    empty() {
      const s = base();
      s.settings.period = U.todayStr().slice(0, 7);
      PL.Payroll.ensure(s);
      return s;
    },
    build() {
      const s = base();
      const rnd = U.rng(20261023);
      addEmployees(s, rnd);
      seedPay(s);
      const ids = s.employees.map((e) => e.id);
      const periods = [
        ['2026-09', true],
        ['2026-10', false],
      ];
      for (const [pk, hist] of periods) {
        const R = E.range(s, pk);
        E.applyPattern(s, ids, R.days);
        E.touch(s, 'roster', R.days);
        const P = E.P(s, pk);
        P.publishedSeq = E.bump(s);
        P.publishedAt = new Date(`${U.addDays(R.start, -7)}T10:00:00`).toISOString();
        const added = genPeriod(s, pk, rnd, { historical: hist, strays: !hist });
        E.touch(s, 'punches', R.days);
        E.touch(s, 'requests', R.days);
        s.imports.push({
          at: new Date(`${U.addDays(R.end, 1)}T08:30:00`).toISOString(),
          file: `attlog_${pk.replace('-', '')}.txt`,
          added, dup: 0, errors: 0, by: s.user.name,
        });
        E.mapPeriod(s, pk);
        E.calcPeriod(s, pk);
        if (hist) {
          const rows = E.payroll(s, pk);
          P.transfers.push({
            at: new Date(`${U.addDays(R.end, 2)}T15:00:00`).toISOString(),
            by: s.user.name, seq: P.calcSeq, rows: rows.length,
            otHours: U.r2(U.sum(rows, (r) => r.x.ot) / 60), otPay: U.r2(U.sum(rows, (r) => r.otPay)),
            deduct: U.r2(U.sum(rows, (r) => r.deduct)), file: `payroll-input_${pk}.csv`,
          });
          P.locked = true;
          // เงินเดือนเดือนที่แล้ว: คำนวณและปิดงวดแล้ว
          seedPayInputs(s, pk);
          const run = PL.Payroll.run(s, pk);
          Object.assign(run, { status: 'APPROVED', approvedAt: new Date(`${U.addDays(R.end, -3)}T16:00:00`).toISOString(), approvedBy: s.user.name, at: new Date(`${U.addDays(R.end, -4)}T10:00:00`).toISOString() });
        } else seedPayInputs(s, pk);
      }
      s.punches.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
      s.log.unshift({ at: U.nowISO(), by: 'ระบบ', action: 'สร้างข้อมูลตัวอย่าง', detail: `พนักงาน ${s.employees.length} คน, รอบ ก.ย.–ต.ค. 2569` });
      return s;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

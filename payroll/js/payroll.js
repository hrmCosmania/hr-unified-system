/* Payroll Full Loop — เอนจินคำนวณเงินเดือน (ไม่มี DOM: ทดสอบด้วย Node ได้)
 *  - เงินได้: เงินเดือน/ค่าแรง, OT แยกอัตรา, ค่ากะดึก, เบี้ยขยัน, เงินได้ประจำ, เงินได้ประจำงวด
 *  - เงินหัก: ขาด/ลาไม่รับค่าจ้าง/สาย/กลับก่อน, ประกันสังคม, กองทุนสำรองเลี้ยงชีพ, ภาษีหัก ณ ที่จ่าย, หักอื่น
 *  - ภาษี: วิธีกรมสรรพากร — เงินได้แน่นอน × 12 ÷ 12, เงินได้ไม่แน่นอนคิดส่วนเพิ่มของภาษีทั้งปี
 */
(function (g) {
  'use strict';
  const PL = (g.PL = g.PL || {});
  const U = PL.U, E = PL.Engine;

  // รายการเงินได้/เงินหัก — sys = ระบบคำนวณเอง, RECUR = ประจำรายเดือนตามข้อมูลพนักงาน, ONCE = ป้อนรายงวด
  const ITEMS = [
    { code: 'BASE', name: 'เงินเดือน / ค่าแรง', kind: 'EARN', sys: true, taxable: true, sso: true, regular: true },
    { code: 'OT', name: 'ค่าล่วงเวลา', kind: 'EARN', sys: true, taxable: true, sso: false, regular: false },
    { code: 'SHIFT', name: 'ค่ากะดึก', kind: 'EARN', sys: true, taxable: true, sso: false, regular: false },
    { code: 'DILIG', name: 'เบี้ยขยัน', kind: 'EARN', sys: true, taxable: true, sso: false, regular: false },
    // ตกเบิก: ส่วนต่างเงินเดือนของงวดที่ปิดไปแล้ว (ปรับอัตราย้อนหลัง) — จ่ายครั้งเดียว คิดภาษีแบบเงินได้ไม่แน่นอน
    { code: 'RETRO', name: 'เงินเดือนตกเบิก', kind: 'EARN', sys: true, taxable: true, sso: false, regular: false },
    { code: 'POS', name: 'ค่าตำแหน่ง', kind: 'EARN', mode: 'RECUR', taxable: true, sso: true, regular: true },
    { code: 'COL', name: 'ค่าครองชีพ', kind: 'EARN', mode: 'RECUR', taxable: true, sso: true, regular: true },
    { code: 'TRAVEL', name: 'ค่าเดินทาง', kind: 'EARN', mode: 'RECUR', taxable: true, sso: false, regular: true },
    { code: 'BONUS', name: 'โบนัส', kind: 'EARN', mode: 'ONCE', taxable: true, sso: false, regular: false },
    { code: 'COMM', name: 'ค่าคอมมิชชั่น', kind: 'EARN', mode: 'ONCE', taxable: true, sso: false, regular: false },
    { code: 'INC', name: 'รายได้อื่น', kind: 'EARN', mode: 'ONCE', taxable: true, sso: false, regular: false },
    { code: 'LOAN', name: 'หักเงินกู้สวัสดิการ', kind: 'DED', mode: 'RECUR' },
    { code: 'STU', name: 'หักเงินกู้ กยศ.', kind: 'DED', mode: 'RECUR' },
    { code: 'ADV', name: 'หักเงินเบิกล่วงหน้า', kind: 'DED', mode: 'ONCE' },
    { code: 'DED', name: 'หักอื่นๆ', kind: 'DED', mode: 'ONCE' },
  ];
  // ค่าตั้งต้นปีภาษี 2569 (ประกันสังคม: เพดานค่าจ้าง 17,500 บาท ตั้งแต่ 1 ม.ค. 2569)
  const DEFAULTS = {
    ssoRate: 5, ssoErRate: 5, ssoMin: 1650, ssoMax: 17500,
    expensePct: 50, expenseMax: 100000,
    personal: 60000, spouse: 60000, child: 30000, parent: 30000,
    lifeMax: 100000, healthMax: 25000, pvdMaxPct: 15, pvdMax: 500000,
    brackets: [[150000, 0], [300000, 5], [500000, 10], [750000, 15], [1000000, 20], [2000000, 25], [5000000, 30], [0, 35]],
    nightRate: 60, nightCodes: 'N',
    diligAmount: 500, diligAllowLeave: ['VACATION'],
    payDay: 0, // 0 = วันสุดท้ายของรอบ
    pvdErMatch: true,
    // วิธีหักภาษีรายเดือน: ANNUAL12 = เงินได้แน่นอน × 12 ÷ 12 · YTD = สะสมจริงตั้งแต่ต้นปี + ประมาณการเดือนที่เหลือ
    taxMethod: 'ANNUAL12',
    trueUp: true, // งวด ธ.ค. และงวดสุดท้ายของคนที่ลาออก: ปรับภาษีให้เท่าภาษีทั้งปีจริง
    trueUpRefund: true, // หักไว้เกิน → คืนในงวดนั้น (ไม่เกินภาษีที่บริษัทหักไว้ในปี)
    companyTaxId: '', companyBranch: '00000', ssoAccount: '', companyBank: '', companyAccount: '',
  };
  const BANKS = ['กสิกรไทย', 'กรุงเทพ', 'ไทยพาณิชย์', 'กรุงไทย', 'กรุงศรีอยุธยา', 'ทหารไทยธนชาต', 'ออมสิน'];
  const STATUS = {
    NOTIME: { label: 'รอผลบันทึกเวลา', cls: 'off' },
    READY: { label: 'พร้อมคำนวณ', cls: 'info' },
    DRAFT: { label: 'รออนุมัติ', cls: 'warn' },
    STALE: { label: 'ต้องคำนวณใหม่', cls: 'orange' },
    APPROVED: { label: 'ปิดงวดแล้ว', cls: 'ok' },
  };

  const Pay = (PL.Payroll = { ITEMS, DEFAULTS, BANKS, STATUS });

  /* ---------------- state ---------------- */
  Pay.base = () => ({ settings: JSON.parse(JSON.stringify(DEFAULTS)), items: ITEMS.map((x) => ({ ...x })), runs: {}, inputs: {}, stamps: {}, configSeq: 0 });
  Pay.profile = () => ({ recur: {}, sso: true, pvd: 0, dilig: false, taxId: '', bank: '', acct: '', spouse: false, children: 0, parents: 0, life: 0, health: 0, otherDed: 0,
    address: '', // ที่อยู่ผู้ถูกหักภาษี (50 ทวิ / ภ.ง.ด.1ก)
    // เงินได้จากนายจ้างเดิมในปีเดียวกัน (เข้างานระหว่างปี) ใช้กับวิธีสะสมและการปรับปลายปี
    prevYear: '', prevIncome: 0, prevTax: 0, prevSso: 0, prevPvd: 0 });
  Pay.ensure = (s) => {
    const p = (s.pay = s.pay || Pay.base());
    p.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), p.settings);
    p.items = p.items && p.items.length ? p.items : ITEMS.map((x) => ({ ...x }));
    ITEMS.filter((x) => x.sys && !p.items.some((y) => y.code === x.code)).forEach((x) => p.items.unshift({ ...x }));
    ['runs', 'inputs', 'stamps'].forEach((k) => (p[k] = p[k] || {}));
    p.configSeq = p.configSeq || 0;
    s.employees.forEach((e) => (e.pay = Object.assign(Pay.profile(), e.pay)));
    return p;
  };
  Pay.touch = (s, pk) => {
    const seq = E.bump(s);
    if (pk) s.pay.stamps[pk] = seq;
    else s.pay.configSeq = seq;
  };
  Pay.itemMap = (s) => {
    const m = {};
    s.pay.items.forEach((x) => (m[x.code] = x));
    return m;
  };
  Pay.payDate = (s, pk) => {
    const R = E.range(s, pk), d = +s.pay.settings.payDay;
    if (!d) return R.end;
    const last = U.daysBetween(`${R.end.slice(0, 7)}-01`, R.end).length;
    return `${R.end.slice(0, 7)}-${U.pad(Math.min(d, last))}`;
  };

  /* ---------------- ภาษีเงินได้บุคคลธรรมดา ---------------- */
  Pay.pit = (net, brackets) => {
    let tax = 0, prev = 0;
    for (const [cap, rate] of brackets) {
      const top = cap ? cap : Infinity;
      if (net > prev) tax += (Math.min(net, top) - prev) * (rate / 100);
      prev = top;
      if (net <= top) break;
    }
    return tax;
  };
  // ภาษีหัก ณ ที่จ่ายรายเดือน: regular × 12 คิดภาษีทั้งปี ÷ 12 + ภาษีส่วนเพิ่มของเงินได้ไม่แน่นอน
  // ค่าลดหย่อนทั้งปี (ประกันสังคมและกองทุนฯ เป็นยอดทั้งปี)
  Pay.allowances = (S, prof, ssoAnnual, pvdAnnual, income) => {
    const life = Math.min(+prof.life || 0, S.lifeMax);
    const health = Math.min(+prof.health || 0, S.healthMax, Math.max(0, S.lifeMax - life));
    const pvd = Math.min(pvdAnnual, income * (S.pvdMaxPct / 100), S.pvdMax);
    return S.personal + (prof.spouse ? S.spouse : 0) + (+prof.children || 0) * S.child + (+prof.parents || 0) * S.parent +
      life + health + ssoAnnual + pvd + (+prof.otherDed || 0);
  };
  Pay.netIncome = (S, income, allowances) => Math.max(0, income - Math.min(income * (S.expensePct / 100), S.expenseMax) - allowances);

  Pay.withholding = (S, prof, regular, irregular, ssoMonthly, pvdMonthly) => {
    const annualReg = Math.max(0, regular) * 12;
    const allowances = Pay.allowances(S, prof, ssoMonthly * 12, pvdMonthly * 12, annualReg);
    const netOf = (income) => Pay.netIncome(S, income, allowances);
    const regNet = netOf(annualReg);
    const regTax = Pay.pit(regNet, S.brackets);
    const irr = Math.max(0, irregular);
    const irrTax = irr ? Pay.pit(netOf(annualReg + irr), S.brackets) - regTax : 0;
    return { method: 'ANNUAL12', annualReg, allowances, regNet, regTax, monthly: regTax / 12, irrTax, tax: U.r2(regTax / 12 + irrTax) };
  };

  // วิธีสะสม (YTD) และการปรับปลายปี (true-up)
  //  o = { left: จำนวนเดือนที่เหลือหลังงวดนี้ (0 = ปรับปลายปี), prior: ยอดสะสมก่อนงวดนี้ (รวมนายจ้างเดิม), regular, irregular, sso, pvd }
  //  ประมาณการทั้งปี = สะสม + เงินได้แน่นอน × (เดือนที่เหลือ + 1) → ภาษีทั้งปี − ภาษีที่หักแล้ว เฉลี่ยเดือนที่เหลือ
  //  เงินได้ไม่แน่นอน: หักภาษีส่วนเพิ่มทั้งก้อนในเดือนที่จ่าย · left = 0: ภาษีทั้งปีจริง − ภาษีที่หักแล้ว (ติดลบได้ = หักไว้เกิน)
  Pay.withholdingYTD = (S, prof, o) => {
    const left = Math.max(0, o.left | 0), k = left + 1, P = o.prior;
    const reg = Math.max(0, o.regular), irr = Math.max(0, o.irregular);
    const incA = P.income + reg * k;
    const allowances = Pay.allowances(S, prof, P.sso + o.sso * k, P.pvd + o.pvd * k, incA + irr);
    const netA = Pay.netIncome(S, incA, allowances), netB = Pay.netIncome(S, incA + irr, allowances);
    const taxA = Pay.pit(netA, S.brackets), taxB = Pay.pit(netB, S.brackets);
    const irrTax = taxB - taxA;
    const regPart = left ? Math.max(0, (taxA - P.tax) / k) : taxA - P.tax;
    return {
      method: left ? 'YTD' : 'TRUEUP', left, annualIncome: U.r2(incA + irr), allowances, regNet: netA, annualNet: netB,
      regTax: taxA, annualTax: U.r2(taxB), priorTax: U.r2(P.tax), irrTax, tax: U.r2(regPart + irrTax),
    };
  };

  // ยอดสะสมของปีภาษีก่อนงวด pk (เฉพาะงวดที่ปิดแล้ว) + เงินได้จากนายจ้างเดิม
  Pay.prior = (s, pk, emp) => {
    const y = pk.slice(0, 4);
    const t = { income: 0, tax: 0, sso: 0, pvd: 0, ownTax: 0, months: 0, prevIncome: 0, prevTax: 0, pending: [] };
    for (const [k, run] of Object.entries(s.pay.runs)) {
      if (k.slice(0, 4) !== y || k >= pk) continue;
      const r = run.rows.find((x) => x.e === emp.id);
      if (!r) continue;
      if (run.status !== 'APPROVED') {
        t.pending.push(k);
        continue;
      }
      t.income += r.taxIncome;
      t.tax += r.tax;
      t.sso += r.sso;
      t.pvd += r.pvd;
      t.months++;
    }
    t.ownTax = t.tax;
    const p = emp.pay || {};
    if (p.prevYear && String(p.prevYear) === y) {
      t.prevIncome = +p.prevIncome || 0;
      t.prevTax = +p.prevTax || 0;
      t.income += t.prevIncome;
      t.tax += t.prevTax;
      t.sso += +p.prevSso || 0;
      t.pvd += +p.prevPvd || 0;
    }
    ['income', 'tax', 'sso', 'pvd', 'ownTax', 'prevIncome', 'prevTax'].forEach((k) => (t[k] = U.r2(t[k])));
    return t;
  };

  /* ---------------- คำนวณรายคน ---------------- */
  Pay.nights = (s, pk, empId, codes) => {
    const P = s.periods[pk];
    const set = new Set(String(codes || '').split(/[,\s]+/).filter(Boolean));
    if (!P || !P.calc || !set.size) return 0;
    return P.calc.filter((r) => r.e === empId && r.type === 'WORK' && set.has(r.code) && (r.in != null || r.out != null) && r.leave < 1).length;
  };
  // คิดภาษีหรือไม่: เงินได้ = ค่าตั้งต้นคิดภาษี (ยกเว้นตั้งไม่คิด) · เงินหัก = ค่าตั้งต้นหักหลังภาษี (ยกเว้นตั้งให้หักก่อนภาษี)
  Pay.itemTaxable = (it) => (it && it.kind === 'DED' ? it.taxable === true : !it || it.taxable !== false);
  Pay.inputTaxable = (inp, it) => (typeof inp.taxable === 'boolean' ? inp.taxable : Pay.itemTaxable(it));

  Pay.calcEmployee = (s, pk, tp, inputs, items) => {
    const S = s.pay.settings, emp = tp.emp, x = tp.x;
    const prof = Object.assign(Pay.profile(), emp.pay);
    const earn = [], ded = [];
    const add = (arr, code, amount, name, extra) => {
      amount = U.r2(+amount || 0);
      if (!amount) return;
      const it = items[code] || {};
      arr.push(Object.assign({ code, name: name || it.name || code, amount, taxable: Pay.itemTaxable(it), sso: !!it.sso, regular: !!it.regular }, extra));
    };
    add(earn, 'BASE', tp.base, Pay.baseLabel(emp, tp));
    for (const rt of tp.retro || []) add(earn, 'RETRO', rt.amount, `${rt.amount < 0 ? 'ปรับลดเงินเดือนจ่ายเกิน' : 'เงินเดือนตกเบิก'} งวด ${U.fmtPeriodShort(rt.pk)}`, { retroPk: rt.pk });
    [['ot1', 1], ['ot15', 1.5], ['ot2', 2], ['ot3', 3]].forEach(([k, rate]) => {
      if (x[k]) add(earn, 'OT', (x[k] / 60) * rate * tp.hourly, `ค่าล่วงเวลา ${rate} เท่า (${U.hrs(x[k])} ชม.)`, { hours: x[k] / 60, rate });
    });
    const nights = Pay.nights(s, pk, emp.id, S.nightCodes);
    if (nights && +S.nightRate) add(earn, 'SHIFT', nights * S.nightRate, `ค่ากะดึก ${nights} คืน × ${U.num(S.nightRate)}`);
    const allowLeave = new Set(S.diligAllowLeave || []);
    const breakingLeave = Object.entries(x.leave).reduce((t, [lt, v]) => t + (allowLeave.has(lt) ? 0 : v), 0);
    const dilig = !!prof.dilig && !x.lateCnt && !x.earlyCnt && !x.absent && !x.inc && !breakingLeave;
    if (dilig && +S.diligAmount) add(earn, 'DILIG', S.diligAmount);
    for (const [code, amt] of Object.entries(prof.recur || {})) {
      const it = items[code];
      if (it && !it.sys && +amt) add(it.kind === 'DED' ? ded : earn, code, amt, undefined, { recur: true });
    }
    // รายการประจำงวด: เลือกคิด/ไม่คิดภาษีรายบรรทัดได้ (ไม่ระบุ = ตามค่าของรายการ)
    for (const inp of inputs) {
      const it = items[inp.code];
      if (!it || it.sys) continue;
      const tx = Pay.inputTaxable(inp, it);
      const flag = tx === Pay.itemTaxable(it) ? '' : it.kind === 'DED' ? (tx ? ' · หักก่อนภาษี' : ' · หักหลังภาษี') : tx ? ' · คิดภาษี' : ' · ไม่คิดภาษี';
      add(it.kind === 'DED' ? ded : earn, inp.code, inp.amount, it.name + (inp.note ? ` (${inp.note})` : '') + flag, { input: inp.id, taxable: tx });
    }
    // หักตามเวลา (ลดฐานเงินได้ ประกันสังคม และภาษี)
    const time = [];
    const addT = (code, amount, name) => (amount = U.r2(amount)) && time.push({ code, name, amount, time: true });
    addT('ABS', tp.dAbsent, `หักขาดงาน ${U.num(x.absent, x.absent % 1 ? 1 : 0)} วัน`);
    addT('UNP', tp.dUnpaid, `หักลาไม่รับค่าจ้าง ${U.num(tp.unpaid, tp.unpaid % 1 ? 1 : 0)} วัน`);
    addT('LATE', tp.dLate, `หักมาสาย ${x.lateMin} นาที`);
    addT('EARLY', tp.dEarly, `หักกลับก่อน ${x.earlyMin} นาที`);
    const timeDed = U.r2(U.sum(time, (t) => t.amount));
    const gross = U.r2(U.sum(earn, (e) => e.amount));

    // ประกันสังคม (ปัดเศษตามระเบียบ: ≥ 50 สตางค์ปัดขึ้น)
    const ssoWage = U.r2(U.sum(earn.filter((e) => e.sso), (e) => e.amount) - timeDed);
    let ssoBase = 0, sso = 0, ssoEr = 0;
    if (prof.sso !== false && ssoWage > 0) {
      ssoBase = Math.min(Math.max(ssoWage, S.ssoMin), S.ssoMax);
      sso = Math.round((ssoBase * S.ssoRate) / 100);
      ssoEr = Math.round((ssoBase * S.ssoErRate) / 100);
    }
    // กองทุนสำรองเลี้ยงชีพ: % ของเงินเดือน (รายวัน: % ของค่าแรงที่ได้รับ)
    const pvdBasis = emp.payType === 'D' ? Math.max(0, tp.base - timeDed) : +tp.base;
    const pvd = +prof.pvd ? U.r2((pvdBasis * prof.pvd) / 100) : 0;
    const pvdEr = S.pvdErMatch ? pvd : 0;

    // ภาษีหัก ณ ที่จ่าย
    //  เงินได้ "ไม่คิดภาษี" ไม่นับเป็นเงินได้พึงประเมิน (ไม่อยู่ใน ภ.ง.ด.1 / 50 ทวิ / ภ.ง.ด.1ก)
    //  เงินหัก "คิดภาษี" (หักก่อนภาษี) ลดเงินได้พึงประเมิน: ประจำทุกเดือน → ลดเงินได้แน่นอน · รายงวด → ลดเงินได้ไม่แน่นอนก่อน
    const taxable = earn.filter((e) => e.taxable);
    const taxDedRecur = U.sum(ded.filter((d) => d.taxable && d.recur), (d) => d.amount);
    const taxDedOnce = U.sum(ded.filter((d) => d.taxable && !d.recur), (d) => d.amount);
    let regular = U.sum(taxable.filter((e) => e.regular), (e) => e.amount) - timeDed - taxDedRecur;
    let irregular = U.sum(taxable.filter((e) => !e.regular), (e) => e.amount) - taxDedOnce;
    if (irregular < 0) {
      regular += irregular;
      irregular = 0;
    }
    const nonTaxEarn = U.r2(U.sum(earn.filter((e) => !e.taxable), (e) => e.amount));
    const taxDed = U.r2(taxDedRecur + taxDedOnce);
    const month = +pk.slice(5, 7);
    const final = !!emp.end && emp.end <= E.range(s, pk).end; // งวดสุดท้ายของคนที่พ้นสภาพ
    const trueUp = S.trueUp !== false && (month === 12 || final);
    const prior = Pay.prior(s, pk, emp);
    const w = S.taxMethod === 'YTD' || trueUp
      ? Pay.withholdingYTD(S, prof, { left: trueUp ? 0 : 12 - month, prior, regular, irregular, sso, pvd })
      : Pay.withholding(S, prof, regular, irregular, sso, pvd);
    let tax = w.tax;
    if (tax < 0) tax = trueUp && S.trueUpRefund !== false ? Math.max(tax, -prior.ownTax) : 0;
    tax = U.r2(tax) || 0;
    const taxIncome = U.r2(Math.max(0, regular + irregular));

    const other = U.r2(U.sum(ded, (d) => d.amount));
    const statutory = [];
    if (sso) statutory.push({ code: 'SSO', name: `ประกันสังคม ${S.ssoRate}%`, amount: sso });
    if (pvd) statutory.push({ code: 'PVD', name: `กองทุนสำรองเลี้ยงชีพ ${prof.pvd}%`, amount: pvd });
    if (tax) statutory.push({ code: 'TAX', name: tax < 0 ? 'คืนภาษีที่หักไว้เกิน (ปรับปลายปี)' : trueUp ? 'ภาษีหัก ณ ที่จ่าย (ปรับปลายปี)' : 'ภาษีหัก ณ ที่จ่าย', amount: tax });
    const deductions = time.concat(statutory, ded);
    const totalDed = U.r2(timeDed + sso + pvd + tax + other);
    const net = U.r2(gross - totalDed);
    return {
      e: emp.id, code: emp.code, name: emp.name, dept: emp.dept, position: emp.position || '', payType: emp.payType, salary: +emp.salary,
      perDay: tp.perDay, hourly: tp.hourly, payDays: tp.payDays, base: U.r2(+tp.base || 0),
      prorate: tp.prorate || null, rateChanged: !!tp.rateChanged, start: emp.start || '', end: emp.end || '',
      retro: (tp.retro || []).map((r) => ({ pk: r.pk, amount: r.amount })),
      earn, deductions, gross, timeDed, ssoWage, ssoBase, sso, ssoEr, pvd, pvdEr, tax, taxIncome, nonTaxEarn, taxDed, other, totalDed, net,
      otPay: U.r2(U.sum(earn.filter((e) => e.code === 'OT'), (e) => e.amount)), nights, dilig,
      taxCalc: {
        method: w.method, pending: prior.pending, regular: U.r2(regular), irregular: U.r2(irregular), nonTaxEarn, taxDed, allowances: U.r2(w.allowances), annualNet: U.r2(w.regNet), annualTax: U.r2(w.regTax), irrTax: U.r2(w.irrTax),
        ...(w.method !== 'ANNUAL12' ? { left: w.left, annualIncome: w.annualIncome, annualTaxAll: w.annualTax, priorIncome: prior.income, priorTax: prior.tax, prevIncome: prior.prevIncome, prevTax: prior.prevTax } : {}),
      },
      time: { sched: x.sched, present: x.present, absent: x.absent, lateCnt: x.lateCnt, lateMin: x.lateMin, earlyMin: x.earlyMin, leaveDays: x.leaveDays, ot: x.ot },
      bank: prof.bank, acct: prof.acct, taxId: prof.taxId,
    };
  };

  Pay.baseLabel = (emp, tp) => {
    if (emp.payType === 'D') return `ค่าแรง ${U.num(tp.payDays, tp.payDays % 1 ? 1 : 0)} วัน` + (tp.rateChanged ? ' (มีปรับอัตราในงวด)' : ` × ${U.money(tp.perDay)}`);
    let t = 'เงินเดือน';
    const p = tp.prorate;
    if (p) t += ` ตามสัดส่วน ${p.days}/${p.by === 'DIV' ? p.div : p.total} วัน`;
    if (tp.rateChanged && tp.segs) t += ` (${tp.segs.map((g) => `${U.num(g.rate)} × ${g.days} วัน`).join(' + ')})`;
    return t;
  };

  /* ---------------- ตกเบิก (ปรับอัตราย้อนหลังไปยังงวดที่ปิดแล้ว) ---------------- */
  // เทียบฐานเงินเดือนที่ควรได้ตามประวัติอัตราปัจจุบัน กับที่จ่ายจริงในงวดที่ปิดแล้ว
  // นับเฉพาะงวดที่มีการบันทึกปรับอัตรา "หลัง" ปิดงวด และหักส่วนที่จ่ายตกเบิกไปแล้วในงวดอื่น
  // (ครอบคลุมเงินเดือน/ค่าแรงพื้นฐาน ไม่รวมส่วนต่าง OT และเงินหักตามเวลา)
  Pay.retro = (s, pk, emp) => {
    const hist = emp.rates || [];
    if (!hist.length) return [];
    const runs = Object.entries(s.pay.runs).filter(([, r]) => r.status === 'APPROVED');
    const out = [];
    for (const [k, run] of runs) {
      if (k >= pk) continue;
      const row = run.rows.find((r) => r.e === emp.id);
      if (!row) continue;
      const R = E.range(s, k);
      if (!hist.some((h) => h.from <= R.end && (!run.approvedAt || !h.at || h.at > run.approvedAt))) continue;
      const paid = row.base != null ? row.base : U.sum(row.earn.filter((x) => x.code === 'BASE'), (x) => x.amount);
      let settled = 0;
      for (const [k2, run2] of runs) {
        if (k2 === pk) continue;
        const r2 = run2.rows.find((r) => r.e === emp.id);
        ((r2 && r2.retro) || []).forEach((x) => x.pk === k && (settled += x.amount));
      }
      const diff = U.r2(E.payBase(s, k, emp).base - paid - settled);
      if (Math.abs(diff) >= 0.01) out.push({ pk: k, amount: diff });
    }
    return out.sort((a, b) => a.pk.localeCompare(b.pk));
  };
  // บันทึกปรับอัตราค่าจ้าง มีผลตั้งแต่วันที่ from (ถ้าย้อนไปงวดที่ปิดแล้ว จะเกิดตกเบิกในงวดถัดไปที่คำนวณ)
  Pay.setRate = (emp, salary, from, note) => {
    salary = +salary || 0;
    const old = E.rateOn(emp, U.addDays(from, -1));
    emp.rates = (emp.rates || []).filter((h) => h.from !== from);
    emp.rates.push({ from, old, salary, at: U.nowISO(), note: note || '' });
    emp.rates.sort((a, b) => a.from.localeCompare(b.from));
    // อัตราของวันหลังจาก from ที่บันทึกไว้แล้ว ให้ old ต่อเนื่องกัน
    for (let i = 1; i < emp.rates.length; i++) emp.rates[i].old = emp.rates[i - 1].salary;
    emp.salary = emp.rates[emp.rates.length - 1].salary;
    return emp;
  };

  /* ---------------- รันงวดเงินเดือน ---------------- */
  Pay.status = (s, pk) => {
    const P = s.periods[pk];
    const run = s.pay.runs[pk] || null;
    const last = P && P.transfers.length ? P.transfers[P.transfers.length - 1] : null;
    const timeReady = !!(P && P.locked && P.calc && last && last.seq === P.calcSeq);
    const approved = !!run && run.status === 'APPROVED';
    const stale = !!run && !approved && (!P || run.timeSeq !== P.calcSeq || run.seq < Math.max(s.pay.stamps[pk] || 0, s.pay.configSeq || 0));
    const key = approved ? 'APPROVED' : !timeReady ? 'NOTIME' : !run ? 'READY' : stale ? 'STALE' : 'DRAFT';
    return { run, timeReady, approved, stale, key, ...STATUS[key] };
  };
  Pay.run = (s, pk) => {
    const P = s.periods[pk];
    const items = Pay.itemMap(s);
    const inputs = s.pay.inputs[pk] || [];
    const R = E.range(s, pk);
    const rows = E.payroll(s, pk)
      .filter((tp) => E.activeIn(tp.emp, R))
      .map((tp) => Pay.calcEmployee(s, pk, Object.assign(tp, { retro: Pay.retro(s, pk, tp.emp) }), inputs.filter((i) => i.e === tp.emp.id), items));
    const prev = s.pay.runs[pk];
    const run = {
      pk, seq: E.bump(s), at: U.nowISO(), by: s.user.name, timeSeq: P ? P.calcSeq : 0, status: 'DRAFT',
      payDate: (prev && prev.payDate) || Pay.payDate(s, pk), rows, totals: Pay.totals(rows),
    };
    s.pay.runs[pk] = run;
    return run;
  };
  Pay.totals = (rows) => {
    const t = { n: rows.length };
    ['gross', 'otPay', 'timeDed', 'sso', 'ssoEr', 'pvd', 'pvdEr', 'tax', 'taxIncome', 'other', 'totalDed', 'net'].forEach((k) => (t[k] = U.r2(U.sum(rows, (r) => r[k]))));
    t.cost = U.r2(t.gross - t.timeDed + t.ssoEr + t.pvdEr);
    t.negative = rows.filter((r) => r.net < 0).length;
    return t;
  };

  /* ---------------- รายงานรายละเอียด / สรุปสำหรับฝ่ายบัญชี ---------------- */
  const TIME_DED = { ABS: 'หักขาดงาน', UNP: 'หักลาไม่รับค่าจ้าง', LATE: 'หักมาสาย', EARLY: 'หักกลับก่อน' };
  const STAT = { SSO: 'ประกันสังคม', PVD: 'กองทุนสำรองเลี้ยงชีพ', TAX: 'ภาษีหัก ณ ที่จ่าย' };
  // ผังบัญชีตั้งต้น (แก้ได้ที่ ตั้งค่าเงินเดือน > อัตรา) — รายการเงินได้/เงินหักกำหนดรหัสบัญชีเองได้ที่ตัวรายการ
  Pay.ACCOUNTS = {
    EXP: ['5110', 'เงินเดือนและค่าจ้าง'],
    OT: ['5120', 'ค่าล่วงเวลา'],
    ALLOW: ['5130', 'สวัสดิการและค่าตอบแทนอื่น'],
    BONUS: ['5140', 'โบนัสและค่านายหน้า'],
    SSO_ER: ['5150', 'เงินสมทบประกันสังคม (ส่วนนายจ้าง)'],
    PVD_ER: ['5160', 'เงินสมทบกองทุนสำรองเลี้ยงชีพ (ส่วนนายจ้าง)'],
    TAX_PAY: ['2130', 'ภาษีเงินได้หัก ณ ที่จ่ายค้างจ่าย (ภ.ง.ด.1)'],
    SSO_PAY: ['2140', 'เงินประกันสังคมค้างจ่าย'],
    PVD_PAY: ['2150', 'เงินกองทุนสำรองเลี้ยงชีพค้างจ่าย'],
    DED: ['2160', 'เงินหักพนักงานรอนำส่ง/ลูกหนี้พนักงาน'],
    NET_PAY: ['2110', 'เงินเดือนค้างจ่าย'],
  };
  // บัญชีตั้งต้นของรายการ (ถ้ารายการไม่ได้ระบุรหัสบัญชีเอง)
  const ITEM_ACCT = { BASE: 'EXP', RETRO: 'EXP', OT: 'OT', BONUS: 'BONUS', COMM: 'BONUS' };
  Pay.accounts = (s) => {
    const m = {};
    const own = (s.pay.settings && s.pay.settings.accounts) || {};
    for (const [k, [code, name]] of Object.entries(Pay.ACCOUNTS)) m[k] = { code: (own[k] && own[k].code) || code, name: (own[k] && own[k].name) || name };
    return m;
  };

  // คอลัมน์ของรายงานรายละเอียด: เฉพาะรายการที่มีในงวด เรียงตามลำดับในตั้งค่า
  Pay.detailColumns = (s, run) => {
    const items = s.pay.items, seen = { EARN: new Set(), DED: new Set(), TIME: new Set(), STAT: new Set() };
    for (const r of run.rows) {
      r.earn.forEach((e) => seen.EARN.add(e.code));
      r.deductions.forEach((d) => (d.time ? seen.TIME : STAT[d.code] ? seen.STAT : seen.DED).add(d.code));
    }
    const name = (c) => (items.find((x) => x.code === c) || {}).name || c;
    const order = (set) => [...set].sort((a, b) => {
      const ia = items.findIndex((x) => x.code === a), ib = items.findIndex((x) => x.code === b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    return {
      earn: order(seen.EARN).map((c) => ({ code: c, name: name(c) })),
      time: Object.keys(TIME_DED).filter((c) => seen.TIME.has(c)).map((c) => ({ code: c, name: TIME_DED[c] })),
      stat: Object.keys(STAT).filter((c) => seen.STAT.has(c)).map((c) => ({ code: c, name: STAT[c] })),
      ded: order(seen.DED).map((c) => ({ code: c, name: name(c) })),
    };
  };
  // ยอดรายคนตามรหัส (รวมหลายบรรทัดรหัสเดียวกัน เช่น OT หลายอัตรา)
  Pay.byCode = (r) => {
    const m = {};
    for (const x of r.earn) m['E:' + x.code] = U.r2((m['E:' + x.code] || 0) + x.amount);
    for (const x of r.deductions) m['D:' + x.code] = U.r2((m['D:' + x.code] || 0) + x.amount);
    return m;
  };

  // สรุปสำหรับฝ่ายบัญชี: ยอดตามรายการ + รายการบันทึกบัญชี (Dr = Cr) + ยอดที่ต้องจ่าย/นำส่ง
  Pay.accountingSummary = (s, run) => {
    const A = Pay.accounts(s), items = Pay.itemMap(s), T = run.totals;
    const cols = Pay.detailColumns(s, run);
    const sumCode = (kind, code) => U.r2(U.sum(run.rows, (r) => Pay.byCode(r)[kind + code] || 0));
    const earn = cols.earn.map((c) => ({ ...c, amount: sumCode('E:', c.code), n: run.rows.filter((r) => Pay.byCode(r)['E:' + c.code]).length, taxable: c.code === 'BASE' || Pay.itemTaxable(items[c.code]) }));
    const time = cols.time.map((c) => ({ ...c, amount: sumCode('D:', c.code) }));
    const ded = cols.ded.map((c) => ({ ...c, amount: sumCode('D:', c.code), n: run.rows.filter((r) => Pay.byCode(r)['D:' + c.code]).length }));
    const acctOf = (code, kind) => {
      const it = items[code] || {};
      if (it.acct) return { code: it.acct, name: it.acctName || it.name || code };
      const key = kind === 'DED' ? 'DED' : ITEM_ACCT[code] || (it.sys ? 'EXP' : 'ALLOW');
      return A[key];
    };
    // รวมบรรทัดบัญชีเดียวกัน
    const lines = [];
    const post = (acct, dr, cr, memo) => {
      if (!U.r2(dr) && !U.r2(cr)) return;
      let l = lines.find((x) => x.code === acct.code && x.name === acct.name);
      if (!l) lines.push((l = { code: acct.code, name: acct.name, dr: 0, cr: 0, memo: [] }));
      l.dr = U.r2(l.dr + dr);
      l.cr = U.r2(l.cr + cr);
      if (memo && !l.memo.includes(memo)) l.memo.push(memo);
    };
    earn.forEach((e) => post(acctOf(e.code, 'EARN'), e.amount, 0, e.name));
    time.forEach((t) => post(acctOf('BASE', 'EARN'), 0, t.amount, t.name)); // หักขาด/สาย ลดค่าใช้จ่ายเงินเดือน
    post(A.SSO_ER, T.ssoEr, 0);
    post(A.PVD_ER, T.pvdEr, 0);
    post(A.TAX_PAY, 0, T.tax);
    post(A.SSO_PAY, 0, U.r2(T.sso + T.ssoEr), `ลูกจ้าง ${U.money(T.sso)} + นายจ้าง ${U.money(T.ssoEr)}`);
    post(A.PVD_PAY, 0, U.r2(T.pvd + T.pvdEr), `ลูกจ้าง ${U.money(T.pvd)} + นายจ้าง ${U.money(T.pvdEr)}`);
    ded.forEach((d) => post(acctOf(d.code, 'DED'), 0, d.amount, d.name));
    post(A.NET_PAY, 0, T.net, 'จ่ายสุทธิพนักงาน');
    // ยอดติดลบ (เช่น คืนภาษีปลายปี) ย้ายข้าง
    for (const l of lines) {
      const v = U.r2(l.dr - l.cr);
      l.dr = v > 0 ? v : 0;
      l.cr = v < 0 ? -v : 0;
    }
    const dr = U.r2(U.sum(lines, (l) => l.dr)), cr = U.r2(U.sum(lines, (l) => l.cr));
    // การจ่ายเงิน
    const pay = run.rows.filter((r) => r.net > 0);
    const banks = {};
    pay.filter((r) => r.acct).forEach((r) => {
      const b = (banks[r.bank || '-'] = banks[r.bank || '-'] || { n: 0, amount: 0 });
      b.n++;
      b.amount = U.r2(b.amount + r.net);
    });
    const cash = pay.filter((r) => !r.acct);
    // ตามแผนก (ศูนย์ต้นทุน)
    const depts = {};
    run.rows.forEach((r) => {
      const d = (depts[r.dept] = depts[r.dept] || { dept: r.dept, n: 0, gross: 0, timeDed: 0, ssoEr: 0, pvdEr: 0, cost: 0, net: 0 });
      d.n++;
      ['gross', 'timeDed', 'ssoEr', 'pvdEr', 'net'].forEach((k) => (d[k] = U.r2(d[k] + r[k])));
      d.cost = U.r2(d.gross - d.timeDed + d.ssoEr + d.pvdEr);
    });
    return {
      earn, time, ded, totals: T, lines, dr, cr, balanced: Math.abs(dr - cr) < 0.005,
      banks, bankTotal: U.r2(U.sum(Object.values(banks), (b) => b.amount)), cash: { n: cash.length, amount: U.r2(U.sum(cash, (r) => r.net)) },
      depts: Object.values(depts).sort((a, b) => a.dept.localeCompare(b.dept)),
      remit: [
        { what: 'ภาษีหัก ณ ที่จ่าย (ภ.ง.ด.1)', amount: T.tax, due: `${U.periodShift(run.payDate.slice(0, 7), 1)}-07`, note: 'ยื่นออนไลน์ขยายถึงวันที่ 15' },
        { what: 'เงินสมทบประกันสังคม (สปส.1-10)', amount: U.r2(T.sso + T.ssoEr), due: `${U.periodShift(run.pk, 1)}-15` },
        { what: 'กองทุนสำรองเลี้ยงชีพ', amount: U.r2(T.pvd + T.pvdEr), due: '', note: 'ตามกำหนดของกองทุน' },
      ].filter((x) => x.amount),
    };
  };

  // ตรวจความพร้อมก่อนอนุมัติ
  Pay.checks = (s, pk) => {
    const st = Pay.status(s, pk), run = st.run;
    const out = [];
    const add = (ok, level, label, detail, link) => out.push({ ok, level, label, detail, link });
    add(st.timeReady || st.approved, 'error', 'ได้รับผลบันทึกเวลาแล้ว (ขั้นตอนที่ 9)', st.timeReady || st.approved ? 'ส่งและล็อกรอบแล้ว' : 'ยังไม่ได้ส่งผลบันทึกเวลา', 'export');
    add(!!run && !st.stale, 'error', 'คำนวณเงินเดือนเป็นปัจจุบัน', !run ? 'ยังไม่ได้คำนวณ' : st.stale ? 'มีการเปลี่ยนแปลงหลังคำนวณ' : 'เป็นปัจจุบัน', 'payroll');
    if (run) {
      const neg = run.rows.filter((r) => r.net < 0);
      add(!neg.length, 'error', 'ไม่มีเงินได้สุทธิติดลบ', neg.length ? `${neg.length} คน: ${neg.slice(0, 3).map((r) => r.code).join(', ')}` : 'ทุกคนสุทธิ ≥ 0', 'payroll');
      const noBank = run.rows.filter((r) => r.net > 0 && (!r.bank || !r.acct));
      add(!noBank.length, 'warn', 'มีบัญชีธนาคารครบ', noBank.length ? `ไม่มีบัญชี ${noBank.length} คน` : 'ครบทุกคน', 'paysetup');
      const noTax = run.rows.filter((r) => (r.tax > 0 || r.sso > 0) && !r.taxId);
      add(!noTax.length, 'warn', 'มีเลขประจำตัวผู้เสียภาษีครบ', noTax.length ? `ไม่มีเลข ${noTax.length} คน` : 'ครบทุกคน', 'paysetup');
      const badTax = run.rows.filter((r) => r.taxId && !U.taxIdValid(r.taxId));
      add(!badTax.length, 'warn', 'เลขประจำตัวผู้เสียภาษีถูกต้อง (หลักตรวจสอบ)', badTax.length ? `ไม่ถูกต้อง ${badTax.length} คน: ${badTax.slice(0, 3).map((r) => r.code).join(', ')}` : 'ถูกต้องทุกคน', 'paysetup');
      const co = s.pay.settings.companyTaxId;
      add(!!co && U.taxIdValid(co), 'warn', 'ข้อมูลนายจ้างครบ (เลขผู้เสียภาษีบริษัท)', !co ? 'ยังไม่ได้กรอก — ตั้งค่าเงินเดือน > อัตรา' : U.taxIdValid(co) ? 'ถูกต้อง' : 'หลักตรวจสอบไม่ถูกต้อง', 'paysetup');
      const pend = [...new Set(run.rows.flatMap((r) => (r.taxCalc && r.taxCalc.pending) || []))].sort();
      if (pend.length) add(false, 'warn', 'งวดก่อนหน้าในปีเดียวกันปิดครบ', `ภาษีสะสม/ปรับปลายปีไม่นับงวดที่ยังไม่ปิด: ${pend.map(U.fmtPeriodShort).join(', ')}`, 'payroll');
      const tu = run.rows.filter((r) => r.taxCalc && r.taxCalc.method === 'TRUEUP');
      if (tu.length) {
        const refund = tu.filter((r) => r.tax < 0);
        add(true, 'info', 'ปรับภาษีปลายปี (true-up)', `${tu.length} คน${refund.length ? ` · คืนภาษี ${refund.length} คน รวม ${U.money(-U.sum(refund, (r) => r.tax))} บาท` : ''}`, 'payroll');
      }
      const prorated = run.rows.filter((r) => r.prorate);
      const retro = run.rows.filter((r) => r.retro && r.retro.length);
      if (prorated.length || retro.length)
        add(true, 'info', 'เข้า-ออกระหว่างงวด / ตกเบิก', [prorated.length ? `ตามสัดส่วนวัน ${prorated.length} คน (${prorated.slice(0, 3).map((r) => r.code).join(', ')})` : '', retro.length ? `ตกเบิก ${retro.length} คน` : ''].filter(Boolean).join(' · '), 'payroll');
    }
    return { checks: out, errors: out.filter((c) => !c.ok && c.level === 'error').length, warns: out.filter((c) => !c.ok && c.level === 'warn').length, st };
  };

  /* ---------------- สะสมทั้งปี ---------------- */
  // รวมงวดที่ปิดแล้วในปีเดียวกันก่อนหน้า + งวดนี้ (แม้ยังไม่อนุมัติ)
  Pay.ytd = (s, empId, pk) => {
    const y = pk.slice(0, 4);
    const t = { gross: 0, taxIncome: 0, tax: 0, sso: 0, pvd: 0, net: 0, months: 0 };
    for (const [k, run] of Object.entries(s.pay.runs)) {
      if (k.slice(0, 4) !== y || k > pk || (k !== pk && run.status !== 'APPROVED')) continue;
      const r = run.rows.find((x) => x.e === empId);
      if (!r) continue;
      ['gross', 'taxIncome', 'tax', 'sso', 'pvd', 'net'].forEach((f) => (t[f] += r[f]));
      t.months++;
    }
    Object.keys(t).forEach((k) => (t[k] = U.r2(t[k])));
    return t;
  };
  Pay.yearSummary = (s, year) => {
    const by = {};
    const runs = Object.entries(s.pay.runs).filter(([k, r]) => k.slice(0, 4) === String(year) && r.status === 'APPROVED').sort();
    for (const [k, run] of runs) {
      for (const r of run.rows) {
        const x = (by[r.e] = by[r.e] || { e: r.e, code: r.code, name: r.name, dept: r.dept, taxId: r.taxId, months: [], gross: 0, taxIncome: 0, tax: 0, sso: 0, pvd: 0, net: 0 });
        x.months.push(k);
        ['gross', 'taxIncome', 'tax', 'sso', 'pvd', 'net'].forEach((f) => (x[f] = U.r2(x[f] + r[f])));
      }
    }
    return { periods: runs.map(([k]) => k), rows: Object.values(by) };
  };

  /* ---------------- จำนวนเงินเป็นตัวอักษร ---------------- */
  const DIG = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const POS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  const readInt = (n, higher) => {
    if (n >= 1e6) {
      const rest = n % 1e6;
      return readInt(Math.floor(n / 1e6), higher) + 'ล้าน' + (rest ? readInt(rest, true) : '');
    }
    const str = String(n);
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const d = +str[i], p = str.length - i - 1;
      if (!d) continue;
      if (p === 1 && d === 1) out += 'สิบ';
      else if (p === 1 && d === 2) out += 'ยี่สิบ';
      else if (p === 0 && d === 1 && (str.length > 1 || higher)) out += 'เอ็ด';
      else out += DIG[d] + POS[p];
    }
    return out;
  };
  Pay.bahtText = (amount) => {
    let a = Math.round((+amount || 0) * 100);
    const neg = a < 0;
    a = Math.abs(a);
    const baht = Math.floor(a / 100), satang = a % 100;
    let t = baht ? readInt(baht) + 'บาท' : satang ? '' : 'ศูนย์บาท';
    t += satang ? readInt(satang) + 'สตางค์' : 'ถ้วน';
    return (neg ? 'ลบ' : '') + t;
  };
  Pay.maskAcct = (a) => (a ? String(a).replace(/\d(?=[\d-]{4})/g, '•') : '');
})(typeof window !== 'undefined' ? window : globalThis);

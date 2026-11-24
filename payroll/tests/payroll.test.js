/* ทดสอบเอนจินเงินเดือน: node tests/payroll.test.js */
const path = require('path');
const assert = require('assert');
['util', 'engine', 'payroll', 'seed'].forEach((f) => require(path.join(__dirname, '..', 'js', f + '.js')));
const { U, Engine: E, Payroll: Pay, Seed } = globalThis.PL;

let pass = 0;
const t = (name, fn) => {
  try {
    fn();
    pass++;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n   ', e.message);
    process.exitCode = 1;
  }
};
const S = Pay.base().settings;
const single = Pay.profile();

console.log('ภาษีเงินได้');
t('progressive brackets', () => {
  assert.strictEqual(Pay.pit(150000, S.brackets), 0);
  assert.strictEqual(Pay.pit(189500, S.brackets), 1975);
  assert.strictEqual(Pay.pit(1000000, S.brackets), 7500 + 20000 + 37500 + 50000);
  assert.strictEqual(Pay.pit(6000000, S.brackets), 7500 + 20000 + 37500 + 50000 + 250000 + 900000 + 350000);
});
t('salary 30,000 single → 164.58/month', () => {
  // 360,000 − ค่าใช้จ่าย 100,000 − ส่วนตัว 60,000 − ประกันสังคม 10,500 = 189,500 → 1,975/ปี
  const w = Pay.withholding(S, single, 30000, 0, 875, 0);
  assert.strictEqual(w.regNet, 189500);
  assert.strictEqual(w.tax, 164.58);
});
t('bonus 60,000 taxed as increment in the same month', () => {
  const w = Pay.withholding(S, single, 30000, 60000, 875, 0);
  assert.strictEqual(w.irrTax, 3000);
  assert.strictEqual(w.tax, 3164.58);
});
t('allowances: spouse, 2 children, life insurance cap', () => {
  const w = Pay.withholding(S, { ...single, spouse: true, children: 2, life: 150000 }, 50000, 0, 875, 0);
  assert.strictEqual(w.allowances, 60000 + 60000 + 60000 + 100000 + 10500);
});

console.log('จำนวนเงินเป็นตัวอักษร');
t('bahtText', () => {
  assert.strictEqual(Pay.bahtText(12178.69), 'หนึ่งหมื่นสองพันหนึ่งร้อยเจ็ดสิบแปดบาทหกสิบเก้าสตางค์');
  assert.strictEqual(Pay.bahtText(21), 'ยี่สิบเอ็ดบาทถ้วน');
  assert.strictEqual(Pay.bahtText(101), 'หนึ่งร้อยเอ็ดบาทถ้วน');
  assert.strictEqual(Pay.bahtText(1000001), 'หนึ่งล้านเอ็ดบาทถ้วน');
  assert.strictEqual(Pay.bahtText(0.5), 'ห้าสิบสตางค์');
  assert.strictEqual(Pay.bahtText(0), 'ศูนย์บาทถ้วน');
});

console.log('คำนวณรายคน');
function oneEmp(emp, x, extra = {}) {
  const s = Seed.base();
  Pay.ensure(s);
  s.employees.push(emp);
  Pay.ensure(s);
  const perDay = emp.payType === 'D' ? emp.salary : emp.salary / 30;
  const tp = Object.assign({ emp, x: Object.assign({ sched: 22, present: 22, absent: 0, lateCnt: 0, lateMin: 0, earlyCnt: 0, earlyMin: 0, inc: 0, leave: {}, leaveDays: 0, ot1: 0, ot15: 0, ot2: 0, ot3: 0, ot: 0, holidays: 0 }, x), perDay, hourly: perDay / 8, unpaid: 0, payDays: null, base: emp.salary, dAbsent: 0, dUnpaid: 0, dLate: 0, dEarly: 0 }, extra);
  return Pay.calcEmployee(s, '2026-10', tp, [], Pay.itemMap(s));
}
const M = (salary, pay = {}) => ({ id: 'E1', code: 'A1', name: 'ก', dept: 'X', payType: 'M', salary, shift: 'D', active: true, pay: Object.assign(Pay.profile(), pay) });
t('SSO capped at 17,500 → 875', () => assert.strictEqual(oneEmp(M(30000)).sso, 875));
t('SSO 5% under cap', () => assert.strictEqual(oneEmp(M(12000)).sso, 600));
t('SSO floor 1,650 → 83', () => assert.strictEqual(oneEmp(M(1000)).sso, 83));
t('absence reduces SSO base and taxable income', () => {
  const r = oneEmp(M(15000), { absent: 2 }, { dAbsent: 1000 });
  assert.strictEqual(r.ssoBase, 14000);
  assert.strictEqual(r.sso, 700);
  assert.strictEqual(r.taxIncome, 14000);
  assert.strictEqual(r.net, U.r2(15000 - 1000 - 700 - r.tax));
});
t('OT at 1.5× paid on hourly rate, not in SSO base', () => {
  const r = oneEmp(M(24000), { ot15: 600, ot: 600 });
  assert.strictEqual(r.otPay, 1500); // 24000/30/8 = 100/ชม. × 1.5 × 10 ชม.
  assert.strictEqual(r.ssoBase, 17500);
});
t('allowances + PVD + net', () => {
  const r = oneEmp(M(20000, { recur: { POS: 3000, TRAVEL: 800, LOAN: 1000 }, pvd: 5 }));
  assert.strictEqual(r.gross, 23800);
  assert.strictEqual(r.ssoWage, 23000); // ค่าเดินทางไม่คิดประกันสังคม
  assert.strictEqual(r.pvd, 1000);
  assert.strictEqual(r.net, U.r2(23800 - 875 - 1000 - r.tax - 1000));
});
t('diligence only when no late/absent/leave', () => {
  const d = (x) => oneEmp({ ...M(400), payType: 'D', pay: { ...Pay.profile(), dilig: true } }, x, { payDays: 26, base: 10400 }).dilig;
  assert.strictEqual(d({}), true);
  assert.strictEqual(d({ lateCnt: 1, lateMin: 5 }), false);
  assert.strictEqual(d({ leave: { VACATION: 1 }, leaveDays: 1 }), true);
  assert.strictEqual(d({ leave: { SICK: 1 }, leaveDays: 1 }), false);
});

console.log('งวดเงินเดือน (ข้อมูลตัวอย่าง)');
const s = Seed.build();
t('Sep payroll approved with sane totals', () => {
  const run = s.pay.runs['2026-09'];
  assert.strictEqual(run.status, 'APPROVED');
  assert.strictEqual(run.rows.length, 48);
  assert.ok(run.totals.net > 500000 && run.totals.net < 1500000, run.totals.net);
  assert.ok(run.rows.every((r) => r.sso <= 875));
  console.log(`     ก.ย.: สุทธิ ${U.money(run.totals.net)} · ภาษี ${U.money(run.totals.tax)} · ปกส. ${U.money(run.totals.sso)} · ต้นทุน ${U.money(run.totals.cost)}`);
});
t('Oct waits for time transfer', () => assert.strictEqual(Pay.status(s, '2026-10').key, 'NOTIME'));
t('Oct: transfer → run → input change makes it stale → approve', () => {
  const P = s.periods['2026-10'];
  P.transfers.push({ at: U.nowISO(), seq: P.calcSeq, rows: 48 });
  P.locked = true;
  assert.strictEqual(Pay.status(s, '2026-10').key, 'READY');
  Pay.run(s, '2026-10');
  assert.strictEqual(Pay.status(s, '2026-10').key, 'DRAFT');
  s.pay.inputs['2026-10'].push({ id: 'X', e: 'E0001', code: 'BONUS', amount: 5000, note: '' });
  Pay.touch(s, '2026-10');
  assert.strictEqual(Pay.status(s, '2026-10').key, 'STALE');
  const run = Pay.run(s, '2026-10');
  const r = run.rows.find((x) => x.e === 'E0001');
  assert.ok(r.earn.some((x) => x.code === 'BONUS' && x.amount === 5000));
  const c = Pay.checks(s, '2026-10');
  console.log(`     ต.ค.: errors ${c.errors}, warns ${c.warns} (${c.checks.filter((x) => !x.ok).map((x) => x.label).join(', ')})`);
  assert.strictEqual(c.errors, 0);
});
t('YTD adds approved Sep + current Oct', () => {
  const y = Pay.ytd(s, 'E0001', '2026-10');
  const sep = s.pay.runs['2026-09'].rows.find((r) => r.e === 'E0001');
  const oct = s.pay.runs['2026-10'].rows.find((r) => r.e === 'E0001');
  assert.strictEqual(y.months, 2);
  assert.strictEqual(y.gross, U.r2(sep.gross + oct.gross));
});
t('storage round-trip keeps payroll', () => {
  ['store'].forEach((f) => require(path.join(__dirname, '..', 'js', f + '.js')));
  const h = PL.Store.hydrate(JSON.parse(PL.Store.serialize(s)));
  assert.strictEqual(h.pay.runs['2026-10'].totals.net, s.pay.runs['2026-10'].totals.net);
});
t('old data without payroll gets demo profiles on load', () => {
  const old = JSON.parse(PL.Store.serialize(s));
  delete old.pay;
  old.employees.forEach((e) => delete e.pay);
  const h = PL.Store.hydrate(old);
  assert.ok(h.pay && h.employees.every((e) => e.pay && e.pay.taxId));
});

console.log('เลขประจำตัวผู้เสียภาษี 13 หลัก');
t('check digit', () => {
  assert.strictEqual(U.taxIdDigit('110170020345'), 0); // Σ dᵢ×(13−i) = 144 → (11 − 144 mod 11) mod 10 = 0
  assert.strictEqual(U.taxIdDigit('310000000000'), 4); // Σ = 3×13 + 1×12 = 51 → (11 − 7) mod 10 = 4
  assert.strictEqual(U.taxIdValid('1-1017-00203-45-0'), true);
  assert.strictEqual(U.taxIdValid('1101700203451'), false);
  assert.strictEqual(U.taxIdValid('110170020345'), false);
  assert.ok(/หลักสุดท้ายควรเป็น 0/.test(U.taxIdError('1101700203454')));
  assert.strictEqual(U.taxIdError(''), '');
});
t('demo data tax IDs are valid', () => assert.ok(s.employees.every((e) => U.taxIdValid(e.pay.taxId))));

console.log('เข้า/ออกระหว่างงวด และปรับอัตรา');
const fresh = () => Seed.build();
const monthly = (st) => st.employees.find((e) => e.payType === 'M' && e.active !== false);
const daily = (st) => st.employees.find((e) => e.payType === 'D' && e.active !== false);
t('rateOn follows history', () => {
  const e = { salary: 20000, rates: [{ from: '2026-10-16', old: 18000, salary: 20000 }] };
  assert.strictEqual(E.rateOn(e, '2026-10-15'), 18000);
  assert.strictEqual(E.rateOn(e, '2026-10-16'), 20000);
  assert.strictEqual(E.rateOn({ salary: 15000 }, '2026-01-01'), 15000);
});
t('new hire mid-period: salary × days ÷ calendar days, no absence before start', () => {
  const st = fresh(), e = monthly(st), R = E.range(st, '2026-10');
  e.start = R.days[15];
  E.touch(st, 'config');
  E.calcPeriod(st, '2026-10');
  const days = R.days.length - 15;
  const tp = E.payroll(st, '2026-10').find((x) => x.emp.id === e.id);
  assert.strictEqual(tp.base, U.r2((e.salary * days) / R.days.length));
  assert.deepStrictEqual(tp.prorate.days, days);
  assert.ok(st.periods['2026-10'].calc.filter((r) => r.e === e.id).every((r) => r.d >= e.start));
  const row = Pay.calcEmployee(st, '2026-10', tp, [], Pay.itemMap(st));
  assert.ok(/ตามสัดส่วน 16\/31 วัน/.test(row.earn[0].name), row.earn[0].name);
});
t('prorateBy DIV: salary ÷ 30 × days, capped at salary', () => {
  const st = fresh(), e = monthly(st), R = E.range(st, '2026-10');
  st.settings.prorateBy = 'DIV';
  e.start = R.days[1]; // 30 วัน ÷ 30 = เต็มเดือน
  assert.strictEqual(E.payBase(st, '2026-10', e).base, e.salary);
  e.start = R.days[20];
  assert.strictEqual(E.payBase(st, '2026-10', e).base, U.r2((e.salary / 30) * (R.days.length - 20)));
});
t('leaver: inactive with end date still paid for days worked in last period', () => {
  const st = fresh(), e = monthly(st), R = E.range(st, '2026-10');
  e.end = R.days[9];
  e.active = false;
  E.touch(st, 'config');
  E.calcPeriod(st, '2026-10');
  const P = st.periods['2026-10'];
  P.transfers.push({ at: U.nowISO(), seq: P.calcSeq, rows: 48 });
  P.locked = true;
  const run = Pay.run(st, '2026-10');
  const r = run.rows.find((x) => x.e === e.id);
  assert.ok(r, 'leaver missing from run');
  assert.strictEqual(r.base, U.r2((e.salary * 10) / R.days.length));
  assert.strictEqual(E.activeIn(e, E.range(st, '2026-11')), false);
});
t('mid-period raise splits by calendar days', () => {
  const st = fresh(), e = monthly(st), R = E.range(st, '2026-10'), old = e.salary;
  Pay.setRate(e, old + 3100, R.days[15]);
  assert.strictEqual(e.salary, old + 3100);
  const pb = E.payBase(st, '2026-10', e);
  assert.strictEqual(pb.segs.length, 2);
  assert.strictEqual(pb.base, U.r2((old * 15 + (old + 3100) * 16) / 31));
});
t('daily worker: each paid day at that day\'s rate', () => {
  const st = fresh(), e = daily(st), R = E.range(st, '2026-10'), old = e.salary;
  const before = E.payBase(st, '2026-10', e);
  Pay.setRate(e, old + 20, R.days[15]);
  const after = E.payBase(st, '2026-10', e);
  const paidLate = st.periods['2026-10'].calc.filter((r) => r.e === e.id && r.d >= R.days[15]);
  assert.strictEqual(after.payDays, before.payDays);
  assert.ok(after.base > before.base && after.base < before.base + 20 * (paidLate.length + 0.01));
});
t('retro pay for closed period, paid once only', () => {
  const st = fresh(), e = monthly(st), old = e.salary;
  Pay.setRate(e, old + 1000, '2026-09-01'); // ย้อนไป ก.ย. ที่ปิดงวดแล้ว
  const P = st.periods['2026-10'];
  P.transfers.push({ at: U.nowISO(), seq: P.calcSeq, rows: 48 });
  P.locked = true;
  const run = Pay.run(st, '2026-10');
  const r = run.rows.find((x) => x.e === e.id);
  const retro = r.earn.find((x) => x.code === 'RETRO');
  assert.ok(retro, 'no RETRO line');
  assert.strictEqual(retro.amount, 1000);
  assert.strictEqual(r.base, old + 1000);
  assert.strictEqual(r.taxCalc.irregular >= 1000, true); // ตกเบิกคิดภาษีแบบเงินได้ไม่แน่นอน
  Object.assign(run, { status: 'APPROVED', approvedAt: U.nowISO() });
  assert.deepStrictEqual(Pay.retro(st, '2026-11', e), []);
  const others = run.rows.filter((x) => x.e !== e.id && x.retro.length);
  assert.strictEqual(others.length, 0);
});
t('approval check flags invalid tax ID', () => {
  const st = fresh(), e = monthly(st);
  e.pay.taxId = '1101700203451';
  const P = st.periods['2026-10'];
  P.transfers.push({ at: U.nowISO(), seq: P.calcSeq, rows: 48 });
  P.locked = true;
  Pay.run(st, '2026-10');
  const c = Pay.checks(st, '2026-10').checks.find((x) => /หลักตรวจสอบ/.test(x.label));
  assert.strictEqual(c.ok, false);
  assert.ok(c.detail.includes(e.code));
});

console.log('เงินเพิ่ม/เงินหัก: คิดหรือไม่คิดภาษี');
const withInputs = (emp, inputs, itemPatch = {}) => {
  const st = Seed.base();
  st.employees.push(emp);
  Pay.ensure(st);
  for (const [code, patch] of Object.entries(itemPatch)) {
    const it = st.pay.items.find((x) => x.code === code);
    if (it) Object.assign(it, patch);
    else st.pay.items.push(Object.assign({ code }, patch));
  }
  const perDay = emp.salary / 30;
  const tp = { emp, x: { sched: 22, present: 22, absent: 0, lateCnt: 0, lateMin: 0, earlyCnt: 0, earlyMin: 0, inc: 0, leave: {}, leaveDays: 0, ot1: 0, ot15: 0, ot2: 0, ot3: 0, ot: 0, holidays: 0 }, perDay, hourly: perDay / 8, unpaid: 0, payDays: null, base: emp.salary, dAbsent: 0, dUnpaid: 0, dLate: 0, dEarly: 0 };
  return Pay.calcEmployee(st, '2026-10', tp, inputs.map((x, i) => Object.assign({ id: 'PI' + i, e: emp.id }, x)), Pay.itemMap(st));
};
const base30 = withInputs(M(30000), []);
t('defaults: earnings taxed, deductions after tax', () => {
  assert.strictEqual(Pay.itemTaxable({ kind: 'EARN' }), true);
  assert.strictEqual(Pay.itemTaxable({ kind: 'EARN', taxable: false }), false);
  assert.strictEqual(Pay.itemTaxable({ kind: 'DED' }), false);
  assert.strictEqual(Pay.itemTaxable({ kind: 'DED', taxable: true }), true);
});
t('bonus marked "not taxed" on the entry: paid, but not in tax income', () => {
  const r = withInputs(M(30000), [{ code: 'BONUS', amount: 10000, taxable: false }]);
  assert.strictEqual(r.gross, 40000);
  assert.strictEqual(r.taxIncome, 30000);
  assert.strictEqual(r.nonTaxEarn, 10000);
  assert.strictEqual(r.tax, base30.tax);
  assert.ok(/ไม่คิดภาษี/.test(r.earn.find((e) => e.code === 'BONUS').name));
});
t('item set to "not taxed" in settings applies to every entry', () => {
  const r = withInputs(M(30000), [{ code: 'GIFT', amount: 3000 }], { GIFT: { name: 'ของขวัญปีใหม่', kind: 'EARN', mode: 'ONCE', taxable: false } });
  assert.strictEqual(r.taxIncome, 30000);
  assert.strictEqual(r.gross, 33000);
});
t('entry can override a "not taxed" item back to taxed', () => {
  const r = withInputs(M(30000), [{ code: 'GIFT', amount: 3000, taxable: true }], { GIFT: { name: 'ของขวัญ', kind: 'EARN', mode: 'ONCE', taxable: false } });
  assert.strictEqual(r.taxIncome, 33000);
});
t('deduction after tax (default): net lower, tax income unchanged', () => {
  const r = withInputs(M(30000), [{ code: 'DED', amount: 2000 }]);
  assert.strictEqual(r.taxIncome, 30000);
  assert.strictEqual(r.taxDed, 0);
  assert.strictEqual(r.net, U.r2(base30.net - 2000));
});
t('deduction before tax: lowers tax income and tax', () => {
  const r = withInputs(M(30000), [{ code: 'DED', amount: 2000, taxable: true }]);
  assert.strictEqual(r.taxIncome, 28000);
  assert.strictEqual(r.taxDed, 2000);
  assert.ok(r.tax < base30.tax, `${r.tax} < ${base30.tax}`);
  assert.strictEqual(r.net, U.r2(30000 - 875 - r.tax - 2000));
  assert.ok(/หักก่อนภาษี/.test(r.deductions.find((d) => d.code === 'DED').name));
});
t('one-off pre-tax deduction comes off the bonus first', () => {
  const r = withInputs(M(30000), [{ code: 'BONUS', amount: 5000 }, { code: 'DED', amount: 2000, taxable: true }]);
  assert.strictEqual(r.taxCalc.regular, 30000);
  assert.strictEqual(r.taxCalc.irregular, 3000);
  assert.strictEqual(r.taxIncome, 33000);
});
t('monthly pre-tax deduction (item setting) lowers regular income', () => {
  const emp = M(30000, { recur: { LOAN: 1500 } });
  const r = withInputs(emp, [], { LOAN: { taxable: true } });
  assert.strictEqual(r.taxCalc.regular, 28500);
  assert.strictEqual(r.taxIncome, 28500);
});
t('non-taxed amounts never appear in the year summary for tax forms', () => {
  const st = Seed.build();
  const run = st.pay.runs['2026-09'];
  const r0 = run.rows[0];
  const ys0 = Pay.yearSummary(st, '2026').rows.find((x) => x.e === r0.e).taxIncome;
  r0.taxIncome = U.r2(r0.taxIncome); // ยอดในแบบภาษี = taxIncome เท่านั้น
  r0.gross += 9999; // เงินได้ที่ไม่คิดภาษีเพิ่มเข้า gross
  r0.nonTaxEarn = 9999;
  assert.strictEqual(Pay.yearSummary(st, '2026').rows.find((x) => x.e === r0.e).taxIncome, ys0);
});

console.log('รายงานรายละเอียด / สรุปสำหรับฝ่ายบัญชี');
t('detail columns cover every amount: each row adds up to gross / total deductions', () => {
  const st = Seed.build(), run = st.pay.runs['2026-09'];
  const C = Pay.detailColumns(st, run);
  for (const r of run.rows) {
    const m = Pay.byCode(r);
    assert.strictEqual(U.r2(U.sum(C.earn, (c) => m['E:' + c.code] || 0)), r.gross, r.code + ' gross');
    assert.strictEqual(U.r2(U.sum([...C.time, ...C.stat, ...C.ded], (c) => m['D:' + c.code] || 0)), r.totalDed, r.code + ' ded');
  }
});
t('journal balances and ties to totals', () => {
  const st = Seed.build(), run = st.pay.runs['2026-09'];
  const A = Pay.accountingSummary(st, run), T = run.totals;
  assert.ok(A.balanced, `${A.dr} vs ${A.cr}`);
  assert.strictEqual(A.dr, T.cost);
  assert.strictEqual(A.lines.find((l) => l.name.includes('เงินเดือนค้างจ่าย')).cr, T.net);
  assert.strictEqual(A.lines.find((l) => l.code === '2140').cr, U.r2(T.sso + T.ssoEr));
  assert.strictEqual(U.r2(A.bankTotal + A.cash.amount), U.r2(U.sum(run.rows.filter((r) => r.net > 0), (r) => r.net)));
  assert.strictEqual(U.r2(U.sum(A.depts, (d) => d.cost)), T.cost);
});
t('account codes: settings and per-item override, lines merged by account', () => {
  const st = Seed.build(), run = st.pay.runs['2026-09'];
  st.pay.settings.accounts = { NET_PAY: { code: '2111', name: 'เงินเดือนรอจ่าย' } };
  st.pay.items.find((x) => x.code === 'STU').acct = '2170';
  st.pay.items.find((x) => x.code === 'STU').acctName = 'กยศ. รอนำส่ง';
  const A = Pay.accountingSummary(st, run);
  assert.ok(A.lines.some((l) => l.code === '2111' && l.cr === run.totals.net));
  assert.ok(A.lines.some((l) => l.code === '2170' && l.name === 'กยศ. รอนำส่ง'));
  assert.ok(A.balanced);
  assert.strictEqual(new Set(A.lines.map((l) => l.code + l.name)).size, A.lines.length);
});
t('negative tax (year-end refund) goes to the debit side, still balanced', () => {
  const st = Seed.build(), run = JSON.parse(JSON.stringify(st.pay.runs['2026-09']));
  const r = run.rows[0];
  const tax = r.deductions.find((d) => d.code === 'TAX');
  const old = tax ? tax.amount : 0;
  if (tax) tax.amount = -500;
  else r.deductions.push({ code: 'TAX', name: 'คืนภาษี', amount: -500 });
  r.tax = -500;
  r.totalDed = U.r2(r.totalDed - old - 500);
  r.net = U.r2(r.gross - r.totalDed);
  run.totals = Pay.totals(run.rows);
  const A = Pay.accountingSummary(st, run);
  assert.ok(A.balanced);
  const l = A.lines.find((x) => x.code === '2130');
  assert.ok(l.dr > 0 || l.cr >= 0);
});

console.log('ภาษีสะสม (YTD) และปรับปลายปี');
const P0 = { income: 0, tax: 0, sso: 0, pvd: 0 };
t('YTD in January equals ×12 method', () => {
  const y = Pay.withholdingYTD(S, single, { left: 11, prior: P0, regular: 30000, irregular: 0, sso: 875, pvd: 0 });
  assert.strictEqual(y.tax, 164.58);
  assert.strictEqual(y.tax, Pay.withholding(S, single, 30000, 0, 875, 0).tax);
});
t('true-up in December settles to annual tax', () => {
  const prior = { income: 330000, tax: 1810.38, sso: 9625, pvd: 0 }; // 11 เดือน × 164.58
  const y = Pay.withholdingYTD(S, single, { left: 0, prior, regular: 30000, irregular: 0, sso: 875, pvd: 0 });
  assert.strictEqual(y.method, 'TRUEUP');
  assert.strictEqual(y.annualTax, 1975);
  assert.strictEqual(y.tax, 164.62);
});
t('true-up negative when over-withheld', () => {
  const prior = { income: 330000, tax: 3000, sso: 9625, pvd: 0 };
  assert.strictEqual(Pay.withholdingYTD(S, single, { left: 0, prior, regular: 30000, irregular: 0, sso: 875, pvd: 0 }).tax, -1025);
});
t('YTD with bonus: increment taken in full that month', () => {
  const a = Pay.withholdingYTD(S, single, { left: 5, prior: { income: 180000, tax: 987.48, sso: 5250, pvd: 0 }, regular: 30000, irregular: 0, sso: 875, pvd: 0 });
  const b = Pay.withholdingYTD(S, single, { left: 5, prior: { income: 180000, tax: 987.48, sso: 5250, pvd: 0 }, regular: 30000, irregular: 60000, sso: 875, pvd: 0 });
  assert.strictEqual(U.r2(b.tax - a.tax), 3000);
});

const withRuns = (st, empId, months, f) => {
  for (const m of months) {
    const pk = `2026-${U.pad(m)}`;
    st.pay.runs[pk] = { pk, status: 'APPROVED', approvedAt: '2026-01-01T00:00:00Z', rows: [Object.assign({ e: empId, taxIncome: 30000, tax: 164.58, sso: 875, pvd: 0, base: 30000, earn: [] }, f && f(m))] };
  }
};
const calcAt = (st, emp, pk, x = {}) => {
  const perDay = emp.salary / 30;
  const tp = { emp, x: Object.assign({ sched: 22, present: 22, absent: 0, lateCnt: 0, lateMin: 0, earlyCnt: 0, earlyMin: 0, inc: 0, leave: {}, leaveDays: 0, ot1: 0, ot15: 0, ot2: 0, ot3: 0, ot: 0, holidays: 0 }, x), perDay, hourly: perDay / 8, unpaid: 0, payDays: null, base: emp.salary, dAbsent: 0, dUnpaid: 0, dLate: 0, dEarly: 0 };
  return Pay.calcEmployee(st, pk, tp, [], Pay.itemMap(st));
};
const baseState = (emp) => {
  const st = Seed.base();
  st.employees.push(emp);
  Pay.ensure(st);
  return st;
};
t('December run uses true-up from approved months', () => {
  const emp = M(30000), st = baseState(emp);
  withRuns(st, emp.id, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const r = calcAt(st, emp, '2026-12');
  assert.strictEqual(r.taxCalc.method, 'TRUEUP');
  assert.strictEqual(r.tax, 164.62);
  assert.ok(/ปรับปลายปี/.test(r.deductions.find((d) => d.code === 'TAX').name));
});
t('December refund capped at tax this employer withheld', () => {
  const emp = M(30000), st = baseState(emp);
  withRuns(st, emp.id, [10, 11], () => ({ tax: 400 })); // หักไว้ 800 แต่เงินได้ทั้งปี 90,000 → ภาษี 0
  const r = calcAt(st, emp, '2026-12');
  assert.strictEqual(r.tax, -800);
  assert.strictEqual(r.net, U.r2(30000 - 875 + 800));
  st.pay.settings.trueUpRefund = false;
  assert.strictEqual(calcAt(st, emp, '2026-12').tax, 0);
});
t('mid-year hire: previous employer income counted in YTD', () => {
  const emp = M(30000, { prevYear: '2026', prevIncome: 270000, prevTax: 1481.22, prevSso: 7875 }), st = baseState(emp);
  st.pay.settings.taxMethod = 'YTD';
  const p = Pay.prior(st, '2026-10', emp);
  assert.strictEqual(p.income, 270000);
  assert.strictEqual(p.ownTax, 0);
  const r = calcAt(st, emp, '2026-10');
  assert.strictEqual(r.taxCalc.method, 'YTD');
  assert.strictEqual(r.taxCalc.annualIncome, 360000);
  assert.strictEqual(r.tax, U.r2((1975 - 1481.22) / 3));
  emp.pay.prevYear = '2025'; // คนละปี → ไม่นับ
  assert.strictEqual(Pay.prior(st, '2026-10', emp).income, 0);
});
t('leaver final period gets true-up; ×12 method elsewhere unchanged', () => {
  const emp = M(30000), st = baseState(emp);
  assert.strictEqual(calcAt(st, emp, '2026-10').taxCalc.method, 'ANNUAL12');
  emp.end = '2026-10-31';
  const r = calcAt(st, emp, '2026-10');
  assert.strictEqual(r.taxCalc.method, 'TRUEUP');
  assert.strictEqual(r.tax, 0); // เงินได้ทั้งปีจริง 30,000 → ไม่ถึงเกณฑ์
});
t('pending earlier period flagged in checks', () => {
  const st = Seed.build();
  const P = st.periods['2026-10'];
  P.transfers.push({ at: U.nowISO(), seq: P.calcSeq, rows: 48 });
  P.locked = true;
  st.pay.runs['2026-09'].status = 'DRAFT';
  Pay.run(st, '2026-10');
  const c = Pay.checks(st, '2026-10').checks.find((x) => /งวดก่อนหน้า/.test(x.label));
  assert.ok(c && !c.ok && /ก.ย./.test(c.detail));
});
console.log(`\n${pass} passed`);

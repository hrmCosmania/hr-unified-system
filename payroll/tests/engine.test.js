/* ทดสอบเอนจินคำนวณ: node tests/engine.test.js */
const path = require('path');
const assert = require('assert');
['util', 'engine', 'payroll', 'seed'].forEach((f) => require(path.join(__dirname, '..', 'js', f + '.js')));
const { U, Engine: E, Seed } = globalThis.PL;

let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; } };

console.log('util');
t('dow', () => { assert.strictEqual(U.dow('2026-10-01'), 4); assert.strictEqual(U.dow('2026-10-04'), 0); });
t('tmin/tstr round trip', () => assert.strictEqual(U.tstr(U.tmin('2026-10-31 23:59')), '2026-10-31 23:59'));
t('periodRange calendar', () => { const r = U.periodRange('2026-02', 0); assert.strictEqual(r.end, '2026-02-28'); assert.strictEqual(r.days.length, 28); });
t('periodRange cutoff 25', () => { const r = U.periodRange('2026-01', 25); assert.strictEqual(r.start, '2025-12-26'); assert.strictEqual(r.end, '2026-01-25'); });
t('periodOf cutoff', () => { assert.strictEqual(U.periodOf('2026-10-26', 25), '2026-11'); assert.strictEqual(U.periodOf('2026-12-26', 25), '2027-01'); });

console.log('parse');
t('formats', () => {
  const r = E.parsePunchText('รหัส,วันที่,เวลา\nEMP0001,2026-10-01,07:55\n1001\t2026-10-01 17:05:22\t1\t0\nEMP0002,01/10/2569,08:01\nbad line');
  assert.strictEqual(r.rows.length, 3);
  assert.deepStrictEqual(r.rows[2], { c: 'EMP0002', t: '2026-10-01 08:01' });
  assert.strictEqual(r.errors.length, 1);
});

console.log('mapping + calc (mini scenario)');
function mini() {
  const s = Seed.base();
  s.employees.push({ id: 'E1', code: 'A1', card: '1', name: 'ก', dept: 'X', payType: 'M', salary: 30000, shift: 'D', pattern: 'SIX', active: true });
  s.employees.push({ id: 'E2', code: 'A2', card: '2', name: 'ข', dept: 'X', payType: 'D', salary: 400, shift: 'N', pattern: 'SIX', active: true });
  const days = E.range(s, '2026-10').days;
  E.applyPattern(s, ['E1'], days, 'SIX');
  days.forEach((d) => (s.roster['E2|' + d] = U.dow(d) === 0 ? 'OFF' : 'N'));
  const P = (c, t) => s.punches.push({ c, t, src: 'test' });
  // E1: 1 ต.ค. ปกติ, 2 ต.ค. สาย 20 นาที + OT 2 ชม. (อนุมัติ), 3 ต.ค. (ส.) ลืมสแกนออก, 5 ต.ค. ขาด, 6 ต.ค. ลาครึ่งเช้า สาย
  P('A1', '2026-10-01 07:50'); P('A1', '2026-10-01 07:51'); P('A1', '2026-10-01 17:03');
  P('A1', '2026-10-02 08:20'); P('A1', '2026-10-02 19:10');
  P('A1', '2026-10-03 07:58');
  P('A1', '2026-10-06 13:10'); P('A1', '2026-10-06 17:00');
  P('A1', '2026-10-04 08:00'); P('A1', '2026-10-04 17:00'); // อาทิตย์ = วันหยุด มาทำงาน (มีคำขอ)
  s.requests.push({ id: 'OT-1', kind: 'OT', e: 'E1', date: '2026-10-02', otStart: '2026-10-02 17:00', otEnd: '2026-10-02 19:00', status: 'APPROVED' });
  s.requests.push({ id: 'LV-1', kind: 'LEAVE', e: 'E1', date: '2026-10-06', dateTo: '2026-10-06', part: 'AM', leaveType: 'SICK', status: 'APPROVED' });
  s.requests.push({ id: 'OT-2', kind: 'OT', e: 'E1', date: '2026-10-04', otStart: '2026-10-04 08:00', otEnd: '2026-10-04 17:00', status: 'APPROVED' });
  // E2 กะดึก: 1 ต.ค. 19:55 → 2 ต.ค. 05:02 ; 2 ต.ค. 20:10 → 3 ต.ค. 05:00
  P('2', '2026-10-01 19:55'); P('2', '2026-10-02 05:02');
  P('2', '2026-10-02 20:10'); P('2', '2026-10-03 05:00');
  E.touch(s, 'punches'); E.touch(s, 'roster'); E.touch(s, 'requests');
  E.calcPeriod(s, '2026-10');
  const get = (e, d) => s.periods['2026-10'].calc.find((r) => r.e === e && r.d === d);
  return { s, get };
}
const { s, get } = mini();
t('normal day + dedupe', () => { const r = get('E1', '2026-10-01'); assert.strictEqual(r.st, 'NORMAL'); assert.strictEqual(r.work, 480); });
t('late 20 + OT 120 approved', () => { const r = get('E1', '2026-10-02'); assert.strictEqual(r.late, 20); assert.strictEqual(r.ot15, 120); assert.strictEqual(r.st, 'LATE'); });
t('missing out → incomplete', () => { const r = get('E1', '2026-10-03'); assert.strictEqual(r.st, 'INCOMPLETE'); assert.strictEqual(r.inc, 'OUT'); });
t('no punches → absent', () => { const r = get('E1', '2026-10-05'); assert.strictEqual(r.st, 'ABSENT'); assert.strictEqual(r.absent, 1); });
t('half-day AM leave, late after 13:00', () => { const r = get('E1', '2026-10-06'); assert.strictEqual(r.leave, 0.5); assert.strictEqual(r.late, 10); assert.strictEqual(r.absent, 0); });
t('holiday work monthly → OT1 8h', () => { const r = get('E1', '2026-10-04'); assert.strictEqual(r.st, 'HOLIDAY_WORK'); assert.strictEqual(r.ot1, 480); assert.strictEqual(r.ot3, 0); });
t('night shift crosses midnight', () => { const r = get('E2', '2026-10-01'); assert.strictEqual(r.st, 'NORMAL'); assert.strictEqual(U.clock(r.out), '05:02'); });
t('night shift late 10', () => { const r = get('E2', '2026-10-02'); assert.strictEqual(r.late, 10); assert.strictEqual(r.st, 'LATE'); });
t('approve ADJ fixes incomplete', () => {
  s.requests.push({ id: 'AJ-1', kind: 'ADJ', e: 'E1', date: '2026-10-03', adjIn: '', adjOut: '2026-10-03 17:00', status: 'APPROVED' });
  E.touch(s, 'requests', ['2026-10-03']);
  assert.ok(E.calcStale(s, '2026-10'));
  E.calcPeriod(s, '2026-10');
  const r = get('E1', '2026-10-03'); assert.strictEqual(r.st, 'NORMAL'); assert.strictEqual(r.adj, 'AJ-1');
});
t('payroll OT pay', () => {
  const row = E.payroll(s, '2026-10').find((r) => r.emp.id === 'E1');
  // hourly = 30000/30/8 = 125 ; OT1.5 2h = 375 ; OT1 8h = 1000
  assert.strictEqual(row.otPay, 1375);
});

t('night shift then holiday work: morning punch belongs to holiday', () => {
  const s2 = Seed.base();
  s2.employees.push({ id: 'E9', code: 'Z9', card: '9', name: 'ค', dept: 'X', payType: 'D', salary: 400, shift: 'D', pattern: 'ROTATE', active: true });
  const days = E.range(s2, '2026-10').days;
  days.forEach((d) => (s2.roster['E9|' + d] = 'N'));
  s2.roster['E9|2026-10-23'] = 'HOL';
  ['2026-10-22 19:55', '2026-10-23 05:03', '2026-10-23 07:52', '2026-10-23 17:06'].forEach((t) => s2.punches.push({ c: '9', t }));
  s2.requests.push({ id: 'OT-9', kind: 'OT', e: 'E9', date: '2026-10-23', otStart: '2026-10-23 08:00', otEnd: '2026-10-23 17:00', status: 'APPROVED' });
  E.calcPeriod(s2, '2026-10');
  const c = (d) => s2.periods['2026-10'].calc.find((r) => r.d === d);
  assert.strictEqual(U.clock(c('2026-10-22').out), '05:03');
  assert.strictEqual(c('2026-10-22').st, 'NORMAL');
  assert.strictEqual(U.clock(c('2026-10-23').in), '07:52');
  assert.strictEqual(c('2026-10-23').st, 'HOLIDAY_WORK');
  assert.strictEqual(c('2026-10-23').ot2, 480); // รายวัน ทำงานวันหยุด 2 เท่า 8 ชม.
});

console.log('demo seed');
const t0 = Date.now();
const demo = Seed.build();
const ms = Date.now() - t0;
t('seed builds fast', () => assert.ok(ms < 3000, ms + 'ms'));
t('Sep transferred & locked', () => assert.ok(demo.periods['2026-09'].locked));
t('Oct pipeline', () => {
  const p = E.pipeline(demo, '2026-10');
  console.log('     punches', p.punches, '| pending', p.pending, '| incomplete', p.inc, '| unknown', p.unknown, '| mapStale', p.mapStale, '| calcStale', p.calcStale);
  assert.ok(p.punches > 2000); assert.ok(!p.mapStale && !p.calcStale);
});
t('Oct summary sane', () => {
  const T = E.summary(demo, '2026-10').T;
  console.log('     completeRate', T.completeRate.toFixed(2), '| late', T.lateCnt, '| absent', T.absent, '| leave', T.leaveDays, '| OT h', (T.ot / 60).toFixed(1), '| orphans', demo.periods['2026-10'].mapStats.orphanCount);
  assert.ok(T.completeRate > 95);
});
t('Sep has no incomplete', () => assert.strictEqual(E.summary(demo, '2026-09').T.inc, 0));
const size = JSON.stringify(demo).length;
console.log(`     state size ${(size / 1024).toFixed(0)} KB, seed ${ms} ms`);
console.log(`\n${pass} passed`);

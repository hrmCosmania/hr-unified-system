/* ทดสอบการแบ่ง/รวมเอกสารสำหรับฐานข้อมูลคลาวด์ และสิทธิ์ตามบทบาท: node tests/store.test.js */
const path = require('path');
const assert = require('assert');
['util', 'engine', 'payroll', 'seed', 'store'].forEach((f) => require(path.join(__dirname, '..', 'js', f + '.js')));
const { U, Payroll: Pay, Seed, Store } = globalThis.PL;

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
const viaJson = (x) => JSON.parse(JSON.stringify(x));
const s = Seed.build();

console.log('แบ่ง/รวมเอกสาร');
const docs = Store.split(s);
t('document keys', () => {
  const keys = Object.keys(docs);
  ['meta', 'config', 'employees', 'pay_profiles', 'roster', 'requests', 'imports', 'pay_config', 'period:2026-09', 'period:2026-10', 'pay_run:2026-09'].forEach((k) => assert.ok(keys.includes(k), k));
  assert.ok(keys.some((k) => k.startsWith('punches:')));
  console.log(`     ${keys.length} เอกสาร: ${keys.map((k) => `${k} ${Math.round(JSON.stringify(docs[k]).length / 1024)}KB`).join(', ')}`);
});
t('salary and tax data only in pay_profiles', () => {
  const emp = Object.values(docs.employees)[0];
  assert.strictEqual(emp.salary, undefined);
  assert.strictEqual(emp.pay, undefined);
  assert.ok(Object.values(docs.pay_profiles)[0].pay.taxId);
  assert.strictEqual(docs.config.settings.period, undefined);
});
t('round trip keeps everything (except selected period)', () => {
  const h = Store.hydrate(Store.join(viaJson(docs)), { noDemoPay: true });
  h.settings.period = s.settings.period;
  h.user = s.user;
  h.log = s.log;
  const a = JSON.parse(Store.serialize(s)), b = JSON.parse(Store.serialize(h));
  a.requests.sort((x, y) => x.id.localeCompare(y.id));
  b.requests.sort((x, y) => x.id.localeCompare(y.id));
  for (const k of Object.keys(a)) assert.deepStrictEqual(b[k], a[k], k);
});
t('re-split after round trip has the same content; split is deterministic', () => {
  const h = Store.hydrate(Store.join(viaJson(docs)), { noDemoPay: true });
  const d2 = Store.split(h);
  for (const k of Object.keys(docs)) {
    try {
      assert.deepStrictEqual(viaJson(d2[k]), viaJson(docs[k]));
    } catch (e) {
      throw new Error('content differs: ' + k);
    }
  }
  // snapshot ของการบันทึกใช้ JSON ของ split(state) ที่โหลดแล้ว → ไม่เปลี่ยน = ไม่บันทึกซ้ำ
  const d3 = Store.split(h);
  for (const k of Object.keys(d2)) assert.strictEqual(JSON.stringify(d3[k]), JSON.stringify(d2[k]), k);
});
t('manager view (no pay docs) still loads without inventing pay data', () => {
  const md = viaJson(docs);
  Object.keys(md).filter((k) => Store.docClass(k) === 'pay').forEach((k) => delete md[k]);
  const h = Store.hydrate(Store.join(md), { noDemoPay: true });
  assert.ok(h.employees.length === 48 && h.employees.every((e) => !e.pay.taxId && !e.salary));
  assert.deepStrictEqual(h.pay.runs, {});
});

console.log('สิทธิ์ตามบทบาท (ตรงกับ RLS)');
t('read/write matrix', () => {
  const R = (role, k) => Store.canRead(role, k), W = (role, k) => Store.canWrite(role, k);
  assert.ok(R('manager', 'employees') && !R('manager', 'pay_profiles') && !R('manager', 'pay_run:2026-10'));
  assert.ok(W('manager', 'requests') && W('manager', 'roster') && W('manager', 'period:2026-10') && !W('manager', 'employees') && !W('manager', 'config'));
  assert.ok(R('accountant', 'pay_profiles') && W('accountant', 'pay_run:2026-10') && !W('accountant', 'employees'));
  assert.ok(W('hr', 'config') && W('admin', 'pay_config'));
  assert.ok(!R('pending', 'employees') && !W('employee', 'requests'));
});

console.log('ดึงพนักงานจาก HR Unified');
t('sync adds new, updates names/depts, keeps pay data, reports missing', () => {
  const st = Seed.build();
  const e1 = st.employees[0], salary = e1.salary, taxId = e1.pay.taxId;
  const list = [
    { emp_code: e1.code.toLowerCase(), name: 'ชื่อใหม่ จาก HRU', department: 'บัญชี', position: 'นักบัญชี', company: 'CMN', hire_date: '2019-04-01', active: true },
    { emp_code: 'N9001', name: 'นางสาวใหม่ ทดสอบ', department: 'ฝ่ายใหม่', position: 'เจ้าหน้าที่', company: 'CMN', hire_date: '2026-11-01', active: true },
    { emp_code: 'N9002', name: 'คนบริษัทอื่น', department: 'X', company: 'CIL', active: true },
    { emp_code: 'N9003', name: 'ลาออกแล้ว', company: 'CMN', active: false },
  ];
  const r = Store.syncEmployees(st, list, { company: 'CMN', update: true });
  assert.strictEqual(r.added.length, 1);
  assert.strictEqual(r.updated.length, 1);
  assert.strictEqual(r.skipped, 2);
  assert.strictEqual(e1.name, 'ชื่อใหม่ จาก HRU');
  assert.strictEqual(e1.salary, salary);
  assert.strictEqual(e1.pay.taxId, taxId);
  assert.ok(e1.start, 'kept existing start date');
  const n = st.employees.find((e) => e.code === 'N9001');
  assert.ok(n && n.salary === 0 && n.start === '2026-11-01' && n.dept === 'ฝ่ายใหม่' && st.depts.includes('ฝ่ายใหม่'));
  assert.strictEqual(new Set(st.employees.map((e) => e.id)).size, st.employees.length, 'unique ids');
  assert.strictEqual(r.missing.length, 47);
  const again = Store.syncEmployees(st, list, { company: 'CMN' });
  assert.strictEqual(again.added.length + again.updated.length, 0, 'idempotent');
});
t('sync without update keeps existing names', () => {
  const st = Seed.build(), e1 = st.employees[0], old = e1.name;
  Store.syncEmployees(st, [{ emp_code: e1.code, name: 'อื่น', department: 'Y' }], { update: false });
  assert.strictEqual(e1.name, old);
});
console.log(`\n${pass} passed`);

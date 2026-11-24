/* ทดสอบตรรกะบันทึกขึ้นคลาวด์ (เทียบ snapshot, แบ่งชุด, เวอร์ชันชน, สิทธิ์, ตัวนับ) กับฐานข้อมูลจำลอง: node tests/cloud.test.js
 * ฐานข้อมูลจำลองทำงานตามกติกาเดียวกับ plfl_save() ใน supabase/001_plfl_schema.sql */
const path = require('path');
const assert = require('assert');

// สภาพแวดล้อมเบราว์เซอร์ขั้นต่ำ
globalThis.window = globalThis;
globalThis.location = { search: '', hash: '', origin: 'http://localhost', pathname: '/' };
globalThis.document = { getElementById: () => null, visibilityState: 'hidden', body: { classList: { add() {}, remove() {} } } };
const ls = {};
globalThis.localStorage = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => (ls[k] = String(v)) };
globalThis.PL_CONFIG = { supabaseUrl: 'https://example.invalid', supabaseKey: 'test' };
['util', 'engine', 'payroll', 'seed', 'store', 'cloud'].forEach((f) => require(path.join(__dirname, '..', 'js', f + '.js')));
const { U, Seed, Store, Cloud } = globalThis.PL;
const ui = { toasts: [], confirms: 0 };
globalThis.PL.UI = { toast: (m) => ui.toasts.push(m), confirm: async () => (ui.confirms++, true) };
globalThis.PL.App = { current: null, rerender() {}, refreshChrome() {} };

// ฐานข้อมูลจำลอง
function mockDb(role) {
  const db = { docs: {}, calls: [], activity: [], role };
  const err = (message) => ({ data: null, error: { message } });
  db.client = {
    rpc: async (fn, args) => {
      if (fn !== 'plfl_save') return err('unknown rpc');
      db.calls.push(args.p_docs.map((d) => d.key));
      const out = {};
      const next = JSON.parse(JSON.stringify(db.docs));
      for (const d of args.p_docs) {
        if (!Store.canWrite(db.role, d.key)) return err('ไม่มีสิทธิ์แก้ไขข้อมูล ' + d.key);
        const cur = next[d.key];
        if (d.key === 'meta' && cur && d.data) {
          const m = Object.assign({}, cur.data, d.data, { seq: Math.max(cur.data.seq || 0, d.data.seq || 0), counters: {} });
          for (const k of new Set([...Object.keys(cur.data.counters || {}), ...Object.keys(d.data.counters || {})])) m.counters[k] = Math.max((cur.data.counters || {})[k] || 0, (d.data.counters || {})[k] || 0);
          next[d.key] = { data: m, version: cur.version + 1 };
          out.meta = cur.version + 1;
          out.meta_data = m;
          continue;
        }
        if (cur && cur.version !== d.version) return err(`conflict:${d.key}:คนอื่น`);
        if (d.data == null) {
          delete next[d.key];
          out[d.key] = 0;
        } else if (!cur) {
          if (d.version !== 0) return err(`conflict:${d.key}:(ถูกลบ)`);
          next[d.key] = { data: JSON.parse(JSON.stringify(d.data)), version: 1 };
          out[d.key] = 1;
        } else {
          next[d.key] = { data: JSON.parse(JSON.stringify(d.data)), version: cur.version + 1 };
          out[d.key] = cur.version + 1;
        }
      }
      db.docs = next; // ทั้งชุดสำเร็จหรือไม่สำเร็จพร้อมกัน (transaction)
      return { data: out, error: null };
    },
    from: (table) => ({
      select: () => {
        const rows = () => Object.entries(db.docs).filter(([k]) => Store.canRead(db.role, k)).map(([key, v]) => ({ key, data: JSON.parse(JSON.stringify(v.data)), version: v.version }));
        const q = { then: (res) => res({ data: table === 'plfl_doc' ? rows() : [], error: null }), order: () => q, limit: () => q };
        return q;
      },
      insert: async (r) => (db.activity.push(...r), { error: null }),
    }),
  };
  return db;
}
const connect = (db, s) => {
  Object.assign(Cloud, { sb: db.client, profile: { name: 'ทดสอบ', email: 't@x', role: db.role, user_id: 'u1' }, versions: {}, snap: {}, pendingLog: [], dirty: false, chain: Promise.resolve() });
  Cloud.loading = () => {};
  Cloud.setStatus = () => {};
  Store.backend = Cloud;
  Store.role = db.role;
  if (s) Store.s = s;
};

let pass = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);

t('first upload: all docs, split into batches ≤ ~700KB', async () => {
  const db = mockDb('admin');
  connect(db, Seed.build());
  Cloud.dirty = true;
  assert.strictEqual(await Cloud.saveNow(), true);
  assert.strictEqual(Object.keys(db.docs).length, Object.keys(Store.split(Store.s)).length);
  assert.ok(db.calls.length >= 2, `calls ${db.calls.length}`);
  console.log(`     ${Object.keys(db.docs).length} เอกสาร ใน ${db.calls.length} ครั้ง`);
  t.db = db;
});
t('no change → nothing sent', async () => {
  const db = t.db, n = db.calls.length;
  Store.save();
  await Cloud.saveNow();
  assert.strictEqual(db.calls.length, n);
});
t('edit one employee → only that document (+ activity log)', async () => {
  const db = t.db;
  Store.s.employees[0].name = 'นายแก้ไข ทดสอบ';
  Store.log('แก้ไขพนักงาน', 'EMP0001');
  Store.save();
  await Cloud.saveNow();
  assert.deepStrictEqual(db.calls[db.calls.length - 1], ['employees']);
  assert.strictEqual(db.docs.employees.data.E0001.name, 'นายแก้ไข ทดสอบ');
  assert.strictEqual(db.activity[db.activity.length - 1].action, 'แก้ไขพนักงาน');
});
t('reload from server reproduces the same state', async () => {
  const before = JSON.parse(Store.serialize(Store.s));
  await Cloud.reload();
  const after = JSON.parse(Store.serialize(Store.s));
  for (const k of ['employees', 'punches', 'roster', 'periods', 'pay', 'settings']) assert.deepStrictEqual(after[k], before[k], k);
});
t('version conflict → user warned, local change dropped, server kept', async () => {
  const db = t.db;
  db.docs.requests.version += 1; // ผู้ใช้อื่นบันทึกก่อน
  db.docs.requests.data['LV-9999'] = { id: 'LV-9999', kind: 'LEAVE', e: 'E0001', date: '2026-10-01', status: 'PENDING', createdAt: 'x' };
  const c0 = ui.confirms;
  Store.s.requests[0].status = 'REJECTED';
  Store.save();
  assert.strictEqual(await Cloud.saveNow(), false);
  assert.strictEqual(ui.confirms, c0 + 1);
  assert.ok(Store.s.requests.some((r) => r.id === 'LV-9999'), 'reloaded server data');
});
t('counters merge: server keeps the max of all users', async () => {
  const db = t.db;
  db.docs.meta.data.seq += 500;
  db.docs.meta.data.counters.LV = 9999;
  Store.s.seq += 1;
  Store.save();
  await Cloud.saveNow();
  assert.strictEqual(Store.s.counters.LV, 9999);
  assert.ok(Store.s.seq >= db.docs.meta.data.seq);
});
t('removed period → document deleted', async () => {
  const db = t.db;
  delete Store.s.periods['2026-10'];
  Store.save();
  await Cloud.saveNow();
  assert.ok(!('period:2026-10' in db.docs));
});
t('manager: pay docs never loaded; editing employees is refused and reverted', async () => {
  const db = t.db;
  db.role = 'manager';
  connect(db);
  await Cloud.reload();
  assert.ok(Store.s.employees.every((e) => !e.salary && !e.pay.taxId), 'no salary/tax data');
  const n = db.calls.length, name = Store.s.employees[1].name;
  Store.s.employees[1].name = 'ห้ามแก้';
  Store.save();
  assert.strictEqual(await Cloud.saveNow(), false);
  assert.strictEqual(db.calls.length, n, 'nothing sent');
  assert.strictEqual(Store.s.employees[1].name, name, 'reverted');
  assert.ok(/ไม่มีสิทธิ์/.test(ui.toasts[ui.toasts.length - 1]));
});
t('manager: approving a request is saved', async () => {
  const db = t.db;
  const r = Store.s.requests.find((x) => x.status === 'PENDING');
  r.status = 'APPROVED';
  Store.touch('requests', [r.date]);
  Store.save();
  assert.strictEqual(await Cloud.saveNow(), true);
  assert.strictEqual(db.docs.requests.data[r.id].status, 'APPROVED');
  assert.ok(db.calls[db.calls.length - 1].every((k) => Store.canWrite('manager', k)));
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      pass++;
      console.log('  ✓', name);
    } catch (e) {
      console.error('  ✗', name, '\n   ', e.message);
      process.exitCode = 1;
    }
  }
  console.log(`\n${pass} passed`);
})();

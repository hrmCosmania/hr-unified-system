#!/usr/bin/env node
/*
  ตรวจความผิดพลาดพื้นฐานก่อนบันทึก/ส่งงานขึ้นเว็บจริง (ไม่ต้องติดตั้งอะไรเพิ่ม มีแค่ Node)

    node check.js            ตรวจทั้งหมด
    node check.js --dups     แสดงรายชื่อฟังก์ชันที่ประกาศซ้ำทั้งหมดด้วย

  ตรวจอะไรบ้าง
    1) โค้ด JavaScript ในทุกไฟล์ HTML/API/payroll เขียนถูกไวยากรณ์ (พิมพ์ผิดแล้วหน้าเว็บพังทั้งหน้า) + เทสต์ของโมดูลเงินเดือน
    2) บรรทัดตั้งค่า TAB_RENDERERS.x = ฟังก์ชัน ต้องชี้ไปยังฟังก์ชันที่มีอยู่แล้ว ณ ตอนที่บรรทัดนั้นทำงาน
       (ถ้าไม่ จะเกิด error "is not defined" และโค้ดส่วนที่เหลือของบล็อกนั้นไม่ทำงาน)
    3) ทดสอบตัวนำเข้า Excel ทะเบียนพนักงาน ด้วยข้อมูลสมมติ (สถานะ Out = ลาออก, ไม่รีเซ็ตวันทดลองงาน ฯลฯ)
    4) รายงานฟังก์ชันที่ประกาศซ้ำ (ตัวสุดท้ายชนะ) เพื่อให้รู้ว่าต้องแก้ที่ตัวไหน

  จบด้วยรหัส 0 = ผ่านทั้งหมด, 1 = มีข้อผิดพลาด
*/
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

process.chdir(__dirname);
const SHOW_DUPS = process.argv.includes('--dups');
let errors = 0;
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { errors++; console.log('❌ ' + m); };
const note = (m) => console.log('ℹ️  ' + m);

/* ---------- helpers ---------- */
function extractScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (type && !/^(text\/javascript|module|application\/javascript)$/i.test(type)) continue;
    const bodyStart = m.index + m[0].indexOf('>') + 1;
    const startLine = html.slice(0, bodyStart).split('\n').length;
    out.push({ code: m[2], startLine, id: (attrs.match(/\bid\s*=\s*["']([^"']+)/) || [])[1] || '' });
  }
  return out;
}
function lineOf(code, index, startLine) { return startLine + code.slice(0, index).split('\n').length - 1; }

/* ---------- 1) syntax of every script ---------- */
const htmlFiles = ['index.html', 'probation/form/index.html', 'probation/results/index.html', 'probation/index.html', 'namecard.html']
  .filter((f) => fs.existsSync(f));
const scriptsByFile = {};
htmlFiles.forEach((f) => {
  const html = fs.readFileSync(f, 'utf8');
  const scripts = extractScripts(html);
  scriptsByFile[f] = scripts;
  let fileOk = true;
  scripts.forEach((s, i) => {
    try { new vm.Script(s.code, { filename: f, lineOffset: s.startLine - 1 }); }
    catch (e) { fileOk = false; bad(`${f}: โค้ด JavaScript ผิดไวยากรณ์ (บล็อกที่ ${i + 1}${s.id ? ' #' + s.id : ''}) — ${e.message}`); }
  });
  if (fileOk) ok(`${f}: ไวยากรณ์ถูกต้องทั้ง ${scripts.length} บล็อก`);
});
if (fs.existsSync('api')) {
  fs.readdirSync('api').filter((f) => f.endsWith('.js')).forEach((f) => {
    try { new vm.Script(fs.readFileSync(path.join('api', f), 'utf8'), { filename: 'api/' + f }); ok(`api/${f}: ไวยากรณ์ถูกต้อง`); }
    catch (e) { bad(`api/${f}: ${e.message}`); }
  });
}

/* ---------- 1c) sub-apps built with Vite: /training (apps/training) และ /performance (apps/performance) ---------- */
[['training', 'แอปฝึกอบรม', 'vite.config.js'], ['performance', 'GrowTogether', 'vite.config.ts']].forEach(([app, label, cfg]) => {
  if (!fs.existsSync(`apps/${app}/src`)) return;
  const idx = fs.existsSync(`${app}/index.html`) ? fs.readFileSync(`${app}/index.html`, 'utf8') : '';
  if (!idx) { bad(`ไม่พบ ${app}/index.html — สั่ง build: npm --prefix apps/${app} run build`); return; }
  const refs = [...idx.matchAll(new RegExp(`(?:src|href)="/${app}/([^"]+)"`, 'g'))].map((m) => m[1]);
  const missing = refs.filter((r) => !fs.existsSync(path.join(app, r)));
  if (!refs.length || missing.length) { bad(`${app}/index.html อ้างไฟล์ที่ไม่มี: ` + (missing.join(', ') || 'ไม่มีไฟล์ assets')); return; }
  const newest = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((m, x) => Math.max(m, x.isDirectory() ? newest(path.join(d, x.name)) : fs.statSync(path.join(d, x.name)).mtimeMs), 0);
  const src = Math.max(newest(`apps/${app}/src`), fs.statSync(`apps/${app}/${cfg}`).mtimeMs);
  if (src > fs.statSync(`${app}/index.html`).mtimeMs + 1000) note(`โค้ด${label}ใหม่กว่าไฟล์ build (ถ้าเพิ่งแก้โค้ด ให้สั่ง: npm --prefix apps/${app} run build)`);
  else ok(`${app}/: build ${label}ล่าสุดตรงกับโค้ด (${refs.length} ไฟล์)`);
});

/* ---------- 1a) shared scripts used by the sub-apps (/shared/*.js) ---------- */
if (fs.existsSync('shared')) {
  const files = fs.readdirSync('shared').filter((f) => f.endsWith('.js'));
  let okAll = true;
  files.forEach((f) => { try { new vm.Script(fs.readFileSync(path.join('shared', f), 'utf8'), { filename: 'shared/' + f }); } catch (e) { okAll = false; bad(`shared/${f}: ${e.message}`); } });
  if (okAll) ok(`shared/: ไวยากรณ์ถูกต้องทั้ง ${files.length} ไฟล์`);
  ['payroll/index.html', 'apps/training/index.html', 'apps/performance/index.html'].forEach((f) => {
    if (fs.existsSync(f) && !fs.readFileSync(f, 'utf8').includes('/shared/company.js')) bad(`${f} ไม่ได้โหลด /shared/company.js (บริษัทที่ทำงาน)`);
  });
}

/* ---------- 1b) payroll module (/payroll): syntax of every JS file + its own unit tests ---------- */
if (fs.existsSync('payroll/js')) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? walk(path.join(d, x.name)) : x.name.endsWith('.js') ? [path.join(d, x.name)] : []));
  const files = walk('payroll/js');
  let synOk = true;
  files.forEach((f) => { try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) { synOk = false; bad(`${f}: ${e.message}`); } });
  if (synOk) ok(`payroll/js: ไวยากรณ์ถูกต้องทั้ง ${files.length} ไฟล์`);
  const { spawnSync } = require('child_process');
  (fs.existsSync('payroll/tests') ? fs.readdirSync('payroll/tests').filter((f) => f.endsWith('.test.js')) : []).forEach((t) => {
    const r = spawnSync(process.execPath, [path.join('payroll/tests', t)], { encoding: 'utf8', timeout: 60000 });
    const last = ((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).pop() || '';
    if (r.status === 0) ok(`เงินเดือน tests/${t}: ${last.trim()}`);
    else bad(`เงินเดือน tests/${t} ไม่ผ่าน — ${last.trim()}`);
  });
}

/* ---------- 2) top-level TAB_RENDERERS.x = fn must point at something that already exists ---------- */
const main = scriptsByFile['index.html'] || [];
const declared = main.map((s) => {
  const fns = new Set(), vars = [], wins = [];
  let m;
  const fnRe = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm;
  while ((m = fnRe.exec(s.code))) fns.add(m[1]);
  const varRe = /^(?:var|let|const)\s+([A-Za-z_$][\w$]*)/gm;
  while ((m = varRe.exec(s.code))) vars.push([m[1], m.index]);
  const winRe = /^[ \t]*window\.([A-Za-z_$][\w$]*)\s*=/gm;
  while ((m = winRe.exec(s.code))) wins.push([m[1], m.index]);
  return { fns, vars, wins };
});
let regOk = true;
main.forEach((s, i) => {
  const re = /^TAB_RENDERERS\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/gm;
  let m;
  while ((m = re.exec(s.code))) {
    const name = m[2], pos = m.index;
    let found = declared[i].fns.has(name)
      || declared[i].vars.some(([n, p]) => n === name && p < pos)
      || declared[i].wins.some(([n, p]) => n === name && p < pos);
    for (let k = 0; k < i && !found; k++) {
      found = declared[k].fns.has(name) || declared[k].vars.some(([n]) => n === name) || declared[k].wins.some(([n]) => n === name);
    }
    if (!found) { regOk = false; bad(`index.html บรรทัด ${lineOf(s.code, pos, s.startLine)}: TAB_RENDERERS.${m[1]} = ${name} แต่ฟังก์ชัน ${name} ยังไม่ถูกประกาศในตอนนั้น (จะเกิด error และโค้ดที่เหลือในบล็อกไม่ทำงาน)`); }
  }
});
if (regOk) ok('index.html: บรรทัดตั้งค่า TAB_RENDERERS ชี้ไปยังฟังก์ชันที่มีอยู่ทั้งหมด');

/* ---------- 3) employee Excel import logic (fake data only) ---------- */
(function importerTests() {
  const umd = main.find((s) => s.code.includes('root.HRDataLogic = api'));
  if (!umd) { bad('ไม่พบโค้ดอ่านทะเบียนพนักงาน (HRDataLogic) ใน index.html'); return; }
  const sandbox = {};
  vm.createContext(sandbox);
  try { vm.runInContext(umd.code, sandbox); } catch (e) { bad('โหลดโค้ดอ่านทะเบียนพนักงานไม่ได้: ' + e.message); return; }
  const L = sandbox.HRDataLogic;
  let fails = 0;
  const eq = (name, actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) { fails++; bad(`ทดสอบตัวนำเข้า "${name}": ได้ ${JSON.stringify(actual)} ควรเป็น ${JSON.stringify(expected)}`); }
  };
  const H = ['ลำดับ', 'สถานะ', 'รหัสพนักงาน', 'บริษัท', 'แผนก', 'ตำแหน่ง', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'วันที่บรรจุ', 'วันที่เริ่มงาน', 'วันที่ลาออก'];
  const CO = 'บริษัท คอสเมเนีย แลบอราทอรี่ส์ จำกัด';
  const aoa = [
    ['รายงานทะเบียนพนักงาน (ข้อมูลพื้นฐาน)'], H,
    [1, 'Out', 'T001', CO, 'แผนกขาย', 'พนักงานขาย', '', 'ทดสอบ หนึ่ง', '', '27/06/2016', '26/08/2024'],
    [2, 'Active', 'T002', CO, 'แผนกบัญชี', 'นักบัญชี', '', 'ทดสอบ สอง', '01/01/2020', '01/09/2019', ''],
    [3, 'ลาออก', 'T003', CO, 'แผนกบัญชี', 'นักบัญชี', '', 'ทดสอบ สาม', '', '15/03/2569', '01/04/2569'],
    [4, 'Active', 'T004', CO, 'แผนกผลิต', 'ช่างเทคนิค', '', 'ทดสอบ สี่', '', '10/10/2025', '']
  ];
  const recs = L.parseEmployeeAoa(aoa, 'CMN');
  eq('อ่านครบทุกแถว', recs.length, 4);
  eq('สถานะ Out = Inactive', recs[0].status, 'Inactive');
  eq('สถานะ Active = Active', recs[1].status, 'Active');
  eq('สถานะ "ลาออก" = Inactive', recs[2].status, 'Inactive');
  eq('วันที่ลาออก -> endDate', recs[0].endDate, '2024-08-26');
  eq('ปี พ.ศ. แปลงเป็น ค.ศ.', recs[2].startDate, '2026-03-15');
  eq('ใช้ "วันที่เริ่มงาน" ไม่ใช่ "วันที่บรรจุ"', recs[1].startDate, '2019-09-01');
  eq('ไม่มีคอลัมน์วันทดลองงาน = 0 (ไม่ไปรีเซ็ตของเดิม)', recs[1].probationDays, 0);
  eq('ตรวจจับบริษัทจากชื่อ', recs[0].company, 'CMN');

  const db = { employees: [
    { empCode: 'T002', fullName: 'ทดสอบ สอง', company: 'CMN', status: 'Active', probationDays: 90, parentId: null, note: 'เดิม' },
    { empCode: 'T003', fullName: 'ทดสอบ สาม', company: 'CMN', status: 'Active', probationDays: 120, parentId: null, note: '' }
  ] };
  const sum = L.mergeEmployeeRecords(db, recs);
  const by = (c) => db.employees.find((e) => e.empCode === c);
  eq('พนักงานเดิมไม่ถูกรีเซ็ตวันทดลองงาน', by('T002').probationDays, 90);
  eq('พนักงานเดิมไม่ถูกลบหมายเหตุ', by('T002').note, 'เดิม');
  eq('คนในระบบที่ไฟล์บอกว่าลาออก = Inactive', by('T003').status, 'Inactive');
  eq('คนในระบบที่ลาออกได้วันสิ้นสุดงาน', by('T003').endDate, '2026-04-01');
  eq('พนักงานใหม่ได้วันทดลองงาน 120', by('T004').probationDays, 120);
  eq('จำนวนเพิ่มใหม่/อัปเดต', [sum.added, sum.updated], [2, 2]);
  if (!fails) ok('ตัวนำเข้าทะเบียนพนักงาน: ผ่านการทดสอบ 18 ข้อ');
})();

/* ---------- 3b) annual appraisal scoring (same cases as the original appraisal app's tests) ---------- */
(function appraisalTests() {
  const blk = main.find((s) => s.code.includes('AP_SCORING') && s.code.includes('computeResult'));
  if (!blk) { bad('ไม่พบโค้ดคำนวณคะแนนประเมินประจำปีใน index.html'); return; }
  const sandbox = {};
  vm.createContext(sandbox);
  try { vm.runInContext(blk.code, sandbox); } catch (e) { bad('โหลดโค้ดคำนวณคะแนนประเมินประจำปีไม่ได้: ' + e.message); return; }
  const S = sandbox.AP_SCORING;
  let fails = 0;
  const eq = (name, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; bad(`คะแนนประเมินประจำปี "${name}": ได้ ${JSON.stringify(a)} ควรเป็น ${JSON.stringify(b)}`); } };
  const c = S.combine({ group: 'ops', level: 'S1', behaviorRaw: 35, attTotal: 42, discScore: 40 });
  eq('ปฏิบัติการ 35/50,42/50,40/40 -> ผลงาน 42%', c.behaviorPct, 42);
  eq('สถิติ 25.2%', c.attendancePct, 25.2); eq('ระเบียบ 10%', c.regulationPct, 10);
  eq('รวม 77.2%', c.total, 77.2); eq('เกรด B+', c.grade.grade, 'B+');
  eq('O1 ขึ้นไป คะแนนเต็ม = 100', S.combine({ group: 'office', level: 'O1', behaviorRaw: 50, attTotal: 50, discScore: 40 }).total, 100);
  eq('สัดส่วน office 70/20/10', S.WEIGHTS.office, { behavior: 70, attendance: 20, regulation: 10 });
  eq('คะแนนสถิติตัวอย่าง = 44', S.attendanceScore({ late: 2, sick: 8, personal: 4, absent: 0 }).total, 44);
  eq('ลาป่วย 31 วัน = 0', S.attendanceItemScore('sick', 31), 0); eq('ขาดงาน 3 ครั้ง = 0', S.attendanceItemScore('absent', 3), 0);
  eq('เกรด 79.99 = B+', S.gradeOf(79.99).grade, 'B+'); eq('เกรด 54.9 = D', S.gradeOf(54.9).grade, 'D'); eq('เกรด 55 = D+', S.gradeOf(55).grade, 'D+');
  const comps = [{ id: 'a', weight: 40, rating: 5 }, { id: 'b', weight: 60, rating: 3 }];
  eq('สมรรถนะถ่วงน้ำหนัก (S1 เต็ม 15) = 11.4', S.competencyScore('S1', comps).score, 11.4);
  const kpis = [{ name: 'x', weight: 70, rating: 4 }, { name: 'y', weight: 30, rating: 5 }];
  const k = S.kpiScore('S1', kpis);
  eq('KPI ถ่วงน้ำหนัก (S1 เต็ม 35) = 30.1', k.score, 30.1); eq('KPI ครบ', k.complete, true);
  eq('KPI น้ำหนักไม่ครบ 100 = ไม่ครบ', S.kpiScore('S1', [{ name: 'x', weight: 70, rating: 4 }]).complete, false);
  eq('M1 เต็ม 75', S.behaviorMax('M1'), 75); eq('O3 เต็ม 50', S.behaviorMax('O3'), 50);
  eq('ผู้ประเมินต้อง M1 ขึ้นไป', [S.canEvaluateLevel('M1'), S.canEvaluateLevel('C'), S.canEvaluateLevel('O3')], [true, true, false]);
  const r = S.computeResult({ emp: { level: 'S1', hireDate: '2020-01-01' }, ev: { comps, kpi: kpis }, att: {}, discCode: 'none', cycleEnd: '2025-12-31' });
  eq('ผลงานดิบรวม 41.5', r.behaviorRaw, 41.5); eq('มีสิทธิ์โบนัสและปรับเงินเดือน', [r.bonusEligible, r.raiseEligible], [true, true]);
  eq('อายุงานไม่ครบ 1 ปี ไม่มีสิทธิ์โบนัส', S.computeResult({ emp: { level: 'S1', hireDate: '2025-06-01' }, ev: { comps, kpi: kpis }, att: {}, discCode: 'none', cycleEnd: '2025-12-31' }).bonusEligible, false);
  eq('ทดลองงานไม่ได้ปรับเงินเดือน', S.computeResult({ emp: { level: 'S1', hireDate: '2020-01-01', status: 'probation' }, ev: { comps, kpi: kpis }, att: {}, discCode: 'none', cycleEnd: '2025-12-31' }).raiseEligible, false);
  if (!fails) ok('คะแนนประเมินประจำปี: ผ่านการทดสอบ 26 ข้อ (ชุดเดียวกับแอปต้นฉบับ)');
})();

/* ---------- 3d) ขาด ลา มาสาย จากระบบเงินเดือน → รูปแบบบันทึกของระบบ HR ---------- */
(function payrollAttendanceTests() {
  const blk = main.find((s) => s.code.includes('payrollAttendanceFromDocs = function'));
  if (!blk) { bad('ไม่พบโค้ดดึงขาด ลา มาสาย จากระบบเงินเดือนใน index.html'); return; }
  const sandbox = { window: {}, document: { addEventListener() {} }, LEAVE_SUBTYPES: ['ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'ลาคลอด', 'ลาบวช', 'อื่นๆ'], supabaseClient: { auth: { onAuthStateChange() {} } }, console };
  vm.createContext(sandbox);
  try { vm.runInContext(blk.code, sandbox); } catch (e) { bad('โหลดโค้ดดึงขาด ลา มาสาย ไม่ได้: ' + e.message); return; }
  let fails = 0;
  const eq = (name, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; bad(`ขาด ลา มาสาย จากเงินเดือน "${name}": ได้ ${JSON.stringify(a)} ควรเป็น ${JSON.stringify(b)}`); } };
  const docs = [
    { key: 'employees', data: { E0001: { code: 't001' }, E0002: { code: 'T002' } } },
    { key: 'config', data: { leaveTypes: [{ code: 'SICK', name: 'ลาป่วย' }, { code: 'PERSONAL', name: 'ลากิจ' }, { code: 'UNPAID', name: 'ลาไม่รับค่าจ้าง' }] } },
    { key: 'period:2026-10', data: { calc: [
      { e: 'E0001', d: '2026-10-01', late: 12 },
      { e: 'E0001', d: '2026-10-02', leave: 0.5, lt: 'SICK', late: 0 },
      { e: 'E0001', d: '2026-10-03' },
      { e: 'E0002', d: '2026-10-01', absent: 1 },
      { e: 'E0002', d: '2026-10-02', leave: 1, lt: 'UNPAID' },
      { e: 'E9999', d: '2026-10-01', absent: 1 },
    ] } },
  ];
  const r = sandbox.window.payrollAttendanceFromDocs(docs, ['T001', 'T002']);
  const pick = (x) => [x.employeeCode, x.date, x.type, x.lateMinutes || x.leaveType || '', x.days || 0];
  eq('แปลงแถวเป็นบันทึก', r.rows.map(pick), [
    ['T001', '2026-10-01', 'late', 12, 0], ['T001', '2026-10-02', 'leave', 'ลาป่วย', 0.5],
    ['T002', '2026-10-01', 'absent', '', 1], ['T002', '2026-10-02', 'leave', 'อื่นๆ', 1]]);
  eq('รหัสพนักงานจับคู่ไม่สนตัวพิมพ์', r.rows[0].employeeCode, 'T001');
  eq('ประเภทลาที่ไม่มีใน HR เก็บชื่อเดิมในหมายเหตุ', r.rows[3].note, 'ลาไม่รับค่าจ้าง');
  eq('วันที่คำนวณแล้วถูกนับว่าครอบคลุม (กันซ้ำกับที่กรอกใน HR)', [!!r.covered['T001|2026-10-03'], !!r.covered['T001|2026-10-04']], [true, false]);
  eq('ทุกแถวมาจากระบบเงินเดือน', r.rows.every((x) => x.source === 'payroll'), true);
  eq('งวดที่อ่าน', r.periods, ['2026-10']);
  if (!fails) ok('ขาด ลา มาสาย จากระบบเงินเดือน: ผ่านการทดสอบ 6 ข้อ');
})();

/* ---------- 4) functions declared more than once (information) ---------- */
(function duplicates() {
  const seen = new Map();
  main.forEach((s) => {
    const re = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm;
    let m;
    while ((m = re.exec(s.code))) {
      if (!seen.has(m[1])) seen.set(m[1], []);
      seen.get(m[1]).push(lineOf(s.code, m.index, s.startLine));
    }
  });
  const dups = [...seen.entries()].filter(([, lines]) => lines.length > 1).sort((a, b) => b[1].length - a[1].length);
  if (!dups.length) { ok('ไม่มีฟังก์ชันประกาศซ้ำ'); return; }
  note(`ฟังก์ชันที่ประกาศซ้ำ ${dups.length} ชื่อ (ตัวสุดท้ายชนะ — แก้ที่บรรทัดสุดท้ายของแต่ละชื่อ)` + (SHOW_DUPS ? '' : ' · ดูทั้งหมดด้วย: node check.js --dups'));
  (SHOW_DUPS ? dups : dups.slice(0, 8)).forEach(([name, lines]) => note(`   ${name}  →  บรรทัด ${lines.join(', ')}  (ใช้ตัวที่ ${lines[lines.length - 1]})`));
})();

console.log('\n' + (errors ? `❌ ตรวจไม่ผ่าน ${errors} รายการ — ยังไม่ควรส่งขึ้นเว็บจริง` : '✅ ผ่านทุกข้อ'));
process.exit(errors ? 1 : 0);

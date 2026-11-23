#!/usr/bin/env node
/*
  ตรวจความผิดพลาดพื้นฐานก่อนบันทึก/ส่งงานขึ้นเว็บจริง (ไม่ต้องติดตั้งอะไรเพิ่ม มีแค่ Node)

    node check.js            ตรวจทั้งหมด
    node check.js --dups     แสดงรายชื่อฟังก์ชันที่ประกาศซ้ำทั้งหมดด้วย

  ตรวจอะไรบ้าง
    1) โค้ด JavaScript ในทุกไฟล์ HTML/API เขียนถูกไวยากรณ์ (พิมพ์ผิดแล้วหน้าเว็บพังทั้งหน้า)
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

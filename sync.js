#!/usr/bin/env node
/*
  ตัวช่วย "ดึงงาน (pull)" และ "ส่งงาน (push)" ระหว่างคอมหลายเครื่อง สำหรับโปรเจกต์ hr-unified-system

    node sync.js status            ดูว่าเครื่องนี้ตรงกับ GitHub หรือยัง
    node sync.js pull              ดึงงานล่าสุดจาก GitHub มาไว้ในเครื่อง
    node sync.js push "ข้อความ"     บันทึกงานที่แก้ + ส่งขึ้น GitHub (เว็บจริงจะอัปเดตอัตโนมัติ)

  ตัวเลือก:  --yes  = ไม่ถามยืนยัน (รวมไฟล์ใหม่ทุกไฟล์ด้วย)   --dry-run = แสดงสิ่งที่จะทำ แต่ไม่ทำจริง
*/
const { spawnSync } = require('child_process');
const readline = require('readline');

process.chdir(__dirname);
const args = process.argv.slice(2);
const cmd = args[0];
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.slice(1).filter(a => !a.startsWith('--'));
const YES = flags.has('--yes'), DRY = flags.has('--dry-run');

function git(a) {
  const r = spawnSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) { console.error('\n❌ ไม่พบโปรแกรม Git — ติดตั้งจาก https://git-scm.com แล้วเปิด Terminal ใหม่'); process.exit(1); }
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
function ask(q) {
  return new Promise(res => {
    if (YES || DRY) return res('y');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res((a || '').trim()); });
  });
}
function fail(msg) { console.error('\n❌ ' + msg); process.exit(1); }
function short(lines, n) { return lines.slice(0, n).map(l => '   ' + l).join('\n') + (lines.length > n ? '\n   … และอีก ' + (lines.length - n) + ' ไฟล์' : ''); }

function prepare() {
  if (git(['rev-parse', '--is-inside-work-tree']).code !== 0) fail('โฟลเดอร์นี้ไม่ใช่โปรเจกต์ Git');
  git(['config', 'core.autocrlf', 'false']); // index.html ใช้ CRLF — กัน Git แปลงบรรทัดทั้งไฟล์
  const f = git(['fetch', 'origin']);
  if (f.code !== 0) fail('เชื่อมต่อ GitHub ไม่ได้ (ตรวจอินเทอร์เน็ต หรือยังไม่ได้ล็อกอิน GitHub)\n' + f.err);
}
function branch() { return git(['rev-parse', '--abbrev-ref', 'HEAD']).out; }
function counts() {
  const r = git(['rev-list', '--left-right', '--count', 'HEAD...origin/main']).out.split(/\s+/).map(Number);
  return { ahead: r[0] || 0, behind: r[1] || 0 };
}
function changes() {
  const lines = (spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout || '').split(/\r?\n/).filter(Boolean);
  return { tracked: lines.filter(l => !l.startsWith('??')), untracked: lines.filter(l => l.startsWith('??')).map(l => l.slice(3)) };
}

function status() {
  prepare();
  const c = counts(), ch = changes();
  console.log('\nสาขา: ' + branch());
  console.log(c.behind ? `⬇️  มีงานใหม่บน GitHub ที่ยังไม่ได้ดึง ${c.behind} รายการ → รัน: node sync.js pull` : '✅ ไม่มีงานใหม่บน GitHub');
  console.log(c.ahead ? `⬆️  มีงานที่บันทึกไว้แต่ยังไม่ได้ส่ง ${c.ahead} รายการ → รัน: node sync.js push` : '✅ ไม่มีงานที่รอส่ง');
  if (ch.tracked.length || ch.untracked.length) {
    console.log('✏️  ไฟล์ที่แก้ไขแล้วแต่ยังไม่ได้บันทึก:');
    console.log(short(ch.tracked.concat(ch.untracked.map(f => '?? ' + f)), 15));
  } else console.log('✅ ไม่มีไฟล์ที่แก้ค้างอยู่');
}

function pull() {
  prepare();
  const c = counts(), ch = changes();
  if (!c.behind) { console.log('\n✅ เครื่องนี้เป็นล่าสุดแล้ว ไม่มีอะไรให้ดึง'); return; }
  if (ch.tracked.length) {
    console.log('\n⚠️  เครื่องนี้มีไฟล์ที่แก้ค้างอยู่ ยังไม่ได้ส่งขึ้น GitHub:');
    console.log(short(ch.tracked, 15));
    fail('หยุดการดึงเพื่อไม่ให้งานที่แก้ค้างอยู่ทับกัน\n   ทำอย่างใดอย่างหนึ่งก่อน:  ส่งงานนี้ขึ้นก่อน (node sync.js push)  หรือบอกผู้ช่วย (Claude) ให้ช่วยจัดการ');
  }
  if (c.ahead) fail('เครื่องนี้มีงานที่ยังไม่ได้ส่ง และ GitHub ก็มีงานใหม่ (แตกต่างกันทั้งสองฝั่ง)\n   ให้รัน  node sync.js push  ก่อน (จะนำงานสองฝั่งมารวมกันให้)');
  const before = git(['rev-parse', 'HEAD']).out;
  if (DRY) { console.log('\n(dry-run) จะดึงงานใหม่ ' + c.behind + ' รายการ:\n' + git(['log', '--format=   %h %s', 'HEAD..origin/main']).out); return; }
  const r = git(['pull', '--ff-only']);
  if (r.code !== 0) fail('ดึงงานไม่สำเร็จ:\n' + r.err);
  console.log('\n✅ ดึงงานล่าสุดแล้ว ได้รับ ' + c.behind + ' รายการ:');
  console.log(git(['log', '--format=   %h %s', before + '..HEAD']).out);
}

async function push() {
  prepare();
  let ch = changes();
  if (ch.untracked.length) {
    console.log('\nไฟล์ใหม่ที่ยังไม่เคยอยู่ใน Git:');
    console.log(short(ch.untracked, 15));
  }
  if (ch.tracked.length) {
    console.log('\nไฟล์ที่แก้ไข:');
    console.log(short(ch.tracked, 15));
  }
  let addUntracked = false;
  if (ch.untracked.length) addUntracked = YES || /^(y|yes|ใช่)$/i.test(await ask('\nรวมไฟล์ใหม่ข้างบนด้วยไหม? (y/N) '));
  const toCommit = ch.tracked.length > 0 || (addUntracked && ch.untracked.length > 0);

  if (toCommit) {
    let msg = positional.join(' ').trim();
    if (!msg) { msg = await ask('\nพิมพ์ข้อความสั้นๆ อธิบายสิ่งที่แก้ (เช่น "Recruitment: แก้ปุ่มส่งอีเมล"): '); }
    if (!msg) fail('ต้องมีข้อความอธิบายการแก้ไข');
    if (DRY) { console.log('\n(dry-run) จะบันทึกด้วยข้อความ: ' + msg); }
    else {
      git(['add', '-u']);
      if (addUntracked) ch.untracked.forEach(f => git(['add', '--', f]));
      const r = git(['commit', '-m', msg]);
      if (r.code !== 0) fail('บันทึกไม่สำเร็จ:\n' + (r.err || r.out));
      console.log('\n✅ บันทึกงานแล้ว: ' + msg);
    }
  } else if (!counts().ahead) {
    console.log('\nไม่มีไฟล์ที่แก้ และไม่มีงานค้างให้ส่ง');
  }

  let c = counts();
  if (c.behind && !DRY) {
    console.log('\n⬇️  GitHub มีงานใหม่จากเครื่องอื่น ' + c.behind + ' รายการ — กำลังนำมารวมกับงานของเครื่องนี้...');
    const r = git(['pull', '--rebase']);
    if (r.code !== 0) {
      git(['rebase', '--abort']);
      fail('รวมงานสองฝั่งอัตโนมัติไม่ได้ (แก้ไฟล์เดียวกันตรงจุดเดียวกัน) — ยกเลิกการรวมแล้ว งานของคุณยังอยู่ครบ\n   ให้ส่งข้อความนี้ให้ผู้ช่วย (Claude) ช่วยรวมให้:\n' + r.err);
    }
    c = counts();
  }
  if (!c.ahead && !DRY) { console.log('\n✅ ไม่มีงานที่ต้องส่ง'); return; }
  console.log('\nงานที่จะส่งขึ้น GitHub ' + c.ahead + ' รายการ:\n' + git(['log', '--format=   %h %s', 'origin/main..HEAD']).out);
  console.log('\n⚠️  เมื่อส่งแล้ว เว็บจริง (hr-unified-system.vercel.app) จะอัปเดตตามอัตโนมัติ');
  if (DRY) { console.log('\n(dry-run) ยังไม่ได้ส่งจริง'); return; }
  const ok = YES || /^(y|yes|ใช่)$/i.test(await ask('ยืนยันส่งขึ้น GitHub? (y/N) '));
  if (!ok) { console.log('\nยกเลิกการส่ง (งานที่บันทึกไว้ยังอยู่ในเครื่อง ส่งภายหลังได้ด้วย node sync.js push)'); return; }
  const r = git(['push', 'origin', 'HEAD']);
  if (r.code !== 0) fail('ส่งงานไม่สำเร็จ (อาจยังไม่ได้ล็อกอิน GitHub — รัน: gh auth login):\n' + r.err);
  console.log('\n✅ ส่งขึ้น GitHub แล้ว เว็บจริงจะอัปเดตใน 1-2 นาที');
}

(async () => {
  if (cmd === 'status') status();
  else if (cmd === 'pull') pull();
  else if (cmd === 'push') await push();
  else console.log('วิธีใช้:\n  node sync.js status\n  node sync.js pull\n  node sync.js push "ข้อความอธิบายสิ่งที่แก้"\n\nตัวเลือก: --yes (ไม่ถามยืนยัน)  --dry-run (ดูเฉยๆ ไม่ทำจริง)');
})();

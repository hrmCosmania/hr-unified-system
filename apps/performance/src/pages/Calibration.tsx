import { useState } from "react";
import { Grid3x3, Lock, Users, GripVertical } from "lucide-react";
import { useStore } from "../data/store";
import { nineBoxMeta, ratingGuideline } from "../data/mock";
import { Avatar, Button, Card, CardTitle, Field, PageHeader, RatingPicker, cx } from "../components/ui";
import { GroupedBars, Legend } from "../components/charts";

const boxOf = (perf: number, pot: number) => (pot - 1) * 3 + perf;

export default function Calibration() {
  const { calibration, moveCalibration, toast, liveStatus, cycle } = useStore();
  const ready = liveStatus === "ready";
  const [sel, setSel] = useState(calibration[0]?.id ?? "");
  const [drag, setDrag] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const p = calibration.find((x) => x.id === sel) ?? calibration[0];
  if (!p) return (
    <div>
      <PageHeader icon={<Grid3x3 size={22} />} title="Calibration · 9-Box" subtitle={cycle?.name} />
      <Card className="p-6"><p className="font-semibold">ยังไม่มีพนักงานที่มีผลประเมินในรอบนี้</p>
        <p className="text-sm text-ink-3 mt-1">รายชื่อจะขึ้นเมื่อพนักงานมีแผนประเมิน (ตั้งเป้าหมาย/ทำแบบประเมิน) ในรอบ {cycle?.name ?? "ปัจจุบัน"}</p></Card>
    </div>);
  const dist = [5, 4, 3, 2, 1].map((r) => Math.round((calibration.filter((x) => x.rating === r).length / calibration.length) * 100));
  const changed = calibration.filter((x) => x.rating !== x.preRating).length;

  return (
    <div>
      <PageHeader icon={<Grid3x3 size={22} />} title="Calibration · 9-Box" subtitle={ready ? `${cycle?.name ?? ""} · ${calibration.length} คน · ลากเพื่อปรับผลงาน/ศักยภาพ — บันทึกลงแผนประเมินทันที` : "Retail · เขตกรุงเทพฯ ตะวันออก · 18 คน · ผู้ดำเนินการ: ชลธิชา (HRBP) · 18 ธ.ค. 2026"}
        actions={<>
          {!ready && <span className="inline-flex items-center gap-1.5 text-sm text-ink-3"><Users size={15} />ผู้เข้าร่วม 5 คน</span>}
          <Button variant={locked ? "ghost" : "primary"} disabled={locked} onClick={() => { setLocked(true); toast("ล็อกผล Calibration แล้ว · ส่งผลไป Payroll & Internal Job ผ่าน Outbox"); }}>
            <Lock size={15} />{locked ? "ล็อกแล้ว" : "ล็อกผลและส่งต่อ"}
          </Button>
        </>} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <CardTitle>ผลงาน × ศักยภาพ</CardTitle>
            <span className="text-xs text-ink-3 hidden sm:inline-flex items-center gap-1"><GripVertical size={13} />ลากรายชื่อเพื่อย้ายช่อง</span>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col justify-around text-[11px] text-ink-3 w-6">
              <span className="-rotate-90 whitespace-nowrap">สูง</span><span className="-rotate-90 whitespace-nowrap">กลาง</span><span className="-rotate-90 whitespace-nowrap">ต่ำ</span>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2">
              {[3, 2, 1].flatMap((pot) => [1, 2, 3].map((perf) => {
                const b = boxOf(perf, pot), meta = nineBoxMeta[b];
                const members = calibration.filter((x) => x.performance === perf && x.potential === pot);
                return (
                  <div key={b} onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (drag && !locked) { moveCalibration(drag, { performance: perf as 1 | 2 | 3, potential: pot as 1 | 2 | 3 }); setSel(drag); } setDrag(null); }}
                    className={cx("rounded-xl p-2.5 min-h-[118px] border border-transparent transition-colors", drag && "border-dashed border-brand-200")}
                    style={{ background: meta.tone }}>
                    <div className="flex items-start justify-between gap-1">
                      <div><p className="text-[12.5px] font-semibold text-navy-800 leading-tight">{meta.name}</p><p className="text-[10.5px] text-ink-3">{meta.en}</p></div>
                      <span className="text-[11px] font-semibold text-ink-2 bg-white/70 rounded-md px-1.5">{members.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {members.map((m) => (
                        <button key={m.id} draggable={!locked} onDragStart={() => setDrag(m.id)} onClick={() => setSel(m.id)} title={`${m.name} · ${m.score}`}
                          className={cx("rounded-full cursor-grab active:cursor-grabbing transition-transform hover:scale-110", sel === m.id && "ring-2 ring-navy-800 ring-offset-1 rounded-full")}>
                          <Avatar p={m} size={28} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 ml-8 mt-2 text-center text-[11px] text-ink-3"><span>ต่ำ</span><span>ตามคาด</span><span>สูง</span></div>
          <p className="text-center text-xs text-ink-2 mt-1 ml-8">ผลงาน (Performance) →</p>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar p={p} size={48} />
              <div><p className="font-semibold">{p.name}</p><p className="text-xs text-ink-3">{p.position} · {p.orgUnit}</p></div>
            </div>
            <div className="mt-4 rounded-xl p-3" style={{ background: nineBoxMeta[boxOf(p.performance, p.potential)].tone }}>
              <p className="text-xs text-ink-3">ตำแหน่งใน 9-Box</p>
              <p className="font-display font-semibold text-navy-800">{nineBoxMeta[boxOf(p.performance, p.potential)].name} ({nineBoxMeta[boxOf(p.performance, p.potential)].en})</p>
              <p className="text-xs text-ink-2 mt-1">แนวทาง: {nineBoxMeta[boxOf(p.performance, p.potential)].action}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="rounded-lg bg-canvas p-2"><dt className="text-[11px] text-ink-3">คะแนนรวม</dt><dd className="font-display font-semibold">{p.score}</dd></div>
              <div className="rounded-lg bg-canvas p-2"><dt className="text-[11px] text-ink-3">หัวหน้าเสนอ</dt><dd className="font-display font-semibold">{p.preRating}</dd></div>
              <div className="rounded-lg bg-canvas p-2"><dt className="text-[11px] text-ink-3">หลังปรับ</dt><dd className={cx("font-display font-semibold", p.rating !== p.preRating && "text-brand-600")}>{p.rating}</dd></div>
            </dl>
            <div className="mt-4"><span className="label">ผลประเมินหลัง Calibration</span><RatingPicker value={p.rating} onChange={(v) => moveCalibration(p.id, { rating: v })} disabled={locked} /></div>
            <div className="mt-3"><Field label="เหตุผลการปรับ (บันทึกใน Audit log)"><textarea className="input" rows={2} placeholder="เช่น ผลงานโดดเด่นเทียบกับสาขาขนาดเดียวกัน" disabled={locked} /></Field></div>
          </Card>

          <Card className="p-5">
            <CardTitle action={<span className="text-xs text-ink-3">ปรับแล้ว {changed} คน</span>}>การกระจายผลประเมิน</CardTitle>
            <Legend items={[{ label: "หลัง Calibration", color: "#2a78d6" }, { label: "Guideline", color: "", hatch: true }]} />
            <div className="mt-2">
              <GroupedBars categories={["5", "4", "3", "2", "1"]} height={190}
                series={[{ label: "หลัง Calibration", values: dist, color: "#2a78d6" }, { label: "Guideline", values: [5, 4, 3, 2, 1].map((r) => ratingGuideline[r]), color: "", hatch: true }]} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

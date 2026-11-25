import { useEffect, useState } from "react";
import { Award, CircleCheck } from "lucide-react";
import { useStore } from "../data/store";
import * as liveApi from "../data/live";
import type { MyResult } from "../data/live";
import { Button, Card } from "./ui";

export const RATING_LABEL = ["", "ต่ำกว่ามาตรฐาน", "ต้องพัฒนา", "ตามความคาดหวัง", "เกินความคาดหวัง", "โดดเด่น"];
const TONE = ["", "bg-crit-bg text-crit", "bg-warn-bg text-warn", "bg-brand-50 text-brand-700", "bg-good-bg text-[#087a08]", "bg-good-bg text-[#087a08]"];
const thDate = (d: string) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

/** ผลการประเมินรอบนี้ของพนักงานที่เลือก — แสดงเมื่อ HR แจ้งผลแล้ว พร้อมปุ่มรับทราบ */
export function useMyResult() {
  const { liveStatus, cycle, subject } = useStore();
  const [res, setRes] = useState<MyResult | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setRes(null);
    if (liveStatus !== "ready" || !cycle || !subject) return;
    liveApi.loadMyResult(cycle.id, subject.id).then(setRes, () => setRes(null));
  }, [liveStatus, cycle?.id, subject?.id, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { res, reload: () => setTick((t) => t + 1) };
}

export function ResultCard({ res, onChanged }: { res: MyResult | null; onChanged: () => void }) {
  const { subject, toast, account } = useStore();
  const [busy, setBusy] = useState(false);
  if (!res || !res.releasedAt) return null;
  const grade = res.calibrated ?? res.finalRating;
  if (grade == null) return null;
  const self = account?.employeeId === subject?.id;
  return (
    <Card className="p-5 mb-5 border-brand-200">
      <div className="flex flex-wrap items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-navy-800 text-white flex flex-col items-center justify-center shrink-0">
          <span className="font-display text-[30px] font-semibold leading-none">{grade}</span><span className="text-[10px] opacity-70">จาก 5</span>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-ink-3 inline-flex items-center gap-1"><Award size={13} />ผลการประเมินรอบนี้ · แจ้งผลเมื่อ {thDate(res.releasedAt)}</p>
          <p className="font-display font-semibold text-lg text-navy-800 mt-0.5">{subject?.name} · <span className={`rounded-full px-2.5 py-0.5 text-sm ${TONE[grade]}`}>{RATING_LABEL[grade]}</span></p>
          <p className="text-sm text-ink-3 mt-1">
            {res.kpiScore != null && <>KPI {res.kpiScore.toFixed(2)} ({res.kpiWeight}%) · </>}
            {res.compScore != null && <>Competency {res.compScore.toFixed(2)} ({res.compWeight}%) · </>}
            {res.overall != null && <>คะแนนรวม {res.overall.toFixed(2)}</>}
            {res.calibrated != null && res.finalRating != null && res.calibrated !== res.finalRating && <> · ปรับจากหัวหน้าเสนอ {res.finalRating} ใน Calibration</>}
          </p>
        </div>
        {res.ackAt
          ? <span className="inline-flex items-center gap-1.5 text-sm text-[#087a08]"><CircleCheck size={16} />รับทราบแล้ว {thDate(res.ackAt)}</span>
          : <Button disabled={busy} onClick={async () => {
              setBusy(true);
              try { await liveApi.acknowledgeResult(res.planId); toast(self ? "รับทราบผลการประเมินแล้ว" : `บันทึกการรับทราบของ ${subject?.name} แล้ว`); onChanged(); }
              catch (e) { toast(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e), "crit"); }
              finally { setBusy(false); }
            }}><CircleCheck size={16} />{self ? "รับทราบผล" : "บันทึกรับทราบแทน"}</Button>}
      </div>
    </Card>
  );
}

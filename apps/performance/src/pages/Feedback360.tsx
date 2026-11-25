import { useEffect, useState } from "react";
import { Radar as RadarIcon, ShieldCheck, ThumbsUp, Lightbulb, Eye, UserPlus, Check } from "lucide-react";
import { useStore, person } from "../data/store";
import * as liveApi from "../data/live";
import type { Request360, Result360 } from "../data/live";
import { people, radar360 } from "../data/mock";
import { Avatar, Button, Card, CardTitle, PageHeader, RatingPicker, StatusPill, Tabs, cx } from "../components/ui";
import { Legend, Radar, SERIES } from "../components/charts";

export default function Feedback360() {
  const { toast, liveStatus } = useStore();
  if (liveStatus === "ready") return <Live360 />;
  return <Demo360 toast={toast} />;
}

function Demo360({ toast }: { toast: (t: string, tone?: "good" | "info" | "crit") => void }) {
  const [tab, setTab] = useState<"result" | "rate" | "nominate">("result");
  const [vis, setVis] = useState([true, true, true, true]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [nominees, setNominees] = useState<string[]>(["t1", "t3", "t5", "am", "p4"]);
  const others = radar360.series.slice(1);
  const avgOthers = radar360.axes.map((_, i) => others.reduce((s, x) => s + x.values[i] * x.n, 0) / others.reduce((s, x) => s + x.n, 0));
  const self = radar360.series[0].values;
  const blind = radar360.axes.map((a, i) => ({ a, d: self[i] - avgOthers[i] })).sort((x, y) => y.d - x.d);

  return (
    <div>
      <PageHeader icon={<RadarIcon size={22} />} title="ประเมินรอบด้าน (360° Feedback)" subtitle="มุมมองจากตนเอง หัวหน้า เพื่อนร่วมงาน และลูกทีม — ช่วยให้เห็นจุดแข็งและจุดบอด" />
      <Tabs value={tab} onChange={setTab} items={[
        { value: "result", label: "ผลของฉัน" },
        { value: "rate", label: "ประเมินผู้อื่น", count: 2 },
        { value: "nominate", label: "เลือกผู้ประเมิน" },
      ]} />

      {tab === "result" && (
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-5">
          <Card className="p-5">
            <CardTitle action={<span className="text-xs text-ink-3">ผู้ตอบ 12 คน · รอบ ต.ค. 2026</span>}>ภาพรวม Competency</CardTitle>
            <Legend items={radar360.series.map((s, i) => ({ label: s.label, color: SERIES[i], note: s.n > 1 ? ` (${s.n})` : "" }))}
              active={vis} onToggle={(i) => setVis(vis.map((v, j) => (j === i ? !v : v)))} />
            <Radar axes={radar360.axes} series={radar360.series} visible={vis} />
            <div className="flex items-center gap-2 text-xs text-ink-3 bg-canvas rounded-lg px-3 py-2">
              <ShieldCheck size={14} className="text-leaf-600" />ปกปิดตัวตน: แสดงผลกลุ่มเพื่อนร่วมงาน/ลูกทีมเมื่อมีผู้ตอบ ≥ 3 คนเท่านั้น
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="px-5 pt-5"><CardTitle>คะแนนเฉลี่ยรายด้าน</CardTitle></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-ink-3 bg-canvas"><tr>
                    <th className="text-left px-5 py-2 font-medium">Competency</th>
                    {radar360.series.map((s, i) => <th key={s.key} className="px-2 py-2 font-medium"><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: SERIES[i] }} />{s.label}</th>)}
                  </tr></thead>
                  <tbody>
                    {radar360.axes.map((a, i) => (
                      <tr key={a} className="border-t border-line">
                        <td className="px-5 py-2.5">{a}</td>
                        {radar360.series.map((s) => <td key={s.key} className={cx("text-center px-2", s.values[i] < 3 && "text-crit font-semibold")}>{s.values[i].toFixed(1)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-5">
              <CardTitle icon={<Eye size={16} className="text-[#6250d6]" />}>Blind spot · มองตนเองต่างจากผู้อื่น</CardTitle>
              <ul className="space-y-2 text-sm">
                {blind.slice(0, 2).map((b) => (
                  <li key={b.a} className="flex justify-between rounded-lg bg-canvas px-3 py-2"><span>{b.a}</span><span className="text-warn font-medium">ประเมินตนเองสูงกว่า +{b.d.toFixed(1)}</span></li>
                ))}
                {blind.slice(-1).map((b) => (
                  <li key={b.a} className="flex justify-between rounded-lg bg-leaf-50 px-3 py-2"><span>{b.a}</span><span className="text-leaf-600 font-medium">ผู้อื่นมองสูงกว่า {b.d.toFixed(1)} (จุดแข็งซ่อน)</span></li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="p-5">
            <CardTitle icon={<ThumbsUp size={16} className="text-leaf-600" />}>จุดแข็ง (ความเห็นจากผู้ประเมิน)</CardTitle>
            <ul className="space-y-2">{radar360.comments.strengths.map((c) => <li key={c} className="rounded-lg bg-leaf-50 px-3 py-2 text-sm text-ink-2">“{c}”</li>)}</ul>
          </Card>
          <Card className="p-5">
            <CardTitle icon={<Lightbulb size={16} className="text-[#eda100]" />}>สิ่งที่ควรพัฒนา</CardTitle>
            <ul className="space-y-2">{radar360.comments.improve.map((c) => <li key={c} className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-ink-2">“{c}”</li>)}</ul>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => toast("เพิ่ม 'การสื่อสาร' เข้า IDP แล้ว")}>เพิ่มเข้าแผนพัฒนา (IDP)</Button>
          </Card>
        </div>
      )}

      {tab === "rate" && (
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
          <Card className="p-3">
            {[{ id: "t6", rel: "ลูกทีม", status: "in_progress" }, { id: "p4", rel: "เพื่อนร่วมงาน (ข้ามสายงาน)", status: "not_started" }, { id: "t1", rel: "ลูกทีม", status: "completed" }].map((r, i) => {
              const p = person(r.id);
              return (
                <button key={r.id} className={cx("w-full flex items-center gap-3 p-3 rounded-xl text-left cursor-pointer", i === 0 ? "bg-brand-50" : "hover:bg-canvas")}>
                  <Avatar p={p} size={38} />
                  <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{p.name}</span><span className="block text-xs text-ink-3">{r.rel}</span></span>
                  <StatusPill status={r.status} label={r.status === "completed" ? "ส่งแล้ว" : undefined} />
                </button>
              );
            })}
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <Avatar p={people.t6} size={44} />
              <div><p className="font-semibold">ประเมิน {people.t6.name}</p><p className="text-xs text-ink-3">คำตอบของคุณจะถูกรวมแบบไม่ระบุตัวตน · ครบกำหนด 30 พ.ย.</p></div>
            </div>
            <div className="divide-y divide-line">
              {radar360.axes.map((a) => (
                <div key={a} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <p className="flex-1 text-sm">{a}</p>
                  <RatingPicker value={ratings[a] ?? null} onChange={(v) => setRatings({ ...ratings, [a]: v })} />
                </div>
              ))}
            </div>
            <label className="block mt-4"><span className="label">สิ่งที่ทำได้ดี / ควรพัฒนา (ไม่บังคับ)</span><textarea className="input" rows={3} /></label>
            <div className="flex justify-end mt-4"><Button disabled={Object.keys(ratings).length < radar360.axes.length} onClick={() => toast("ส่งการประเมิน 360° แล้ว")}>ส่งการประเมิน</Button></div>
          </Card>
        </div>
      )}

      {tab === "nominate" && (
        <Card className="mt-5 p-5">
          <CardTitle action={<span className="text-xs text-ink-3">แนะนำ 5–8 คน · หัวหน้าอนุมัติรายชื่อ</span>}>เลือกผู้ประเมินของคุณ</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(people).filter((p) => !["me", "hrd", "mgr"].includes(p.id)).map((p) => {
              const on = nominees.includes(p.id);
              return (
                <button key={p.id} onClick={() => setNominees(on ? nominees.filter((x) => x !== p.id) : [...nominees, p.id])}
                  className={cx("flex items-center gap-3 rounded-xl border p-3 text-left cursor-pointer transition-all", on ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-200")}>
                  <Avatar p={p} size={36} />
                  <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate">{p.name}</span><span className="block text-xs text-ink-3 truncate">{p.position} · {p.orgUnit}</span></span>
                  <span className={cx("w-6 h-6 rounded-md border flex items-center justify-center", on ? "bg-brand-600 border-brand-600 text-white" : "border-line")}>{on && <Check size={14} />}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-5">
            <p className="text-sm text-ink-3">เลือกแล้ว {nominees.length} คน · หัวหน้า (วิภาวดี) ถูกเพิ่มอัตโนมัติ</p>
            <Button onClick={() => toast("ส่งรายชื่อให้หัวหน้าอนุมัติแล้ว")} disabled={nominees.length < 3}><UserPlus size={16} />ส่งรายชื่อ</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ===================== ข้อมูลจริง (schema pm) ===================== */
function Live360() {
  const { toast, subject, cycle, managerOf, directory, personOf, posComps } = useStore();
  const [tab, setTab] = useState<"result" | "rate" | "nominate">("result");
  const [res, setRes] = useState<Result360 | null>(null);
  const [toRate, setToRate] = useState<Request360[]>([]);
  const [cur, setCur] = useState<string>("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [nominees, setNominees] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e), "crit");
  const reload = () => {
    if (!subject || !cycle) return;
    liveApi.load360Result(subject.id, cycle.id).then(setRes, fail);
    liveApi.load360ToRate(subject.id, cycle.id).then((r) => { setToRate(r); setCur((c) => c || r.find((x) => x.status !== "submitted")?.id || ""); }, fail);
  };
  useEffect(() => { setRes(null); setToRate([]); setCur(""); setNominees([]); reload(); }, [subject?.id, cycle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cycle) return <div><PageHeader icon={<RadarIcon size={22} />} title="ประเมินรอบด้าน (360° Feedback)" /><Card className="p-6 text-ink-3">ยังไม่มีรอบประเมินที่เปิดอยู่</Card></div>;
  const mgr = managerOf(subject);
  const pending = toRate.filter((r) => r.status !== "submitted");
  const req = toRate.find((r) => r.id === cur);
  const target = req ? personOf(req.subjectId) : null;
  const avgOthers = res ? res.axes.map((_, i) => { const v = res.series.filter((x) => x.key !== "self").map((x) => x.values[i]).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }) : [];
  const selfS = res?.series.find((x) => x.key === "self");
  const blind = res && selfS ? res.axes.map((a, i) => ({ a, d: (selfS.values[i] ?? 0) - (avgOthers[i] ?? selfS.values[i] ?? 0) })).sort((x, y) => y.d - x.d) : [];
  const already = new Set((res?.raters ?? []).map((r) => r.raterId));
  const pool = directory.filter((p) => p.id !== subject?.id && p.id !== mgr?.id && !already.has(p.id) && (!q || p.name.includes(q) || p.code.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader icon={<RadarIcon size={22} />} title="ประเมินรอบด้าน (360° Feedback)" subtitle={`${subject?.name ?? ""} · ${cycle.name} · ข้อหัวข้อประเมิน = Competency ตามตำแหน่งจากระบบ HR หลัก`} />
      <Tabs value={tab} onChange={setTab} items={[
        { value: "result", label: "ผลการประเมิน" },
        { value: "rate", label: "ประเมินผู้อื่น", count: pending.length || undefined },
        { value: "nominate", label: "เลือกผู้ประเมิน" },
      ]} />

      {tab === "result" && (!res || res.axes.length === 0 ? (
        <Card className="mt-5 p-6">
          <p className="font-semibold">ยังไม่มีผลประเมิน 360° ของ {subject?.name}</p>
          <p className="text-sm text-ink-3 mt-1">{res && res.raters.length ? `ส่งคำขอแล้ว ${res.raters.length} คน · ตอบแล้ว ${res.raters.filter((r) => r.status === "submitted").length} คน` : "เริ่มจากแท็บ “เลือกผู้ประเมิน”"}</p>
          {res && res.raters.length > 0 && <ul className="mt-3 text-sm space-y-1">{res.raters.map((r) => <li key={r.id} className="flex gap-2"><span className="w-28 text-ink-3">{liveApi.rel360Label(r.relation)}</span><span className="flex-1">{r.relation === "peer" || r.relation === "direct_report" ? "(ไม่เปิดเผยชื่อ)" : personOf(r.raterId).name}</span><StatusPill status={r.status === "submitted" ? "completed" : "not_started"} label={r.status === "submitted" ? "ส่งแล้ว" : "รอประเมิน"} /></li>)}</ul>}
        </Card>
      ) : (
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-5">
          <Card className="p-5">
            <CardTitle action={<span className="text-xs text-ink-3">ผู้ตอบ {res.raters.filter((r) => r.status === "submitted").length} คน</span>}>ภาพรวม Competency</CardTitle>
            <Legend items={res.series.map((x, i) => ({ label: x.label, color: SERIES[i], note: x.n > 1 ? ` (${x.n})` : "" }))} active={res.series.map(() => true)} onToggle={() => {}} />
            <Radar axes={res.axes} series={res.series.map((x) => ({ ...x, values: x.values.map((v) => v ?? 0) }))} visible={res.series.map(() => true)} />
            <div className="flex items-center gap-2 text-xs text-ink-3 bg-canvas rounded-lg px-3 py-2"><ShieldCheck size={14} className="text-leaf-600" />ผลจากเพื่อนร่วมงาน/ลูกทีมแสดงเป็นค่าเฉลี่ยกลุ่ม ไม่ระบุตัวตน</div>
          </Card>
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="px-5 pt-5"><CardTitle>คะแนนเฉลี่ยรายด้าน</CardTitle></div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-xs text-ink-3 bg-canvas"><tr><th className="text-left px-5 py-2 font-medium">Competency</th>{res.series.map((x, i) => <th key={x.key} className="px-2 py-2 font-medium"><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: SERIES[i] }} />{x.label}</th>)}</tr></thead>
                <tbody>{res.axes.map((a, i) => <tr key={a} className="border-t border-line"><td className="px-5 py-2.5">{a}</td>{res.series.map((x) => <td key={x.key} className={cx("text-center px-2", (x.values[i] ?? 5) < 3 && "text-crit font-semibold")}>{x.values[i] == null ? "–" : x.values[i]!.toFixed(1)}</td>)}</tr>)}</tbody>
              </table></div>
            </Card>
            {blind.length > 1 && <Card className="p-5">
              <CardTitle icon={<Eye size={16} className="text-[#6250d6]" />}>Blind spot · มองตนเองต่างจากผู้อื่น</CardTitle>
              <ul className="space-y-2 text-sm">
                {blind.filter((b) => b.d > 0).slice(0, 2).map((b) => <li key={b.a} className="flex justify-between rounded-lg bg-canvas px-3 py-2"><span>{b.a}</span><span className="text-warn font-medium">ประเมินตนเองสูงกว่า +{b.d.toFixed(1)}</span></li>)}
                {blind.filter((b) => b.d < 0).slice(-1).map((b) => <li key={b.a} className="flex justify-between rounded-lg bg-leaf-50 px-3 py-2"><span>{b.a}</span><span className="text-leaf-600 font-medium">ผู้อื่นมองสูงกว่า {b.d.toFixed(1)}</span></li>)}
              </ul>
            </Card>}
            {res.comments.length > 0 && <Card className="p-5">
              <CardTitle icon={<Lightbulb size={16} className="text-[#eda100]" />}>ความเห็นจากผู้ประเมิน</CardTitle>
              <ul className="space-y-2">{res.comments.map((c) => <li key={c} className="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-2">“{c}”</li>)}</ul>
            </Card>}
          </div>
        </div>
      ))}

      {tab === "rate" && (
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
          <Card className="p-3">
            {toRate.length === 0 && <p className="p-3 text-sm text-ink-3">{subject?.name} ยังไม่มีคำขอให้ประเมินผู้อื่น</p>}
            {toRate.map((r) => { const p = personOf(r.subjectId); return (
              <button key={r.id} onClick={() => { setCur(r.id); setRatings({}); setComment(""); }} className={cx("w-full flex items-center gap-3 p-3 rounded-xl text-left cursor-pointer", r.id === cur ? "bg-brand-50" : "hover:bg-canvas")}>
                <Avatar p={p} size={38} />
                <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{p.name}</span><span className="block text-xs text-ink-3">ในฐานะ{liveApi.rel360Label(r.relation)}</span></span>
                <StatusPill status={r.status === "submitted" ? "completed" : "not_started"} label={r.status === "submitted" ? "ส่งแล้ว" : undefined} />
              </button>); })}
          </Card>
          {req && target && <Card className="p-5">
            <div className="flex items-center gap-3 mb-4"><Avatar p={target} size={44} />
              <div><p className="font-semibold">ประเมิน {target.name}</p><p className="text-xs text-ink-3">{target.position}{req.dueDate ? ` · ครบกำหนด ${new Date(req.dueDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : ""}</p></div></div>
            <RateItems targetId={req.subjectId} ratings={ratings} setRatings={setRatings} fallback={posComps} disabled={req.status === "submitted"} />
            <label className="block mt-4"><span className="label">สิ่งที่ทำได้ดี / ควรพัฒนา (ไม่บังคับ)</span><textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} disabled={req.status === "submitted"} /></label>
            <div className="flex justify-end mt-4"><Button disabled={busy || req.status === "submitted" || Object.keys(ratings).length === 0}
              onClick={async () => { setBusy(true); try { await liveApi.submit360(req.id, ratings, comment); toast("ส่งการประเมิน 360° แล้ว"); reload(); } catch (e) { fail(e); } finally { setBusy(false); } }}>
              {req.status === "submitted" ? "ส่งแล้ว" : "ส่งการประเมิน"}</Button></div>
          </Card>}
        </div>
      )}

      {tab === "nominate" && (
        <Card className="mt-5 p-5">
          <CardTitle action={<span className="text-xs text-ink-3">แนะนำ 5–8 คน · ตนเองและหัวหน้าถูกเพิ่มอัตโนมัติ</span>}>เลือกผู้ประเมินของ {subject?.name}</CardTitle>
          <input className="input mb-3 sm:w-72" placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-auto">
            {pool.slice(0, 120).map((p) => { const on = nominees.includes(p.id); return (
              <button key={p.id} onClick={() => setNominees(on ? nominees.filter((x) => x !== p.id) : [...nominees, p.id])}
                className={cx("flex items-center gap-3 rounded-xl border p-3 text-left cursor-pointer transition-all", on ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-200")}>
                <Avatar p={p} size={36} />
                <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate">{p.name}</span><span className="block text-xs text-ink-3 truncate">{p.position} · {p.orgUnit}</span></span>
                <span className={cx("w-6 h-6 rounded-md border flex items-center justify-center", on ? "bg-brand-600 border-brand-600 text-white" : "border-line")}>{on && <Check size={14} />}</span>
              </button>); })}
          </div>
          <div className="flex items-center justify-between mt-5">
            <p className="text-sm text-ink-3">เลือกแล้ว {nominees.length} คน · {mgr ? `หัวหน้า (${mgr.name}) ถูกเพิ่มอัตโนมัติ` : "ยังไม่มีหัวหน้างานในระบบ HR"}{already.size ? ` · ส่งคำขอไปแล้ว ${already.size} คน` : ""}</p>
            <Button disabled={busy || nominees.length < 1} onClick={async () => {
              if (!subject) return; setBusy(true);
              try { const n = await liveApi.nominate360(subject.id, cycle.id, mgr?.id ?? null, nominees, cycle.endDate); toast(`ส่งคำขอประเมินแล้ว ${n} คน`); setNominees([]); reload(); }
              catch (e) { fail(e); } finally { setBusy(false); }
            }}><UserPlus size={16} />ส่งคำขอประเมิน</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/** หัวข้อประเมิน = Competency ตามตำแหน่งของคนที่ถูกประเมิน */
function RateItems({ targetId, ratings, setRatings, fallback, disabled }: { targetId: string; ratings: Record<string, number>; setRatings: (r: Record<string, number>) => void; fallback: { id: string; name: string }[]; disabled: boolean }) {
  const { personOf } = useStore();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const pid = (personOf(targetId) as { positionId?: string | null }).positionId;
    if (!pid) { setItems(fallback); return; }
    liveApi.loadFramework(pid).then((f) => setItems(f.comps.length ? f.comps : fallback), () => setItems(fallback));
  }, [targetId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return <p className="text-sm text-ink-3">ตำแหน่งของคนนี้ยังไม่มี Competency ในระบบ HR หลัก</p>;
  return <div className="divide-y divide-line">{items.map((c) => (
    <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2"><p className="flex-1 text-sm">{c.name}</p>
      <RatingPicker value={ratings[c.id] ?? null} onChange={(v) => setRatings({ ...ratings, [c.id]: v })} disabled={disabled} /></div>))}</div>;
}

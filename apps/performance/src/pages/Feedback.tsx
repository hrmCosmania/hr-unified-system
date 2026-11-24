import { useState } from "react";
import { MessageSquareHeart, Send, Eye, Lock, Globe, Sparkles, HandHeart, Inbox } from "lucide-react";
import { useStore, person } from "../data/store";
import { badges, competencies, feedbackRequests, people, recognitionWall } from "../data/mock";
import { Avatar, Button, Card, CardTitle, Empty, Field, PageHeader, Segmented, Tabs, cx, thDate } from "../components/ui";
import type { Feedback } from "../data/types";

const visLabel = { public: { l: "สาธารณะ (Recognition Wall)", i: <Globe size={13} /> }, manager: { l: "ผู้รับ + หัวหน้าของผู้รับ", i: <Eye size={13} /> }, private: { l: "เฉพาะผู้รับ", i: <Lock size={13} /> } };

export default function FeedbackPage() {
  const { feedback, sendFeedback, toast } = useStore();
  const [tab, setTab] = useState<"give" | "received" | "sent" | "wall">("give");
  const [type, setType] = useState<"praise" | "constructive" | "request">("praise");
  const [to, setTo] = useState("t1");
  const [comp, setComp] = useState(competencies[0].name);
  const [msg, setMsg] = useState("");
  const [badge, setBadge] = useState<string | undefined>("team_player");
  const [vis, setVis] = useState<Feedback["visibility"]>("public");
  const received = feedback.filter((f) => f.toId === "me");
  const sent = feedback.filter((f) => f.fromId === "me");
  const unread = received.filter((f) => !f.isRead).length;
  const colleagues = Object.values(people).filter((p) => p.id !== "me");

  const submit = () => {
    sendFeedback({ fromId: "me", toId: to, type, competency: comp, message: msg, badge: type === "praise" ? badge : undefined, visibility: type === "praise" ? vis : "private" });
    setMsg("");
    toast(type === "request" ? "ส่งคำขอ Feedback แล้ว" : "ส่ง Feedback แล้ว ขอบคุณที่ช่วยกันพัฒนา 🙏");
  };

  return (
    <div>
      <PageHeader icon={<MessageSquareHeart size={22} />} title="Feedback & Recognition" subtitle="ให้คำชื่นชมและคำแนะนำได้ทุกวัน — ไม่ต้องรอรอบประเมิน" />
      <Tabs value={tab} onChange={setTab} items={[
        { value: "give", label: "ให้ / ขอ Feedback" },
        { value: "received", label: "ได้รับ", count: unread || undefined },
        { value: "sent", label: "ที่ฉันส่ง" },
        { value: "wall", label: "Recognition Wall" },
      ]} />

      {tab === "give" && (
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <Card className="p-5">
            <Segmented value={type} onChange={setType} items={[
              { value: "praise", label: "👏 ชื่นชม" }, { value: "constructive", label: "💡 แนะนำ" }, { value: "request", label: "🙋 ขอ Feedback" },
            ]} />
            <div className="mt-5 space-y-4">
              <Field label={type === "request" ? "ขอจาก" : "ถึง"}>
                <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                  {colleagues.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.position} ({p.orgUnit})</option>)}
                </select>
              </Field>
              <Field label="เกี่ยวกับ Competency">
                <select className="input" value={comp} onChange={(e) => setComp(e.target.value)}>
                  {competencies.map((c) => <option key={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {type === "praise" && (
                <div>
                  <span className="label">มอบ Badge</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(badges).map(([k, b]) => (
                      <button key={k} type="button" onClick={() => setBadge(badge === k ? undefined : k)}
                        className={cx("rounded-full border px-3 h-9 text-[13px] cursor-pointer transition-all",
                          badge === k ? "border-[#eda100] bg-[#fff6e0] text-[#7a4f00] font-medium" : "border-line hover:border-[#eda100]")}>
                        {b.emoji} {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Field label={type === "request" ? "อยากได้ Feedback เรื่องอะไร" : "ข้อความ"} hint={type === "constructive" ? "เทคนิค SBI: สถานการณ์ (Situation) → พฤติกรรม (Behavior) → ผลกระทบ (Impact)" : undefined}>
                <textarea className="input" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)}
                  placeholder={type === "praise" ? "เล่าสิ่งที่เขาทำ และผลลัพธ์ที่เกิดขึ้น…" : type === "constructive" ? "เมื่อ… (สถานการณ์) คุณ… (พฤติกรรม) ทำให้… (ผลกระทบ) ครั้งหน้าลอง…" : "เช่น การนำเสนอยอดขายในที่ประชุมเช้า"} />
              </Field>
              {type === "praise" && (
                <div>
                  <span className="label">ใครมองเห็นได้</span>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(visLabel) as Feedback["visibility"][]).map((v) => (
                      <button key={v} type="button" onClick={() => setVis(v)}
                        className={cx("inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-[13px] cursor-pointer", vis === v ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-2")}>
                        {visLabel[v].i}{visLabel[v].l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setMsg("")}>ยกเลิก</Button>
                <Button onClick={submit} disabled={msg.trim().length < 5}><Send size={16} />{type === "request" ? "ส่งคำขอ" : "ส่ง Feedback"}</Button>
              </div>
            </div>
          </Card>
          <div className="space-y-5">
            <Card className="p-5">
              <CardTitle icon={<Inbox size={16} className="text-brand-600" />}>มีคนขอ Feedback จากคุณ</CardTitle>
              {feedbackRequests.map((r) => {
                const p = person(r.fromId);
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <Avatar p={p} size={36} />
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-ink-3 truncate">{r.topic} · ภายใน {r.due}</p></div>
                    <Button size="sm" variant="secondary" onClick={() => { setTo(r.fromId); setType("constructive"); }}>ตอบ</Button>
                  </div>
                );
              })}
            </Card>
            <Card className="p-5 bg-gradient-to-br from-[#fff9ec] to-white">
              <CardTitle icon={<Sparkles size={16} className="text-[#eda100]" />}>Feedback ของคุณเดือนนี้</CardTitle>
              <div className="grid grid-cols-3 text-center gap-2">
                {[["ให้", sent.length], ["ได้รับ", received.length], ["Badge", received.filter((f) => f.badge).length]].map(([l, v]) => (
                  <div key={l as string}><p className="font-display text-2xl font-semibold text-navy-800">{v}</p><p className="text-xs text-ink-3">{l}</p></div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {(tab === "received" || tab === "sent") && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(tab === "received" ? received : sent).map((f) => <FeedbackCard key={f.id} f={f} perspective={tab} />)}
          {(tab === "received" ? received : sent).length === 0 && <Empty icon={<HandHeart size={22} />} title="ยังไม่มี Feedback" />}
        </div>
      )}

      {tab === "wall" && (
        <div className="mt-5 columns-1 md:columns-2 xl:columns-3 gap-4 [&>*]:mb-4">
          {recognitionWall.map((f) => <FeedbackCard key={f.id} f={f} perspective="wall" />)}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ f, perspective }: { f: Feedback; perspective: "received" | "sent" | "wall" }) {
  const from = person(f.fromId), to = person(f.toId);
  const typeTag = f.type === "praise" ? { l: "ชื่นชม", c: "bg-good-bg text-[#087a08]" } : f.type === "constructive" ? { l: "คำแนะนำ", c: "bg-brand-50 text-brand-700" } : { l: "คำขอ", c: "bg-canvas text-ink-2" };
  return (
    <Card className={cx("p-4 break-inside-avoid", !f.isRead && perspective === "received" && "border-brand-200 ring-1 ring-brand-100")}>
      <div className="flex items-center gap-3">
        <Avatar p={perspective === "sent" ? to : from} size={38} />
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            {perspective === "wall" ? <><b>{from.name}</b> <span className="text-ink-3">→</span> <b>{to.name}</b></> : perspective === "sent" ? <>ถึง <b>{to.name}</b></> : <b>{from.name}</b>}
          </p>
          <p className="text-xs text-ink-3">{(perspective === "sent" ? to : perspective === "wall" ? to : from).position} · {thDate(f.createdAt)}</p>
        </div>
        <span className={cx("text-[11px] rounded-full px-2 py-0.5 font-medium", typeTag.c)}>{typeTag.l}</span>
      </div>
      {f.badge && (
        <div className="mt-3 rounded-xl bg-gradient-to-r from-[#fff3d6] to-[#fffaf0] px-3 py-2 text-sm font-medium text-[#7a4f00]">
          {badges[f.badge].emoji} {badges[f.badge].label}
        </div>
      )}
      <p className="text-[14px] text-ink-2 mt-3 leading-relaxed">{f.message}</p>
      <div className="flex items-center justify-between mt-3 text-xs text-ink-3">
        {f.competency && <span className="rounded-md bg-canvas px-2 py-0.5">#{f.competency}</span>}
        <span className="inline-flex items-center gap-1">{visLabel[f.visibility].i}{f.visibility === "public" ? "สาธารณะ" : f.visibility === "manager" ? "หัวหน้าเห็น" : "ส่วนตัว"}</span>
      </div>
    </Card>
  );
}

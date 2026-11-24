import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, CircleCheck, CircleDashed, TriangleExclamationPoint, X, Clock, Database, ShoppingCart, Factory, BookOpen, Pencil, ShieldCheck, Users } from "lucide-react";
import type { DataSource, GoalStatus, Person } from "../data/types";

export const cx = (...c: (string | number | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const fmt = (n: number, d = 0) => n.toLocaleString("th-TH", { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtCompact = (n: number) =>
  n >= 1_000_000 ? `${fmt(n / 1_000_000, 2)} ล้าน` : n >= 10_000 ? `${fmt(n / 1000, 0)}K` : fmt(n, n % 1 ? 1 : 0);
const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const thDate = (iso: string, withYear = true) => {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${thMonths[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
};

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("card", className)} {...rest}>{children}</div>;
}

export function CardTitle({ children, action, icon }: { children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className="font-display text-[15px] font-semibold text-ink flex items-center gap-2">{icon}{children}</h3>
      {action}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "leaf" | "danger"; size?: "sm" | "md" };
export function Button({ variant = "primary", size = "md", className, children, ...rest }: BtnProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "leaf" && "bg-leaf-500 text-white hover:bg-leaf-600",
        variant === "secondary" && "bg-white text-brand-700 border border-brand-200 hover:bg-brand-50",
        variant === "ghost" && "text-ink-2 hover:bg-brand-50 hover:text-brand-700",
        variant === "danger" && "bg-white text-crit border border-red-200 hover:bg-crit-bg",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Avatar({ p, size = 36 }: { p: Pick<Person, "name" | "color">; size?: number }) {
  const initials = p.name.replace(/^(นาย|นาง|นางสาว)/, "").trim().slice(0, 1);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-display font-semibold text-white shrink-0 ring-2 ring-white"
      style={{ width: size, height: size, background: p.color ?? "#2a78d6", fontSize: size * 0.42 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function Progress({ value, tone = "brand", className, height = 8 }: { value: number; tone?: "brand" | "good" | "warn" | "crit" | "leaf"; className?: string; height?: number }) {
  const color = { brand: "var(--color-brand-500)", good: "var(--color-good)", leaf: "var(--color-leaf-500)", warn: "var(--color-warn-mark)", crit: "var(--color-crit)" }[tone];
  return (
    <div className={cx("w-full rounded-full bg-[#e8eef6] overflow-hidden", className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

const statusMap: Record<string, { label: string; cls: string; icon: ReactNode }> = {
  on_track: { label: "ตามเป้า", cls: "bg-good-bg text-[#087a08]", icon: <CircleCheck size={13} /> },
  approved: { label: "อนุมัติแล้ว", cls: "bg-good-bg text-[#087a08]", icon: <CircleCheck size={13} /> },
  completed: { label: "สำเร็จ", cls: "bg-good-bg text-[#087a08]", icon: <CircleCheck size={13} /> },
  at_risk: { label: "ต้องดูแล", cls: "bg-warn-bg text-warn", icon: <TriangleExclamationPoint size={13} /> },
  off_track: { label: "เสี่ยง", cls: "bg-crit-bg text-crit", icon: <TriangleExclamationPoint size={13} /> },
  draft: { label: "ร่าง", cls: "bg-[#eef1f5] text-ink-2", icon: <Pencil size={12} /> },
  pending_approval: { label: "รออนุมัติ", cls: "bg-brand-50 text-brand-700", icon: <Clock size={13} /> },
  no_goal: { label: "ยังไม่ตั้งเป้า", cls: "bg-[#eef1f5] text-ink-2", icon: <CircleDashed size={13} /> },
  not_started: { label: "ยังไม่เริ่ม", cls: "bg-[#eef1f5] text-ink-2", icon: <CircleDashed size={13} /> },
  in_progress: { label: "กำลังทำ", cls: "bg-brand-50 text-brand-700", icon: <Clock size={13} /> },
};
export function StatusPill({ status, label }: { status: GoalStatus | string; label?: string }) {
  const s = statusMap[status] ?? statusMap.draft;
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-xs font-medium whitespace-nowrap", s.cls)}>
      {s.icon}{label ?? s.label}
    </span>
  );
}

export const toneOf = (status: string): "good" | "warn" | "crit" | "brand" =>
  status === "at_risk" ? "warn" : status === "off_track" ? "crit" : status === "on_track" || status === "completed" || status === "approved" ? "good" : "brand";

const sourceMap: Record<DataSource, { label: string; icon: ReactNode }> = {
  pos: { label: "POS", icon: <ShoppingCart size={12} /> },
  mes: { label: "MES", icon: <Factory size={12} /> },
  qms: { label: "QMS", icon: <ShieldCheck size={12} /> },
  tna: { label: "T&A", icon: <Clock size={12} /> },
  lms: { label: "LMS", icon: <BookOpen size={12} /> },
  crm: { label: "CRM", icon: <Users size={12} /> },
  manual: { label: "กรอกเอง", icon: <Pencil size={12} /> },
};
export function SourceTag({ source, title }: { source: DataSource; title?: string }) {
  const s = sourceMap[source];
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[11px] font-medium border",
      source === "manual" ? "border-line text-ink-3 bg-white" : "border-brand-100 text-brand-700 bg-brand-50")}>
      {source !== "manual" && <Database size={11} className="opacity-60" />}{s.icon}{s.label}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="flex gap-1 border-b border-line overflow-x-auto" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx("relative px-3.5 py-2.5 text-sm whitespace-nowrap cursor-pointer transition-colors",
            value === it.value ? "text-brand-700 font-semibold" : "text-ink-3 hover:text-ink")}
        >
          {it.label}
          {it.count !== undefined && <span className={cx("ml-1.5 rounded-full px-1.5 text-[11px]", value === it.value ? "bg-brand-600 text-white" : "bg-[#eef1f5] text-ink-2")}>{it.count}</span>}
          {value === it.value && <span className="absolute left-2 right-2 -bottom-px h-[3px] rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-[10px] bg-[#eaf0f7] p-1">
      {items.map((it) => (
        <button key={it.value} onClick={() => onChange(it.value)}
          className={cx("px-3 h-8 rounded-lg text-[13px] cursor-pointer transition-all",
            value === it.value ? "bg-white shadow-sm text-brand-700 font-semibold" : "text-ink-2 hover:text-ink")}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: string; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        {icon && <div className="hidden sm:flex w-11 h-11 rounded-xl bg-white border border-line items-center justify-center text-brand-600 shadow-sm">{icon}</div>}
        <div>
          <h1 className="font-display text-[22px] font-semibold text-navy-800 leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-ink-3 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: { label: string; sub?: string }[]; current: number }) {
  return (
    <ol className="flex items-start w-full overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={i} className="flex-1 min-w-[88px] flex flex-col items-center text-center relative">
            {i > 0 && <span className={cx("absolute top-[13px] right-1/2 w-full h-[3px] -z-0", i <= current ? "bg-leaf-500" : "bg-[#dfe7f1]")} />}
            <span className={cx("relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-[3px]",
              done && "bg-leaf-500 border-leaf-500 text-white",
              active && "bg-white border-leaf-500 text-leaf-600 ring-4 ring-leaf-100",
              !done && !active && "bg-white border-[#d3dde9] text-ink-3")}>
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cx("mt-2 text-[12.5px] leading-tight", active ? "text-ink font-semibold" : "text-ink-2")}>{s.label}</span>
            {s.sub && <span className="text-[11px] text-ink-3 mt-0.5">{s.sub}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-900/40 backdrop-blur-[2px] p-0 sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={cx("bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col fade-up", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-lg font-semibold text-navy-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-50 cursor-pointer" aria-label="ปิด"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-line flex justify-end gap-2 bg-[#fafcfe] rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3 mt-1">{hint}</span>}
    </label>
  );
}

export function RatingPicker({ value, onChange, disabled }: { value: number | null; onChange: (v: number) => void; disabled?: boolean }) {
  const labels = ["ต่ำกว่ามาตรฐาน", "ต้องพัฒนา", "ตามความคาดหวัง", "เกินความคาดหวัง", "โดดเด่น"];
  return (
    <div className="flex gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={disabled} role="radio" aria-checked={value === n} title={`${n} · ${labels[n - 1]}`}
          onClick={() => onChange(n)}
          className={cx("w-9 h-9 rounded-lg text-sm font-semibold border transition-all cursor-pointer disabled:cursor-default",
            value === n ? "bg-brand-600 border-brand-600 text-white shadow" : "bg-white border-[#d5dfeb] text-ink-2 hover:border-brand-500")}>
          {n}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 text-ink-3">
      <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-500 mb-3">{icon}</div>
      <p className="font-medium text-ink-2">{title}</p>
      {text && <p className="text-sm mt-1">{text}</p>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "crit" }) {
  return (
    <div className="card p-4">
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="font-display text-[26px] font-semibold text-navy-800 leading-tight mt-1">{value}</p>
      {sub && <p className={cx("text-xs mt-1", tone === "good" ? "text-[#087a08]" : tone === "warn" ? "text-warn" : tone === "crit" ? "text-crit" : "text-ink-3")}>{sub}</p>}
    </div>
  );
}

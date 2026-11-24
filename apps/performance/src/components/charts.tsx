// SVG charts แบบเบา ๆ (ไม่พึ่งไลบรารี) — สีตาม palette ที่ผ่านการตรวจ CVD, มี tooltip ทุกกราฟ
import { useState, type ReactNode } from "react";

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];

function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const node = tip ? <div className="viz-tip" style={{ left: tip.x + 12, top: tip.y - 10 }}>{tip.content}</div> : null;
  return { node, show: (e: React.MouseEvent, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content }), hide: () => setTip(null) };
}

/* ---------- Donut ---------- */
export function Donut({ segments, size = 132, thickness = 16, center }: {
  segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: ReactNode;
}) {
  const tip = useTip();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2, c = 2 * Math.PI * r, gap = segments.filter((s) => s.value > 0).length > 1 ? 2 : 0;
  let off = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8eef6" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = s.value > 0 && (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-off} strokeLinecap="butt"
              onMouseMove={(e) => tip.show(e, <><b>{s.label}</b> · {s.value} ({Math.round((s.value / total) * 100)}%)</>)}
              onMouseLeave={tip.hide} className="cursor-default" />
          );
          off += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      {tip.node}
    </div>
  );
}

/* ---------- Ring (single value) ---------- */
export function Ring({ value, size = 120, thickness = 12, color = "#1fa463", children }: { value: number; size?: number; thickness?: number; color?: string; children?: ReactNode }) {
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8eef6" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, value) / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ---------- Radar ---------- */
export function Radar({ axes, series, max = 5, size = 340, visible }: {
  axes: string[]; series: { label: string; values: number[]; n?: number }[]; max?: number; size?: number; visible?: boolean[];
}) {
  const tip = useTip();
  const cxy = size / 2, R = size / 2 - 62;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    return [cxy + Math.cos(a) * (v / max) * R, cxy + Math.sin(a) * (v / max) * R];
  };
  return (
    <div className="relative w-full flex justify-center">
      <svg viewBox={`-70 0 ${size + 140} ${size}`} className="w-full max-w-[480px] h-auto" role="img" aria-label="กราฟเรดาร์ผลประเมิน 360 องศา">
        {[1, 2, 3, 4, 5].map((lv) => (
          <polygon key={lv} points={axes.map((_, i) => pt(i, lv).join(",")).join(" ")} fill={lv % 2 ? "#f6f9fc" : "#fff"} stroke="#e1e8f1" strokeWidth={1} />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, max);
          const [lx, ly] = pt(i, max + 0.95);
          return (
            <g key={a}>
              <line x1={cxy} y1={cxy} x2={x} y2={y} stroke="#e1e8f1" />
              <text x={lx} y={ly} textAnchor={Math.abs(lx - cxy) < 8 ? "middle" : lx > cxy ? "start" : "end"} dominantBaseline="middle"
                className="fill-ink-2" style={{ fontSize: 12 }}>{a}</text>
            </g>
          );
        })}
        {[1, 3, 5].map((lv) => (
          <text key={lv} x={cxy + 3} y={pt(0, lv)[1] - 2} className="fill-ink-3" style={{ fontSize: 9 }}>{lv}</text>
        ))}
        {series.map((s, si) => (visible?.[si] ?? true) && (
          <g key={s.label}>
            <polygon points={s.values.map((v, i) => pt(i, v).join(",")).join(" ")} fill={SERIES[si]} fillOpacity={0.08} stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" />
            {s.values.map((v, i) => {
              const [x, y] = pt(i, v);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={4} fill={SERIES[si]} stroke="#fff" strokeWidth={2} />
                  <circle cx={x} cy={y} r={11} fill="transparent"
                    onMouseMove={(e) => tip.show(e, <><b>{s.label}</b>{s.n && s.n > 1 ? ` (${s.n} คน)` : ""} · {axes[i]}: {v.toFixed(1)}</>)}
                    onMouseLeave={tip.hide} />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {tip.node}
    </div>
  );
}

/* ---------- Grouped vertical bars (e.g., actual vs guideline) ---------- */
export function GroupedBars({ categories, series, unit = "%", height = 200 }: {
  categories: string[]; series: { label: string; values: number[]; color: string; hatch?: boolean }[]; unit?: string; height?: number;
}) {
  const tip = useTip();
  const max = Math.max(...series.flatMap((s) => s.values)) * 1.15;
  const W = 520, H = height, padL = 30, padB = 28, padT = 10;
  const gw = (W - padL) / categories.length, bw = Math.min(26, (gw - 18) / series.length);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#f2f5f9" /><line x1="0" y1="0" x2="0" y2="6" stroke="#9fb0c4" strokeWidth="2" />
          </pattern>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(max * t)} y2={y(max * t)} stroke="#edf1f6" />
            <text x={padL - 6} y={y(max * t)} textAnchor="end" dominantBaseline="middle" className="fill-ink-3" style={{ fontSize: 10 }}>{Math.round(max * t)}</text>
          </g>
        ))}
        {categories.map((c, ci) => {
          const gx = padL + ci * gw + (gw - bw * series.length - 2 * (series.length - 1)) / 2;
          return (
            <g key={c}>
              {series.map((s, si) => {
                const v = s.values[ci], x = gx + si * (bw + 2), top = y(v), h = y(0) - top;
                return (
                  <g key={si}>
                    <path d={`M${x},${y(0)} V${top + 4} Q${x},${top} ${x + 4},${top} H${x + bw - 4} Q${x + bw},${top} ${x + bw},${top + 4} V${y(0)} Z`}
                      fill={s.hatch ? "url(#hatch)" : s.color} stroke={s.hatch ? "#9fb0c4" : "none"} strokeWidth={s.hatch ? 1 : 0} />
                    <rect x={x - 3} y={padT} width={bw + 6} height={H - padT - padB} fill="transparent"
                      onMouseMove={(e) => tip.show(e, <><b>{c}</b> · {s.label}: {v}{unit}</>)} onMouseLeave={tip.hide} />
                    {h > 14 && !s.hatch && <text x={x + bw / 2} y={top - 4} textAnchor="middle" className="fill-ink-2" style={{ fontSize: 10, fontWeight: 600 }}>{v}</text>}
                  </g>
                );
              })}
              <text x={padL + ci * gw + gw / 2} y={H - 8} textAnchor="middle" className="fill-ink-2" style={{ fontSize: 11 }}>{c}</text>
            </g>
          );
        })}
        <line x1={padL} x2={W} y1={y(0)} y2={y(0)} stroke="#c9d4e1" />
      </svg>
      {tip.node}
    </div>
  );
}

/* ---------- Line chart with crosshair ---------- */
export function LineChart({ labels, values, unit = "%", color = SERIES[0], height = 180, target }: {
  labels: string[]; values: number[]; unit?: string; color?: string; height?: number; target?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = height, padL = 30, padB = 26, padT = 12, padR = 10;
  const min = Math.min(...values, target ?? Infinity) - 8, max = Math.max(...values, target ?? 0) + 6;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (labels.length - 1);
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(labels.length - 1, Math.round(((px - padL) / (W - padL - padR)) * (labels.length - 1)))));
        }}>
        {[0, 0.5, 1].map((t) => {
          const v = min + (max - min) * t;
          return <g key={t}><line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#edf1f6" /><text x={padL - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-ink-3" style={{ fontSize: 10 }}>{Math.round(v)}</text></g>;
        })}
        {target !== undefined && <>
          <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="#7b8aa0" strokeDasharray="4 4" />
          <text x={W - padR} y={y(target) - 5} textAnchor="end" className="fill-ink-3" style={{ fontSize: 10 }}>เป้า {target}{unit}</text>
        </>}
        <path d={`${d} L${x(values.length - 1)},${y(min)} L${x(0)},${y(min)} Z`} fill={color} opacity={0.08} />
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {labels.map((l, i) => <text key={l} x={x(i)} y={H - 7} textAnchor="middle" className="fill-ink-3" style={{ fontSize: 10 }}>{l}</text>)}
        <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
        <text x={x(values.length - 1) - 6} y={y(values[values.length - 1]) - 9} textAnchor="end" className="fill-ink" style={{ fontSize: 11, fontWeight: 600 }}>{values[values.length - 1]}{unit}</text>
        {hover !== null && <>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#9fb0c4" strokeWidth={1} />
          <circle cx={x(hover)} cy={y(values[hover])} r={5} fill={color} stroke="#fff" strokeWidth={2} />
        </>}
      </svg>
      {hover !== null && (
        <div className="absolute pointer-events-none viz-tip" style={{ position: "absolute", left: `${(x(hover) / W) * 100}%`, top: 0, transform: "translateX(-50%)" }}>
          {labels[hover]}: <b>{values[hover]}{unit}</b>
        </div>
      )}
    </div>
  );
}

/* ---------- Sparkline ---------- */
export function Sparkline({ values, color = SERIES[0], width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`);
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={2.5} fill={color} />
    </svg>
  );
}

/* ---------- Legend ---------- */
export function Legend({ items, onToggle, active }: { items: { label: string; color: string; hatch?: boolean; note?: string }[]; onToggle?: (i: number) => void; active?: boolean[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2">
      {items.map((it, i) => (
        <button key={it.label} type="button" onClick={() => onToggle?.(i)} disabled={!onToggle}
          className={"inline-flex items-center gap-1.5 " + (onToggle ? "cursor-pointer" : "cursor-default") + (active && !active[i] ? " opacity-40" : "")}>
          <span className="w-3 h-3 rounded-[3px]" style={{ background: it.hatch ? "repeating-linear-gradient(45deg,#9fb0c4 0 2px,#f2f5f9 2px 5px)" : it.color }} />
          {it.label}{it.note && <span className="text-ink-3">{it.note}</span>}
        </button>
      ))}
    </div>
  );
}

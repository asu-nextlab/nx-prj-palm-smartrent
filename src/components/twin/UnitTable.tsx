import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Building, Unit } from "@/lib/twin/data";
import { cn } from "@/lib/utils";

type Field = "apt_number" | "floor" | "beds" | "baths" | "area_sqft" | "rent" | "status" | "notes";
const COLS: { key: Field; label: string; num?: boolean; w: string }[] = [
  { key: "apt_number", label: "Apt", w: "w-20" },
  { key: "floor", label: "Floor", num: true, w: "w-14" },
  { key: "beds", label: "Beds", num: true, w: "w-16" },
  { key: "baths", label: "Baths", num: true, w: "w-14" },
  { key: "area_sqft", label: "Sq ft", num: true, w: "w-20" },
  { key: "rent", label: "Rent $", num: true, w: "w-20" },
  { key: "status", label: "Status", w: "w-24" },
  { key: "notes", label: "Notes", w: "min-w-40" },
];

function Cell({ unit, col, siteId }: { unit: Unit; col: (typeof COLS)[number]; siteId: string }) {
  const qc = useQueryClient();
  const initial = unit[col.key] == null ? "" : String(unit[col.key]);
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  const [editing, setEditing] = useState(false);
  // A studio has 0 bedrooms; say so, and accept "studio" when typed.
  const studio = col.key === "beds" && v === "0" && !editing;
  const save = async (): Promise<void> => {
    if (v === initial) return;
    const typed = col.key === "beds" && /^studio$/i.test(v.trim()) ? "0" : v;
    const value = col.num ? (typed === "" ? null : Number(typed)) : typed === "" && col.key !== "notes" ? initial : typed;
    if (col.num && value !== null && isNaN(value as number)) { setV(initial); { toast.error("Enter a number"); return; } }
    const { error } = await supabase.from("units").update({ [col.key]: value } as never).eq("id", unit.id);
    if (error) { setV(initial); { toast.error(error.message); return; } }
    qc.setQueryData(["site", siteId], (old: { units: Unit[] } | undefined) =>
      old ? { ...old, units: old.units.map((u) => (u.id === unit.id ? { ...u, [col.key]: value } : u)) } : old);
  };
  if (col.key === "status") {
    return (
      <select value={v} onClick={(e) => e.stopPropagation()} onChange={(e) => setV(e.target.value)} onBlur={save}
        className="w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-card">
        {["available", "leased", "notice", "maintenance"].map((s) => <option key={s}>{s}</option>)}
      </select>
    );
  }
  return (
    <input value={studio ? "Studio" : v} onClick={(e) => e.stopPropagation()} onChange={(e) => setV(e.target.value)}
      onFocus={() => setEditing(true)} onBlur={() => { setEditing(false); void save(); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setV(initial); }}
      inputMode={col.num ? "decimal" : undefined}
      className={cn("w-full bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-card focus:ring-1 focus:ring-ring", col.num && "text-right tabular-nums")} />
  );
}

export function UnitTable({ units, buildings, siteId, selected, onSelect }: {
  units: Unit[]; buildings: Building[]; siteId: string; selected: string | null; onSelect: (objectName: string) => void;
}) {
  const bname = new Map(buildings.map((b) => [b.id, b.name]));
  useEffect(() => {
    if (selected) document.getElementById(`row-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {buildings.length > 0 && <th className="px-2 py-2 font-medium">Building</th>}
            {COLS.map((c) => <th key={c.key} className={cn("px-2 py-2 font-medium", c.w, c.num && "text-right")}>{c.label}</th>)}
            <th className="px-2 py-2 font-medium">Model object</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} id={`row-${u.object_name}`} onClick={() => onSelect(u.object_name)}
              className={cn("cursor-pointer border-b hover:bg-accent/40", selected === u.object_name && "bg-accent")}>
              {buildings.length > 0 && <td className="whitespace-nowrap px-2 text-muted-foreground">{bname.get(u.building_id ?? "") ?? "—"}</td>}
              {COLS.map((c) => <td key={c.key} className={c.w}><Cell unit={u} col={c} siteId={siteId} /></td>)}
              <td className="px-2 font-mono text-xs text-muted-foreground">{u.object_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

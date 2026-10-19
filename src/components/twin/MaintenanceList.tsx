import type { Building, Unit } from "@/lib/twin/data";
import { LEVEL_COLORS, LEVEL_LABELS, RULES, type Issue, type Level } from "@/lib/twin/issues";
import { cn } from "@/lib/utils";

export function LevelBadge({ level }: { level: Level }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: LEVEL_COLORS[level] }} />
      {LEVEL_LABELS[level]}
    </span>
  );
}

/** Site-wide maintenance queue: every open issue, most urgent first. */
export function MaintenanceList({ issues, units, buildings, selectedUnit, selectedDevice, onSelect }: {
  issues: Issue[]; units: Unit[]; buildings: Building[];
  selectedUnit: string | null; selectedDevice: string | null;
  onSelect: (unitObjectName: string, deviceObjectName: string) => void;
}) {
  const unitByName = new Map(units.map((u) => [u.object_name, u]));
  const bname = new Map(buildings.map((b) => [b.id, b.name]));
  if (!issues.length) return <p className="p-4 text-sm text-muted-foreground">No open issues. Every device is online and within its service life.</p>;
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-2 font-medium">Priority</th>
            <th className="px-2 py-2 text-right font-medium" title="Higher is more urgent">Score</th>
            <th className="px-2 py-2 font-medium">Apt</th>
            {buildings.length > 0 && <th className="px-2 py-2 font-medium">Building</th>}
            <th className="px-2 py-2 font-medium">Device</th>
            <th className="px-2 py-2 font-medium">Issue</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => {
            const u = unitByName.get(i.device.unit_object_name);
            const selected = selectedUnit === i.device.unit_object_name && selectedDevice === i.device.object_name;
            return (
              <tr key={`${i.device.id}-${i.kind}`} onClick={() => onSelect(i.device.unit_object_name, i.device.object_name)}
                className={cn("cursor-pointer border-b hover:bg-accent/40", selected && "bg-accent")}>
                <td className="whitespace-nowrap px-2 py-1.5"><LevelBadge level={i.level} /></td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{i.priority}</td>
                <td className="px-2 py-1.5 font-medium">{u?.apt_number ?? i.device.unit_object_name}</td>
                {buildings.length > 0 && <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{bname.get(u?.building_id ?? "") ?? "—"}</td>}
                <td className="whitespace-nowrap px-2 py-1.5">{i.device.name}</td>
                <td className="px-2 py-1.5">
                  {i.label} <span className="text-muted-foreground">· {i.detail}</span>
                  {i.brokenInUnit > 1 && (
                    <span className="ml-2 rounded bg-muted px-1 text-[0.65rem] uppercase text-muted-foreground"
                      title={`+${RULES.perExtraBrokenDevice * (i.brokenInUnit - 1)} priority: several devices broken in this apartment`}>
                      {i.brokenInUnit} broken in apt
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

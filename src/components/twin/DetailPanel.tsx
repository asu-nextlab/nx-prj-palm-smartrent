import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addDevice, deleteDevice, devicesQuery, nextDeviceObjectName, type Device, type Unit } from "@/lib/twin/data";
import { DEVICE_KINDS, guessDevice, layoutOf } from "@/lib/twin/templates";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function DeviceEditor({ device, onDeleted }: { device: Device; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState(device);
  useEffect(() => setD(device), [device]);
  const fields: [keyof Device, string, boolean?][] = [["name", "Name"], ["type", "Type"], ["model", "Model"], ["install_year", "Installed", true], ["energy_kwh", "Energy kWh/yr", true], ["notes", "Notes"]];
  const save = async (): Promise<void> => {
    const { error } = await supabase.from("devices").update({
      name: d.name, type: d.type, model: d.model, notes: d.notes, status: d.status,
      install_year: d.install_year === null || (d.install_year as unknown) === "" ? null : Number(d.install_year),
      energy_kwh: d.energy_kwh === null || (d.energy_kwh as unknown) === "" ? null : Number(d.energy_kwh),
    }).eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Device saved");
    qc.invalidateQueries({ queryKey: ["devices", d.unit_id] });
    qc.invalidateQueries({ queryKey: ["site-devices"] });
  };
  const remove = async (): Promise<void> => {
    if (!confirm(`Delete ${device.name} (${device.object_name})? This removes its data for everyone. The 3D model isn't changed, but the object will be hidden.`)) return;
    try {
      await deleteDevice(device.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      return;
    }
    toast.success(`Deleted ${device.name}`);
    onDeleted();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["devices", device.unit_id] }),
      qc.invalidateQueries({ queryKey: ["site-devices"] }),
    ]);
  };
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-warn/50 bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{d.object_name}</span>
        <select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })} className="rounded border bg-background px-1 text-xs">
          {["online", "offline", "needs service"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {fields.map(([k, label, num]) => (
        <label key={k} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-xs text-muted-foreground">
          {label}
          <Input className="h-8 text-sm text-foreground" inputMode={num ? "numeric" : undefined} value={(d[k] as string | number | null) ?? ""}
            onChange={(e) => setD({ ...d, [k]: e.target.value })} />
        </label>
      ))}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={save}>Save device</Button>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={remove}>Delete</Button>
      </div>
    </div>
  );
}

const NEW_MARKER = "";

/** Adds a device row to an apartment. It either links to a DEV_ object in the model that has no
 *  row yet, or gets a new DEV_ name and shows as a marker in the 3D view. */
function AddDeviceForm({ unit, devices, modelDevices, onAdded, onCancel }: {
  unit: Unit; devices: Device[]; modelDevices: string[]; onAdded: (objectName: string) => void; onCancel: () => void;
}) {
  const qc = useQueryClient();
  const unlinked = modelDevices.filter((n) => !devices.some((d) => d.object_name === n));
  const [link, setLink] = useState(NEW_MARKER);
  const [kind, setKind] = useState<string>(DEVICE_KINDS[0]);
  const guess = guessDevice(link || `DEV_${kind}`);
  const [name, setName] = useState(guess.name);
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  // Follow the chosen kind/object until the user types their own name.
  const [nameEdited, setNameEdited] = useState(false);
  useEffect(() => { if (!nameEdited) setName(guess.name); }, [guess.name, nameEdited]);

  const submit = async (): Promise<void> => {
    if (!name.trim()) { toast.error("Enter a name"); return; }
    const objectName = link || nextDeviceObjectName(kind, [...devices.map((d) => d.object_name), ...modelDevices]);
    setSaving(true);
    try {
      await addDevice({ unit_id: unit.id, object_name: objectName, name: name.trim(), type: guess.type, model: model.trim() || null, status: "online" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add device");
      setSaving(false);
      return;
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["devices", unit.id] }),
      qc.invalidateQueries({ queryKey: ["site-devices"] }),
    ]);
    toast.success(`Added ${name.trim()} (${objectName})`);
    onAdded(objectName);
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-card p-3">
      <p className="text-xs font-semibold">Add device</p>
      <label className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-xs text-muted-foreground">
        3D object
        <select value={link} onChange={(e) => setLink(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground">
          <option value={NEW_MARKER}>New marker</option>
          {unlinked.map((n) => <option key={n} value={n}>{n} (in model, no data)</option>)}
        </select>
      </label>
      {!link && (
        <label className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-xs text-muted-foreground">
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm text-foreground">
            {DEVICE_KINDS.map((k) => <option key={k} value={k}>{guessDevice(`DEV_${k}`).type}</option>)}
          </select>
        </label>
      )}
      <label className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-xs text-muted-foreground">
        Name
        <Input className="h-8 text-sm text-foreground" value={name} onChange={(e) => { setName(e.target.value); setNameEdited(true); }} />
      </label>
      <label className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-xs text-muted-foreground">
        Model
        <Input className="h-8 text-sm text-foreground" value={model} placeholder="optional" onChange={(e) => setModel(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={saving} onClick={submit}>{saving ? "Adding…" : "Add device"}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function DetailPanel({ unit, device, modelDevices, onSelectDevice, onClose }: {
  unit: Unit; device: string | null;
  /** DEV_ object names in the 3D model for this apartment; null while the model is loading. */
  modelDevices: string[] | null;
  onSelectDevice: (obj: string | null) => void; onClose: () => void;
}) {
  const { data: devices = [] } = useQuery(devicesQuery(unit.id));
  const current = devices.find((d) => d.object_name === device);
  const [adding, setAdding] = useState(false);
  useEffect(() => setAdding(false), [unit.id]);
  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">Apartment</p>
          <h2 className="text-2xl font-semibold">{unit.apt_number}</h2>
          <p className="text-sm text-muted-foreground">Floor {unit.floor}{unit.layout ? ` · ${layoutOf(unit.layout).name}` : ""}</p>
        </div>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[["Beds", unit.beds], ["Baths", unit.baths], ["Sq ft", unit.area_sqft]].map(([k, v]) => (
          <div key={k as string} className="rounded-lg bg-muted py-2"><dt className="text-[0.65rem] uppercase text-muted-foreground">{k}</dt><dd className="font-display text-lg">{v ?? "—"}</dd></div>
        ))}
      </dl>
      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Devices <span className="font-normal text-muted-foreground">({devices.length})</span></h3>
        {!adding && <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!modelDevices} onClick={() => { setAdding(true); onSelectDevice(null); }}>+ Add device</Button>}
      </div>
      {devices.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No devices in this apartment yet.</p>}
      <ul className="mt-2 space-y-1">
        {devices.map((d) => (
          <li key={d.id}>
            <button onClick={() => onSelectDevice(d.object_name === device ? null : d.object_name)}
              className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent", d.object_name === device && "bg-accent")}>
              <span>{d.name}<span className="ml-2 text-xs text-muted-foreground">{d.type}</span>
                {modelDevices && !modelDevices.includes(d.object_name) && <span className="ml-2 rounded bg-muted px-1 text-[0.6rem] uppercase text-muted-foreground" title="Added in the web app; shown as a marker in 3D">web-added</span>}</span>
              <span className={cn("h-2 w-2 rounded-full", d.status === "online" ? "bg-success" : "bg-warn")} />
            </button>
          </li>
        ))}
      </ul>
      {adding && modelDevices && (
        <AddDeviceForm unit={unit} devices={devices} modelDevices={modelDevices}
          onAdded={(obj) => { setAdding(false); onSelectDevice(obj); }} onCancel={() => setAdding(false)} />
      )}
      {current && !adding && <DeviceEditor device={current} onDeleted={() => onSelectDevice(null)} />}
      <p className="mt-auto pt-6 text-xs text-muted-foreground">Click devices in the 3D view or in this list. Edit apartment details in the table below.</p>
    </div>
  );
}

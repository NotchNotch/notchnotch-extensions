import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Column, JSONRPCClient, ListItem, Ring, Row, Section, Settings, Spacer, Symbol, Text,
  capability, getPreferenceValues,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

interface Usage { used: number; total: number }
interface SystemStatus {
  cpu?: number;
  memory: Usage;
  disk: Usage;
  network?: { received: number; sent: number };
  thermal: "nominal" | "fair" | "serious" | "critical";
  uptime: number;
}
type Preferences = { busyAlert: boolean };

const { busyAlert } = getPreferenceValues<Preferences>();
/** Samples arrive every two seconds; three in a row is six seconds of load, not a spike. */
const settle = 3;

const share = (usage: Usage) => (usage.total > 0 ? Math.min(1, usage.used / usage.total) : 0);
const percent = (value: number) => `${Math.round(value * 100)}%`;
function bytes(value: number, perSecond = false) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  while (value >= 1000 && index < units.length - 1) { value /= 1000; index += 1; }
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}${perSecond ? "/s" : ""}`;
}

/** Busy means sustained CPU load, nearly full memory, or heat. It clears with some slack so it doesn't flicker. */
function pressure(status: SystemStatus, busy: boolean) {
  const cpu = status.cpu ?? 0;
  const memory = share(status.memory);
  const hot = status.thermal === "serious" || status.thermal === "critical";
  return hot || (busy ? cpu >= 0.6 || memory >= 0.85 : cpu >= 0.8 || memory >= 0.9);
}

function Gauge({ label, value }: { label: string; value: number }) {
  return <Column spacing="tight" align="center">
    <Ring value={value} size="title" tone={value >= 0.9 ? "warning" : "accent"} label={label}>
      <Text size="caption">{percent(value)}</Text>
    </Ring>
    <Text size="caption" tone="secondary">{label.toUpperCase()}</Text>
  </Column>;
}

function SystemMonitor() {
  const rpc = useMemo(() => new JSONRPCClient(capability("system")), []);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [peek, setPeek] = useState<{ id: string; text: string } | null>(null);
  const streak = useRef(0);

  useEffect(() => {
    const stop = rpc.onNotification(({ method, params }) => {
      if (method === "system/state") setStatus(params as unknown as SystemStatus);
    });
    void rpc.request<SystemStatus>("system/getState").then(setStatus).catch(() => {});
    return () => { stop(); void rpc.dispose().catch(() => {}); };
  }, [rpc]);

  useEffect(() => {
    if (!status) return;
    const pressed = pressure(status, busy);
    streak.current = pressed === busy ? 0 : streak.current + 1;
    if (streak.current < settle) return;
    streak.current = 0;
    setBusy(pressed);
    if (pressed && busyAlert) {
      const hot = status.thermal === "serious" || status.thermal === "critical";
      setPeek({ id: `busy-${Date.now()}`, text: hot ? "Your Mac is running hot" : "Your Mac is working hard" });
    }
  }, [status]);

  if (!status) return null;
  const cpu = status.cpu ?? 0;
  const memory = share(status.memory);
  const disk = share(status.disk);

  return <>
    <Settings>
      <Section title="Now" footer="System Monitor reads your Mac every two seconds while it runs. Nothing leaves your Mac.">
        <ListItem icon="cpu" title={`CPU ${percent(cpu)}`} subtitle={`Thermal state: ${status.thermal}`} />
        <ListItem icon="memorychip" title={`Memory ${percent(memory)}`} subtitle={`${bytes(status.memory.used)} of ${bytes(status.memory.total)}`} />
        <ListItem icon="internaldrive" title={`Disk ${percent(disk)}`} subtitle={`${bytes(status.disk.total - status.disk.used)} available`} />
      </Section>
    </Settings>
    {/* A glance: paused, so it waits on hover, until the Mac is busy enough to say so. */}
    <Activity id="system" title="System Monitor" phase={busy && busyAlert ? "active" : "paused"} idlePreview>
      <Activity.Compact
        leading={<Ring value={cpu} tone={busy ? "warning" : "accent"} label="CPU" />}
        trailing={<Text size="caption" tone={busy ? "warning" : "accent"}>{percent(cpu)}</Text>} />
      {peek ? <Activity.Peek id={peek.id} text={peek.text} /> : null}
      <Activity.Expanded>
        <Row>
          <Spacer />
          <Gauge label="CPU" value={cpu} />
          <Spacer />
          <Gauge label="Memory" value={memory} />
          <Spacer />
          <Gauge label="Disk" value={disk} />
          <Spacer />
        </Row>
        <Row spacing="tight">
          <Symbol name="arrow.down" size="caption" tone="accent" label="Download" />
          <Text size="caption">{status.network ? bytes(status.network.received, true) : "—"}</Text>
          <Spacer />
          <Symbol name="arrow.up" size="caption" tone="accent" label="Upload" />
          <Text size="caption">{status.network ? bytes(status.network.sent, true) : "—"}</Text>
        </Row>
      </Activity.Expanded>
    </Activity>
  </>;
}

start(<SystemMonitor />);

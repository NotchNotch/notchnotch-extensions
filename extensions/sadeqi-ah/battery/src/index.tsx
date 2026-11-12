import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Badge, Column, JSONRPCClient, ListItem, Ring, Row, Section, Settings, Spacer, Symbol, Text, Value,
  capability, getPreferenceValues,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

interface BatteryStatus {
  present: boolean;
  level?: number;
  charging: boolean;
  pluggedIn: boolean;
  charged: boolean;
  minutesToEmpty?: number;
  minutesToFull?: number;
  lowPowerMode: boolean;
}
type Preferences = { lowLevel: "10" | "20" | "30" | "off"; whileCharging: boolean };

const { lowLevel, whileCharging } = getPreferenceValues<Preferences>();
const lowLimit = lowLevel === "off" ? null : Number(lowLevel) / 100;

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}

function Battery() {
  const rpc = useMemo(() => new JSONRPCClient(capability("battery")), []);
  const [battery, setBattery] = useState<BatteryStatus | null>(null);
  // Peeks mark a moment: plugging in, or crossing the low level. Their ids change each time.
  const [moment, setMoment] = useState<{ id: string; text: string } | null>(null);
  const previous = useRef<BatteryStatus | null>(null);

  useEffect(() => {
    const stop = rpc.onNotification(({ method, params }) => {
      if (method === "battery/state") setBattery(params as unknown as BatteryStatus);
    });
    void rpc.request<BatteryStatus>("battery/getState").then(setBattery).catch(() => {});
    return () => { stop(); void rpc.dispose().catch(() => {}); };
  }, [rpc]);

  const percent = Math.round((battery?.level ?? 0) * 100);
  const low = !!battery?.present && !battery.pluggedIn && lowLimit !== null && (battery.level ?? 1) <= lowLimit;

  useEffect(() => {
    const before = previous.current;
    previous.current = battery;
    if (!before || !battery?.present) return;
    if (battery.pluggedIn && !before.pluggedIn && whileCharging && !battery.charged) {
      setMoment({ id: `plugged-${Date.now()}`, text: `Charging · ${percent}%` });
    } else if (low && !(before.level !== undefined && lowLimit !== null && before.level <= lowLimit && !before.pluggedIn)) {
      setMoment({ id: `low-${Date.now()}`, text: `Battery at ${percent}%` });
    }
  }, [battery]);

  if (!battery) return null;
  if (!battery.present) {
    return <Settings><Text tone="secondary">This Mac has no battery.</Text></Settings>;
  }

  const charging = battery.pluggedIn && !battery.charged;
  const active = low || (whileCharging && charging);
  const tone = low ? "danger" : "accent";
  const state = battery.charged ? "Charged" : charging ? "Charging" : "On battery";
  const time = charging && battery.minutesToFull !== undefined ? `${duration(battery.minutesToFull)} until full`
    : !battery.pluggedIn && battery.minutesToEmpty !== undefined ? `${duration(battery.minutesToEmpty)} left` : "";
  const symbol = charging ? "bolt.fill" : battery.pluggedIn ? "powerplug.fill" : "battery.75percent";

  return <>
    <Settings>
      <Section title="Now" footer="Choose when Battery shows in the notch under Setup.">
        <ListItem icon={symbol} tone={tone} title={`${percent}% · ${state}`} subtitle={time || undefined}>
          {battery.lowPowerMode ? <Badge tone="warning">Low Power</Badge> : null}
        </ListItem>
      </Section>
    </Settings>
    {/* Paused when there's nothing to watch: it waits on hover instead of holding the wings. */}
    <Activity id="battery" title="Battery" phase={active ? "active" : "paused"} idlePreview>
      <Activity.Compact
        leading={<Ring value={battery.level ?? 0} tone={tone} label="Battery" />}
        trailing={<Text size="caption" tone={tone}>{`${percent}%`}</Text>} />
      {moment ? <Activity.Peek id={moment.id} text={moment.text} /> : null}
      <Activity.Expanded>
        <Row spacing="loose">
          <Ring value={battery.level ?? 0} size="title" tone={tone} label="Battery">
            <Symbol name={symbol} tone={tone} />
          </Ring>
          <Column spacing="none">
            <Text size="caption" tone="secondary">{state.toUpperCase()}</Text>
            <Value unit="%" tone={tone}>{percent}</Value>
          </Column>
          <Spacer />
          <Column spacing="tight" align="end">
            {battery.lowPowerMode ? <Badge tone="warning">Low Power</Badge> : null}
            {time ? <Text size="caption" tone="secondary">{time}</Text> : null}
          </Column>
        </Row>
      </Activity.Expanded>
    </Activity>
  </>;
}

start(<Battery />);

import { useEffect, useState } from "react";
import { Activity, ListItem, Row, Section, Settings, Spacer, Symbol, Text, getPreferenceValues } from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

type Preferences = { zones: string; hour24: boolean };
const { zones, hour24 } = getPreferenceValues<Preferences>();

function isZone(zone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return true; } catch { return false; }
}
const requested = zones.split(",").map((zone) => zone.trim()).filter(Boolean).slice(0, 6);
const valid = requested.filter(isZone);
const invalid = requested.filter((zone) => !isZone(zone));

/** "America/New_York" → "New York". */
const cityName = (zone: string) => zone.split("/").pop()!.replace(/_/g, " ");

/** Minutes the zone is ahead of UTC at `date`. */
function offset(zone: string, date: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUTC - date.getTime()) / 60_000);
}

function describe(zone: string, now: Date) {
  const time = now.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: !hour24 });
  const difference = offset(zone, now) + now.getTimezoneOffset();
  const hours = difference / 60;
  const relative = difference === 0 ? "Same time" : `${hours > 0 ? "+" : "−"}${Math.abs(hours)}h`;
  const day = new Date(now.getTime() + difference * 60_000);
  const label = day.getDate() === now.getDate() ? "Today" : day > now ? "Tomorrow" : "Yesterday";
  return { city: cityName(zone), time, detail: `${label}, ${relative}`, night: day.getHours() < 7 || day.getHours() >= 20 };
}

/** Re-renders at the start of every minute. */
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { timer = setTimeout(() => { setNow(new Date()); schedule(); }, 60_000 - (Date.now() % 60_000) + 50); };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

function WorldClock() {
  const now = useMinute();
  const clocks = valid.map((zone) => describe(zone, now));
  return <>
    <Settings>
      <Section title="Clocks" footer="Add or remove cities in Setup, using time zone names such as Europe/Paris.">
        {clocks.map((clock) => <ListItem key={clock.city} icon={clock.night ? "moon.fill" : "sun.max.fill"} title={clock.city} subtitle={clock.detail}>
          <Text>{clock.time}</Text>
        </ListItem>)}
        {invalid.map((zone) => <ListItem key={zone} icon="exclamationmark.triangle" tone="warning" title={`“${zone}” isn’t a time zone`}
          subtitle="Use a name such as America/New_York." />)}
      </Section>
    </Settings>

    {clocks.length ? <Activity id="clocks" title="World Clock" phase="paused" idlePreview>
      <Activity.Compact leading={<Symbol name="globe" />} trailing={<Text size="caption">{clocks[0].time}</Text>} />
      <Activity.Expanded>
        {clocks.slice(0, 4).map((clock) => <Row key={clock.city}>
          <Symbol name={clock.night ? "moon.fill" : "sun.max.fill"} size="caption" tone="secondary" />
          <Text>{clock.city}</Text>
          <Text size="caption" tone="secondary">{clock.detail}</Text>
          <Spacer />
          <Text size="headline">{clock.time}</Text>
        </Row>)}
      </Activity.Expanded>
    </Activity> : null}
  </>;
}

start(<WorldClock />);

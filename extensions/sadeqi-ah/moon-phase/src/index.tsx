import { useEffect, useState } from "react";
import { Activity, ListItem, Progress, Row, Section, Settings, Spacer, Symbol, Text } from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

/** Mean length of a lunar cycle, and a known new moon (2000-01-06 18:14 UTC). */
const synodicMonth = 29.530588853;
const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
const day = 86_400_000;

const phases = [
  { name: "New Moon", symbol: "moonphase.new.moon" },
  { name: "Waxing Crescent", symbol: "moonphase.waxing.crescent" },
  { name: "First Quarter", symbol: "moonphase.first.quarter" },
  { name: "Waxing Gibbous", symbol: "moonphase.waxing.gibbous" },
  { name: "Full Moon", symbol: "moonphase.full.moon" },
  { name: "Waning Gibbous", symbol: "moonphase.waning.gibbous" },
  { name: "Last Quarter", symbol: "moonphase.last.quarter" },
  { name: "Waning Crescent", symbol: "moonphase.waning.crescent" },
];

/** Where the moon is in its cycle at `date`, from 0 (new) through 0.5 (full) to 1. */
function moon(date: Date) {
  const age = (((date.getTime() - knownNewMoon) / day) % synodicMonth + synodicMonth) % synodicMonth;
  const fraction = age / synodicMonth;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const phase = phases[Math.round(fraction * 8) % 8];
  const until = (target: number) => new Date(date.getTime() + (((target - fraction) % 1 + 1) % 1) * synodicMonth * day);
  return { age, illumination, phase, nextFull: until(0.5), nextNew: until(0) };
}

const dayName = (date: Date) => date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function MoonPhase() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30 * 60_000);
    return () => clearInterval(timer);
  }, []);

  const today = moon(now);
  const lit = `${Math.round(today.illumination * 100)}%`;
  const fullTonight = sameDay(today.nextFull, now) || today.phase.name === "Full Moon";
  return <>
    <Settings>
      <Section title={today.phase.name} footer="Calculated on your Mac from the average length of a lunar cycle; dates can be off by a few hours.">
        <ListItem icon={today.phase.symbol} title={`${lit} illuminated`} subtitle={`Day ${Math.floor(today.age) + 1} of 29.5`} />
        <ListItem icon="moonphase.full.moon" title="Next full moon" subtitle={dayName(today.nextFull)} />
        <ListItem icon="moonphase.new.moon" title="Next new moon" subtitle={dayName(today.nextNew)} />
      </Section>
    </Settings>

    <Activity id="moon" title="Moon Phase" phase="paused" idlePreview>
      <Activity.Compact leading={<Symbol name={today.phase.symbol} label={today.phase.name} />} trailing={<Text size="caption">{lit}</Text>} />
      {fullTonight ? <Activity.Peek id={`full-${today.nextFull.toDateString()}`} text="Full moon tonight" /> : null}
      <Activity.Expanded>
        <Row>
          <Symbol name={today.phase.symbol} size="title" tone="accent" />
          <Text size="title">{today.phase.name}</Text>
          <Spacer />
          <Text size="headline">{lit}</Text>
        </Row>
        <Progress value={today.illumination} />
        <Text size="caption" tone="secondary">{`Full moon ${fullTonight ? "tonight" : dayName(today.nextFull)} · New moon ${dayName(today.nextNew)}`}</Text>
      </Activity.Expanded>
    </Activity>
  </>;
}

start(<MoonPhase />);

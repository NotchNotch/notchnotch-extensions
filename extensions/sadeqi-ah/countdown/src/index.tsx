import { useEffect, useState } from "react";
import { Activity, ListItem, Row, Section, Settings, Spacer, Symbol, Text, getPreferenceValues } from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

type Preferences = { event: string; date: string; besideNotch: boolean };
const { event, date, besideNotch } = getPreferenceValues<Preferences>();

/** `2027-01-01` or `2027-01-01 18:30`, in local time. */
function parse(text: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(text.trim());
  if (!match) return undefined;
  const [, year, month, day, hour = "0", minute = "0"] = match;
  const target = new Date(+year, +month - 1, +day, +hour, +minute);
  return target.getMonth() === +month - 1 && target.getDate() === +day ? target : undefined;
}
const target = parse(date);

function remaining(now: Date) {
  const seconds = Math.max(0, Math.floor(((target?.getTime() ?? 0) - now.getTime()) / 1000));
  const days = Math.floor(seconds / 86_400), hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60), rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (days > 0) {
    return { done: false, short: `${days}d`, long: `${days} ${days === 1 ? "day" : "days"}`, detail: `${hours}h ${minutes}m`, seconds };
  }
  return { done: seconds === 0, short: `${hours}:${pad(minutes)}`, long: `${hours}:${pad(minutes)}:${pad(rest)}`, detail: "Today", seconds };
}

function Countdown() {
  const [now, setNow] = useState(() => new Date());
  const left = remaining(now);
  // Every second on the last day, every minute before that.
  const lastDay = left.seconds < 86_400;
  useEffect(() => {
    if (left.done || !target) return;
    const timer = setInterval(() => setNow(new Date()), lastDay ? 1000 : 60_000);
    return () => clearInterval(timer);
  }, [lastDay, left.done]);

  if (!target) {
    return <Settings>
      <Section title={event}>
        <ListItem icon="exclamationmark.triangle" tone="warning" title={`“${date}” isn’t a date`}
          subtitle="Use YYYY-MM-DD, or YYYY-MM-DD HH:MM for a time, in Setup." />
      </Section>
    </Settings>;
  }
  const when = target.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  return <>
    <Settings>
      <Section title={event} footer="Change the event and date in Setup.">
        <ListItem icon="calendar" title={when} subtitle={left.done ? "It’s here." : `${left.long} to go`} />
      </Section>
    </Settings>

    <Activity id="countdown" title={event} phase={left.done ? "completed" : besideNotch ? "active" : "paused"} idlePreview>
      <Activity.Compact leading={<Symbol name={left.done ? "party.popper.fill" : "hourglass"} />}
        trailing={<Text size="caption">{left.done ? "Now" : left.short}</Text>} />
      {left.done ? <Activity.Peek id={`done-${date}`} text={`${event} is here`} /> : null}
      <Activity.Expanded>
        <Row spacing="tight">
          <Symbol name="hourglass" size="caption" tone="secondary" />
          <Text size="caption" tone="secondary">{event.toUpperCase()}</Text>
          <Spacer />
          <Text size="caption" tone="secondary">{left.done ? "" : left.detail}</Text>
        </Row>
        <Text size="timer" tone="accent">{left.done ? "It’s here" : left.long}</Text>
        <Text size="caption" tone="secondary">{when}</Text>
      </Activity.Expanded>
    </Activity>
  </>;
}

start(<Countdown />);

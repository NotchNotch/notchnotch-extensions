import { useEffect, useState } from "react";
import {
  Actions, Activity, Button, ListItem, Picker, Prompt, Section, Settings, Symbol, Text, Toggle, useStoredState,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

const intervals = [
  { value: "20", label: "20 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "90 min" },
] as const;
type Interval = (typeof intervals)[number]["value"];
const minute = 60_000;
/** Overdue by more than this, the Mac slept or you were away: start over instead of nagging. */
const away = 15 * minute;

function BreakReminder() {
  const [enabled, setEnabled] = useStoredState<boolean>("enabled", true);
  const [period, setPeriod] = useStoredState<Interval>("interval", "45");
  const [nextAt, setNextAt] = useStoredState<number>("nextAt", 0);
  const [now, setNow] = useState(Date.now());
  const [asking, setAsking] = useState(false);
  const length = Number(period) * minute;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!enabled) { setAsking(false); return; }
    if (!nextAt || now - nextAt > away) { setNextAt(now + length); setAsking(false); }
    else if (now >= nextAt) setAsking(true);
  }, [enabled, nextAt, now, length]);

  function restart(after = length) { setAsking(false); setNextAt(Date.now() + after); setNow(Date.now()); }
  const left = Math.max(0, Math.ceil((nextAt - now) / minute));
  return <>
    <Settings>
      <Section title="Reminders" footer="If you’re away longer than 15 minutes, the timer starts over when you’re back.">
        <Toggle label="Remind me to take breaks" value={enabled} onChange={setEnabled} />
        <Picker label="Every" options={intervals} value={period} onChange={(value) => { setPeriod(value); setNextAt(Date.now() + Number(value) * minute); }} />
        {enabled ? <ListItem icon="clock" title={`Next break in ${left} min`}>
          <Button title="Start Over" onPress={() => restart()} />
        </ListItem> : null}
      </Section>
    </Settings>

    {enabled && !asking ? <Activity id="next-break" title="Next Break" phase="paused" idlePreview>
      <Activity.Compact leading={<Symbol name="figure.walk" />} trailing={<Text size="caption">{`${left}m`}</Text>} />
      <Activity.Expanded>
        <Text size="caption" tone="secondary">NEXT BREAK</Text>
        <Text size="timer" tone="accent">{`${left} min`}</Text>
        <Actions>
          <Button title="Start Over" icon="arrow.counterclockwise" onPress={() => restart()} />
          <Button title="Break Now" tone="accent" onPress={() => setAsking(true)} />
        </Actions>
      </Activity.Expanded>
    </Activity> : null}

    {enabled && asking ? <Prompt id="break" title="Time for a Break">
      <Prompt.Compact leading={<Symbol name="figure.walk" tone="success" />} trailing={<Text size="caption">Break</Text>} />
      <Prompt.Expanded>
        <Text tone="secondary">Stand up, stretch, and look at something far away for 20 seconds.</Text>
        <Actions>
          <Button title="In 10 Minutes" onPress={() => restart(10 * minute)} />
          <Button title="Done" tone="accent" onPress={() => restart()} />
        </Actions>
      </Prompt.Expanded>
    </Prompt> : null}
  </>;
}

start(<BreakReminder />);

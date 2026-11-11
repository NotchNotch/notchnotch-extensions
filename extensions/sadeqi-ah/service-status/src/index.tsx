import { useEffect, useState } from "react";
import {
  Activity, Button, ListItem, Row, Section, Settings, Symbol, Text, Toggle, fetch, open, useStoredState,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

/** Status pages with the Statuspage API. Each host is listed in the manifest's `network`. */
const services = [
  { id: "github", name: "GitHub", page: "https://www.githubstatus.com" },
  { id: "cloudflare", name: "Cloudflare", page: "https://www.cloudflarestatus.com" },
  { id: "openai", name: "OpenAI", page: "https://status.openai.com" },
  { id: "claude", name: "Claude", page: "https://status.claude.com" },
  { id: "discord", name: "Discord", page: "https://discordstatus.com" },
  { id: "npm", name: "npm", page: "https://status.npmjs.org" },
  { id: "vercel", name: "Vercel", page: "https://www.vercel-status.com" },
  { id: "atlassian", name: "Atlassian", page: "https://status.atlassian.com" },
  { id: "dropbox", name: "Dropbox", page: "https://status.dropbox.com" },
] as const;
type Service = (typeof services)[number];
type Indicator = "none" | "minor" | "major" | "critical" | "maintenance";
type Status = { service: Service; indicator: Indicator; description: string } | { service: Service; error: string };

async function check(service: Service): Promise<Status> {
  try {
    const response = await fetch(`${service.page}/api/v2/status.json`);
    if (!response.ok) return { service, error: `Answered ${response.status}` };
    const { status } = await response.json<{ status: { indicator: Indicator; description: string } }>();
    return { service, indicator: status.indicator, description: status.description };
  } catch {
    return { service, error: "Couldn’t reach the status page" };
  }
}

const isIncident = (status: Status) => "indicator" in status && status.indicator !== "none";
function look(status: Status): { symbol: string; tone: "success" | "warning" | "danger" | "secondary" } {
  if (!("indicator" in status)) return { symbol: "questionmark.circle", tone: "secondary" };
  switch (status.indicator) {
    case "none": return { symbol: "checkmark.circle.fill", tone: "success" };
    case "minor": case "maintenance": return { symbol: "exclamationmark.circle.fill", tone: "warning" };
    default: return { symbol: "xmark.octagon.fill", tone: "danger" };
  }
}

function ServiceStatus() {
  const [hidden, setHidden] = useStoredState<string[]>("hidden", ["atlassian", "dropbox"]);
  const [statuses, setStatuses] = useState<Status[]>();
  const [attempt, setAttempt] = useState(0);
  const watched = services.filter((service) => !hidden.includes(service.id));

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await Promise.all(watched.map(check));
      if (!cancelled) setStatuses(next);
    };
    refresh();
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [hidden.join(","), attempt]);

  const incidents = (statuses ?? []).filter(isIncident);
  const row = (status: Status) => {
    const { symbol, tone } = look(status);
    return <ListItem key={status.service.id} icon={symbol} tone={tone} title={status.service.name}
      subtitle={"indicator" in status ? status.description : status.error} onPress={() => open(status.service.page)} />;
  };
  const toggle = (id: string, on: boolean) => setHidden(on ? hidden.filter((value) => value !== id) : [...hidden, id]);

  return <>
    <Settings>
      <Section title="Now" footer="Checked every 5 minutes. Click a service to open its status page.">
        {(statuses ?? []).map(row)}
        <Row><Button title="Check Now" icon="arrow.clockwise" onPress={() => setAttempt((value) => value + 1)} /></Row>
      </Section>
      <Section title="Services">
        {services.map((service) => <Toggle key={service.id} label={service.name} value={!hidden.includes(service.id)}
          onChange={(on) => toggle(service.id, on)} />)}
      </Section>
    </Settings>

    {statuses ? <Activity id="status" title="Service Status" phase={incidents.length ? "active" : "paused"} idlePreview>
      <Activity.Compact leading={<Symbol name={incidents.length ? "exclamationmark.triangle.fill" : "checkmark.shield.fill"}
        tone={incidents.length ? "warning" : "success"} label={incidents.length ? "Incidents" : "All services working"} />}
        trailing={<Text size="caption">{incidents.length ? String(incidents.length) : "OK"}</Text>} />
      {incidents.length ? <Activity.Peek id={incidents.map((status) => status.service.id).join("+")}
        text={`${incidents.map((status) => status.service.name).join(", ")}: ${"description" in incidents[0] ? incidents[0].description : ""}`} /> : null}
      <Activity.Expanded>
        {incidents.length ? incidents.slice(0, 4).map(row)
          : <ListItem icon="checkmark.circle.fill" tone="success" title="All systems normal"
            subtitle={watched.map((service) => service.name).join(", ")} />}
      </Activity.Expanded>
    </Activity> : null}
  </>;
}

start(<ServiceStatus />);

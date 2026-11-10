import { useEffect, useState } from "react";
import {
  Actions, Activity, Button, ListItem, Row, Section, Settings, Spacer, Symbol, Text, fetch, getPreferenceValues, open,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

type Preferences = { token: string; participating: boolean };
const { token, participating } = getPreferenceValues<Preferences>();

type Notification = {
  id: string; reason: string; updated_at: string;
  subject: { title: string; type: string; url: string | null };
  repository: { full_name: string; html_url: string };
};

const symbols: Record<string, string> = {
  PullRequest: "arrow.triangle.pull", Issue: "smallcircle.filled.circle", Release: "tag.fill",
  Discussion: "bubble.left.and.bubble.right.fill", CheckSuite: "xmark.octagon.fill", Commit: "point.3.connected.trianglepath.dotted",
};

/** The page for a notification: API URLs for pulls and issues map onto github.com. */
function pageURL(item: Notification) {
  const match = /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/(pulls|issues)\/(\d+)$/.exec(item.subject.url ?? "");
  if (match) return `https://github.com/${match[1]}/${match[2] === "pulls" ? "pull" : "issues"}/${match[3]}`;
  return item.repository.html_url;
}

async function load(): Promise<{ items: Notification[]; poll: number }> {
  const response = await fetch(`https://api.github.com/notifications?per_page=20&participating=${participating}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (response.status === 401) throw new Error("GitHub didn’t accept the token. Check it in Setup.");
  if (response.status === 403) throw new Error("The token can’t read notifications. Give it the notifications scope.");
  if (!response.ok) throw new Error(`GitHub answered ${response.status}.`);
  // GitHub says how often to poll; never more often than that.
  const poll = Math.max(60, Number(response.headers["x-poll-interval"] ?? 60));
  return { items: await response.json<Notification[]>(), poll };
}

function GitHubNotifications() {
  const [items, setItems] = useState<Notification[]>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  // The newest notification at launch isn't news; only ones that arrive later are announced.
  const [launchKey, setLaunchKey] = useState<string | null>();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    async function refresh() {
      let wait = 120;
      try {
        const result = await load();
        if (cancelled) return;
        setItems(result.items); setError(undefined);
        const first = result.items[0];
        setLaunchKey((key) => key === undefined ? (first ? `${first.id}-${first.updated_at}` : null) : key);
        wait = Math.max(wait, result.poll);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      }
      if (!cancelled) timer = setTimeout(refresh, wait * 1000);
    }
    refresh();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [attempt]);

  const count = items?.length ?? 0;
  const newest = items?.[0];
  const newestKey = newest ? `${newest.id}-${newest.updated_at}` : null;
  const openAll = () => open("https://github.com/notifications");
  const list = (limit: number) => (items ?? []).slice(0, limit).map((item) =>
    <ListItem key={item.id} icon={symbols[item.subject.type] ?? "bell.fill"} title={item.subject.title}
      subtitle={item.repository.full_name} onPress={() => open(pageURL(item))} />);

  return <>
    <Settings>
      <Section title={error ? "Couldn’t Load Notifications" : `${count === 20 ? "20+" : count} Unread`}
        footer="Checked every few minutes, as often as GitHub allows.">
        {error ? <ListItem icon="exclamationmark.triangle" tone="warning" title={error} /> : list(10)}
        <Row>
          <Button title="Check Now" icon="arrow.clockwise" onPress={() => setAttempt((value) => value + 1)} />
          <Button title="Open GitHub" onPress={openAll} />
        </Row>
      </Section>
    </Settings>

    {error ? <Activity id="notifications" title="GitHub" phase="paused" idlePreview>
      <Activity.Compact leading={<Symbol name="exclamationmark.triangle.fill" tone="warning" />} trailing={<Text size="caption">GitHub</Text>} />
      <Activity.Expanded>
        <Text tone="secondary">{error}</Text>
        <Row><Spacer /><Button title="Try Again" onPress={() => setAttempt((value) => value + 1)} /></Row>
      </Activity.Expanded>
    </Activity> : items ? <Activity id="notifications" title="GitHub" phase={count ? "active" : "paused"} idlePreview>
      <Activity.Compact leading={<Symbol name={count ? "bell.badge.fill" : "bell"} tone={count ? "accent" : "secondary"} />}
        trailing={<Text size="caption">{count === 20 ? "20+" : String(count)}</Text>} />
      {newest && newestKey !== launchKey ? <Activity.Peek id={newestKey!} text={`${newest.repository.full_name} • ${newest.subject.title}`} /> : null}
      <Activity.Expanded>
        {count ? list(3) : <Text tone="secondary">You’re all caught up.</Text>}
        <Actions><Button title="Open GitHub" tone="accent" onPress={openAll} /></Actions>
      </Activity.Expanded>
    </Activity> : null}
  </>;
}

start(<GitHubNotifications />);

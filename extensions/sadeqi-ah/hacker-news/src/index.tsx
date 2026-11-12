import { useEffect, useState } from "react";
import {
  Activity, Button, ListItem, Picker, Row, Section, Settings, Spacer, Symbol, Text, fetch, open, useStoredState,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

const lists = [
  { value: "top", label: "Top" },
  { value: "best", label: "Best" },
  { value: "new", label: "New" },
  { value: "show", label: "Show HN" },
  { value: "ask", label: "Ask HN" },
] as const;
type List = (typeof lists)[number]["value"];
type Story = { id: number; title: string; url?: string; score: number; descendants?: number; by: string };

const api = "https://hacker-news.firebaseio.com/v0";
const discussion = (story: Story) => `https://news.ycombinator.com/item?id=${story.id}`;

async function load(list: List): Promise<Story[]> {
  const response = await fetch(`${api}/${list}stories.json`);
  if (!response.ok) throw new Error(`Hacker News answered ${response.status}.`);
  const ids = (await response.json<number[]>()).slice(0, 10);
  const stories = await Promise.all(ids.map(async (id) => {
    const item = await fetch(`${api}/item/${id}.json`);
    return item.ok ? item.json<Story | null>() : null;
  }));
  return stories.filter((story): story is Story => Boolean(story?.title));
}

function HackerNews() {
  const [list, setList] = useStoredState<List>("list", "top");
  const [stories, setStories] = useState<Story[]>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const next = await load(list);
        if (!cancelled) { setStories(next); setError(undefined); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      }
    }
    refresh();
    const timer = setInterval(refresh, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [list, attempt]);

  const item = (story: Story) => <ListItem key={story.id} title={story.title}
    subtitle={`${story.score} points · ${story.descendants ?? 0} comments`} onPress={() => open(story.url ?? discussion(story))}>
    <Button icon="bubble.left" label="Comments" onPress={() => open(discussion(story))} />
  </ListItem>;
  const name = lists.find((option) => option.value === list)!.label;

  return <>
    <Settings>
      <Section title="Stories" footer="Refreshed every 10 minutes. Click a story to open it, or the bubble for its comments.">
        <Picker label="List" options={lists} value={list} onChange={setList} />
        {error ? <ListItem icon="exclamationmark.triangle" tone="warning" title={error} /> : (stories ?? []).map(item)}
        <Row><Button title="Refresh" icon="arrow.clockwise" onPress={() => setAttempt((value) => value + 1)} /></Row>
      </Section>
    </Settings>

    {stories?.length ? <Activity id="stories" title="Hacker News" phase="paused" idlePreview>
      <Activity.Compact leading={<Symbol name="newspaper.fill" />} trailing={<Text size="caption">{name}</Text>} />
      <Activity.Expanded>
        <Row spacing="tight">
          <Symbol name="newspaper.fill" size="caption" tone="accent" />
          <Text size="caption" tone="secondary">{`HACKER NEWS · ${name.toUpperCase()}`}</Text>
          <Spacer />
        </Row>
        {stories.slice(0, 3).map(item)}
      </Activity.Expanded>
    </Activity> : null}
  </>;
}

start(<HackerNews />);

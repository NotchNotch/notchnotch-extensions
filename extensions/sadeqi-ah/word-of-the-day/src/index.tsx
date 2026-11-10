import { useEffect, useState } from "react";
import {
  Actions, Activity, Badge, Button, ListItem, Row, Section, Settings, Spacer, Symbol, Text, fetch, open, useStoredState,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

/** One a day, in this order; every word has an entry in the dictionary API. */
const words = [
  "serendipity", "ephemeral", "luminous", "solitude", "petrichor", "halcyon", "eloquent", "resilient", "mellifluous", "ineffable",
  "quixotic", "sanguine", "laconic", "ebullient", "nostalgia", "wanderlust", "panacea", "zenith", "candor", "gregarious",
  "meticulous", "pragmatic", "ubiquitous", "vivacious", "aplomb", "benevolent", "cogent", "diligent", "effervescent", "felicity",
  "gossamer", "harbinger", "idyllic", "jubilant", "kinetic", "labyrinth", "magnanimous", "nuance", "oblivion", "paradigm",
  "quintessential", "reverie", "solace", "tenacious", "umbrage", "verisimilitude", "whimsical", "zealous", "alacrity", "bucolic",
  "cacophony", "demure", "enigma", "fortitude", "gratitude", "hubris", "incandescent", "juxtapose", "kaleidoscope", "lucid",
  "mirth", "nebulous", "opulent", "pensive", "quandary", "rapport", "sagacious", "tranquil", "unfathomable", "vestige",
  "wistful", "epiphany", "ambivalent", "bravado", "conundrum", "dichotomy", "esoteric", "facetious", "gumption", "hiatus",
  "impetus", "jovial", "keen", "lethargic", "maverick", "nonchalant", "ostentatious", "placid", "quaint", "rhetoric",
  "scrutiny", "trepidation", "unassuming", "vicarious", "wry", "zephyr", "anomaly", "brevity", "catalyst", "deference",
];
type Entry = { word: string; phonetic?: string; partOfSpeech: string; definition: string; example?: string; date: string };

const today = () => new Date().toLocaleDateString("en-CA"); // 2026-11-10, in local time
function wordFor(date: string, skip = 0) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return words[(day + skip) % words.length];
}

async function lookUp(date: string): Promise<Entry> {
  let retried = false;
  for (let skip = 0; skip < 3; skip++) {
    const word = wordFor(date, skip);
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (response.status === 404) continue;
    // The dictionary's server fails now and then; one quick retry covers most of it.
    if (response.status >= 500 && !retried) { retried = true; skip -= 1; await new Promise<void>((done) => setTimeout(() => done(), 2000)); continue; }
    if (!response.ok) throw new Error(`The dictionary answered ${response.status}. Trying again in a few minutes.`);
    const [entry] = await response.json<{ word: string; phonetic?: string; meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[] }[]>();
    const meaning = entry.meanings[0];
    const sense = meaning.definitions.find((definition) => definition.example) ?? meaning.definitions[0];
    return { word: entry.word, phonetic: entry.phonetic, partOfSpeech: meaning.partOfSpeech, definition: sense.definition, example: sense.example, date };
  }
  throw new Error("Today’s word isn’t in the dictionary.");
}

function WordOfTheDay() {
  const [entry, setEntry] = useStoredState<Entry | null>("entry", null);
  const [error, setError] = useState<string>();
  const [date, setDate] = useState(today);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDate(today()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (entry?.date === date) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    lookUp(date).then((next) => { if (!cancelled) { setEntry(next); setError(undefined); } },
      (reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        retry = setTimeout(() => setAttempt((value) => value + 1), 5 * 60_000);
      });
    return () => { cancelled = true; if (retry) clearTimeout(retry); };
  }, [date, entry?.date, attempt]);

  const lookUpMore = () => entry && open(`https://en.wiktionary.org/wiki/${encodeURIComponent(entry.word)}`);
  return <>
    <Settings>
      <Section title="Today" footer="Definitions from Wiktionary, via the Free Dictionary API, under CC BY-SA 4.0.">
        {entry ? <ListItem icon="character.book.closed" title={entry.word} subtitle={`${entry.partOfSpeech} · ${entry.definition}`}>
          <Button title="Wiktionary" onPress={lookUpMore} />
        </ListItem> : <ListItem icon={error ? "exclamationmark.triangle" : "hourglass"} tone={error ? "warning" : "secondary"} title={error ?? "Looking it up…"} />}
      </Section>
    </Settings>

    {entry ? <Activity id="word" title="Word of the Day" phase="paused" idlePreview>
      <Activity.Compact leading={<Symbol name="character.book.closed.fill" />} trailing={<Text size="caption">{entry.word}</Text>} />
      <Activity.Peek id={entry.date} text={`Word of the day: ${entry.word}`} />
      <Activity.Expanded>
        <Row>
          <Text size="title">{entry.word}</Text>
          <Badge>{entry.partOfSpeech}</Badge>
          <Spacer />
          <Text size="caption" tone="secondary">{entry.phonetic ?? ""}</Text>
        </Row>
        <Text>{entry.definition}</Text>
        {entry.example ? <Text tone="secondary">{`“${entry.example}”`}</Text> : null}
        <Actions><Button title="More on Wiktionary" onPress={lookUpMore} /></Actions>
      </Activity.Expanded>
    </Activity> : null}
  </>;
}

start(<WordOfTheDay />);

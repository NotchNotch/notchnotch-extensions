import { useEffect, useState } from "react";
import {
  Activity, Badge, Button, ListItem, Row, Section, Settings, Spacer, Symbol, Text, fetch, getPreferenceValues, open,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

type Preferences = { coins: string; currency: string; besideNotch: boolean };
const { coins, currency, besideNotch } = getPreferenceValues<Preferences>();
const ids = coins.split(",").map((coin) => coin.trim().toLowerCase()).filter(Boolean).slice(0, 8);

type Price = { id: string; price: number; change: number };

/** "bitcoin" → "Bitcoin", "usd-coin" → "Usd Coin". */
const title = (id: string) => id.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const money = (value: number, compact = false) => new Intl.NumberFormat(undefined, {
  style: "currency", currency: currency.toUpperCase(), notation: compact && value >= 10_000 ? "compact" : "standard",
  maximumFractionDigits: value < 1 ? 4 : compact ? 1 : 2,
}).format(value);
const percent = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;

async function load(): Promise<Price[]> {
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=${currency}&include_24hr_change=true`);
  if (response.status === 429) throw new Error("CoinGecko asked to slow down. Trying again shortly.");
  if (!response.ok) throw new Error(`CoinGecko answered ${response.status}.`);
  const data = await response.json<Record<string, Record<string, number>>>();
  const prices = ids.filter((id) => data[id]?.[currency] !== undefined)
    .map((id) => ({ id, price: data[id][currency], change: data[id][`${currency}_24h_change`] ?? 0 }));
  if (!prices.length) throw new Error("None of those coins were found. Use CoinGecko IDs such as bitcoin in Setup.");
  return prices;
}

function CryptoPrices() {
  const [prices, setPrices] = useState<Price[]>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const next = await load();
        if (!cancelled) { setPrices(next); setError(undefined); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      }
    }
    refresh();
    const timer = setInterval(refresh, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [attempt]);

  const row = (price: Price) => <ListItem key={price.id} title={title(price.id)} subtitle={money(price.price)}
    onPress={() => open(`https://www.coingecko.com/en/coins/${price.id}`)}>
    <Badge tone={price.change >= 0 ? "success" : "danger"}>{percent(price.change)}</Badge>
  </ListItem>;
  const missing = prices ? ids.filter((id) => !prices.some((price) => price.id === id)) : [];
  const first = prices?.[0];

  return <>
    <Settings>
      <Section title="Prices" footer="From CoinGecko, every 2 minutes. Change in the last 24 hours. Not financial advice.">
        {error ? <ListItem icon="exclamationmark.triangle" tone="warning" title={error} /> : null}
        {(prices ?? []).map(row)}
        {missing.map((id) => <ListItem key={id} icon="questionmark.circle" tone="secondary" title={`“${id}” wasn’t found`} />)}
        <Row><Button title="Refresh" icon="arrow.clockwise" onPress={() => setAttempt((value) => value + 1)} /></Row>
      </Section>
    </Settings>

    {prices && first ? <Activity id="prices" title="Crypto Prices" phase={besideNotch ? "active" : "paused"} idlePreview>
      <Activity.Compact leading={<Symbol name="bitcoinsign.circle.fill" tone={first.change >= 0 ? "success" : "danger"}
        label={`${title(first.id)} ${first.change >= 0 ? "up" : "down"}`} />}
        trailing={<Text size="caption">{money(first.price, true)}</Text>} />
      <Activity.Expanded>
        {prices.slice(0, 4).map((price) => <Row key={price.id}>
          <Text>{title(price.id)}</Text>
          <Spacer />
          <Text size="headline">{money(price.price)}</Text>
          <Badge tone={price.change >= 0 ? "success" : "danger"}>{percent(price.change)}</Badge>
        </Row>)}
      </Activity.Expanded>
    </Activity> : null}
  </>;
}

start(<CryptoPrices />);

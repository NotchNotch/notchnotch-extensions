import { useEffect, useState } from "react";
import {
  Activity, Button, ListItem, Row, Section, Settings, Spacer, Symbol, Text, fetch, getPreferenceValues,
} from "@notchnotch/sdk";
import { start } from "@notchnotch/runtime";

type Preferences = { city: string; units: "metric" | "imperial"; besideNotch: boolean };
const { city, units, besideNotch } = getPreferenceValues<Preferences>();
const imperial = units === "imperial";

type Place = { name: string; country?: string; latitude: number; longitude: number };
type Weather = {
  place: string; temperature: number; feelsLike: number; high: number; low: number;
  wind: number; code: number; isDay: boolean; updated: Date;
};

/** WMO weather interpretation codes, as Open-Meteo reports them. */
function conditions(code: number, isDay: boolean): { label: string; symbol: string } {
  if (code === 0) return { label: "Clear", symbol: isDay ? "sun.max.fill" : "moon.stars.fill" };
  if (code <= 2) return { label: "Partly cloudy", symbol: isDay ? "cloud.sun.fill" : "cloud.moon.fill" };
  if (code === 3) return { label: "Overcast", symbol: "cloud.fill" };
  if (code === 45 || code === 48) return { label: "Fog", symbol: "cloud.fog.fill" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", symbol: "cloud.drizzle.fill" };
  if (code >= 61 && code <= 67) return { label: "Rain", symbol: "cloud.rain.fill" };
  if (code >= 71 && code <= 77) return { label: "Snow", symbol: "cloud.snow.fill" };
  if (code >= 80 && code <= 82) return { label: "Showers", symbol: "cloud.heavyrain.fill" };
  if (code === 85 || code === 86) return { label: "Snow showers", symbol: "cloud.snow.fill" };
  if (code >= 95) return { label: "Thunderstorm", symbol: "cloud.bolt.rain.fill" };
  return { label: "Unknown", symbol: "cloud.fill" };
}

async function findPlace(): Promise<Place> {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(city)}`);
  if (!response.ok) throw new Error(`The place search answered ${response.status}.`);
  const { results } = await response.json<{ results?: Place[] }>();
  if (!results?.length) throw new Error(`Couldn’t find “${city}”. Check the city in Setup.`);
  return results[0];
}

async function loadWeather(place: Place): Promise<Weather> {
  const query = [
    `latitude=${place.latitude}`, `longitude=${place.longitude}`, "timezone=auto", "forecast_days=1",
    "current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    "daily=temperature_2m_max,temperature_2m_min",
    ...(imperial ? ["temperature_unit=fahrenheit", "wind_speed_unit=mph"] : []),
  ].join("&");
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
  if (!response.ok) throw new Error(`The weather service answered ${response.status}.`);
  const data = await response.json<{
    current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; is_day: number };
    daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
  }>();
  return {
    place: place.name, temperature: data.current.temperature_2m, feelsLike: data.current.apparent_temperature,
    high: data.daily.temperature_2m_max[0], low: data.daily.temperature_2m_min[0], wind: data.current.wind_speed_10m,
    code: data.current.weather_code, isDay: data.current.is_day === 1, updated: new Date(),
  };
}

const degrees = (value: number) => `${Math.round(value)}°`;
const time = (date: Date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const speed = (value: number) => `${Math.round(value)} ${imperial ? "mph" : "km/h"}`;

function WeatherExtension() {
  const [weather, setWeather] = useState<Weather>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let place: Place | undefined;
    let cancelled = false;
    async function refresh() {
      try {
        place ??= await findPlace();
        const next = await loadWeather(place);
        if (!cancelled) { setWeather(next); setError(undefined); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      }
    }
    refresh();
    const timer = setInterval(refresh, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [attempt]);

  const now = weather ? conditions(weather.code, weather.isDay) : undefined;
  const retry = <Button title="Try Again" icon="arrow.clockwise" onPress={() => setAttempt((value) => value + 1)} />;
  return <>
    <Settings>
      <Section title={weather?.place ?? city} footer="Updated every 15 minutes. Change the city and units in Setup.">
        {weather && now ? <>
          <ListItem icon={now.symbol} title={`${degrees(weather.temperature)} ${now.label}`} subtitle={`Feels like ${degrees(weather.feelsLike)}`} />
          <ListItem icon="thermometer.medium" title={`High ${degrees(weather.high)} · Low ${degrees(weather.low)}`} />
          <ListItem icon="wind" title={`Wind ${speed(weather.wind)}`} />
        </> : <ListItem icon={error ? "exclamationmark.triangle" : "hourglass"} tone={error ? "warning" : "secondary"} title={error ?? "Loading…"} />}
        <Row>{retry}</Row>
      </Section>
    </Settings>

    {weather && now ? <Activity id="weather" title="Weather" phase={besideNotch ? "active" : "paused"} idlePreview>
      <Activity.Compact leading={<Symbol name={now.symbol} label={now.label} />} trailing={<Text size="caption">{degrees(weather.temperature)}</Text>} />
      <Activity.Expanded>
        <Row spacing="tight">
          <Symbol name="location.fill" size="caption" tone="secondary" />
          <Text size="caption" tone="secondary">{weather.place.toUpperCase()}</Text>
          <Spacer />
          <Text size="caption" tone="secondary">{time(weather.updated)}</Text>
        </Row>
        <Row>
          <Symbol name={now.symbol} size="title" />
          <Text size="timer">{degrees(weather.temperature)}</Text>
          <Spacer />
          <Text tone="secondary">{`${now.label} · H ${degrees(weather.high)} L ${degrees(weather.low)}`}</Text>
        </Row>
        <Text size="caption" tone="secondary">{`Feels like ${degrees(weather.feelsLike)} · Wind ${speed(weather.wind)}`}</Text>
      </Activity.Expanded>
    </Activity> : error ? <Activity id="weather" title="Weather" phase="paused" idlePreview>
      <Activity.Compact leading={<Symbol name="exclamationmark.triangle.fill" tone="warning" label="Weather unavailable" />} trailing={<Text size="caption">--°</Text>} />
      <Activity.Expanded>
        <Text tone="secondary">{error}</Text>
        <Row><Spacer />{retry}</Row>
      </Activity.Expanded>
    </Activity> : null}
  </>;
}

start(<WeatherExtension />);

/**
 * Open-Meteo weather service for IITR campus.
 * Free, no API key required.
 * Docs: https://open-meteo.com/en/docs
 */

const IITR_LAT = 29.8638;
const IITR_LNG = 77.8980;

export interface WeatherSnapshot {
  temperatureCelsius: number;
  apparentTemperatureCelsius: number; // heat index / "feels like"
  uvIndex: number;
  isExtremeHeat: boolean; // temp > 35°C OR apparent > 38°C
  isSunny: boolean;
  fetchedAt: number; // unix ms
}

let _cache: WeatherSnapshot | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // refresh at most every 15 min

export async function getCurrentWeather(): Promise<WeatherSnapshot | null> {
  // Return cached value if fresh enough
  if (_cache && Date.now() - _cacheTime < CACHE_TTL_MS) {
    return _cache;
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(IITR_LAT));
    url.searchParams.set('longitude', String(IITR_LNG));
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,uv_index,weather_code');
    url.searchParams.set('timezone', 'Asia/Kolkata');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error('[weather] Open-Meteo error:', res.status);
      return _cache; // return stale cache if available
    }

    const data = await res.json() as {
      current: {
        temperature_2m: number;
        apparent_temperature: number;
        uv_index: number;
        weather_code: number;
      };
    };

    const c = data.current;
    const snap: WeatherSnapshot = {
      temperatureCelsius: c.temperature_2m,
      apparentTemperatureCelsius: c.apparent_temperature,
      uvIndex: c.uv_index,
      isExtremeHeat: c.temperature_2m > 35 || c.apparent_temperature > 38,
      // WMO weather codes 0-3 are clear/partly cloudy
      isSunny: c.weather_code <= 3,
      fetchedAt: Date.now(),
    };

    _cache = snap;
    _cacheTime = Date.now();
    console.log(`[weather] ${snap.temperatureCelsius}°C, feels like ${snap.apparentTemperatureCelsius}°C, extreme=${snap.isExtremeHeat}`);
    return snap;
  } catch (err) {
    console.error('[weather] Fetch failed:', err);
    return _cache; // return stale cache or null
  }
}

/** Returns a human-readable heat warning string for the bot message */
export function buildHeatWarningMessage(weather: WeatherSnapshot, nextLocation?: string): string {
  const temp = Math.round(weather.apparentTemperatureCelsius);
  const where = nextLocation ? `heading to ${nextLocation}` : 'on the go';
  return (
    `🌡️ It's ${temp}°C outside right now (feels like ${temp}°C)! ` +
    `You're likely ${where} — stay hydrated! 💧\n\n` +
    `Quick tip: Grab an ORS/electrolyte drink or at least 500ml water from ` +
    `the nearest canteen before you head out. Your body needs it in this heat!`
  );
}

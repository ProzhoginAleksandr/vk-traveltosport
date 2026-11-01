// src/utils/trackFilter.ts
// Чистые функции фильтрации GPS-точек: решают, принять точку или отбросить.
//
// Важно про мобильный VK: там позиция приходит не потоком, а опросом
// VKWebAppGetGeodata раз в секунду (см. utils/geo.ts), а точность в городе
// нередко 30–60 м. Поэтому фильтр не должен ни отбрасывать точки «из осторожности»,
// ни требовать большого смещения между соседними фиксами — иначе трек рисуется
// рывками раз в 10–15 секунд или не рисуется вовсе.
import { haversine, type LatLon } from './geoMath';

export interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
  isPaused: boolean;
}

export interface Candidate extends LatLon {
  timestamp: number;
  /** Точность в метрах, 0 — неизвестна (так бывает в мобильном VK) */
  accuracy: number;
}

export const FILTER_DEFAULTS = {
  /** Абсолютный мусор: с такой точностью координата бесполезна */
  accuracyThreshold: 100,
  /** Порог индикатора «слабый сигнал» в интерфейсе (на запись точки не влияет) */
  weakAccuracy: 30,
  maxSpeedMps: 8,
  minIntervalMs: 500,
  /** Через сколько времени точка принимается даже при небольшом смещении */
  forceAcceptAfterMs: 5000,
  /** ...но только если она реально сдвинулась хотя бы на столько метров */
  forceAcceptMinMeters: 3,
} as const;

export type Rejection = 'accuracy' | 'interval' | 'tooClose' | 'speed';

export type FilterResult =
  | { ok: true; point: TrackPoint }
  | { ok: false; reason: Rejection };

/**
 * Минимальный сдвиг, после которого точка записывается.
 * Ориентир: опрос раз в секунду, скорость бега 3 м/с — между фиксами ~3 м.
 * Порог 3–8 м отсекает дрожание приёмника, но не «съедает» нормальный бег.
 */
const minDistanceFor = (accuracy: number): number =>
  accuracy > 0 ? Math.max(3, Math.min(8, accuracy * 0.25)) : 3;

export interface FilterOptions {
  isPaused: boolean;
  maxSpeedMps?: number;
  accuracyThreshold?: number;
}

export const acceptPoint = (
  prev: ReadonlyArray<TrackPoint>,
  candidate: Candidate,
  options: FilterOptions
): FilterResult => {
  const accuracyThreshold = options.accuracyThreshold ?? FILTER_DEFAULTS.accuracyThreshold;
  const maxSpeed = options.maxSpeedMps ?? FILTER_DEFAULTS.maxSpeedMps;

  // Отбрасываем только откровенный мусор: раньше порог был 30 м, и при обычной
  // городской точности 30–60 м трек не записывался вообще.
  if (candidate.accuracy > accuracyThreshold) return { ok: false, reason: 'accuracy' };

  const point: TrackPoint = {
    lat: candidate.lat,
    lon: candidate.lon,
    timestamp: candidate.timestamp,
    isPaused: options.isPaused,
  };

  if (prev.length === 0) return { ok: true, point };

  const last = prev[prev.length - 1];
  const dt = candidate.timestamp - last.timestamp;
  if (dt < FILTER_DEFAULTS.minIntervalMs) return { ok: false, reason: 'interval' };

  const segment = haversine(last, candidate);

  // Физически невозможная скорость — это выброс приёмника, а не бег
  if (segment / (dt / 1000) > maxSpeed) return { ok: false, reason: 'speed' };

  const minDistance = minDistanceFor(candidate.accuracy);

  // Точка слишком близко к предыдущей, но если запись «замерла» надолго,
  // а человек действительно сдвинулся — принимаем, иначе трек стоит на месте.
  const stalled = dt >= FILTER_DEFAULTS.forceAcceptAfterMs && segment >= FILTER_DEFAULTS.forceAcceptMinMeters;
  if (segment < minDistance && !stalled) return { ok: false, reason: 'tooClose' };

  return { ok: true, point };
};

export interface Sample extends LatLon {
  t: number;
}

/**
 * Скользящее среднее по последним точкам — сглаживает дрожание GPS.
 * Окно 5 с и два отсчёта: задержка примерно один фикс, а не 8 секунд,
 * как было при трёх отсчётах за 8 с (трек и дистанция заметно отставали).
 */
export const smoothPosition = (
  buffer: Sample[],
  sample: Sample,
  windowMs = 5000,
  maxLen = 2
): LatLon => {
  buffer.push(sample);
  while (buffer.length > maxLen || (buffer.length > 1 && sample.t - buffer[0].t > windowMs)) {
    buffer.shift();
  }
  const n = buffer.length;
  return {
    lat: buffer.reduce((sum, s) => sum + s.lat, 0) / n,
    lon: buffer.reduce((sum, s) => sum + s.lon, 0) / n,
  };
};

// src/utils/trackFilter.ts
// Чистые функции фильтрации GPS-точек: решают, принять точку или отбросить.
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
  accuracyThreshold: 30,
  maxSpeedMps: 7,
  minIntervalMs: 1000,
  backwardThresholdM: 5,
} as const;

export type Rejection = 'accuracy' | 'interval' | 'tooClose' | 'speed' | 'backward';

export type FilterResult =
  | { ok: true; point: TrackPoint }
  | { ok: false; reason: Rejection };

/**
 * Минимальный сдвиг, после которого точка записывается.
 * Чем хуже точность GPS, тем больше порог (от 5 до 15 м): так шум не превращается в «дрожание» трека.
 */
const minDistanceFor = (accuracy: number): number =>
  accuracy > 0 ? Math.min(15, Math.max(5, accuracy * 0.6)) : 5;

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
  if (segment < minDistanceFor(candidate.accuracy)) return { ok: false, reason: 'tooClose' };

  if (segment / (dt / 1000) > maxSpeed) return { ok: false, reason: 'speed' };

  // «Откат назад»: новая точка ближе к предпредыдущей, чем к предыдущей, — это шум
  if (prev.length >= 2) {
    const beforeLast = prev[prev.length - 2];
    if (haversine(beforeLast, candidate) < segment - FILTER_DEFAULTS.backwardThresholdM) {
      return { ok: false, reason: 'backward' };
    }
  }

  return { ok: true, point };
};

export interface Sample extends LatLon {
  t: number;
}

/** Скользящее среднее по последним точкам (до 3 штук за 8 секунд) — сглаживает дрожание GPS */
export const smoothPosition = (
  buffer: Sample[],
  sample: Sample,
  windowMs = 8000,
  maxLen = 3
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

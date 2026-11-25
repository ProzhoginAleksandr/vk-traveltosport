// src/utils/trackCloudCodec.ts
// Компактное кодирование тренировки для VK Storage (лимит значения ~4 КБ).
// Полный трек с тысячами точек туда не влезает, поэтому в облако уходят точные
// итоги и упрощённый маршрут: столько точек, сколько помещается в лимит.
import type { SavedTrack } from './trackStorage';

export const MAX_CLOUD_VALUE = 3800;
const MAX_CLOUD_POINTS = 120;
const MIN_CLOUD_POINTS = 20;

interface CompactTrack {
  v: 1;
  id: string;
  date: string;
  distance: number;
  duration: number;
  pace: number;
  speed: number;
  points: number[][];
}

const roundCoord = (value: number): number => Math.round(value * 1e5) / 1e5;

const compactPoints = (points: SavedTrack['points']): number[][] =>
  points.map((point) => [roundCoord(point.lat), roundCoord(point.lon), point.timestamp]);

const buildPayload = (track: SavedTrack, points: number[][]): string => {
  const compact: CompactTrack = {
    v: 1,
    id: track.id,
    date: track.date,
    distance: track.distance,
    duration: track.duration,
    pace: track.pace,
    speed: track.speed,
    points,
  };
  return JSON.stringify(compact);
};

/** Сжимает трек до размера, который влезает в VK Storage */
export const encodeTrackForCloud = (track: SavedTrack): string => {
  const allPoints = compactPoints(track.points);
  let payload = buildPayload(track, allPoints);
  if (payload.length <= MAX_CLOUD_VALUE) return payload;

  let count = Math.min(MAX_CLOUD_POINTS, allPoints.length);
  while (count >= MIN_CLOUD_POINTS) {
    const step = Math.max(1, Math.ceil(allPoints.length / count));
    const sampled: number[][] = [];
    for (let index = 0; index < allPoints.length; index += step) {
      sampled.push(allPoints[index]);
    }
    const last = allPoints[allPoints.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);

    payload = buildPayload(track, sampled);
    if (payload.length <= MAX_CLOUD_VALUE) return payload;
    count = Math.floor(count * 0.75);
  }

  // Даже упрощённый маршрут не влез — оставляем только итоги
  return buildPayload(track, []);
};

/** Восстанавливает трек из облачной копии */
export const decodeTrackFromCloud = (raw: string): SavedTrack | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<CompactTrack>;
    if (parsed.v !== 1) return null;
    if (typeof parsed.id !== 'string' || typeof parsed.date !== 'string') return null;
    const numeric = ['distance', 'duration', 'pace', 'speed'] as const;
    for (const field of numeric) {
      if (typeof parsed[field] !== 'number' || !Number.isFinite(parsed[field])) return null;
    }
    if (!Array.isArray(parsed.points)) return null;

    const points = parsed.points
      .filter(
        (point): point is number[] =>
          Array.isArray(point) &&
          point.length >= 3 &&
          point.slice(0, 3).every((value) => typeof value === 'number' && Number.isFinite(value))
      )
      .map((point) => ({
        lat: point[0],
        lon: point[1],
        timestamp: point[2],
        isPaused: false,
      }));

    return {
      id: parsed.id,
      date: parsed.date,
      distance: parsed.distance as number,
      duration: parsed.duration as number,
      pace: parsed.pace as number,
      speed: parsed.speed as number,
      points,
    };
  } catch {
    return null;
  }
};

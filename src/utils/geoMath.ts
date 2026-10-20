// src/utils/geoMath.ts
// Общая «география»: расстояния, упрощение трека, отсечки по километрам.
// Здесь нет ни React, ни VK Bridge, поэтому всё легко тестируется.

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Split {
  km: number;
  /** Время на этот километр, секунды */
  seconds: number;
}

const EARTH_RADIUS_M = 6371000;

const toRad = (d: number): number => (d * Math.PI) / 180;

/** Расстояние между двумя точками, метры (формула гаверсинусов) */
export const haversine = (a: LatLon, b: LatLon): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** Длина трека, метры. Участки, где хотя бы одна точка поставлена на паузу, не считаются */
export const computeDistance = (points: ReadonlyArray<LatLon & { isPaused?: boolean }>): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.isPaused || b.isPaused) continue;
    total += haversine(a, b);
  }
  return total;
};

/** Отсечки по километрам по меткам времени (только «движущееся» время, паузы не считаются) */
export const computeSplits = (
  points: ReadonlyArray<LatLon & { timestamp: number; isPaused?: boolean }>
): Split[] => {
  const splits: Split[] = [];
  let dist = 0;
  let movingTime = 0;
  let lastBoundaryTime = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.isPaused || b.isPaused) continue;

    const seg = haversine(a, b);
    const dt = Math.max(0, (b.timestamp - a.timestamp) / 1000);
    const prevDist = dist;
    const prevTime = movingTime;
    dist += seg;
    movingTime += dt;

    while (seg > 0 && dist >= (splits.length + 1) * 1000) {
      const boundary = (splits.length + 1) * 1000;
      const frac = (boundary - prevDist) / seg;
      const tAt = prevTime + frac * dt;
      splits.push({ km: splits.length + 1, seconds: tAt - lastBoundaryTime });
      lastBoundaryTime = tAt;
    }
  }
  return splits;
};

/* ---------------------------- упрощение трека ----------------------------- */

const roundCoord = (value: number, decimals = 5): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

// Алгоритм Дугласа—Пекера (без рекурсии). Возвращает индексы оставленных точек.
const douglasPeucker = (pts: ReadonlyArray<LatLon>, toleranceM: number): number[] => {
  const n = pts.length;
  if (n <= 2) return pts.map((_, i) => i);

  const lat0 = pts.reduce((sum, p) => sum + p.lat, 0) / n;
  const kx = Math.cos(toRad(lat0)) * 111320; // метров в градусе долготы
  const ky = 110540; // метров в градусе широты
  const xs = pts.map((p) => p.lon * kx);
  const ys = pts.map((p) => p.lat * ky);

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop() as [number, number];
    if (e - s < 2) continue;

    const dx = xs[e] - xs[s];
    const dy = ys[e] - ys[s];
    const len2 = dx * dx + dy * dy;

    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      let d: number;
      if (len2 === 0) {
        d = Math.hypot(xs[i] - xs[s], ys[i] - ys[s]);
      } else {
        let t = ((xs[i] - xs[s]) * dx + (ys[i] - ys[s]) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        d = Math.hypot(xs[i] - (xs[s] + t * dx), ys[i] - (ys[s] + t * dy));
      }
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }

    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
};

/**
 * Прореживает трек и округляет координаты до 5 знаков (~1 м).
 * Участки до и после паузы упрощаются по отдельности, поэтому границы пауз сохраняются.
 * Если после упрощения точек всё ещё больше maxPoints, допуск постепенно увеличивается.
 */
export const simplifyTrack = <T extends LatLon & { isPaused?: boolean }>(
  points: T[],
  toleranceM = 3,
  maxPoints = 1000
): T[] => {
  const rounded = (list: T[]): T[] =>
    list.map((p) => ({ ...p, lat: roundCoord(p.lat), lon: roundCoord(p.lon) }));

  if (points.length <= 2) return rounded(points);

  const runs: T[][] = [];
  let current: T[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (!!points[i].isPaused === !!current[current.length - 1].isPaused) {
      current.push(points[i]);
    } else {
      runs.push(current);
      current = [points[i]];
    }
  }
  runs.push(current);

  let tolerance = toleranceM;
  let result: T[] = points;
  for (let attempt = 0; attempt < 14; attempt++) {
    result = runs.flatMap((run) => douglasPeucker(run, tolerance).map((i) => run[i]));
    if (result.length <= maxPoints) break;
    tolerance *= 1.6;
  }
  return rounded(result);
};

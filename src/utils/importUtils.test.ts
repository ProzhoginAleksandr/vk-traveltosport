import { describe, expect, it } from 'vitest';

import { calculateMetrics } from './importUtils';
import type { TrackPoint } from './trackStorage';

const point = (lat: number, lon: number, timestamp: number): TrackPoint => ({
  lat,
  lon,
  timestamp,
  isPaused: false,
});

const forward = (): TrackPoint[] =>
  Array.from({ length: 61 }, (_, i) => point(55.75 + i * 0.0008, 37.62, i * 30000));

const outAndBack = (mirroredTime: boolean): TrackPoint[] => {
  const outbound = forward();
  const back = outbound
    .slice(0, -1)
    .reverse()
    .map((p) => point(p.lat, p.lon, mirroredTime ? p.timestamp : p.timestamp + 1800000));
  return [...outbound, ...back];
};

describe('calculateMetrics', () => {
  it('считает полную дистанцию в маршруте «туда-обратно»', () => {
    const metrics = calculateMetrics(outAndBack(false));

    expect(metrics.distance).toBeGreaterThan(10000);
    expect(metrics.distance).toBeLessThan(11000);
    expect(metrics.duration).toBeGreaterThan(3400);
    expect(metrics.duration).toBeLessThanOrEqual(3600);
  });

  it('не теряет вторую половину, если время идёт назад', () => {
    const metrics = calculateMetrics(outAndBack(true));

    expect(metrics.distance).toBeGreaterThan(10000);
    expect(metrics.distance).toBeLessThan(11000);
  });

  it('считает дистанцию без меток времени', () => {
    const points = outAndBack(false).map((p) => point(p.lat, p.lon, 0));
    const metrics = calculateMetrics(points);

    expect(metrics.distance).toBeGreaterThan(10000);
    expect(metrics.duration).toBe(0);
    expect(metrics.pace).toBe(0);
  });

  it('учитывает километры на сегменте без времени', () => {
    const metrics = calculateMetrics([point(55.75, 37.62, 0), point(55.751, 37.62, 0)]);
    expect(metrics.distance).toBeGreaterThan(100);
    expect(metrics.duration).toBe(0);
  });
});

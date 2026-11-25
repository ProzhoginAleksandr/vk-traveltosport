import { describe, expect, it } from 'vitest';

import type { SavedTrack, TrackPoint } from './trackStorage';
import { decodeTrackFromCloud, encodeTrackForCloud, MAX_CLOUD_VALUE } from './trackCloudCodec';

const makeTrack = (pointsCount: number): SavedTrack => {
  const points: TrackPoint[] = Array.from({ length: pointsCount }, (_, index) => ({
    lat: 55.75 + index * 0.00002,
    lon: 37.62 + Math.sin(index / 10) * 0.001,
    timestamp: 1763371200000 + index * 1000,
    isPaused: false,
  }));

  return {
    id: 'imported_gpx_1763371200000',
    date: '2026-11-17T09:31:20.000Z',
    distance: 10800,
    duration: 3666,
    pace: 339,
    speed: 10.6,
    points,
  };
};

describe('trackCloudCodec', () => {
  it('сохраняет короткий трек целиком', () => {
    const track = makeTrack(40);
    const payload = encodeTrackForCloud(track);
    expect(payload.length).toBeLessThanOrEqual(MAX_CLOUD_VALUE);

    const decoded = decodeTrackFromCloud(payload);
    expect(decoded).not.toBeNull();
    expect(decoded?.points).toHaveLength(40);
    expect(decoded?.distance).toBe(10800);
  });

  it('упрощает длинный трек, но сохраняет итоги', () => {
    const track = makeTrack(1889);
    const payload = encodeTrackForCloud(track);
    expect(payload.length).toBeLessThanOrEqual(MAX_CLOUD_VALUE);

    const decoded = decodeTrackFromCloud(payload);
    expect(decoded).not.toBeNull();
    expect(decoded?.distance).toBe(10800);
    expect(decoded?.duration).toBe(3666);
    expect(decoded?.points.length).toBeGreaterThan(2);
    expect(decoded?.points.length).toBeLessThan(1889);
  });

  it('выдерживает очень длинный трек', () => {
    const payload = encodeTrackForCloud(makeTrack(20000));
    expect(payload.length).toBeLessThanOrEqual(MAX_CLOUD_VALUE);
    expect(decodeTrackFromCloud(payload)?.points.length).toBeGreaterThan(0);
  });

  it('отклоняет битые данные', () => {
    expect(decodeTrackFromCloud('не json')).toBeNull();
    expect(decodeTrackFromCloud('{"v":2}')).toBeNull();
    expect(decodeTrackFromCloud('{"v":1,"id":"x","date":"y"}')).toBeNull();
  });
});

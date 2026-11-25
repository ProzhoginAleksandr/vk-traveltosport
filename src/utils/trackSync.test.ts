import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const store = new Map<string, string>();
  const send = vi.fn(async (method: string, params: { keys?: string[]; key?: string; value?: string }) => {
    if (method === 'VKWebAppStorageGet') {
      return {
        keys: (params.keys ?? []).map((key) => ({ key, value: store.get(key) ?? '' })),
      };
    }
    if (method === 'VKWebAppStorageSet' && typeof params.key === 'string') {
      store.set(params.key, params.value ?? '');
      return { result: true };
    }
    return {};
  });
  return { store, send };
});

vi.mock('@vkontakte/vk-bridge', () => ({
  default: { supports: () => true, send: mock.send },
}));

import {
  clearCloudTracks,
  pushTrackToCloud,
  removeTrackFromCloud,
  syncTracksOnStart,
} from './trackSync';
import { clearUserTracks, loadUserTracks, replaceUserTracks, type SavedTrack } from './trackStorage';

const local = new Map<string, string>();

const track: SavedTrack = {
  id: 'track-1',
  date: '2026-11-17T09:31:20.000Z',
  distance: 10800,
  duration: 3666,
  pace: 339,
  speed: 10.6,
  points: Array.from({ length: 200 }, (_, index) => ({
    lat: 55.75 + index * 0.0001,
    lon: 37.62,
    timestamp: 1763371200000 + index * 1000,
    isPaused: false,
  })),
};

beforeEach(() => {
  local.clear();
  mock.store.clear();
  mock.send.mockClear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  });
});

describe('trackSync', () => {
  it('загружает локальные тренировки в облако при первом запуске', async () => {
    replaceUserTracks(1, [track]);
    await syncTracksOnStart(1);

    expect(mock.store.size).toBeGreaterThan(0);
    expect(loadUserTracks(1)).toHaveLength(1);
  });

  it('восстанавливает историю, если локальная пуста', async () => {
    await pushTrackToCloud(track);
    clearUserTracks(1);

    const restored = await syncTracksOnStart(1);

    expect(restored).toBe(true);
    const tracks = loadUserTracks(1);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].distance).toBe(10800);
    expect(tracks[0].points.length).toBeGreaterThan(0);
  });

  it('не воскрешает удалённую тренировку', async () => {
    await pushTrackToCloud(track);
    await removeTrackFromCloud(track.id);
    clearUserTracks(1);

    const restored = await syncTracksOnStart(1);

    expect(restored).toBe(false);
    expect(loadUserTracks(1)).toHaveLength(0);
  });

  it('очищает облачную копию', async () => {
    await pushTrackToCloud(track);
    await clearCloudTracks();
    clearUserTracks(1);

    const restored = await syncTracksOnStart(1);

    expect(restored).toBe(false);
  });
});

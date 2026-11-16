import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildBackup,
  clearAppData,
  collectAppData,
  isAppKey,
  restoreBackup,
} from './appData';

const store = new Map<string, string>();

const localStorageMock = {
  get length() {
    return store.size;
  },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
};

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
});

describe('appData', () => {
  it('распознаёт ключи приложения и не трогает чужие', () => {
    expect(isAppKey('traveltosport_race_plan_v1')).toBe(true);
    expect(isAppKey('user_stats_1')).toBe(true);
    expect(isAppKey('vk_token')).toBe(false);
  });

  it('собирает только данные приложения', () => {
    localStorage.setItem('traveltosport_race_plan_v1', '{"a":1}');
    localStorage.setItem('user_history_1', '[]');
    localStorage.setItem('foreign_key', 'secret');
    expect(collectAppData()).toEqual({
      traveltosport_race_plan_v1: '{"a":1}',
      user_history_1: '[]',
    });
  });

  it('делает копию с версией и датой', () => {
    localStorage.setItem('traveltosport_ads_v1', '{}');
    const backup = buildBackup();
    expect(backup.app).toBe('TraveltoSport');
    expect(backup.version).toBe(1);
    expect(typeof backup.exportedAt).toBe('string');
    expect(backup.data.traveltosport_ads_v1).toBe('{}');
  });

  it('восстанавливает копию и считает записи', () => {
    const restored = restoreBackup(
      JSON.stringify({
        app: 'TraveltoSport',
        version: 1,
        exportedAt: '2026-11-16T00:00:00.000Z',
        data: { traveltosport_race_plan_v1: '{"b":2}', user_stats_1: '{}' },
      })
    );
    expect(restored).toBe(2);
    expect(localStorage.getItem('traveltosport_race_plan_v1')).toBe('{"b":2}');
  });

  it('отклоняет чужой файл', () => {
    expect(() => restoreBackup('{"app":"Other","data":{}}')).toThrow();
  });

  it('удаляет только данные приложения', () => {
    localStorage.setItem('traveltosport_tracks_1', '[]');
    localStorage.setItem('user_stats_1', '{}');
    localStorage.setItem('foreign_key', 'secret');
    expect(clearAppData()).toBe(2);
    expect(localStorage.getItem('foreign_key')).toBe('secret');
    expect(localStorage.getItem('traveltosport_tracks_1')).toBeNull();
  });
});

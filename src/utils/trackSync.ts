// src/utils/trackSync.ts
// Резервная копия тренировок в VKWebAppStorage. Переживает очистку кэша VK,
// переустановку приложения и переезд на другое устройство.
//
// Значение в VK Storage ограничено ~4 КБ, поэтому полный трек с тысячами точек
// туда не помещается. В облако уходят точные итоги (дистанция, время, темп) и
// упрощённый маршрут: столько точек, сколько влезает в лимит. Этого хватает,
// чтобы восстановить историю, статистику и картинку пробежки; форма маршрута
// может быть чуть грубее исходной.
import bridge from '@vkontakte/vk-bridge';

import {
  hasUserTracks,
  loadUserTracks,
  replaceUserTracks,
  type SavedTrack,
} from './trackStorage';
import {
  decodeTrackFromCloud,
  encodeTrackForCloud,
  MAX_CLOUD_VALUE,
} from './trackCloudCodec';

const MANIFEST_KEY = 'traveltosport_tracks_v1';
const TRACK_PREFIX = 'traveltosport_track_v1_';
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 20;
const BATCH_SIZE = 50;
const TIMEOUT_MS = 5000;

interface TrackManifest {
  ids: string[];
  updatedAt: string;
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

const supportsStorage = (): boolean => {
  try {
    return bridge.supports('VKWebAppStorageSet') && bridge.supports('VKWebAppStorageGet');
  } catch {
    return false;
  }
};

const chunkKey = (base: string, index: number): string => `${base}_${index}`;
const trackKey = (trackId: string): string =>
  `${TRACK_PREFIX}${encodeURIComponent(trackId).slice(0, 80)}`;

const readKeys = async (keys: string[]): Promise<Record<string, string>> => {
  const data = await withTimeout(bridge.send('VKWebAppStorageGet', { keys }), TIMEOUT_MS);
  const result: Record<string, string> = {};
  data.keys.forEach((entry) => {
    result[entry.key] = entry.value;
  });
  return result;
};

const writeKeys = async (entries: Array<{ key: string; value: string }>): Promise<void> => {
  await Promise.all(
    entries.map((entry) =>
      withTimeout(bridge.send('VKWebAppStorageSet', entry), TIMEOUT_MS).catch(() => null)
    )
  );
};

const readChunked = async (base: string): Promise<string | null> => {
  const head = await readKeys([base]);
  if (!head[base]) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(head[base]);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const meta = parsed as { chunks?: unknown };
  const chunks = typeof meta.chunks === 'number' ? meta.chunks : 0;
  if (!Number.isInteger(chunks) || chunks < 1 || chunks > MAX_CHUNKS) return null;

  const keys = Array.from({ length: chunks }, (_, index) => chunkKey(base, index));
  const values = await readKeys(keys);
  const payload = keys.map((key) => values[key] ?? '').join('');
  return payload || null;
};

const writeChunked = async (base: string, payload: string): Promise<boolean> => {
  const chunks: string[] = [];
  for (let offset = 0; offset < payload.length; offset += CHUNK_SIZE) {
    chunks.push(payload.slice(offset, offset + CHUNK_SIZE));
  }
  if (chunks.length > MAX_CHUNKS) return false;

  await writeKeys(chunks.map((value, index) => ({ key: chunkKey(base, index), value })));
  await writeKeys([{ key: base, value: JSON.stringify({ chunks: chunks.length }) }]);
  return true;
};

const clearChunked = async (base: string): Promise<void> => {
  const head = await readKeys([base]);
  const raw = head[base];
  const keys = [base];
  if (raw) {
    try {
      const meta = JSON.parse(raw) as { chunks?: number };
      if (typeof meta.chunks === 'number') {
        for (let index = 0; index < meta.chunks; index += 1) keys.push(chunkKey(base, index));
      }
    } catch {
      /* битый манифест — чистим хотя бы его */
    }
  }
  await writeKeys(keys.map((key) => ({ key, value: '' })));
};

const readManifest = async (): Promise<TrackManifest | null> => {
  const raw = await readChunked(MANIFEST_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TrackManifest>;
    if (!Array.isArray(parsed.ids) || !parsed.ids.every((id) => typeof id === 'string')) return null;
    return { ids: parsed.ids, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '' };
  } catch {
    return null;
  }
};

const writeManifest = (ids: string[]): Promise<boolean> =>
  writeChunked(
    MANIFEST_KEY,
    JSON.stringify({ ids, updatedAt: new Date().toISOString() })
  );

let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
};

/** Сохраняет тренировку в облако (перезаписывает копию с тем же id) */
export const pushTrackToCloud = (track: SavedTrack): Promise<boolean> =>
  enqueue(async () => {
    if (!supportsStorage()) return false;
    try {
      const payload = encodeTrackForCloud(track);
      if (payload.length > MAX_CLOUD_VALUE) return false;

      // Для нового пользователя манифеста ещё нет — создаём его
      const manifest = (await readManifest()) ?? { ids: [], updatedAt: '' };

      await writeKeys([{ key: trackKey(track.id), value: payload }]);
      if (!manifest.ids.includes(track.id)) {
        await writeManifest([...manifest.ids, track.id]);
      }
      return true;
    } catch {
      return false;
    }
  });

/** Удаляет тренировку из облака */
export const removeTrackFromCloud = (trackId: string): Promise<void> =>
  enqueue(async () => {
    if (!supportsStorage()) return;
    try {
      await writeKeys([{ key: trackKey(trackId), value: '' }]);
      const manifest = await readManifest();
      if (manifest) {
        await writeManifest(manifest.ids.filter((id) => id !== trackId));
      }
    } catch {
      /* нет связи — удалим при следующей попытке */
    }
  });

/** Полностью очищает облачную копию тренировок */
export const clearCloudTracks = (): Promise<void> =>
  enqueue(async () => {
    if (!supportsStorage()) return;
    try {
      const manifest = await readManifest();
      if (manifest) {
        const keys = manifest.ids.map((id) => trackKey(id));
        for (let offset = 0; offset < keys.length; offset += BATCH_SIZE) {
          await writeKeys(
            keys.slice(offset, offset + BATCH_SIZE).map((key) => ({ key, value: '' }))
          );
        }
      }
      await clearChunked(MANIFEST_KEY);
    } catch {
      /* нечего чистить */
    }
  });

const pullTracksFromCloud = async (): Promise<SavedTrack[]> => {
  const manifest = await readManifest();
  if (!manifest || manifest.ids.length === 0) return [];

  const tracks: SavedTrack[] = [];
  for (let offset = 0; offset < manifest.ids.length; offset += BATCH_SIZE) {
    const ids = manifest.ids.slice(offset, offset + BATCH_SIZE);
    const keys = ids.map(trackKey);
    const values = await readKeys(keys);
    for (const id of ids) {
      const raw = values[trackKey(id)];
      if (!raw) continue;
      const track = decodeTrackFromCloud(raw);
      if (track) tracks.push(track);
    }
  }
  return tracks;
};

/**
 * Синхронизация при запуске:
 * - локальная история пуста → поднимаем резервную копию из облака;
 * - локальная история есть → досылаем в облако тренировки, которых там ещё нет
 *   (первый запуск после обновления или восстановление из JSON).
 */
export const syncTracksOnStart = async (userId: number): Promise<boolean> => {
  if (!supportsStorage()) return false;
  try {
    const local = loadUserTracks(userId);

    if (local.length === 0) {
      // Пустой массив — осознанно пустая история; отсутствие ключа — новое
      // устройство или очищенный кэш, тогда поднимаем резервную копию.
      if (hasUserTracks(userId)) return false;
      const cloudTracks = await pullTracksFromCloud();
      if (cloudTracks.length === 0) return false;
      replaceUserTracks(userId, cloudTracks);
      return true;
    }

    const manifest = await readManifest();
    const cloudIds = new Set(manifest?.ids ?? []);
    const missing = local.filter((track) => !cloudIds.has(track.id));
    for (const track of missing) {
      await pushTrackToCloud(track);
    }
    return false;
  } catch {
    return false;
  }
};

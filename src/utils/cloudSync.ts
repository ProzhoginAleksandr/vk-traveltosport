// src/utils/cloudSync.ts
// Резервная копия плана в VKWebAppStorage: серверное хранилище VK для текущего
// пользователя. Переживает очистку кэша и переезд на другое устройство.
//
// Значение в хранилище ограничено по размеру, поэтому план режется на куски:
// сначала пишутся чанки, потом манифест. При чтении порядок обратный — если
// манифеста нет или он битый, копия считается отсутствующей.
import bridge from '@vkontakte/vk-bridge';

import type { PlanState } from './planStorage';

const PLAN_KEY = 'traveltosport_race_plan_v1';
const MANIFEST_KEY = 'traveltosport_plan_v1';
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 30;
const TIMEOUT_MS = 5000;

interface CloudManifest {
  updatedAt: string;
  chunks: number;
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

const chunkKey = (index: number): string => `${MANIFEST_KEY}_${index}`;

const readKeys = async (keys: string[]): Promise<Record<string, string>> => {
  const data = await withTimeout(
    bridge.send('VKWebAppStorageGet', { keys }),
    TIMEOUT_MS
  );
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

const parseManifest = (raw: string | undefined): CloudManifest | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const manifest = parsed as Partial<CloudManifest>;
    if (
      typeof manifest.updatedAt !== 'string' ||
      typeof manifest.chunks !== 'number' ||
      manifest.chunks < 1 ||
      manifest.chunks > MAX_CHUNKS
    ) {
      return null;
    }
    return { updatedAt: manifest.updatedAt, chunks: manifest.chunks };
  } catch {
    return null;
  }
};

const parseState = (raw: string): PlanState | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const state = parsed as Partial<PlanState>;
    if (typeof state.input !== 'object' || state.input === null) return null;
    return state as PlanState;
  } catch {
    return null;
  }
};

/** Сохраняет план в облако. Ошибки не пробрасывает: локальная копия важнее */
export const pushPlanToCloud = async (state: PlanState): Promise<boolean> => {
  if (!supportsStorage()) return false;
  try {
    const updatedAt = state.updatedAt ?? new Date().toISOString();
    const payload = JSON.stringify({ ...state, updatedAt });
    const chunks: string[] = [];
    for (let offset = 0; offset < payload.length; offset += CHUNK_SIZE) {
      chunks.push(payload.slice(offset, offset + CHUNK_SIZE));
    }
    if (chunks.length > MAX_CHUNKS) return false;

    await writeKeys(chunks.map((value, index) => ({ key: chunkKey(index), value })));
    await writeKeys([
      { key: MANIFEST_KEY, value: JSON.stringify({ updatedAt, chunks: chunks.length }) },
    ]);
    return true;
  } catch {
    return false;
  }
};

/** Читает план из облака, если копия целая */
export const pullPlanFromCloud = async (): Promise<PlanState | null> => {
  if (!supportsStorage()) return null;
  try {
    const manifestRaw = await readKeys([MANIFEST_KEY]);
    const manifest = parseManifest(manifestRaw[MANIFEST_KEY]);
    if (!manifest) return null;

    const keys = Array.from({ length: manifest.chunks }, (_, index) => chunkKey(index));
    const chunks = await readKeys(keys);
    const payload = keys.map((key) => chunks[key] ?? '').join('');
    if (!payload) return null;

    const state = parseState(payload);
    if (!state) return null;
    return { ...state, updatedAt: manifest.updatedAt };
  } catch {
    return null;
  }
};

/** Подтягивает облачную копию при запуске, если она свежее локальной */
export const syncPlanOnStart = async (): Promise<boolean> => {
  const cloud = await pullPlanFromCloud();
  if (!cloud) return false;
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    const local: PlanState | null = raw ? (JSON.parse(raw) as PlanState) : null;
    const localAt = local?.updatedAt ?? local?.createdAt ?? '';
    if (cloud.updatedAt && cloud.updatedAt > localAt) {
      localStorage.setItem(PLAN_KEY, JSON.stringify(cloud));
      return true;
    }
  } catch {
    /* локальную копию не трогаем */
  }
  return false;
};

/** Удаляет облачную копию плана */
export const clearCloudPlan = async (): Promise<void> => {
  if (!supportsStorage()) return;
  try {
    const manifestRaw = await readKeys([MANIFEST_KEY]);
    const manifest = parseManifest(manifestRaw[MANIFEST_KEY]);
    const keys = [MANIFEST_KEY];
    if (manifest) {
      for (let index = 0; index < manifest.chunks; index++) keys.push(chunkKey(index));
    }
    await writeKeys(keys.map((key) => ({ key, value: '' })));
  } catch {
    /* нечего чистить или нет связи */
  }
};

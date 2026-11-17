// src/utils/club.ts
// Клубный пробег: отправка своего месячного километража на бэкенд и получение
// общей статистики. Считаются только импортированные тренировки; наружу уходят
// суммы, без имён и отдельных маршрутов.
import bridge from '@vkontakte/vk-bridge';

import { CLUB_API_URL, CLUB_ENABLED } from '../config/club';
import { getCurrentUser } from './userUtils';
import { loadUserTracks } from './trackStorage';
import {
  collectMonthKm,
  formatClubNumber,
  monthKey,
  monthTitle,
} from './clubFormat';

export { collectMonthKm, formatClubNumber, monthKey, monthTitle };

const CACHE_KEY = 'traveltosport_club_stats_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;
const BRIDGE_TIMEOUT_MS = 2000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

export interface ClubStats {
  month: string;
  km: number;
  users: number;
  fetchedAt: number;
}

export type LaunchAuth = Record<string, string | number>;

const pickAuth = (source: Record<string, unknown>): LaunchAuth | null => {
  const auth: LaunchAuth = {};
  Object.entries(source).forEach(([key, value]) => {
    if ((key === 'sign' || key.startsWith('vk_')) && (typeof value === 'string' || typeof value === 'number')) {
      auth[key] = value;
    }
  });
  return auth.sign && auth.vk_user_id ? auth : null;
};

const authFromUrl = (): LaunchAuth | null => {
  const params = new URLSearchParams(window.location.search);
  const source: Record<string, string> = {};
  params.forEach((value, key) => {
    source[key] = value;
  });
  return pickAuth(source);
};

const authFromBridge = async (): Promise<LaunchAuth | null> => {
  try {
    const params = await withTimeout(bridge.send('VKWebAppGetLaunchParams'), BRIDGE_TIMEOUT_MS);
    return pickAuth(params as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
};

const getAuth = async (): Promise<LaunchAuth | null> => {
  const fromBridge = await authFromBridge();
  return fromBridge ?? authFromUrl();
};

const requestJson = async (url: string, init?: RequestInit): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const readCache = (): ClubStats | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const stats = parsed as Partial<ClubStats>;
    if (
      typeof stats.month !== 'string' ||
      typeof stats.km !== 'number' ||
      typeof stats.users !== 'number' ||
      typeof stats.fetchedAt !== 'number'
    ) {
      return null;
    }
    return { month: stats.month, km: stats.km, users: stats.users, fetchedAt: stats.fetchedAt };
  } catch {
    return null;
  }
};

const writeCache = (stats: ClubStats): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stats));
  } catch {
    /* кэш не критичен */
  }
};

/** Кэшированная сводка: показываем сразу, пока не пришла свежая */
export const getCachedClubStats = (): ClubStats | null => {
  const stats = readCache();
  if (!stats) return null;
  return stats;
};

export const isClubCacheFresh = (stats: ClubStats | null): boolean =>
  Boolean(stats && Date.now() - stats.fetchedAt < CACHE_TTL_MS);

const toStats = (data: unknown, month: string): ClubStats | null => {
  if (typeof data !== 'object' || data === null) return null;
  const source = data as { km?: unknown; users?: unknown; month?: unknown };
  const km = typeof source.km === 'number' ? source.km : Number(source.km);
  const users = typeof source.users === 'number' ? source.users : Number(source.users);
  if (!Number.isFinite(km) || !Number.isFinite(users)) return null;
  return {
    month: typeof source.month === 'string' ? source.month : month,
    km: Math.round(km * 10) / 10,
    users: Math.max(0, Math.round(users)),
    fetchedAt: Date.now(),
  };
};

const fetchClubStats = async (month: string): Promise<ClubStats | null> => {
  if (!CLUB_ENABLED) return null;
  const data = await requestJson(`${CLUB_API_URL}?month=${encodeURIComponent(month)}`);
  const stats = toStats(data, month);
  if (stats) writeCache(stats);
  return stats;
};

const submitContribution = async (
  auth: LaunchAuth,
  month: string,
  km: number,
  allowDecrease: boolean
): Promise<void> => {
  await requestJson(`${CLUB_API_URL}?action=submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth, month, km, allowDecrease }),
  });
};

let inFlight: Promise<ClubStats | null> | null = null;

export interface ClubSyncOptions {
  /** Разрешить уменьшить вклад: включается только при удалении тренировки */
  allowDecrease?: boolean;
}

/**
 * Отправляет свой месячный километраж и возвращает свежую сводку.
 * Параллельные вызовы переиспользуют один запрос; перерасчёт после удаления
 * выполняется после текущей отправки, чтобы не потерять порядок.
 */
export const syncClubContribution = (
  options: ClubSyncOptions = {}
): Promise<ClubStats | null> => {
  if (!CLUB_ENABLED) return Promise.resolve(null);
  if (inFlight) {
    if (!options.allowDecrease) return inFlight;
    return inFlight.then(() => syncClubContribution(options));
  }

  const allowDecrease = options.allowDecrease === true;

  inFlight = (async () => {
    const auth = await getAuth();
    if (!auth) return null;

    const user = await withTimeout(getCurrentUser(), BRIDGE_TIMEOUT_MS).catch(() => null);
    const userId = user?.id ?? Number(auth.vk_user_id);
    if (!userId) return null;

    const month = monthKey();
    const km = collectMonthKm(loadUserTracks(userId), month);
    await submitContribution(auth, month, km, allowDecrease);
    const stats = await fetchClubStats(month);
    if (stats && typeof window !== 'undefined') {
      // Главная и экран клуба обновляют карточку без перезагрузки
      window.dispatchEvent(new CustomEvent('traveltosport:club', { detail: stats }));
    }
    return stats;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
};

/** Свой вклад за месяц по локальным данным */
export const getOwnMonthKm = async (month: string = monthKey()): Promise<number> => {
  const user = await withTimeout(getCurrentUser(), BRIDGE_TIMEOUT_MS).catch(() => null);
  if (user) return collectMonthKm(loadUserTracks(user.id), month);
  const auth = await getAuth();
  const userId = auth ? Number(auth.vk_user_id) : 0;
  return userId ? collectMonthKm(loadUserTracks(userId), month) : 0;
};

// src/utils/adUtils.ts
// Полноэкранная реклама VK: событийные показы, редкий фолбэк в таббаре и
// показ по кнопке (opt-in). Все места пользуются одним состоянием, поэтому
// лимиты действуют на приложение целиком, а не на отдельный экран.
//
// Правила, чтобы реклама не была навязчивой:
//  • не чаще одного показа в 3 минуты;
//  • не больше 3 показов за сессию и 8 за день;
//  • первые 2 сессии нового пользователя — без автоматической рекламы;
//  • событийный показ (игра, неделя плана, импорт, шаринг, финиш) приоритетнее таббара;
//  • таббар — не чаще раза в 10 минут, и только если событийной рекламы не было 10 минут;
//  • во время пробежки реклама запрещена.
//
// TODO (следующий шаг): rewarded-видео (EAdsFormats.REWARD) — «продолжить серию»
// в играх, разбор тренировки, бонус к серии. Пока не реализовано по договорённости.

import bridge, { EAdsFormats } from '@vkontakte/vk-bridge';
import type { RouteNavigator } from '@vkontakte/vk-mini-apps-router';

const STORAGE_KEY = 'traveltosport_ads_v1';

/** Минимальный промежуток между любыми показами */
export const AD_INTERVAL_MS = 3 * 60_000;

/** Таббар: свой, более строгий интервал */
const TABBAR_INTERVAL_MS = 10 * 60_000;

/** После событийного показа таббар молчит столько же */
const EVENT_QUIET_MS = 10 * 60_000;

const SESSION_MAX_ADS = 3;
const DAILY_MAX_ADS = 8;
/** Сессия «продолжается», если между действиями меньше получаса */
const SESSION_IDLE_MS = 30 * 60_000;
/** Первые сессии нового пользователя проходят без автоматической рекламы */
const NEW_USER_SESSIONS = 2;
/** В начале сессии таббар не показываем, чтобы не встречать рекламой */
const SESSION_WARMUP_MS = 60_000;

const CHECK_TIMEOUT_MS = 4000;
const SHOW_TIMEOUT_MS = 15000;
/** Если рекламы нет, повторно спрашиваем VK не чаще, чем раз в это время */
const FAILURE_COOLDOWN_MS = 30_000;
/** Показ по кнопке — тоже не чаще раза в 45 секунд */
const OPT_IN_COOLDOWN_MS = 45_000;

/** Откуда пришёл запрос на рекламу */
export type AdTrigger =
  | 'tabbar'
  | 'run_finished'
  | 'game_finished'
  | 'plan_week'
  | 'import_done'
  | 'share_done'
  | 'opt_in';

type AdCounters = Partial<Record<AdTrigger, number>>;

interface AdStats {
  /** Сколько раз просили показать (до проверки доступности) */
  attempts: AdCounters;
  /** Сколько роликов реально показано */
  shown: AdCounters;
  /** VK не дал рекламу или показ сорвался */
  failed: AdCounters;
  /** Почему показ не состоялся (лимиты, блокировка, новая сессия) */
  skipped: AdCounters;
}

interface AdState {
  firstSeenAt: number;
  /** Номер текущей сессии */
  sessions: number;
  sessionStartedAt: number;
  sessionAds: number;
  dayKey: string;
  dayAds: number;
  lastAdAt: number;
  lastEventAt: number;
  lastTabbarAt: number;
  lastFailureAt: number;
  stats: AdStats;
}

const emptyCounters = (): AdCounters => ({});

const defaultState = (): AdState => ({
  firstSeenAt: 0,
  sessions: 0,
  sessionStartedAt: 0,
  sessionAds: 0,
  dayKey: '',
  dayAds: 0,
  lastAdAt: 0,
  lastEventAt: 0,
  lastTabbarAt: 0,
  lastFailureAt: 0,
  stats: { attempts: emptyCounters(), shown: emptyCounters(), failed: emptyCounters(), skipped: emptyCounters() },
});

let adsBlocked = false;
let adInFlight = false;

export const setAdsBlocked = (blocked: boolean): void => {
  adsBlocked = blocked;
};

export const isAdsBlocked = (): boolean => adsBlocked;

export const isLocalHost = (): boolean => {
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.')
  );
};

const dayKey = (time: number): string => {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const counter = (value: unknown): AdCounters => {
  if (typeof value !== 'object' || value === null) return emptyCounters();
  const result: AdCounters = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, amount]) => {
    if (typeof amount === 'number' && amount > 0) result[key as AdTrigger] = amount;
  });
  return result;
};

const loadState = (): AdState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaultState();
    const source = parsed as Partial<AdState> & { stats?: Partial<AdStats> };
    return {
      firstSeenAt: typeof source.firstSeenAt === 'number' ? source.firstSeenAt : 0,
      sessions: typeof source.sessions === 'number' ? source.sessions : 0,
      sessionStartedAt: typeof source.sessionStartedAt === 'number' ? source.sessionStartedAt : 0,
      sessionAds: typeof source.sessionAds === 'number' ? source.sessionAds : 0,
      dayKey: typeof source.dayKey === 'string' ? source.dayKey : '',
      dayAds: typeof source.dayAds === 'number' ? source.dayAds : 0,
      lastAdAt: typeof source.lastAdAt === 'number' ? source.lastAdAt : 0,
      lastEventAt: typeof source.lastEventAt === 'number' ? source.lastEventAt : 0,
      lastTabbarAt: typeof source.lastTabbarAt === 'number' ? source.lastTabbarAt : 0,
      lastFailureAt: typeof source.lastFailureAt === 'number' ? source.lastFailureAt : 0,
      stats: {
        attempts: counter(source.stats?.attempts),
        shown: counter(source.stats?.shown),
        failed: counter(source.stats?.failed),
        skipped: counter(source.stats?.skipped),
      },
    };
  } catch {
    return defaultState();
  }
};

const saveState = (state: AdState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage может быть недоступен */
  }
};

const bump = (map: AdCounters, trigger: AdTrigger): void => {
  map[trigger] = (map[trigger] ?? 0) + 1;
};

/** Новая сессия, если приложение давно не открывали; и новый день */
const beginSession = (state: AdState, now: number): void => {
  if (state.sessions === 0) {
    state.sessions = 1;
    state.sessionStartedAt = now;
    state.firstSeenAt = now;
  } else if (now - state.sessionStartedAt > SESSION_IDLE_MS) {
    state.sessions += 1;
    state.sessionStartedAt = now;
    state.sessionAds = 0;
  }
  const today = dayKey(now);
  if (state.dayKey !== today) {
    state.dayKey = today;
    state.dayAds = 0;
  }
};

/**
 * Проверяет, можно ли показать автоматическую рекламу.
 * Возвращает причину отказа или null, если показ разрешён.
 */
const refusalReason = (state: AdState, trigger: AdTrigger, now: number): string | null => {
  if (adsBlocked) return 'blocked';
  if (now - state.lastAdAt < AD_INTERVAL_MS) return 'gap';
  if (now - state.lastFailureAt < FAILURE_COOLDOWN_MS) return 'failure-cooldown';
  if (state.dayAds >= DAILY_MAX_ADS) return 'daily-cap';
  if (state.sessionAds >= SESSION_MAX_ADS) return 'session-cap';
  if (state.sessions <= NEW_USER_SESSIONS) return 'new-user';
  if (trigger === 'tabbar') {
    if (now - state.sessionStartedAt < SESSION_WARMUP_MS) return 'warmup';
    if (now - state.lastEventAt < EVENT_QUIET_MS) return 'event-recent';
    if (now - state.lastTabbarAt < TABBAR_INTERVAL_MS) return 'tabbar-gap';
  }
  return null;
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

/**
 * Общий путь показа. optIn — показ по кнопке: его инициировал сам пользователь,
 * поэтому лимиты частоты к нему не применяются, но общий кулдаун остаётся.
 */
const runAd = async (trigger: AdTrigger, optIn: boolean): Promise<boolean> => {
  if (adsBlocked || adInFlight) return false;

  const now = Date.now();
  const state = loadState();
  beginSession(state, now);

  // На локальной разработке настоящую рекламу не запрашиваем, но попытку
  // учитываем — так видно, что триггеры срабатывают.
  if (isLocalHost()) {
    bump(state.stats.skipped, trigger);
    saveState(state);
    return false;
  }

  if (optIn) {
    if (now - state.lastAdAt < OPT_IN_COOLDOWN_MS) {
      bump(state.stats.skipped, trigger);
      saveState(state);
      return false;
    }
  } else {
    const reason = refusalReason(state, trigger, now);
    if (reason) {
      bump(state.stats.skipped, trigger);
      saveState(state);
      return false;
    }
  }

  bump(state.stats.attempts, trigger);
  saveState(state);
  adInFlight = true;

  try {
    await withTimeout(
      bridge.send('VKWebAppCheckNativeAds', { ad_format: EAdsFormats.INTERSTITIAL }),
      CHECK_TIMEOUT_MS
    );

    // Пока шла проверка, мог начаться бег — тогда ролик не показываем
    if (adsBlocked) return false;

    // Проверка прошла — считаем интервал использованным, даже если сам показ
    // сорвётся: иначе при сбоях ролик пытался бы открыться на каждом действии.
    const shownAt = Date.now();
    state.lastAdAt = shownAt;
    if (optIn) {
      /* opt-in не участвует в приоритетах таббара и событий */
    } else if (trigger === 'tabbar') {
      state.lastTabbarAt = shownAt;
    } else {
      state.lastEventAt = shownAt;
    }
    saveState(state);

    const data = await withTimeout(
      bridge.send('VKWebAppShowNativeAds', { ad_format: EAdsFormats.INTERSTITIAL }),
      SHOW_TIMEOUT_MS
    );
    const shown = Boolean(data.result);

    const fresh = loadState();
    if (shown) {
      fresh.sessionAds += 1;
      if (!optIn) fresh.dayAds += 1;
      bump(fresh.stats.shown, trigger);
    } else {
      bump(fresh.stats.failed, trigger);
    }
    saveState(fresh);
    return shown;
  } catch (error) {
    const fresh = loadState();
    fresh.lastFailureAt = Date.now();
    bump(fresh.stats.failed, trigger);
    saveState(fresh);
    console.warn(`Реклама (${trigger}) не показана:`, error);
    return false;
  } finally {
    adInFlight = false;
  }
};

/** Событийный показ: игра, неделя плана, импорт, шаринг, финиш пробежки */
export const showEventAd = (trigger: AdTrigger): Promise<boolean> => runAd(trigger, false);

/** Совместимость со старыми вызовами: раньше интервал передавался параметром */
export const showAdIfDue = (trigger: AdTrigger): Promise<boolean> => runAd(trigger, false);

/** Редкий фолбэк при переходах по таббару */
export const showTabbarAd = (): Promise<boolean> => runAd('tabbar', false);

/**
 * Переход по вкладке таббара. Навигация выполняется сразу и не зависит от рекламы:
 * ролик (если позволили лимиты) показывается следом.
 */
export const showAdAndNavigate = (
  target: string,
  routeNavigator: RouteNavigator
): void => {
  routeNavigator.push(target);
  void showTabbarAd();
};

/** Показ по кнопке: пользователь сам решил посмотреть ролик */
export const showOptInAd = (): Promise<boolean> => runAd('opt_in', true);

/** Счётчики показов — пригодятся, чтобы сравнить триггеры по отдаче */
export const getAdStats = (): AdStats => {
  const { stats } = loadState();
  return {
    attempts: { ...stats.attempts },
    shown: { ...stats.shown },
    failed: { ...stats.failed },
    skipped: { ...stats.skipped },
  };
};

/** Сброс лимитов и статистики (отладка) */
export const resetAdState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ничего */
  }
};

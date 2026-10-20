// src/utils/adUtils.ts
// Полноэкранная реклама VK. Все места показа (таббар, конец пробежки, конец игры)
// пользуются одним общим таймером, поэтому чаще, чем раз в AD_INTERVAL_MS, реклама не появится.
import bridge, { EAdsFormats } from '@vkontakte/vk-bridge';
import type { RouteNavigator } from '@vkontakte/vk-mini-apps-router';

const STORAGE_KEY = 'traveltosport_last_ad_time';

/** Минимальный промежуток между показами, общий для всех мест */
export const AD_INTERVAL_MS = 120000;

const CHECK_TIMEOUT_MS = 4000;
const SHOW_TIMEOUT_MS = 15000;
/** Если рекламы нет, повторно спрашиваем VK не чаще, чем раз в это время */
const FAILURE_COOLDOWN_MS = 30000;

/** Откуда пришёл запрос на рекламу (пригодится для отладки и статистики) */
export type AdTrigger = 'tabbar' | 'run_finished' | 'game_finished';

let adsBlocked = false;
let adInFlight = false;
let lastFailureAt = 0;

/**
 * Запрещает рекламу, пока идёт пробежка: ролик поверх бегущего трекера мешает и небезопасен.
 * Включает и выключает трекер; переходы по вкладкам при этом работают как обычно, просто без рекламы.
 */
export const setAdsBlocked = (blocked: boolean): void => {
  adsBlocked = blocked;
};

export const isAdsBlocked = (): boolean => adsBlocked;

const isLocalHost = (): boolean => {
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.')
  );
};

const getLastAdTime = (): number => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const setLastAdTime = (time: number): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(time));
  } catch {
    /* localStorage может быть недоступен */
  }
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

/**
 * Показывает рекламу, если это разрешено: не идёт пробежка, не локальная разработка,
 * прошёл общий интервал, и VK сообщил, что реклама доступна.
 * Возвращает true, если ролик был показан. Никогда не бросает ошибку.
 */
export const showAdIfDue = async (
  trigger: AdTrigger,
  intervalMs: number = AD_INTERVAL_MS
): Promise<boolean> => {
  if (adsBlocked || adInFlight || isLocalHost()) return false;

  const now = Date.now();
  if (now - getLastAdTime() < intervalMs) return false;
  if (now - lastFailureAt < FAILURE_COOLDOWN_MS) return false;

  adInFlight = true;
  try {
    await withTimeout(
      bridge.send('VKWebAppCheckNativeAds', { ad_format: EAdsFormats.INTERSTITIAL }),
      CHECK_TIMEOUT_MS
    );

    // Пока шла проверка, мог начаться бег — тогда ролик не показываем
    if (adsBlocked) return false;

    // Интервал отсчитываем, только когда реклама точно есть: неудачная проверка его не «съедает»
    setLastAdTime(Date.now());
    const data = await withTimeout(
      bridge.send('VKWebAppShowNativeAds', { ad_format: EAdsFormats.INTERSTITIAL }),
      SHOW_TIMEOUT_MS
    );
    return Boolean(data.result);
  } catch (error) {
    lastFailureAt = Date.now();
    console.warn(`Реклама (${trigger}) не показана:`, error);
    return false;
  } finally {
    adInFlight = false;
  }
};

/**
 * Переход по вкладке таббара. Навигация выполняется сразу и не зависит от рекламы:
 * ролик (если подошёл интервал) показывается следом.
 */
export const showAdAndNavigate = (
  target: string,
  routeNavigator: RouteNavigator,
  adIntervalMs: number = AD_INTERVAL_MS
): void => {
  routeNavigator.push(target);
  void showAdIfDue('tabbar', adIntervalMs);
};

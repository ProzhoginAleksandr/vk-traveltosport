// src/utils/analytics.ts
// Продуктовые события. Основной канал — VKWebAppTrackEvent: он работает внутри
// мини-приложения без внешних SDK. Параллельно события складываются в локальный
// журнал, чтобы воронку можно было посмотреть прямо на устройстве.
//
// AppMetrica здесь не используется: у неё нет web-SDK (только iOS, Android,
// Flutter, React Native, Unity), поэтому ключ AppMetrica из вебвью недоступен.
// Если появится бэкенд или веб-аналитика — канал меняется в одном месте.

import bridge from '@vkontakte/vk-bridge';

const LOG_KEY = 'traveltosport_analytics_v1';
const MAX_EVENTS = 200;

export type AnalyticsParams = Record<string, string | number | boolean>;

export interface AnalyticsEvent {
  at: string;
  name: string;
  params?: AnalyticsParams;
}

let started = false;

const store = (name: string, params?: AnalyticsParams): void => {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const events: AnalyticsEvent[] = Array.isArray(parsed)
      ? parsed.filter((item): item is AnalyticsEvent => Boolean(item && typeof item === 'object'))
      : [];
    events.unshift({ at: new Date().toISOString(), name, params });
    localStorage.setItem(LOG_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    /* журнал не критичен */
  }
};

const canSendToVk = (): boolean => {
  try {
    return bridge.supports('VKWebAppTrackEvent');
  } catch {
    return false;
  }
};

/** Отправить событие. Никогда не бросает и не блокирует интерфейс */
export const track = (name: string, params?: AnalyticsParams): void => {
  store(name, params);
  if (!canSendToVk()) return;
  try {
    void bridge
      .send('VKWebAppTrackEvent', {
        event_name: name,
        event_params: params ?? {},
      })
      .catch(() => null);
  } catch {
    /* вне VK моста нет — остаёмся с локальным журналом */
  }
};

/** Отметить открытие приложения один раз за сессию */
export const initAnalytics = (): void => {
  if (started) return;
  started = true;
  track('app_open');
};

export const getAnalyticsLog = (): AnalyticsEvent[] => {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AnalyticsEvent =>
        Boolean(item && typeof item === 'object' && typeof (item as AnalyticsEvent).name === 'string')
    );
  } catch {
    return [];
  }
};

export const clearAnalyticsLog = (): void => {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* ничего */
  }
};

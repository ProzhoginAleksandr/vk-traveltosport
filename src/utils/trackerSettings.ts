// src/utils/trackerSettings.ts
export interface TrackerSettings {
  vibration: boolean;
  countdown: boolean;
}

const KEY = 'traveltosport_tracker_settings';

export const DEFAULT_TRACKER_SETTINGS: TrackerSettings = {
  vibration: true,
  countdown: true,
};

export const loadTrackerSettings = (): TrackerSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TRACKER_SETTINGS;
    // Читаем только известные поля: в localStorage могли остаться ключи
    // от удалённых настроек (например, autoPause), и они не должны возвращаться в объект.
    const stored = JSON.parse(raw) as Partial<TrackerSettings>;
    return {
      vibration: stored.vibration ?? DEFAULT_TRACKER_SETTINGS.vibration,
      countdown: stored.countdown ?? DEFAULT_TRACKER_SETTINGS.countdown,
    };
  } catch {
    return DEFAULT_TRACKER_SETTINGS;
  }
};

export const saveTrackerSettings = (settings: TrackerSettings): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* localStorage может быть недоступен */
  }
};

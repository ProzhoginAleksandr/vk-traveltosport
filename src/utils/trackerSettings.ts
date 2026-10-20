// src/utils/trackerSettings.ts
export interface TrackerSettings {
  autoPause: boolean;
  vibration: boolean;
  countdown: boolean;
}

const KEY = 'traveltosport_tracker_settings';

export const DEFAULT_TRACKER_SETTINGS: TrackerSettings = {
  autoPause: true,
  vibration: true,
  countdown: true,
};

export const loadTrackerSettings = (): TrackerSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TRACKER_SETTINGS;
    return { ...DEFAULT_TRACKER_SETTINGS, ...(JSON.parse(raw) as Partial<TrackerSettings>) };
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

// src/utils/trackSession.ts
// Автосохранение незавершённой пробежки, чтобы её можно было продолжить
// после закрытия или вылета приложения.

const KEY = 'traveltosport_active_session';
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // сессии старше 6 часов считаем потерянными

export interface SessionPoint {
  lat: number;
  lon: number;
  timestamp: number;
  isPaused: boolean;
}

export interface ActiveSession {
  savedAt: number;
  points: SessionPoint[];
  elapsedSec: number;
}

export const saveSession = (session: ActiveSession): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Не удалось сохранить сессию:', err);
  }
};

export const loadSession = (): ActiveSession | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as ActiveSession;
    const valid =
      Array.isArray(session.points) &&
      session.points.length > 1 &&
      typeof session.elapsedSec === 'number' &&
      Date.now() - session.savedAt < MAX_AGE_MS;
    if (!valid) {
      localStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

export const clearSession = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* localStorage может быть недоступен */
  }
};
// src/utils/trackStorage.ts

export interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
  isPaused: boolean;
}

export interface SavedTrack {
  id: string;
  date: string;         // ISO-дата
  distance: number;     // в метрах
  duration: number;     // в секундах (активное время)
  pace: number;         // сек/км
  speed: number;        // км/ч
  points: TrackPoint[];
}

const STORAGE_PREFIX = 'traveltosport_tracks_';

// 💾 Сохранить трек
export const saveTrackToStorage = (userId: number, track: SavedTrack) => {
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const existing: SavedTrack[] = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(track);
    localStorage.setItem(key, JSON.stringify(existing));
    console.log('✅ Трек сохранён в профиль:', track.id);
    return true;
  } catch (err) {
    console.error('❌ Ошибка сохранения трека:', err);
    return false;
  }
};

// 📂 Загрузить все треки пользователя
export const loadUserTracks = (userId: number): SavedTrack[] => {
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('❌ Ошибка загрузки треков:', err);
    return [];
  }
};

// 🗑️ Удалить один трек
export const deleteUserTrack = (userId: number, trackId: string) => {
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const existing: SavedTrack[] = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = existing.filter((t) => t.id !== trackId);
    localStorage.setItem(key, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('❌ Ошибка удаления трека:', err);
    return false;
  }
};

// 🗑️ Очистить все треки
export const clearUserTracks = (userId: number) => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
    return true;
  } catch (err) {
    console.error('❌ Ошибка очистки треков:', err);
    return false;
  }
};
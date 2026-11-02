// src/utils/splitUtils.ts
import { TrackPoint } from './trackStorage';

export interface Split {
  km: number;         // номер километра (1, 2, 3...)
  duration: number;   // время на этом км (сек)
  pace: number;       // темп (сек/км)
  distance: number;   // фактическая дистанция сегмента (может быть <1000 м на последнем)
}

// 📏 Расстояние между двумя точками (формула гаверсинусов)
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Разбивает трек на километровые отрезки.
 * @param points — точки трека
 * @returns массив сплитов (по одному на каждый км)
 */
export const calculateSplits = (points: TrackPoint[]): Split[] => {
  if (points.length < 2) return [];

  const splits: Split[] = [];
  let currentDistance = 0;         // накопленная дистанция в текущем км
  let currentDuration = 0;         // накопленное время в текущем км
  let currentKm = 1;
  

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Пропускаем паузные сегменты (не считаем их во времени сплита)
    if (prev.isPaused || curr.isPaused) {
      // Дистанцию всё равно учитываем — она реальная
      const seg = haversine(prev.lat, prev.lon, curr.lat, curr.lon);
      currentDistance += seg;
      continue;
    }

    const segDistance = haversine(prev.lat, prev.lon, curr.lat, curr.lon);
    const segDuration = (curr.timestamp - prev.timestamp) / 1000; // сек

    currentDistance += segDistance;
    currentDuration += segDuration;

    // Как только набрали 1000 м — фиксируем сплит
    if (currentDistance >= 1000) {
      splits.push({
        km: currentKm,
        duration: currentDuration,
        pace: currentDuration / (currentDistance / 1000),
        distance: currentDistance,
      });

      currentKm += 1;
      currentDistance = 0;
      currentDuration = 0;
      
    }
  }

  // Последний неполный километр
  if (currentDistance > 50) {
    splits.push({
      km: currentKm,
      duration: currentDuration,
      pace: currentDuration / (currentDistance / 1000),
      distance: currentDistance,
    });
  }

  return splits;
};

// 🏃 Форматирование темпа
export const formatPace = (paceSecPerKm: number): string => {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !isFinite(paceSecPerKm)) return '—';
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.round(paceSecPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

// 🕐 Форматирование времени
export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
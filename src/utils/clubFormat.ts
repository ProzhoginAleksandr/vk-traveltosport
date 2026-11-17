// src/utils/clubFormat.ts
// Чистые функции клубного пробега: без сети и без VK Bridge,
// чтобы их можно было тестировать отдельно.
import type { SavedTrack } from './trackStorage';

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

/** Текущий месяц в формате YYYY-MM */
export const monthKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** «ноябрь 2026» по строке YYYY-MM */
export const monthTitle = (month: string): string => {
  const [year, index] = month.split('-').map(Number);
  if (!year || !index || index < 1 || index > 12) return month;
  return `${MONTHS[index - 1]} ${year}`;
};

/** 1240.4 → «1 240,4» */
export const formatClubNumber = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);

/** Сумма километров по импортированным тренировкам за месяц */
export const collectMonthKm = (tracks: SavedTrack[], month: string): number => {
  const total = tracks.reduce((sum, track) => {
    const date = typeof track.date === 'string' ? track.date.slice(0, 7) : '';
    return date === month ? sum + track.distance / 1000 : sum;
  }, 0);
  return Math.round(total * 10) / 10;
};

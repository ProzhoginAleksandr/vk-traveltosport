// src/config/club.ts
// Клубный пробег: общая статистика по импортированным тренировкам.
//
// Адрес бэкенда задаётся при сборке через VITE_CLUB_API_URL (Yandex Cloud
// Functions). Пока переменная пустая, клубный блок в интерфейсе не показывается.
export const CLUB_API_URL = (import.meta.env.VITE_CLUB_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

/** Месячная цель клуба, км */
export const CLUB_MONTH_GOAL_KM = 1000;

export const CLUB_ENABLED = CLUB_API_URL.length > 0;

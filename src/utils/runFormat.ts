// src/utils/runFormat.ts
export const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Темп «м:сс» из секунд на километр; для пустого значения — прочерк */
export const formatPaceValue = (secPerKm: number | null): string => {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export const formatKm = (meters: number): string => (meters / 1000).toFixed(2);

import { describe, expect, it } from 'vitest';

import { collectMonthKm, formatClubNumber, monthKey, monthTitle } from './clubFormat';
import type { SavedTrack } from './trackStorage';

const track = (date: string, km: number): SavedTrack => ({
  id: `track-${date}-${km}`,
  date,
  distance: km * 1000,
  duration: 0,
  pace: 0,
  speed: 0,
  points: [],
});

describe('clubFormat', () => {
  it('формирует ключ месяца', () => {
    expect(monthKey(new Date(2026, 10, 15))).toBe('2026-11');
    expect(monthKey(new Date(2026, 0, 1))).toBe('2026-01');
  });

  it('называет месяц по-русски', () => {
    expect(monthTitle('2026-11')).toBe('ноябрь 2026');
    expect(monthTitle('2027-01')).toBe('январь 2027');
    expect(monthTitle('мусор')).toBe('мусор');
  });

  it('суммирует только нужный месяц', () => {
    const tracks = [
      track('2026-11-03T10:00:00', 5),
      track('2026-11-20', 2.5),
      track('2026-10-31', 10),
      track('2026-12-01', 7),
    ];
    expect(collectMonthKm(tracks, '2026-11')).toBe(7.5);
  });

  it('округляет сумму до десятых', () => {
    const tracks = [track('2026-11-01', 1.234), track('2026-11-02', 1.234)];
    expect(collectMonthKm(tracks, '2026-11')).toBe(2.5);
  });

  it('игнорирует битые даты и пустой список', () => {
    expect(collectMonthKm([], '2026-11')).toBe(0);
    expect(collectMonthKm([{ ...track('', 3), date: '' }], '2026-11')).toBe(0);
  });

  it('форматирует число с разделителем', () => {
    expect(formatClubNumber(1240).replace(/\s/g, ' ')).toBe('1 240');
  });
});

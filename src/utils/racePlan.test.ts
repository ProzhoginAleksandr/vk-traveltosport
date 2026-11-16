import { describe, expect, it } from 'vitest';

import {
  buildRacePlan,
  estimatePaces,
  formatRaceTime,
  type PlanInput,
} from './racePlan';

const base: PlanInput = {
  goalKm: 10,
  raceDate: '2027-02-07',
  level: 'stable',
  daysPerWeek: 3,
  weeklyKm: 30,
  age: 35,
  startDate: '2026-11-15',
};

const withResult: PlanInput = {
  ...base,
  recentResult: { distanceKm: 10, timeSec: 3300 },
};

describe('estimatePaces', () => {
  it('пересчитывает недавний результат на 10 км', () => {
    const paces = estimatePaces(withResult);
    expect(paces.p10Sec).toBe(330);
    expect(paces.currentTimeSec).toBe(3300);
    expect(paces.source).toBe('result');
  });

  it('без результата даёт темп уровня с поправкой на объём', () => {
    const paces = estimatePaces(base);
    expect(paces.source).toBe('estimate');
    expect(paces.p10Sec).toBeGreaterThan(330);
    expect(paces.p10Sec).toBeLessThan(346);
  });

  it('цель по умолчанию — прогноз, быстрее текущей формы', () => {
    const paces = estimatePaces(withResult);
    expect(paces.goalSource).toBe('predicted');
    expect(paces.targetTimeSec).toBe(paces.predictedTimeSec);
    expect(paces.predictedTimeSec).toBeLessThan(paces.currentTimeSec);
    expect(paces.gainRatio).toBeGreaterThan(0);
    expect(paces.gainRatio).toBeLessThanOrEqual(0.08);
  });

  it('ручная цель переопределяет прогноз и темп', () => {
    const paces = estimatePaces({ ...withResult, targetTimeSec: 3000 });
    expect(paces.goalSource).toBe('user');
    expect(paces.targetTimeSec).toBe(3000);
    expect(paces.goal).toBe(300);
    expect(paces.assessment).toBe('ambitious');
  });

  it('слишком быстрая цель помечается как нереалистичная', () => {
    const paces = estimatePaces({ ...withResult, targetTimeSec: 2400 });
    expect(paces.assessment).toBe('unrealistic');
  });

  it('цель медленнее текущей формы допустима', () => {
    const paces = estimatePaces({ ...withResult, targetTimeSec: 3420 });
    expect(paces.goalSource).toBe('user');
    expect(paces.assessment).toBe('realistic');
    expect(paces.goal).toBe(342);
  });

  it('заметно медленная цель помечается как комфортная', () => {
    const paces = estimatePaces({ ...withResult, targetTimeSec: 3480 });
    expect(paces.assessment).toBe('conservative');
  });

  it('полумарафон 1:50 пересчитывается туда и обратно без искажений', () => {
    const paces = estimatePaces({
      ...base,
      goalKm: 21,
      recentResult: { distanceKm: 21, timeSec: 6600 },
    });
    expect(Math.abs(paces.currentTimeSec - 6600)).toBeLessThanOrEqual(2);
  });
});

describe('buildRacePlan', () => {
  it('строит недели и заканчивает план днём забега', () => {
    const plan = buildRacePlan(withResult);
    expect(plan.weeksTotal).toBe(12);
    const lastWeek = plan.weeks[plan.weeks.length - 1];
    const race = lastWeek.sessions[lastWeek.sessions.length - 1];
    expect(race.type).toBe('race');
    expect(race.date).toBe(plan.raceDate);
    expect(race.distanceKm).toBe(10);
  });

  it('не включает тренировки раньше даты старта', () => {
    const plan = buildRacePlan({ ...withResult, startDate: '2026-12-01' });
    const dates = plan.weeks.flatMap((week) => week.sessions.map((session) => session.date));
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((date) => date >= '2026-12-01')).toBe(true);
  });

  it('объём не превышает потолок уровня', () => {
    const plan = buildRacePlan(withResult);
    expect(plan.peakKm).toBeLessThanOrEqual(55);
  });

  it('целевой темп на пике совпадает с целью', () => {
    const plan = buildRacePlan({ ...withResult, targetTimeSec: 3000 });
    const peakWeek = plan.weeks.find((week) => week.phase === 'peak');
    expect(peakWeek).toBeTruthy();
    expect(plan.paces.goal).toBe(300);
  });
});

describe('formatRaceTime', () => {
  it('форматирует минуты и часы', () => {
    expect(formatRaceTime(3300)).toBe('55:00');
    expect(formatRaceTime(6600)).toBe('1:50:00');
    expect(formatRaceTime(59)).toBe('0:59');
  });
});

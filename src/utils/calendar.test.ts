import { describe, expect, it } from 'vitest';

import { buildCalendarFile } from './calendar';
import { buildRacePlan, type PlanInput } from './racePlan';

const input: PlanInput = {
  goalKm: 10,
  raceDate: '2027-02-07',
  level: 'stable',
  daysPerWeek: 3,
  weeklyKm: 30,
  recentResult: { distanceKm: 10, timeSec: 3300 },
  startDate: '2026-11-15',
};

describe('calendar', () => {
  it('собирает корректный ICS с забегом и тренировками', async () => {
    const plan = buildRacePlan(input);
    const file = buildCalendarFile(plan);
    const content = await file.text();

    expect(content.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(content.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(content).toContain('SUMMARY:Забег');
    expect(content).toContain('DTSTART;VALUE=DATE:20270207');
    expect(content).toContain('RRULE:FREQ=WEEKLY');
    expect(content).toContain('DURATION:PT1H');
  });

  it('не добавляет в календарь сам забег как тренировку', async () => {
    const plan = buildRacePlan(input);
    const content = await buildCalendarFile(plan).text();
    const weekly = (content.match(/RRULE:FREQ=WEEKLY/g) ?? []).length;
    const week = plan.weeks[0];
    const expected = week.sessions.filter((session) => session.type !== 'race').length;
    expect(weekly).toBe(expected);
  });
});

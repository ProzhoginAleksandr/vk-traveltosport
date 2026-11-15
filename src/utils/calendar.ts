// src/utils/calendar.ts
// Напоминания без сервера: отдаём план в календарь устройства (.ics).
// VK-уведомления требуют бэкенда и сообщества, а календарь работает сразу.
import { GOAL_DISTANCE_TEXT, formatRaceTime, type RacePlan } from './racePlan';
import { saveFile, textToFile } from './fileExport';

const pad = (value: number): string => String(value).padStart(2, '0');

const icsDate = (iso: string): string => iso.replace(/-/g, '');

const nextDay = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const stamp = (): string => `${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

/**
 * Собирает .ics: сам забег и еженедельные тренировки на дни первой недели плана.
 * События повторяются каждую неделю до даты старта.
 */
export const buildCalendarFile = (plan: RacePlan): File => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TraveltoSport//Training plan//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  lines.push(
    'BEGIN:VEVENT',
    `UID:race-${plan.raceDate}@traveltosport`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${icsDate(plan.raceDate)}`,
    `DTEND;VALUE=DATE:${icsDate(nextDay(plan.raceDate))}`,
    `SUMMARY:Забег — ${GOAL_DISTANCE_TEXT[plan.goalKm]}`,
    `DESCRIPTION:Цель: ${formatRaceTime(plan.paces.targetTimeSec)}`,
    'END:VEVENT'
  );

  const firstWeek = plan.weeks[0];
  firstWeek?.sessions.forEach((session, index) => {
    if (session.type === 'race') return;
    lines.push(
      'BEGIN:VEVENT',
      `UID:training-${index}-${session.date}@traveltosport`,
      `DTSTAMP:${stamp()}`,
      `DTSTART:${icsDate(session.date)}T190000`,
      'DURATION:PT1H',
      `RRULE:FREQ=WEEKLY;UNTIL=${icsDate(plan.raceDate)}T000000Z`,
      `SUMMARY:${session.title}`,
      'DESCRIPTION:Тренировка по программе подготовки TraveltoSport',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return textToFile(lines.join('\r\n'), 'traveltosport-training-plan.ics', 'text/calendar');
};

export const downloadCalendar = async (plan: RacePlan): Promise<boolean> => {
  const result = await saveFile(buildCalendarFile(plan));
  return result !== 'failed';
};

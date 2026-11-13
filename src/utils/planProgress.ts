// src/utils/planProgress.ts
// Сводка по плану: какие тренировки уже отмечены, что делать сегодня и
// сколько осталось до старта. Чистая функция — удобно использовать и на
// экране плана, и на главной.

import {
  buildRacePlan,
  daysUntilRace,
  type Phase,
  type PlannedSession,
  type RacePlan,
} from './racePlan';
import type { PlanState, SessionStatus } from './planStorage';

export interface PlanSessionView extends PlannedSession {
  weekIndex: number;
  phase: Phase;
  /** Дата с учётом переносов */
  effectiveDate: string;
  status?: SessionStatus;
}

export interface PlanView {
  plan: RacePlan;
  /** Все тренировки по порядку дат */
  sessions: PlanSessionView[];
  total: number;
  doneCount: number;
  skippedCount: number;
  /** Пройдено километров по отмеченным тренировкам */
  doneKm: number;
  percent: number;
  daysLeft: number;
  todaySessions: PlanSessionView[];
  nextSession: PlanSessionView | null;
  currentWeekIndex: number;
  /** День забега уже прошёл */
  racePassed: boolean;
}

export const buildPlanView = (state: PlanState, today: string): PlanView => {
  const plan = buildRacePlan(state.input);

  const sessions: PlanSessionView[] = [];
  plan.weeks.forEach((week) => {
    week.sessions.forEach((session) => {
      sessions.push({
        ...session,
        weekIndex: week.index,
        phase: week.phase,
        effectiveDate: state.moved[session.id] ?? session.date,
        status: state.status[session.id],
      });
    });
  });

  sessions.sort((left, right) =>
    left.effectiveDate === right.effectiveDate
      ? left.id.localeCompare(right.id)
      : left.effectiveDate.localeCompare(right.effectiveDate)
  );

  const total = sessions.length;
  const doneSessions = sessions.filter((session) => session.status === 'done');
  const doneCount = doneSessions.length;
  const skippedCount = sessions.filter((session) => session.status === 'skipped').length;
  const doneKm = Math.round(doneSessions.reduce((sum, session) => sum + (session.distanceKm ?? 0), 0) * 10) / 10;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const daysLeft = daysUntilRace(plan.raceDate, today);
  const todaySessions = sessions.filter(
    (session) => session.effectiveDate === today && !session.status
  );
  const nextSession =
    todaySessions[0] ??
    sessions.find((session) => !session.status && session.effectiveDate > today) ??
    null;

  return {
    plan,
    sessions,
    total,
    doneCount,
    skippedCount,
    doneKm,
    percent,
    daysLeft,
    todaySessions,
    nextSession,
    currentWeekIndex: nextSession?.weekIndex ?? plan.weeksTotal,
    racePassed: daysLeft < 0,
  };
};

/** «6 февраля 2027» */
export const formatPlanDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .replace(/\s*г\.$/, '');
};

/** «6 фев» — короткий вариант для списков */
export const formatShortDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
};

/** Склонение: 1 день, 2 дня, 5 дней */
export const plural = (count: number, one: string, few: string, many: string): string => {
  const abs = Math.abs(count) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (tail > 1 && tail < 5) return few;
  if (tail === 1) return one;
  return many;
};

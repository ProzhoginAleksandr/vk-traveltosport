// src/utils/planStorage.ts
// Хранение плана подготовки к забегу.
//
// Сервера у приложения нет, поэтому план и отметки о выполнении лежат только
// на устройстве. Если пользователь очистит кэш, план придётся составить заново —
// об этом честно предупреждаем на онбординге.

import type { PlanInput } from './racePlan';

const STORAGE_KEY = 'traveltosport_race_plan_v1';

export type SessionStatus = 'done' | 'skipped';

export interface PlanState {
  input: PlanInput;
  /** Когда план создан, ISO */
  createdAt: string;
  /** id тренировки → выполнено или пропущено */
  status: Record<string, SessionStatus>;
  /** id тренировки → новая дата, ISO */
  moved: Record<string, string>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPlanInput = (value: unknown): value is PlanInput => {
  if (!isObject(value)) return false;
  return (
    typeof value.goalKm === 'number' &&
    (value.goalKm === 5 || value.goalKm === 10 || value.goalKm === 21 || value.goalKm === 42) &&
    typeof value.raceDate === 'string' &&
    (value.level === 'novice' || value.level === 'stable' || value.level === 'advanced') &&
    typeof value.daysPerWeek === 'number' &&
    typeof value.weeklyKm === 'number' &&
    (value.targetTimeSec === undefined || typeof value.targetTimeSec === 'number')
  );
};

const sanitizeStatus = (value: unknown): Record<string, SessionStatus> => {
  const result: Record<string, SessionStatus> = {};
  if (!isObject(value)) return result;
  Object.entries(value).forEach(([id, status]) => {
    if (status === 'done' || status === 'skipped') result[id] = status;
  });
  return result;
};

const sanitizeMoved = (value: unknown): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!isObject(value)) return result;
  Object.entries(value).forEach(([id, date]) => {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) result[id] = date;
  });
  return result;
};

export const loadPlanState = (): PlanState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || !isPlanInput(parsed.input)) return null;
    return {
      input: parsed.input,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
      status: sanitizeStatus(parsed.status),
      moved: sanitizeMoved(parsed.moved),
    };
  } catch {
    return null;
  }
};

export const savePlanState = (state: PlanState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Приватный режим или переполненное хранилище: план останется в памяти до перезагрузки
  }
};

export const clearPlanState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ничего не делаем: если хранилище недоступно, там и нечего удалять
  }
};

export const createPlanState = (input: PlanInput): PlanState => ({
  input,
  createdAt: new Date().toISOString(),
  status: {},
  moved: {},
});

export const setSessionStatus = (
  state: PlanState,
  sessionId: string,
  status: SessionStatus | null
): PlanState => {
  const nextStatus = { ...state.status };
  if (status) nextStatus[sessionId] = status;
  else delete nextStatus[sessionId];
  return { ...state, status: nextStatus };
};

export const moveSession = (state: PlanState, sessionId: string, date: string): PlanState => {
  const nextMoved = { ...state.moved };
  nextMoved[sessionId] = date;
  return { ...state, moved: nextMoved };
};

export const resetSessionMove = (state: PlanState, sessionId: string): PlanState => {
  const nextMoved = { ...state.moved };
  delete nextMoved[sessionId];
  return { ...state, moved: nextMoved };
};

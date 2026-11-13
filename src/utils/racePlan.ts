// src/utils/racePlan.ts
// Генератор плана подготовки к забегу.
//
// Чистые функции без сети и без UI: на вход — цель, дата и текущая форма,
// на выход — недели с тренировками. План детерминированный: при одинаковых
// входных данных получается одинаковый результат, поэтому его можно сохранить
// один раз и не пересчитывать при каждом открытии экрана.
//
// Дистанции тренировок считаются от структуры: длинная — от целевого объёма
// и потолка по дистанции, качественная — из отрезков (разминка + работа +
// восстановление + заминка). Поэтому текст тренировки и её километраж всегда
// совпадают.

export type GoalDistance = 5 | 10 | 21 | 42;
export type Level = 'novice' | 'stable' | 'advanced';

export type SessionType = 'easy' | 'long' | 'tempo' | 'interval' | 'strength' | 'race';
export type Phase = 'base' | 'build' | 'peak' | 'taper' | 'race';

export interface RecentResult {
  distanceKm: number;
  timeSec: number;
}

export interface PlanInput {
  goalKm: GoalDistance;
  /** Дата старта, ISO (YYYY-MM-DD) */
  raceDate: string;
  level: Level;
  daysPerWeek: number;
  /** Текущий недельный объём, км */
  weeklyKm: number;
  /** Возраст для расчёта пульсовых зон */
  age?: number;
  /** Результат за последние месяцы — уточняет темпы */
  recentResult?: RecentResult;
  /** Дата начала плана, по умолчанию сегодня */
  startDate?: string;
}

export interface PlannedSession {
  /** Устойчивый идентификатор вида w3-d2 */
  id: string;
  /** День недели по-русски: Вт, Чт, Вс */
  day: string;
  /** Календарная дата тренировки, ISO */
  date: string;
  type: SessionType;
  title: string;
  detail: string;
  distanceKm?: number;
  /** Темп диапазоном, например «7:20–7:40 /км» */
  paceText?: string;
  /** Пульсовая зона, например «Z2 · 111–130» */
  hrText?: string;
  purpose: string;
}

export interface PlanWeek {
  index: number;
  phase: Phase;
  volumeKm: number;
  cutback: boolean;
  sessions: PlannedSession[];
}

export interface TrainingPaces {
  /** Оценка темпа на 10 км, сек/км */
  p10Sec: number;
  easy: [number, number];
  long: [number, number];
  tempo: [number, number];
  interval: [number, number];
  /** Целевой темп на дистанции забега */
  goal: number;
  source: 'result' | 'estimate';
}

export interface RacePlan {
  goalKm: GoalDistance;
  raceDate: string;
  level: Level;
  daysPerWeek: number;
  weeklyKm: number;
  weeksTotal: number;
  peakKm: number;
  paces: TrainingPaces;
  weeks: PlanWeek[];
}

export const GOAL_TITLES: Record<GoalDistance, string> = {
  5: '5 км',
  10: '10 км',
  21: 'полумарафон',
  42: 'марафон',
};

/** Дистанция забега так, как её пишут на стартовых номерах */
export const GOAL_DISTANCE_TEXT: Record<GoalDistance, string> = {
  5: '5 км',
  10: '10 км',
  21: '21,1 км',
  42: '42,2 км',
};

export const LEVEL_TITLES: Record<Level, string> = {
  novice: 'Новичок',
  stable: 'Стабильно бегаю',
  advanced: 'Уверенный любитель',
};

export const PHASE_TITLES: Record<Phase, string> = {
  base: 'База',
  build: 'Развитие',
  peak: 'Пик',
  taper: 'Снижение',
  race: 'Старт',
};

/** Потолки недельного объёма: выше поднимать опасно без тренера */
export const LEVEL_CAP: Record<Level, Record<GoalDistance, number>> = {
  novice: { 5: 20, 10: 28, 21: 35, 42: 40 },
  stable: { 5: 45, 10: 55, 21: 65, 42: 75 },
  advanced: { 5: 65, 10: 75, 21: 90, 42: 110 },
};

const MIN_BASE_KM: Record<Level, number> = { novice: 8, stable: 20, advanced: 35 };

/** Минимальная длина лёгкой тренировки: короче — уже не тренировка */
const EASY_MIN_KM: Record<Level, number> = { novice: 3, stable: 4, advanced: 5 };

/** Потолок длинной тренировки к пику плана */
const LONG_PEAK_KM: Record<Level, Record<GoalDistance, number>> = {
  novice: { 5: 8, 10: 10, 21: 15, 42: 24 },
  stable: { 5: 10, 10: 15, 21: 22, 42: 30 },
  advanced: { 5: 12, 10: 17, 21: 26, 42: 34 },
};

/** Параметры качественной работы: длина отрезка и сколько их максимум */
const QUALITY_PARAMS: Record<
  Level,
  { repMeters: number; minReps: number; maxReps: number; recoverySec: number; tempoMaxMin: number }
> = {
  novice: { repMeters: 400, minReps: 3, maxReps: 6, recoverySec: 90, tempoMaxMin: 16 },
  stable: { repMeters: 600, minReps: 3, maxReps: 7, recoverySec: 90, tempoMaxMin: 22 },
  advanced: { repMeters: 1000, minReps: 4, maxReps: 8, recoverySec: 120, tempoMaxMin: 30 },
};

/** Смещения дней недели от дня старта: 0 — сам забег */
const DAY_OFFSETS: Record<number, number[]> = {
  2: [4, 0],
  3: [5, 3, 0],
  4: [5, 3, 1, 0],
  5: [5, 4, 3, 1, 0],
  6: [6, 5, 4, 3, 1, 0],
};

const RUS_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** 6.5 → «6,5», 10 → «10» */
export const formatKmNumber = (value: number): string => {
  const rounded = round1(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
};

const kmText = (value: number): string => `${formatKmNumber(value)} км`;

export const formatPace = (secPerKm: number): string => {
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.round(secPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const paceRangeText = (range: [number, number]): string =>
  range[0] === range[1]
    ? `${formatPace(range[0])} /км`
    : `${formatPace(range[0])}–${formatPace(range[1])} /км`;

/** Пульсовые зоны по возрасту: Z2 для лёгких, Z3–Z4 для темповых, Z4–Z5 для интервалов */
const heartRateText = (age: number | undefined, zone: 'Z2' | 'Z3' | 'Z4'): string => {
  if (!age || age < 10 || age > 90) return `${zone} · по самочувствию`;
  const max = 220 - age;
  const ranges: Record<'Z2' | 'Z3' | 'Z4', [number, number]> = {
    Z2: [0.6, 0.7],
    Z3: [0.7, 0.8],
    Z4: [0.8, 0.9],
  };
  const [from, to] = ranges[zone];
  return `${zone} · ${Math.round(max * from)}–${Math.round(max * to)}`;
};

/**
 * Оценка темпа на 10 км.
 * Если есть недавний результат — пересчитываем его на 10 км по правилу Риджа,
 * иначе берём базовый темп уровня с небольшой поправкой на объём.
 */
export const estimatePaces = (input: PlanInput): TrainingPaces => {
  let p10 = 0;
  let source: 'result' | 'estimate' = 'estimate';

  const result = input.recentResult;
  if (result && result.distanceKm >= 1 && result.distanceKm <= 42 && result.timeSec > 0) {
    const equivalent = result.timeSec * Math.pow(10 / result.distanceKm, 1.06);
    p10 = equivalent / 10;
    source = 'result';
  } else {
    const base: Record<Level, number> = { novice: 420, stable: 345, advanced: 290 };
    const cap = LEVEL_CAP[input.level][input.goalKm];
    const volumeShare = Math.min(1, Math.max(0, input.weeklyKm / Math.max(1, cap * 2)));
    p10 = base[input.level] * (1 - volumeShare * 0.07);
  }

  const goalPace: Record<GoalDistance, number> = {
    5: p10 - 10,
    10: p10,
    21: p10 + 10,
    42: p10 + 20,
  };

  return {
    p10Sec: Math.round(p10),
    easy: [Math.round(p10 + 75), Math.round(p10 + 95)],
    long: [Math.round(p10 + 60), Math.round(p10 + 80)],
    tempo: [Math.round(p10 - 15), Math.round(p10 - 5)],
    interval: [Math.round(p10 - 25), Math.round(p10 - 15)],
    goal: Math.round(goalPace[input.goalKm]),
    source,
  };
};

const weeksBetween = (fromISO: string, toISO: string): number => {
  const from = new Date(`${fromISO}T00:00:00`).getTime();
  const to = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((to - from) / (7 * 24 * 3600 * 1000));
};

export const todayISO = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/** Сдвиг даты на days дней без перехода в UTC */
export const shiftDate = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const dayName = (iso: string): string => RUS_DAYS[new Date(`${iso}T00:00:00`).getDay()];

/** Сколько дней осталось до забега: отрицательное значение — дата прошла */
export const daysUntilRace = (raceDate: string, from: string = todayISO()): number => {
  const target = new Date(`${raceDate}T00:00:00`).getTime();
  const start = new Date(`${from}T00:00:00`).getTime();
  return Math.round((target - start) / (24 * 3600 * 1000));
};

interface SessionBody {
  type: SessionType;
  title: string;
  detail: string;
  distanceKm: number;
  paceText: string;
  hrText: string;
  purpose: string;
}

/** Разминка и заминка в километрах: масштабируются по бюджету, но не раздуваются */
const warmCool = (budgetKm: number): { warm: number; cool: number } => ({
  warm: round1(clamp(budgetKm * 0.2, 1.2, 2)),
  cool: round1(clamp(budgetKm * 0.13, 0.8, 1.5)),
});

/** Лёгкий бег с ускорениями: база, снижение и неделя старта */
const buildStrides = (
  distanceKm: number,
  phase: Phase,
  paces: TrainingPaces,
  age: number | undefined
): SessionBody => {
  const count = phase === 'taper' || phase === 'race' ? 4 : 6;
  return {
    type: 'easy',
    title: 'Лёгкий бег с ускорениями',
    detail: `${kmText(distanceKm)} легко, в конце ${count}×30 с быстро, между ними 90 с трусцой`,
    distanceKm: round1(distanceKm),
    paceText: paceRangeText(paces.easy),
    hrText: heartRateText(age, 'Z2'),
    purpose: 'Держит тонус и технику, не добавляя усталости',
  };
};

/** Интервалы: отрезки заданной длины, восстановление трусцой */
const buildInterval = (
  budgetKm: number,
  progress: number,
  level: Level,
  paces: TrainingPaces,
  age: number | undefined
): SessionBody => {
  const spec = QUALITY_PARAMS[level];
  const { warm, cool } = warmCool(budgetKm);
  const repKm = spec.repMeters / 1000;
  const easyMid = (paces.easy[0] + paces.easy[1]) / 2;
  const recoveryKm = spec.recoverySec / easyMid;
  const totalFor = (reps: number): number =>
    round1(warm + cool + reps * repKm + Math.max(0, reps - 1) * recoveryKm);

  let reps = Math.round(spec.minReps + (spec.maxReps - spec.minReps) * clamp(progress, 0, 1));
  reps = clamp(reps, spec.minReps, spec.maxReps);
  while (reps > 2 && totalFor(reps) > budgetKm + 0.05) reps -= 1;

  const distanceKm = totalFor(reps);
  return {
    type: 'interval',
    title: 'Интервалы',
    detail: `Разминка ${kmText(warm)}, затем ${reps}×${spec.repMeters} м быстро, между ними ${spec.recoverySec} с трусцой, заминка ${kmText(cool)}`,
    distanceKm,
    paceText: paceRangeText(paces.interval),
    hrText: heartRateText(age, 'Z4'),
    purpose: 'Развивает максимальное потребление кислорода — запас скорости',
  };
};

/** Темповый бег: непрерывная работа в темповом режиме */
const buildTempo = (
  budgetKm: number,
  level: Level,
  paces: TrainingPaces,
  age: number | undefined
): SessionBody => {
  const spec = QUALITY_PARAMS[level];
  const { warm, cool } = warmCool(budgetKm);
  const paceMid = Math.round((paces.tempo[0] + paces.tempo[1]) / 2);
  const room = Math.max(1, budgetKm - warm - cool);
  const tempoMin = clamp(Math.round((room * paceMid) / 60), 8, spec.tempoMaxMin);
  const tempoKm = round1((tempoMin * 60) / paceMid);

  return {
    type: 'tempo',
    title: 'Темповый бег',
    detail: `Разминка ${kmText(warm)}, затем ${tempoMin} мин в темповом режиме, заминка ${kmText(cool)}`,
    distanceKm: round1(warm + cool + tempoKm),
    paceText: paceRangeText(paces.tempo),
    hrText: heartRateText(age, 'Z3'),
    purpose: 'Учит держать высокий темп долго — ключевое качество для забега',
  };
};

/** Отрезки в целевом темпе: генеральная репетиция забега */
const buildGoalPace = (
  budgetKm: number,
  goalKm: GoalDistance,
  level: Level,
  paces: TrainingPaces,
  age: number | undefined
): SessionBody => {
  const { warm, cool } = warmCool(budgetKm);
  const reps = 2;
  const longMid = (paces.long[0] + paces.long[1]) / 2;
  const recoveryKm = 180 / longMid;
  const baseRepKm: Record<GoalDistance, number> = { 5: 2, 10: 2.5, 21: 3, 42: 3.5 };
  let repKm = baseRepKm[goalKm];
  const totalFor = (rep: number): number =>
    round1(warm + cool + reps * rep + (reps - 1) * recoveryKm);

  // Короткому бюджету — короткие отрезки: важнее уложиться в объём недели
  while (repKm > 1 && totalFor(repKm) > budgetKm + 0.5) repKm -= 0.5;
  repKm = Math.max(1, repKm);

  return {
    type: 'tempo',
    title: 'Отрезки в целевом темпе',
    detail: `Разминка ${kmText(warm)}, затем ${reps}×${kmText(repKm)} в целевом темпе (${formatPace(paces.goal)}), между ними 3 мин трусцой, заминка ${kmText(cool)}`,
    distanceKm: totalFor(repKm),
    paceText: `${formatPace(paces.goal)} /км`,
    hrText: heartRateText(age, level === 'novice' ? 'Z3' : 'Z4'),
    purpose: 'Приучает держать именно тот темп, с которым побежите на старте',
  };
};

/**
 * Собирает план целиком.
 * Объём растёт от текущего к пиковому, каждая четвёртая неделя разгрузочная,
 * две последние недели — снижение перед стартом.
 */
export const buildRacePlan = (input: PlanInput): RacePlan => {
  const startDate = input.startDate ?? todayISO();
  const weeksTotal = Math.min(24, Math.max(3, weeksBetween(startDate, input.raceDate)));
  const daysPerWeek = clamp(Math.round(input.daysPerWeek), 2, 6);

  const cap = LEVEL_CAP[input.level][input.goalKm];
  const base = Math.min(cap, Math.max(MIN_BASE_KM[input.level], input.weeklyKm));
  const peakTarget = round1(Math.min(cap, base * 1.45));

  const paces = estimatePaces({ ...input, daysPerWeek });

  const growthWeeks = Math.max(1, weeksTotal - 2);
  const longPeak = LONG_PEAK_KM[input.level][input.goalKm];
  const longStart = round1(clamp(input.weeklyKm * 0.42, 4, longPeak));

  const volumeTarget = (week: number): number => {
    if (week === weeksTotal) return round1(peakTarget * 0.55);
    if (week === weeksTotal - 1) return round1(peakTarget * 0.72);
    const progress = growthWeeks > 1 ? (week - 1) / (growthWeeks - 1) : 1;
    let volume = base + (peakTarget - base) * clamp(progress, 0, 1);
    if (week % 4 === 0) volume *= 0.75;
    return round1(volume);
  };

  const phaseFor = (week: number): Phase => {
    if (week === weeksTotal) return 'race';
    if (week === weeksTotal - 1) return 'taper';
    if (week === weeksTotal - 2) return 'peak';
    const trainingWeeks = Math.max(1, weeksTotal - 3);
    return week / trainingWeeks <= 0.45 ? 'base' : 'build';
  };

  const offsets = DAY_OFFSETS[daysPerWeek] ?? DAY_OFFSETS[3];

  const weeks: PlanWeek[] = [];

  for (let week = 1; week <= weeksTotal; week++) {
    const phase = phaseFor(week);
    const cutback = week % 4 === 0 && week < weeksTotal - 1;
    const target = volumeTarget(week);
    const progress = growthWeeks > 1 ? clamp((week - 1) / (growthWeeks - 1), 0, 1) : 1;

    // Даты тренировок привязаны к дню забега: последняя неделя заканчивается стартом
    const weekShift = -(weeksTotal - week) * 7;
    const dates = offsets.map((offset) => shiftDate(input.raceDate, weekShift - offset));

    // Длинная: растёт от стартовой к потолку, разгрузка и снижение её укорачивают
    let longKm: number;
    if (phase === 'race') {
      longKm = input.goalKm;
    } else {
      longKm = round1(longStart + (longPeak - longStart) * progress);
      if (cutback) longKm = round1(longKm * 0.85);
      if (phase === 'taper') longKm = round1(Math.min(longKm, longPeak * 0.62));
      longKm = Math.max(4, Math.min(longKm, round1(target * 0.62)));
    }

    const hasQuality = dates.length >= 3 && phase !== 'race';
    const budget = round1(target * 0.3);
    let quality: SessionBody | null = null;
    if (hasQuality) {
      if (phase === 'base' || phase === 'taper') {
        quality = buildStrides(clamp(longKm * 0.5, 4, 7), phase, paces, input.age);
      } else if (phase === 'peak') {
        quality = buildGoalPace(budget, input.goalKm, input.level, paces, input.age);
      } else {
        quality =
          week % 2 === 0
            ? buildTempo(budget, input.level, paces, input.age)
            : buildInterval(budget, progress, input.level, paces, input.age);
      }
    }

    const easyCount = Math.max(1, dates.length - 1 - (quality ? 1 : 0));
    const easyKm = round1(
      Math.max(
        EASY_MIN_KM[input.level],
        Math.min((target - longKm - (quality?.distanceKm ?? 0)) / easyCount, longKm * 0.9)
      )
    );

    const sessions: PlannedSession[] = [];
    let qualityPlaced = false;

    dates.forEach((date, index) => {
      // Первая неделя может начинаться раньше сегодняшнего дня: прошедшие
      // тренировки в план не попадают, их не нужно «догонять».
      if (date < startDate) return;

      const id = `w${week}-d${index + 1}`;
      const day = dayName(date);
      const isLong = index === dates.length - 1;

      if (isLong) {
        const isRace = phase === 'race';
        sessions.push({
          id,
          day,
          date,
          type: isRace ? 'race' : 'long',
          title: isRace ? `Старт: ${GOAL_DISTANCE_TEXT[input.goalKm]}` : 'Длинная тренировка',
          detail: isRace
            ? 'Разминка 10 минут, затем забег в целевом темпе'
            : `${kmText(longKm)} в спокойном темпе, ровно, без ускорений`,
          distanceKm: isRace ? input.goalKm : longKm,
          paceText: paceRangeText(isRace ? [paces.goal, paces.goal] : paces.long),
          hrText: heartRateText(input.age, isRace ? 'Z4' : 'Z2'),
          purpose: isRace
            ? 'Тот самый день, к которому строился весь план'
            : 'Выносливость: учит тело работать долго и экономить гликоген',
        });
        return;
      }

      if (quality && index === 1 && !qualityPlaced) {
        qualityPlaced = true;
        sessions.push({ id, day, date, ...quality });
        return;
      }

      const easyDistance = round1(easyKm);
      sessions.push({
        id,
        day,
        date,
        type: 'easy',
        title: 'Лёгкий бег',
        detail: `${kmText(easyDistance)} в разговорном темпе${phase === 'race' ? ', без ускорений' : ''}`,
        distanceKm: easyDistance,
        paceText: paceRangeText(paces.easy),
        hrText: heartRateText(input.age, 'Z2'),
        purpose: 'Основной объём: сердце и мышцы работают без лишнего стресса',
      });
    });

    const volumeKm = round1(sessions.reduce((sum, session) => sum + (session.distanceKm ?? 0), 0));

    weeks.push({ index: week, phase, volumeKm, cutback, sessions });
  }

  // Неделя, целиком оставшаяся в прошлом (план начали не с понедельника),
  // в списке не нужна: пустой блок только путает.
  const plannedWeeks = weeks.filter((week) => week.sessions.length > 0);

  const peakKm = plannedWeeks.length > 0
    ? round1(Math.max(...plannedWeeks.map((week) => week.volumeKm)))
    : 0;

  return {
    goalKm: input.goalKm,
    raceDate: input.raceDate,
    level: input.level,
    daysPerWeek,
    weeklyKm: input.weeklyKm,
    weeksTotal,
    peakKm,
    paces,
    weeks: plannedWeeks,
  };
};

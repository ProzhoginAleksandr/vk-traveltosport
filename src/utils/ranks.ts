// src/utils/ranks.ts

export interface Rank {
  /** Минимальное количество пробежек для получения звания */
  minRuns: number;
  name: string;
  icon: string;
  description: string;
}

/** Список по возрастанию minRuns. Источник: Звания_TTS.xlsx */
export const RANKS: readonly Rank[] = [
  { minRuns: 1,    name: 'Новичок',  icon: '🌱',  description: 'Первый шаг. Ты вышел — и это уже победа.' },
  { minRuns: 10,   name: 'Стажёр',   icon: '🔹',  description: 'Десять пробежек — привычка начинает формироваться.' },
  { minRuns: 15,   name: 'Любитель', icon: '🔸',  description: 'Бег входит в жизнь. Ты ждёшь следующей пробежки.' },
  { minRuns: 25,   name: 'Топотун',  icon: '👟',  description: 'Четверть сотни! Ты уже не гость, а свой.' },
  { minRuns: 50,   name: 'Бегун',    icon: '🏃',  description: 'Первый серьёзный рубеж. Ты доказал себе, что можешь.' },
  { minRuns: 75,   name: 'Опытный',  icon: '🎯',  description: 'Ты понимаешь тело, умеешь распределять силы.' },
  { minRuns: 100,  name: 'Чемпион',  icon: '🏆',  description: 'Легендарный рубеж. Пример для новичков.' },
  { minRuns: 200,  name: 'Эксперт',  icon: '🧠',  description: 'Ты пробежал больше, чем большинство за всю жизнь.' },
  { minRuns: 300,  name: 'Ветеран',  icon: '🎖️', description: 'Триста пробежек. Это уже образ жизни.' },
  { minRuns: 400,  name: 'Разрядник', icon: '⚡',  description: 'Ты не просто бегаешь — ты ставишь планку.' },
  { minRuns: 500,  name: 'Мастер',   icon: '👑',  description: 'Пятьсот! Культовый статус.' },
  { minRuns: 1000, name: 'Легенда',  icon: '🌟',  description: 'Тысяча пробежек. Это за гранью обычного.' },
];

/** Текущее звание или null, если пробежек ещё нет */
export const getRank = (runsCount: number): Rank | null => {
  let current: Rank | null = null;
  for (const rank of RANKS) {
    if (runsCount >= rank.minRuns) current = rank;
    else break;
  }
  return current;
};

/** Следующее звание или null, если достигнуто максимальное */
export const getNextRank = (runsCount: number): Rank | null =>
  RANKS.find((rank) => rank.minRuns > runsCount) ?? null;
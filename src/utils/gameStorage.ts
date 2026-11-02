// src/utils/gameStorage.ts

export interface GameRecord {
  bestTime: number | null;
  bestMoves: number | null;
  gamesPlayed: number;
  lastPlayed: string | null;
}

export interface SplitMemoryRecord {
  bestLevel: number;
  gamesPlayed: number;
  lastPlayed: string | null;
}

// Запись для викторины
export interface DictionaryQuizRecord {
  bestScore: number;               // максимальное число правильных ответов (0..10)
  bestTimeSeconds: number | null;  // лучшее время среди партий с максимальным счётом
  gamesPlayed: number;
  lastPlayed: string | null;
}

export type PairGameSize = 4 | 6;

export interface UserGamesData {
  /** «Найди пару», поле 4×4. Поле осталось под прежним именем для совместимости со старыми данными */
  pairGame: GameRecord;
  /** «Найди пару», поле 6×6 — отдельные рекорды */
  pairGameHard: GameRecord;
  splitMemory: SplitMemoryRecord;
  dictionaryQuiz: DictionaryQuizRecord;
}

const STORAGE_PREFIX = 'traveltosport_games_';

const emptyRecord = (): GameRecord => ({
  bestTime: null,
  bestMoves: null,
  gamesPlayed: 0,
  lastPlayed: null,
});

const emptySplitMemory = (): SplitMemoryRecord => ({
  bestLevel: 0,
  gamesPlayed: 0,
  lastPlayed: null,
});

const emptyDictionaryQuiz = (): DictionaryQuizRecord => ({
  bestScore: 0,
  bestTimeSeconds: null,
  gamesPlayed: 0,
  lastPlayed: null,
});

const emptyData = (): UserGamesData => ({
  pairGame: emptyRecord(),
  pairGameHard: emptyRecord(),
  splitMemory: emptySplitMemory(),
  dictionaryQuiz: emptyDictionaryQuiz(),
});

// 📂 Загрузка (совместима со старыми данными без новых полей)
export const loadUserGamesData = (userId: number): UserGamesData => {
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as Partial<UserGamesData>;
    return {
      pairGame: parsed.pairGame || emptyRecord(),
      pairGameHard: parsed.pairGameHard || emptyRecord(),
      splitMemory: parsed.splitMemory || emptySplitMemory(),
      dictionaryQuiz: parsed.dictionaryQuiz || emptyDictionaryQuiz(),
    };
  } catch (err) {
    console.error('❌ Ошибка загрузки игровых данных:', err);
    return emptyData();
  }
};

// 💾 Сохранение
export const saveUserGamesData = (userId: number, data: UserGamesData) => {
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('❌ Ошибка сохранения игровых данных:', err);
    return false;
  }
};

// 🎴 Рекорд «Найди пару» для нужного размера поля
export const getPairGameRecord = (data: UserGamesData, size: PairGameSize): GameRecord =>
  size === 6 ? data.pairGameHard : data.pairGame;

// 🏆 «Найди пару». Параметр size необязательный (по умолчанию 4×4),
// поэтому прежние вызовы без него продолжают работать.
export const updatePairGameRecord = (
  userId: number,
  timeSeconds: number,
  moves: number,
  size: PairGameSize = 4
): { isNewTimeRecord: boolean; isNewMovesRecord: boolean } => {
  const data = loadUserGamesData(userId);
  const rec = getPairGameRecord(data, size);

  const isNewTimeRecord = rec.bestTime === null || timeSeconds < rec.bestTime;
  const isNewMovesRecord = rec.bestMoves === null || moves < rec.bestMoves;

  const updated: GameRecord = {
    bestTime: isNewTimeRecord ? timeSeconds : rec.bestTime,
    bestMoves: isNewMovesRecord ? moves : rec.bestMoves,
    gamesPlayed: rec.gamesPlayed + 1,
    lastPlayed: new Date().toISOString(),
  };

  if (size === 6) data.pairGameHard = updated;
  else data.pairGame = updated;

  saveUserGamesData(userId, data);
  return { isNewTimeRecord, isNewMovesRecord };
};

// 🏆 «Запомни раскладку»
export const updateSplitMemoryRecord = (
  userId: number,
  reachedLevel: number
): { isNewRecord: boolean } => {
  const data = loadUserGamesData(userId);
  const rec = data.splitMemory;

  const isNewRecord = reachedLevel > rec.bestLevel;

  data.splitMemory = {
    bestLevel: isNewRecord ? reachedLevel : rec.bestLevel,
    gamesPlayed: rec.gamesPlayed + 1,
    lastPlayed: new Date().toISOString(),
  };

  saveUserGamesData(userId, data);
  return { isNewRecord };
};

// 🏆 «Викторина»
export const updateDictionaryQuizRecord = (
  userId: number,
  score: number,
  timeSeconds: number
): { isNewScoreRecord: boolean; isNewTimeRecord: boolean } => {
  const data = loadUserGamesData(userId);
  const rec = data.dictionaryQuiz;

  const isNewScoreRecord = score > rec.bestScore;
  // Время считаем рекордным только если счёт такой же или лучше
  const isNewTimeRecord =
    isNewScoreRecord ||
    (score === rec.bestScore &&
      (rec.bestTimeSeconds === null || timeSeconds < rec.bestTimeSeconds));

  data.dictionaryQuiz = {
    bestScore: isNewScoreRecord ? score : rec.bestScore,
    bestTimeSeconds: isNewTimeRecord ? timeSeconds : rec.bestTimeSeconds,
    gamesPlayed: rec.gamesPlayed + 1,
    lastPlayed: new Date().toISOString(),
  };

  saveUserGamesData(userId, data);
  return { isNewScoreRecord, isNewTimeRecord };
};

// 🕐 Форматирование времени
export const formatGameTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s} сек`;
};
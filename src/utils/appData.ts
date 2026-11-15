// src/utils/appData.ts
// Всё, что приложение хранит на устройстве: сбор, восстановление и удаление.
// Нужно для резервной копии и для честного экрана «Данные и конфиденциальность».

const APP_PREFIXES = ['traveltosport_', 'user_history_', 'user_stats_'];

export const isAppKey = (key: string): boolean =>
  APP_PREFIXES.some((prefix) => key.startsWith(prefix));

export interface AppBackup {
  app: 'TraveltoSport';
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

/** Собирает все ключи приложения в один объект */
export const collectAppData = (): Record<string, string> => {
  const data: Record<string, string> = {};
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || !isAppKey(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  } catch {
    /* хранилище недоступно — вернём пустой объект */
  }
  return data;
};

/** Размер сохранённых данных в килобайтах */
export const appDataSizeKb = (): number => {
  const data = collectAppData();
  const bytes = Object.values(data).reduce((sum, value) => sum + keyBytes(value), 0);
  return Math.round((bytes / 1024) * 10) / 10;
};

const keyBytes = (value: string): number => value.length * 2;

export const buildBackup = (): AppBackup => ({
  app: 'TraveltoSport',
  version: 1,
  exportedAt: new Date().toISOString(),
  data: collectAppData(),
});

const isBackup = (value: unknown): value is AppBackup => {
  if (typeof value !== 'object' || value === null) return false;
  const backup = value as Partial<AppBackup>;
  return (
    backup.app === 'TraveltoSport' &&
    typeof backup.data === 'object' &&
    backup.data !== null &&
    Object.entries(backup.data).every(
      ([key, entry]) => isAppKey(key) && typeof entry === 'string'
    )
  );
};

/** Восстанавливает данные из копии. Возвращает число восстановленных ключей */
export const restoreBackup = (raw: string): number => {
  const parsed: unknown = JSON.parse(raw);
  if (!isBackup(parsed)) throw new Error('Файл не похож на копию TraveltoSport');
  let restored = 0;
  Object.entries(parsed.data).forEach(([key, value]) => {
    if (!isAppKey(key)) return;
    localStorage.setItem(key, value);
    restored += 1;
  });
  return restored;
};

/** Полностью удаляет данные приложения с устройства */
export const clearAppData = (): number => {
  const keys: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && isAppKey(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ничего не остаётся сделать */
  }
  return keys.length;
};

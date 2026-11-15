// src/utils/errorLog.ts
// Локальный журнал ошибок: складываем последние сбои в localStorage, чтобы
// пользователь мог показать их в поддержку, а мы — увидеть, что происходило
// на устройстве. Наружу ничего не отправляется.

const STORAGE_KEY = 'traveltosport_errors_v1';
const MAX_ENTRIES = 20;

export type ErrorSource = 'boundary' | 'window' | 'promise' | 'manual';

export interface ErrorEntry {
  at: string;
  source: ErrorSource;
  message: string;
  stack?: string;
}

const isEntry = (value: unknown): value is ErrorEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<ErrorEntry>;
  return typeof entry.at === 'string' && typeof entry.message === 'string';
};

export const getErrorLog = (): ErrorEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
};

export const clearErrorLog = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* хранилище недоступно — журнала и нет */
  }
};

export const logError = (source: ErrorSource, error: unknown): void => {
  try {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Неизвестная ошибка';
    const stack = error instanceof Error ? error.stack : undefined;
    const existing = getErrorLog();
    const entry: ErrorEntry = {
      at: new Date().toISOString(),
      source,
      message: message.slice(0, 500),
      stack: stack?.slice(0, 2000),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...existing].slice(0, MAX_ENTRIES)));
  } catch {
    /* не даём журналу уронить приложение */
  }
};

/** Глобальные перехватчики: ошибки вне React-дерева и необработанные промисы */
export const installGlobalErrorHandlers = (): void => {
  window.addEventListener('error', (event) => {
    logError('window', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    logError('promise', event.reason);
  });
};

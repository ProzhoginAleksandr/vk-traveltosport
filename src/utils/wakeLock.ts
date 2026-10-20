// src/utils/wakeLock.ts
// Не даёт экрану гаснуть, пока идёт пробежка. Если Wake Lock не поддерживается
// (старый WebView), тихо ничего не делает.

export const createWakeLock = () => {
  let sentinel: WakeLockSentinel | null = null;
  let wanted = false;

  const acquire = async (): Promise<void> => {
    if (!wanted || sentinel || !('wakeLock' in navigator)) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      sentinel = lock;
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null;
      });
    } catch (err) {
      console.warn('Wake Lock недоступен:', err);
    }
  };

  // Браузер сам снимает блокировку при сворачивании — запрашиваем заново при возврате
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') void acquire();
  };

  return {
    enable(): void {
      if (wanted) return;
      wanted = true;
      document.addEventListener('visibilitychange', onVisibility);
      void acquire();
    },
    disable(): void {
      wanted = false;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        void sentinel.release().catch(() => undefined);
        sentinel = null;
      }
    },
  };
};
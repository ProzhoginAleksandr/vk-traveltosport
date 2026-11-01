// src/utils/buildInfo.ts
// Короткий идентификатор сборки, который реально исполняется в браузере.
// Берётся из адреса подключённого скрипта: assets/index-XXXX.js → XXXX.
// Нужен, чтобы на устройстве было видно, какая версия открыта: старая или новая.
export const getBuildId = (): string => {
  try {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    for (const script of scripts) {
      const src = (script as HTMLScriptElement).src || '';
      const match = /assets\/index-([A-Za-z0-9_-]+)\.js/.exec(src);
      if (match) return match[1];
    }
  } catch {
    /* сработает, только если DOM недоступен — тогда просто не показываем метку */
  }
  return '';
};

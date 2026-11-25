import { createRoot } from 'react-dom/client';
import vkBridge from '@vkontakte/vk-bridge';
import { AppConfig } from './AppConfig';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getBuildId } from './utils/buildInfo';
import { installGlobalErrorHandlers } from './utils/errorLog';
import { initAnalytics } from './utils/analytics';
import { syncPlanOnStart } from './utils/cloudSync';
import { syncTracksOnStart } from './utils/trackSync';
import { getCurrentUser } from './utils/userUtils';

// Метка сборки в заголовке страницы: на телефоне в браузере VK заголовок виден
// в шапке, поэтому сразу понятно, какая версия открыта — старая или новая.
const buildId = getBuildId();
if (buildId) document.title = `TraveltoSport · ${buildId}`;

// Шрифт интерфейса грузим сразу: канвас карточки умеет рисовать только уже
// загруженными шрифтами, иначе вместо Oswald в картинку попадёт запасной.
if (typeof document.fonts?.load === 'function') {
  void document.fonts.load('400 16px Oswald');
  void document.fonts.load('600 16px Oswald');
  void document.fonts.load('700 16px Oswald');
}

vkBridge.send('VKWebAppInit')
  .then(() => {
    console.log('✅ Bridge init OK');
    void (async () => {
      // Если локальная история пуста, поднимаем резервную копию тренировок
      const user = await getCurrentUser();
      if (user) {
        const restored = await syncTracksOnStart(user.id);
        if (restored) window.dispatchEvent(new Event('traveltosport:tracks-restored'));
      }
      // Подтягиваем облачную копию плана, если она свежее локальной
      await syncPlanOnStart();
    })();
  })
  .catch(err => console.error('❌ Bridge init error:', err));

installGlobalErrorHandlers();
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AppConfig />
  </ErrorBoundary>
);

// Прячем заставку после первого кадра и загрузки шрифта, но не ждём дольше
// 700 мс: на медленной сети лучше показать приложение в запасном шрифте.
const splash = document.getElementById('splash');
let splashHidden = false;
const hideSplash = () => {
  if (!splash || splashHidden) return;
  splashHidden = true;
  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 500);
};

const revealApp = () => window.setTimeout(hideSplash, 180);
if (document.fonts?.ready) {
  document.fonts.ready.then(revealApp).catch(revealApp);
  window.setTimeout(revealApp, 700);
} else {
  revealApp();
}

if (import.meta.env.MODE === 'development') {
  import('./eruda.ts');
}

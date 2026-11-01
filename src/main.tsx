import { createRoot } from 'react-dom/client';
import vkBridge from '@vkontakte/vk-bridge';
import { AppConfig } from './AppConfig';
import { getBuildId } from './utils/buildInfo';

// Метка сборки в заголовке страницы: на телефоне в браузере VK заголовок виден
// в шапке, поэтому сразу понятно, какая версия открыта — старая или новая.
const buildId = getBuildId();
if (buildId) document.title = `TraveltoSport · ${buildId}`;

vkBridge.send('VKWebAppInit')
  .then(() => console.log('✅ Bridge init OK'))
  .catch(err => console.error('❌ Bridge init error:', err));

createRoot(document.getElementById('root')!).render(<AppConfig />);

if (import.meta.env.MODE === 'development') {
  import('./eruda.ts');
}

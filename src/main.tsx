import { createRoot } from 'react-dom/client';
import vkBridge from '@vkontakte/vk-bridge';
import { AppConfig } from './AppConfig';

vkBridge.send('VKWebAppInit')
  .then(() => console.log('✅ Bridge init OK'))
  .catch(err => console.error('❌ Bridge init error:', err));

createRoot(document.getElementById('root')!).render(<AppConfig />);

if (import.meta.env.MODE === 'development') {
  import('./eruda.ts');
}
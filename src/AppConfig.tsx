// src/AppConfig.tsx
import vkBridge, { parseURLSearchParamsForGetLaunchParams } from '@vkontakte/vk-bridge';
import { useAdaptivity, useInsets } from '@vkontakte/vk-bridge-react';
import { AdaptivityProvider, ConfigProvider, AppRoot } from '@vkontakte/vkui';
import { RouterProvider } from '@vkontakte/vk-mini-apps-router';
import '@vkontakte/vkui/dist/vkui.css';
import './styles/global.css';

import { transformVKBridgeAdaptivity } from './utils';
import { router } from './routes';
import { App } from './App';


export const AppConfig = () => {
  const vkBridgeInsets = useInsets() || undefined;
  const adaptivity = transformVKBridgeAdaptivity(useAdaptivity());
  const { vk_platform } = parseURLSearchParamsForGetLaunchParams(window.location.search);

  return (
    <ConfigProvider
      // Оформление приложения всегда тёмное: свои поверхности (фоны, карточки,
      // текст) заданы тёмными вручную. Если следовать теме VK, у пользователя
      // со светлой темой компоненты VKUI окажутся светлыми на тёмном фоне.
      colorScheme="dark"
      platform={vk_platform === 'desktop_web' ? 'vkcom' : undefined}
      isWebView={vkBridge.isWebView()}
      hasCustomPanelHeaderAfter={true}
    >
      <AdaptivityProvider {...adaptivity}>
        <AppRoot mode="full" safeAreaInsets={vkBridgeInsets}>
          <RouterProvider router={router} notFoundRedirectPath="/">
            <App />   {/* ← ТОЛЬКО App, без AdProvider */}
          </RouterProvider>
        </AppRoot>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};
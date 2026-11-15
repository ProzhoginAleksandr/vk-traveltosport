// src/utils/bannerAd.ts
// Баннер VK для главного экрана. Показываем только там, где он не мешает
// навигации: на главной нет таббара, поэтому баннер встаёт у нижней кромки
// и сжимает контент (layout_type: resize), а не перекрывает его.
import bridge, {
  BannerAdHeightType,
  BannerAdLayoutType,
  BannerAdLocation,
} from '@vkontakte/vk-bridge';

import { isAdsBlocked, isLocalHost } from './adUtils';

const CHECK_TIMEOUT_MS = 4000;
const SHOW_TIMEOUT_MS = 6000;

let visible = false;
let inFlight = false;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

/** Клиент сам закрыл баннер — не считаем его видимым */
bridge.subscribe((event) => {
  if (event.detail.type === 'VKWebAppBannerAdClosedByUser') visible = false;
});

export const showBannerAd = async (): Promise<boolean> => {
  if (visible || inFlight || isLocalHost() || isAdsBlocked()) return false;

  let supported = false;
  try {
    supported = bridge.supports('VKWebAppShowBannerAd');
  } catch {
    // В обычном браузере моста нет — баннер просто не показываем
    return false;
  }
  if (!supported) return false;

  inFlight = true;
  try {
    await withTimeout(bridge.send('VKWebAppCheckBannerAd', {}), CHECK_TIMEOUT_MS);
    const data = await withTimeout(
      bridge.send('VKWebAppShowBannerAd', {
        banner_location: BannerAdLocation.BOTTOM,
        layout_type: BannerAdLayoutType.RESIZE,
        height_type: BannerAdHeightType.COMPACT,
        can_close: true,
      }),
      SHOW_TIMEOUT_MS
    );
    visible = Boolean(data.result);
    return visible;
  } catch {
    // В вебе и на десктопе баннер часто недоступен — это нормальный сценарий
    return false;
  } finally {
    inFlight = false;
  }
};

export const hideBannerAd = async (): Promise<void> => {
  if (!visible) return;
  visible = false;
  try {
    await bridge.send('VKWebAppHideBannerAd', {});
  } catch {
    // Клиент мог уже убрать баннер сам
  }
};

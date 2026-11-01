// src/utils/geo.ts
// Единый слой геолокации для разных платформ:
//  — VK Mini App (мобильные клиенты VK): координаты и запрос разрешения
//    отдаёт только VK Bridge (VKWebAppGetGeodata). Нативный диалог разрешения
//    на мобильных показывает именно он, navigator.geolocation в WebView молчит.
//  — Десктоп / обычный браузер: navigator.geolocation (стандартный браузерный
//    запрос разрешения и GPS).
import bridge, { parseURLSearchParamsForGetLaunchParams } from '@vkontakte/vk-bridge';

export interface GeoPosition {
  lat: number;
  lon: number;
  accuracy: number; // метры, 0 если точность неизвестна
}

// Значения совпадают с ошибками navigator.geolocation
export const GEO_ERROR = {
  UNSUPPORTED: -1,
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;

export class GeoError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'GeoError';
    this.code = code;
  }
}

// Частота опроса VK Bridge во время активного трекинга на мобильных.
// 1 с вместо 2 с: при опросе раз в две секунды между точками набегает 6–10 м,
// из-за чего линия трека рисовалась редкими рывками и запаздывала.
const POLL_INTERVAL_MS = 1000;

interface VKGeodataResponse {
  available?: number | boolean;
  lat?: number;
  long?: number;
  accuracy?: number;
}

const getVKPlatform = (): string | undefined => {
  try {
    const params = parseURLSearchParamsForGetLaunchParams(window.location.search);
    return typeof params.vk_platform === 'string' ? params.vk_platform : undefined;
  } catch {
    return undefined;
  }
};

// true — приложение запущено в мобильном клиенте VK
// (mobile_android, mobile_iphone, mobile_web и т.п.)
const isMobileVKClient = (): boolean => {
  const platform = getVKPlatform();
  if (platform) return platform.startsWith('mobile');
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const vkGeodataSupported = (): boolean => {
  try {
    return bridge.supports('VKWebAppGetGeodata');
  } catch {
    return false;
  }
};

const getFromVK = async (): Promise<GeoPosition> => {
  const response = (await bridge.send('VKWebAppGetGeodata')) as VKGeodataResponse;

  if (!response || !response.available) {
    throw new GeoError(GEO_ERROR.PERMISSION_DENIED, 'Доступ к геопозиции не предоставлен');
  }

  if (typeof response.lat !== 'number' || typeof response.long !== 'number') {
    throw new GeoError(GEO_ERROR.POSITION_UNAVAILABLE, 'Нет данных о местоположении');
  }

  return {
    lat: response.lat,
    lon: response.long,
    accuracy: typeof response.accuracy === 'number' ? response.accuracy : 0,
  };
};

const getFromNavigator = (): Promise<GeoPosition> =>
  new Promise<GeoPosition>((resolve, reject) => {
    if (!('geolocation' in navigator) || !navigator.geolocation) {
      reject(new GeoError(GEO_ERROR.UNSUPPORTED, 'Геолокация не поддерживается'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (err) => reject(new GeoError(err.code, err.message)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

// 📍 Одноразовое получение координат. Заодно запрашивает разрешение на доступ
// к геопозиции (нативный диалог на мобильных VK или браузерный на десктопе).
export const getGeolocation = async (): Promise<GeoPosition> => {
  // В мобильном клиенте VK получить координаты можно только через VK Bridge
  if (isMobileVKClient() && vkGeodataSupported()) {
    return getFromVK();
  }

  return getFromNavigator();
};

// 📡 Непрерывное отслеживание позиции. Возвращает функцию остановки.
export const startWatchingGeolocation = (
  onPosition: (position: GeoPosition) => void,
  onError: (error: GeoError) => void
): (() => void) => {
  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let navWatchId: number | null = null;

  const stop = (): void => {
    stopped = true;
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (navWatchId !== null) {
      navigator.geolocation.clearWatch(navWatchId);
      navWatchId = null;
    }
  };

  // Мобильный клиент VK: непрерывных событий от VK Bridge нет,
  // поэтому опрашиваем VKWebAppGetGeodata с заданным интервалом.
  if (isMobileVKClient() && vkGeodataSupported()) {
  let errorWasShown = false;
  let inFlight = false; // ← 1. новый флаг

  const tick = async (): Promise<void> => {
    if (inFlight) return; // ← 2. пропускаем тик, если прошлый запрос ещё не завершился
    inFlight = true;
    try {
      const position = await getFromVK();
      errorWasShown = false;
      if (!stopped) onPosition(position);
    } catch (err) {
      if (!stopped && !errorWasShown) {
        errorWasShown = true;
        onError(
          err instanceof GeoError
            ? err
            : new GeoError(GEO_ERROR.POSITION_UNAVAILABLE, 'Не удалось получить геопозицию')
        );
      }
    } finally {
      inFlight = false; // ← 3. снимаем флаг в любом случае, даже при ошибке
    }
  };

  void tick();
  pollTimer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  return stop;
}

  // Десктоп / обычный браузер: нативный watchPosition.
  if (!('geolocation' in navigator) || !navigator.geolocation) {
    onError(new GeoError(GEO_ERROR.UNSUPPORTED, 'Геолокация не поддерживается'));
    return stop;
  }

  navWatchId = navigator.geolocation.watchPosition(
    (position) =>
      onPosition({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
    (err) => onError(new GeoError(err.code, err.message)),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );

  return stop;
};
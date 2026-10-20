// src/utils/haptics.ts
import bridge from '@vkontakte/vk-bridge';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success';

/** Вибрация-отклик: через VK Bridge, а если он недоступен — через navigator.vibrate. Ошибки не пробрасываются */
export const haptic = (kind: HapticKind): void => {
  try {
    if (kind === 'success') {
      if (bridge.supports('VKWebAppTapticNotificationOccurred')) {
        bridge.send('VKWebAppTapticNotificationOccurred', { type: 'success' }).catch(() => undefined);
        return;
      }
    } else if (bridge.supports('VKWebAppTapticImpactOccurred')) {
      bridge.send('VKWebAppTapticImpactOccurred', { style: kind }).catch(() => undefined);
      return;
    }
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'heavy' || kind === 'success' ? [120, 60, 120] : 40);
    }
  } catch {
    /* не критично */
  }
};

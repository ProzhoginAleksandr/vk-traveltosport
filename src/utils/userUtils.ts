import bridge from '@vkontakte/vk-bridge';

export interface VKUser {
  id: number;
  first_name: string;
  last_name: string;
  photo_100: string;
}

export const getCurrentUser = async (): Promise<VKUser | null> => {
  try {
    const user = await bridge.send('VKWebAppGetUserInfo');
    return user as VKUser;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return null;
  }
};
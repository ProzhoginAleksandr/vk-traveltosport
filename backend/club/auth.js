// backend/club/auth.js
// Проверка подписи VK и хеширование идентификатора пользователя.
// Секрет приложения живёт только в переменной окружения функции.
const crypto = require('crypto');

const normalize = (value) =>
  String(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** База подписи: все vk_*-параметры, кроме sign, по алфавиту */
const signBase = (params) =>
  Object.keys(params)
    .filter((key) => key !== 'sign' && key.startsWith('vk_'))
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

const verifySign = (auth) => {
  const secret = process.env.VK_APP_SECRET || '';
  if (!secret || !auth || typeof auth !== 'object') return false;
  if (!auth.sign || !auth.vk_user_id) return false;

  const expected = normalize(
    crypto.createHmac('sha256', secret).update(signBase(auth)).digest('base64')
  );
  const given = normalize(auth.sign);
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** Необратимый идентификатор: в базе нет VK id в открытом виде */
const hashUser = (vkUserId) =>
  crypto.createHmac('sha256', process.env.VK_APP_SECRET || '').update(`user:${vkUserId}`).digest('hex');

/** Подпись не старше недели: защита от вечного повторного использования */
const checkFreshness = (vkTs, maxAgeMs = 7 * 24 * 3600 * 1000) => {
  const timestamp = Number(vkTs);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const age = Date.now() - timestamp * 1000;
  return age >= -5 * 60 * 1000 && age <= maxAgeMs;
};

module.exports = { signBase, verifySign, hashUser, checkFreshness, normalize };

// backend/club/storage.js
// Хранилище клубной статистики в Yandex Object Storage.
//
// Ключ объекта: club/<месяц>/<хеш пользователя>/<км>. Один объект на
// пользователя и месяц: при обновлении старый ключ удаляется, поэтому вклад
// не дублируется. Наружу читаются только суммы, без имён и маршрутов.
const BUCKET = () => process.env.CLUB_BUCKET || '';
const STORAGE_HOST = 'https://storage.yandexcloud.net';
const METADATA_URL =
  'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token';

let tokenCache = { token: '', expiresAt: 0 };

const getIamToken = async () => {
  if (process.env.CLUB_IAM_TOKEN) return process.env.CLUB_IAM_TOKEN;
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const response = await fetch(METADATA_URL, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (!response.ok) throw new Error(`metadata token: ${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error('metadata token: empty');

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, (data.expires_in || 3600) - 60) * 1000,
  };
  return tokenCache.token;
};

const storageRequest = async (method, path, query = '') => {
  const token = await getIamToken();
  const url = `${STORAGE_HOST}/${BUCKET()}${path}${query}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '');
    throw new Error(`storage ${method} ${response.status}: ${body.slice(0, 200)}`);
  }
  return response;
};

const decodeXml = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Все ключи по префиксу, с постраничной выдачей */
const listKeys = async (prefix) => {
  const keys = [];
  let continuation = '';

  for (let page = 0; page < 50; page += 1) {
    const query =
      `?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000` +
      (continuation ? `&continuation-token=${encodeURIComponent(continuation)}` : '');
    const response = await storageRequest('GET', '', query);
    if (response.status === 404) break;

    const xml = await response.text();
    for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
      keys.push(decodeXml(match[1]));
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!truncated || !next) break;
    continuation = decodeXml(next[1]);
  }

  return keys;
};

const objectPath = (key) =>
  `/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;

const putObject = async (key) => {
  await storageRequest('PUT', objectPath(key));
};

const deleteObject = async (key) => {
  await storageRequest('DELETE', objectPath(key));
};

const kmFromKey = (key) => {
  const value = Number(key.split('/').pop());
  return Number.isFinite(value) ? value : 0;
};

const monthPrefix = (month) => `club/${month}/`;
const userPrefix = (month, userHash) => `${monthPrefix(month)}${userHash}/`;

const getMonthKm = async (userHash, month) => {
  const keys = await listKeys(userPrefix(month, userHash));
  return keys.reduce((max, key) => Math.max(max, kmFromKey(key)), 0);
};

/**
 * Сохраняет вклад. По умолчанию берётся максимум (повторные отправки не
 * уменьшают сумму), а с allowDecrease — ровно присланное значение: так
 * удаление тренировки уменьшает клубный пробег.
 */
const saveMonthKm = async (userHash, month, km, options = {}) => {
  const current = await getMonthKm(userHash, month);
  const next = options.allowDecrease ? km : Math.max(current, km);
  if (next === current) return current;

  const keys = await listKeys(userPrefix(month, userHash));

  if (next > 0) {
    await putObject(`${userPrefix(month, userHash)}${next.toFixed(1)}`);
  }
  await Promise.all(
    keys
      .filter((key) => kmFromKey(key) !== next)
      .map((key) => deleteObject(key))
  );

  return next;
};

/** Общие километры и число участников за месяц */
const getMonthStats = async (month) => {
  const keys = await listKeys(monthPrefix(month));
  const byUser = new Map();

  keys.forEach((key) => {
    const parts = key.split('/');
    if (parts.length < 4) return;
    const userHash = parts[2];
    byUser.set(userHash, Math.max(byUser.get(userHash) || 0, kmFromKey(key)));
  });

  let km = 0;
  byUser.forEach((value) => {
    km += value;
  });

  return {
    km: Math.round(km * 10) / 10,
    users: byUser.size,
  };
};

module.exports = { getMonthKm, saveMonthKm, getMonthStats };

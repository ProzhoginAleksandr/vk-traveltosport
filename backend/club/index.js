// backend/club/index.js
// HTTP-функция Yandex Cloud для клубного пробега.
//
// GET  ?month=YYYY-MM           — общие километры и число участников
// POST ?action=submit           — принять свой месячный километраж
//      { auth: { ...vk launch params, sign }, month, km }
//
// Считаются только импортированные тренировки: клиент присылает сумму за месяц.
// Хранится максимум, поэтому повторные запросы идемпотентны.
const { verifySign, hashUser, checkFreshness } = require('./auth');
const { saveMonthKm, getMonthStats } = require('./storage');

const MAX_MONTH_KM = 2000;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const allowedOrigins = () => {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [
    'https://prozhoginaleksandr.github.io',
    ...extra,
  ];
};

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (allowedOrigins().includes(origin)) return true;
  return (
    /^https:\/\/[a-z0-9-]+\.pages(?:-ac)?\.vk-apps\.ru$/.test(origin) ||
    /^http:\/\/localhost:(5173|5199)$/.test(origin)
  );
};

const baseHeaders = (origin, isPublic) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
  if (isPublic) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
};

const preflightHeaders = (origin) => ({
  ...baseHeaders(origin, false),
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

const respond = (statusCode, headers, payload) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload || {}),
  isBase64Encoded: false,
});

const parseBody = (event) => {
  if (!event || !event.body) return null;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Москва — UTC+3 без перехода на летнее время, Intl в рантайме не нужен
const moscowMonth = () => {
  const now = new Date(Date.now() + 3 * 3600 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const isMonth = (value) =>
  typeof value === 'string' && MONTH_RE.test(value) && value <= moscowMonth();

module.exports.handler = async (event) => {
  const method = String((event && event.httpMethod) || 'GET').toUpperCase();
  const origin =
    (event && event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const query = (event && event.queryStringParameters) || {};

  if (method === 'OPTIONS') {
    return respond(204, preflightHeaders(origin), {});
  }

  try {
    if (method === 'GET') {
      const month = String(query.month || '');
      if (!isMonth(month)) {
        return respond(400, baseHeaders(origin, true), { error: 'month' });
      }
      const stats = await getMonthStats(month);
      return respond(
        200,
        { ...baseHeaders(origin, true), 'Cache-Control': 'public, max-age=60' },
        { month, ...stats }
      );
    }

    if (method === 'POST') {
      if (!origin || !isAllowedOrigin(origin)) {
        return respond(403, baseHeaders(origin, false), { error: 'origin' });
      }

      const body = parseBody(event);
      if (!body || typeof body !== 'object') {
        return respond(400, baseHeaders(origin, false), { error: 'body' });
      }

      const { auth, month, km } = body;
      if (!isMonth(month)) {
        return respond(400, baseHeaders(origin, false), { error: 'month' });
      }
      if (!verifySign(auth) || !checkFreshness(auth && auth.vk_ts)) {
        return respond(401, baseHeaders(origin, false), { error: 'auth' });
      }

      const amount = Number(km);
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONTH_KM) {
        return respond(400, baseHeaders(origin, false), { error: 'km' });
      }

      const userHash = hashUser(auth.vk_user_id);
      const savedKm = await saveMonthKm(userHash, month, Math.round(amount * 10) / 10);
      const stats = await getMonthStats(month);

      return respond(
        200,
        { ...baseHeaders(origin, false), 'Cache-Control': 'no-store' },
        { month, savedKm, ...stats }
      );
    }

    return respond(405, baseHeaders(origin, false), { error: 'method' });
  } catch (error) {
    console.error('club handler error', error);
    return respond(500, baseHeaders(origin, false), { error: 'server' });
  }
};

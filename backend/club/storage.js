// backend/club/storage.js
// Хранилище клубной статистики в YDB: одна строка на пользователя и месяц.
// Хранится только максимум километража, поэтому повторные отправки и очистка
// кэша на устройстве не уменьшают вклад и не создают дублей.
const {
  Driver,
  getCredentialsFromEnv,
  TypedValues,
  TableDescription,
  Column,
  Types,
} = require('ydb-sdk');

let driverPromise = null;
let tablePromise = null;

const getDriver = () => {
  if (driverPromise) return driverPromise;

  const endpoint = process.env.YDB_ENDPOINT;
  const database = process.env.YDB_DATABASE;
  if (!endpoint || !database) {
    return Promise.reject(new Error('YDB_ENDPOINT и YDB_DATABASE не заданы'));
  }

  const driver = new Driver({
    endpoint,
    database,
    authService: getCredentialsFromEnv(),
  });
  driverPromise = driver.ready(10000).then(() => driver);
  return driverPromise;
};

/** Первый холодный старт создаёт таблицу сам — ручной SQL не нужен */
const ensureTable = () => {
  if (tablePromise) return tablePromise;

  tablePromise = (async () => {
    const driver = await getDriver();
    await driver.tableClient.withSession(async (session) => {
      const description = new TableDescription()
        .withColumns(
          new Column('user_hash', Types.UTF8),
          new Column('month', Types.UTF8),
          new Column('km', Types.DOUBLE),
          new Column('updated_at', Types.TIMESTAMP)
        )
        .withPrimaryKeys('user_hash', 'month');

      try {
        await session.createTable('club_month', description);
      } catch (error) {
        const message = String((error && error.message) || error);
        if (!/already exists|ALREADY_EXISTS/i.test(message)) throw error;
      }
    });
  })().catch((error) => {
    tablePromise = null;
    throw error;
  });

  return tablePromise;
};

const numeric = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value.toString === 'function') return Number(value.toString());
  return 0;
};

const valueToJs = (value) => {
  if (!value) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'nullFlagValue')) return null;
  if (value.boolValue !== undefined) return Boolean(value.boolValue);
  if (value.int32Value !== undefined) return numeric(value.int32Value);
  if (value.int64Value !== undefined) return numeric(value.int64Value);
  if (value.uint32Value !== undefined) return numeric(value.uint32Value);
  if (value.uint64Value !== undefined) return numeric(value.uint64Value);
  if (value.floatValue !== undefined) return numeric(value.floatValue);
  if (value.doubleValue !== undefined) return numeric(value.doubleValue);
  if (value.textValue !== undefined) return value.textValue;
  if (value.bytesValue !== undefined) return value.bytesValue;
  if (value.timestampValue !== undefined) return numeric(value.timestampValue);
  return null;
};

const rowsToObjects = (resultSet) => {
  if (!resultSet || !Array.isArray(resultSet.rows) || !Array.isArray(resultSet.columns)) return [];
  return resultSet.rows.map((row) => {
    const record = {};
    resultSet.columns.forEach((column, index) => {
      record[column.name] = valueToJs(row.items[index]);
    });
    return record;
  });
};

const query = async (sql, params = {}) => {
  await ensureTable();
  const driver = await getDriver();
  return driver.tableClient.withSession(async (session) => {
    const result = await session.executeQuery(sql, params);
    return (result.resultSets || []).map(rowsToObjects);
  });
};

const getMonthKm = async (userHash, month) => {
  const sets = await query(
    'DECLARE $user AS Utf8; DECLARE $month AS Utf8; ' +
      'SELECT km FROM club_month WHERE user_hash = $user AND month = $month;',
    {
      $user: TypedValues.utf8(userHash),
      $month: TypedValues.utf8(month),
    }
  );
  const row = sets[0] && sets[0][0];
  return row ? Math.max(0, numeric(row.km)) : 0;
};

/** Сохраняет максимум из текущего и присланного значения */
const saveMonthKm = async (userHash, month, km) => {
  const current = await getMonthKm(userHash, month);
  const next = Math.max(current, km);
  if (next === current && current > 0) return current;

  await query(
    'DECLARE $user AS Utf8; DECLARE $month AS Utf8; DECLARE $km AS Double; DECLARE $ts AS Timestamp; ' +
      'UPSERT INTO club_month (user_hash, month, km, updated_at) ' +
      'VALUES ($user, $month, $km, $ts);',
    {
      $user: TypedValues.utf8(userHash),
      $month: TypedValues.utf8(month),
      $km: TypedValues.double(next),
      $ts: TypedValues.timestamp(new Date()),
    }
  );
  return next;
};

/** Общие километры и число участников за месяц */
const getMonthStats = async (month) => {
  const sets = await query(
    'DECLARE $month AS Utf8; ' +
      'SELECT SUM(km) AS km, COUNT(*) AS users FROM club_month ' +
      'WHERE month = $month AND km > 0;',
    { $month: TypedValues.utf8(month) }
  );
  const row = (sets[0] && sets[0][0]) || {};
  return {
    km: Math.round(numeric(row.km) * 10) / 10,
    users: Math.max(0, Math.round(numeric(row.users))),
  };
};

module.exports = { getMonthKm, saveMonthKm, getMonthStats, __private: { valueToJs } };

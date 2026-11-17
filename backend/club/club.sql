-- backend/club/club.sql
-- Таблица клубного пробега: одна строка на пользователя и месяц.
-- Хранится только максимум километров, поэтому повторные отправки
-- и очистка кэша на устройстве не уменьшают вклад.

CREATE TABLE club_month (
  user_hash Utf8,
  month Utf8,
  km Double,
  updated_at Timestamp,
  PRIMARY KEY (user_hash, month)
);

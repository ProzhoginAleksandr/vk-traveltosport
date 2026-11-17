# Клубный пробег — бэкенд

HTTP-функция Yandex Cloud, которая собирает сумму километров за месяц по
импортированным тренировкам и считает число участников.

Считаются только импортированные тренировки. Клиент присылает свой **месячный**
километраж; сервер хранит максимум из присланного и сохранённого, поэтому
повторные запросы и очистка кэша на устройстве не уменьшают вклад и не создают
дублей. Наружу отдаются только суммы.

## Быстрый старт (Windows)

Нужен установленный yc CLI и выполненный yc init.

1. Установите CLI: https://yandex.cloud/ru/docs/cli/operations/install-cli
2. Войдите: `yc init` (выберите облако и каталог).
3. В корне репозитория выполните:

`powershell
powershell -ExecutionPolicy Bypass -File backend/club/deploy.ps1
`

Скрипт создаст сервисный аккаунт, базу YDB, функцию и HTTP-триггер, а в конце
напечатает URL. Таблицу функция создаст сама при первом запросе.

4. Добавьте этот URL в GitHub: Settings → Secrets and variables → Actions →
   Variables → `VITE_CLUB_API_URL`.
5. Сделайте push в `main` — Pages пересоберётся, и клубный блок появится.

## API

```
GET  <url>?month=YYYY-MM
→ { "month": "2026-11", "km": 1240.5, "users": 86 }

POST <url>?action=submit
{ "auth": { ...vk_* launch params, "sign": "..." }, "month": "2026-11", "km": 42.5 }
→ { "month": "2026-11", "savedKm": 42.5, "km": 1240.5, "users": 86 }
```

`auth` — полный набор launch-параметров VK, которые подписаны `sign`.
Подпись проверяется на сервере с `VK_APP_SECRET`; `vk_user_id` хешируется,
в базе нет открытых идентификаторов.

## Переменные окружения функции

| Переменная | Зачем |
|---|---|
| `VK_APP_SECRET` | секрет приложения VK: проверка `sign` и хеш пользователя |
| `YDB_ENDPOINT` | эндпоинт YDB, например `grpcs://ydb.serverless.yandexcloud.net:2135` |
| `YDB_DATABASE` | путь к базе, например `/ru-central1/b1g.../etn...` |
| `YDB_METADATA_CREDENTIALS=1` | брать IAM-токен из метаданных функции |
| `ALLOWED_ORIGINS` | дополнительные origin через запятую (опционально) |

## Развёртывание

Нужен установленный [yc CLI](https://yandex.cloud/ru/docs/cli/) и авторизация
`yc init`.

### 1. Сервисный аккаунт

```bash
yc iam service-account create --name club-stats
SA_ID=$(yc iam service-account get club-stats --format json | jq -r .id)
yc resource-manager folder add-access-binding <FOLDER_ID> \
  --role ydb.editor --subject serviceAccount:$SA_ID
yc resource-manager folder add-access-binding <FOLDER_ID> \
  --role functions.functionInvoker --subject serviceAccount:$SA_ID
```

### 2. База YDB и таблица

```bash
yc ydb database create club-db --serverless
yc ydb database get club-db
# из вывода возьмите endpoint и database
```

Таблицу создавать вручную не нужно: функция создаёт её сама при первом запросе
(`CREATE TABLE` в холодном старте). `club.sql` оставлен как справка о схеме.

### 3. Функция

```bash
cd backend/club
npm ci --omit=dev
# Windows PowerShell:
Compress-Archive -Path index.js,auth.js,storage.js,node_modules -DestinationPath club.zip -Force
# macOS/Linux:
# zip -r club.zip index.js auth.js storage.js node_modules

yc serverless function create --name club-stats
yc serverless function version create \
  --function-name club-stats \
  --runtime nodejs18 \
  --entry-point index.handler \
  --memory 256m \
  --execution-timeout 10s \
  --service-account-id $SA_ID \
  --source-path club.zip \
  --environment VK_APP_SECRET=<SECRET>,YDB_ENDPOINT=<ENDPOINT>,YDB_DATABASE=<DATABASE>,YDB_METADATA_CREDENTIALS=1
```

### 4. HTTP-триггер

```bash
yc serverless trigger create http \
  --name club-stats-http \
  --invoke-function-name club-stats \
  --invoke-function-service-account-id $SA_ID \
  --invoke-function-tag '$latest'

yc serverless trigger get club-stats-http
```

В выводе будет `url` — это и есть адрес API. Проверка:

```bash
curl "<URL>?month=2026-11"
```

### 5. Подключение клиента

1. В репозитории GitHub: Settings → Secrets and variables → Actions → Variables
   → добавьте `VITE_CLUB_API_URL` со значением URL из шага 4.
2. Для локальной проверки — в `.env`:
   `VITE_CLUB_API_URL=http://localhost:5277` (с мок-сервером) или реальный URL.
3. Пересоберите приложение: Pages workflow передаёт переменную в `npm run build`.

Пока переменная пустая, клубный блок в приложении не показывается.

## Стоимость

Функции: 1 млн вызовов и 10 ГБ·с в месяц бесплатно — клубу хватит с запасом.
YDB Serverless тарифицируется за запросы и хранение; при сотнях пользователей
и одном запросе на сессию это единицы рублей в месяц. Точные цифры смотрите в
калькуляторе Yandex Cloud для своего региона.

## Ограничения

- Считается только текущий и прошлые месяцы; будущие отклоняются.
- Максимум 2000 км на пользователя в месяц — защита от накрутки.
- Удаление тренировки на устройстве не уменьшает вклад в клубе: сервер хранит
  максимум и не знает, что именно удалили. Для честного удаления нужен отдельный
  запрос «уменьшить вклад», его можно добавить позже.
- Показываются только суммы, без имён и личных рейтингов.

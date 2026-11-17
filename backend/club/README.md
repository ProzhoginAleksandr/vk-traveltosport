# Клубный пробег — бэкенд

HTTP-функция Yandex Cloud, которая собирает сумму километров за месяц по
импортированным тренировкам и считает число участников. Данные лежат в Yandex
Object Storage, отдельная база не нужна.

Считаются только импортированные тренировки. Клиент присылает свой **месячный**
километраж; сервер хранит максимум из присланного и сохранённого, поэтому
повторные запросы и очистка кэша на устройстве не уменьшают вклад и не создают
дублей. Наружу отдаются только суммы.

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

## Как хранится

Объект в бакете: `club/<месяц>/<хеш пользователя>/<км>`. Один объект на
пользователя и месяц: при обновлении старый ключ удаляется, поэтому вклад не
дублируется. Сводка — список объектов за месяц и сумма километров.

## Переменные окружения функции

| Переменная | Зачем |
|---|---|
| `VK_APP_SECRET` | секрет приложения VK: проверка `sign` и хеш пользователя |
| `CLUB_BUCKET` | имя бакета Object Storage для статистики |

IAM-токен функция берёт из метаданных сервисного аккаунта, ключи доступа не
нужны.

## Быстрый старт (Windows)

Нужен установленный `yc` CLI и выполненный `yc init`.

```powershell
powershell -ExecutionPolicy Bypass -File backend/club/deploy.ps1
```

Скрипт создаст сервисный аккаунт, бакет, функцию и HTTP-доступ, а в конце
напечатает URL. Его нужно добавить в GitHub: Settings → Secrets and variables →
Actions → Variables → `VITE_CLUB_API_URL`.

Дальше любой push в `main` пересоберёт Pages, и клубный блок появится.

## Вручную

1. Сервисный аккаунт и роли:
   ```bash
   yc iam service-account create --name club-stats
   yc resource-manager folder add-access-binding <FOLDER_ID> \
     --role storage.editor --subject serviceAccount:<SA_ID>
   yc resource-manager folder add-access-binding <FOLDER_ID> \
     --role functions.functionInvoker --subject serviceAccount:<SA_ID>
   ```
2. Бакет:
   ```bash
   yc storage bucket create --name club-stats-data-<FOLDER_ID> --folder-id <FOLDER_ID>
   ```
3. Функция:
   ```bash
   cd backend/club
   tar -a -c -f club.zip index.js auth.js storage.js
   yc serverless function create --name club-stats
   yc serverless function version create \
     --function-name club-stats \
     --runtime nodejs18 \
     --entrypoint index.handler \
     --memory 256MB \
     --execution-timeout 15s \
     --service-account-id <SA_ID> \
     --source-path club.zip \
     --environment VK_APP_SECRET=<SECRET>,CLUB_BUCKET=club-stats-data-<FOLDER_ID>
   yc serverless function allow-unauthenticated-invoke club-stats
   ```
4. URL: `yc serverless function get club-stats --format json` → `http_invoke_url`.

## Стоимость

Функции: 1 млн вызовов и 10 ГБ×час в месяц бесплатно. Object Storage: 1 ГБ
хранения и бесплатный объём запросов в месяц; при сотнях пользователей расход
близок к нулю.

## Ограничения

- Считается только текущий и прошлые месяцы; будущие отклоняются.
- Максимум 2000 км на пользователя в месяц — защита от накрутки.
- Удаление тренировки уменьшает вклад: клиент присылает новый месячный итог с
  флагом `allowDecrease`, и сервер принимает уменьшение. Обычная синхронизация
  по-прежнему берёт максимум, поэтому новая установка без локальных треков не
  обнуляет вклад.
- Показываются только суммы, без имён и личных рейтингов.

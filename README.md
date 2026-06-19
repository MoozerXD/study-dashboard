# 📚 Study Dashboard

Учебная панель с ИИ-помощником: планируй задачи, следи за прогрессом по предметам, веди календарь и фокус-сессии. Двуязычный интерфейс (RU/EN), тёмная и светлая темы, плавные анимации.

> Это **не статический сайт**: есть Node.js/Express-сервер, авторизация, база Prisma/SQLite и API.

---

## ✨ Возможности

- **Дашборд** — метрики (задачи, фокус, прогресс) с анимированным счётчиком, задачи на сегодня, ИИ-план дня, прогресс по предметам.
- **Задачи** — приоритеты, дедлайны, фильтры (все / сегодня / важные), фокус-режим.
- **Предметы** — материалы, тесты, прогресс по каждому предмету.
- **Календарь** — режимы день/неделя/месяц, расписание дня, ИИ-рекомендации.
- **ИИ-помощник** — объяснение тем, планы, генерация задач, вложение файлов (OpenAI / Gemini / OpenRouter).
- **Профиль** — аватар, учебная статистика, быстрые действия.
- **Фокус-таймер (Pomodoro)** — плавающий виджет: режимы «Фокус / Перерыв / Отдых», счётчик сессий за день, сохранение состояния между перезагрузками.
- **Аутентификация** — регистрация, подтверждение email кодом, вход, сброс пароля (JWT + bcrypt).
- **Двуязычность (RU/EN)**, тёмная/светлая темы, доступность (skip-link, focus-ring), SEO-теги, `prefers-reduced-motion`.

## 🛠 Технологии

| Слой        | Используется                                                                 |
| ----------- | ---------------------------------------------------------------------------- |
| Backend     | Node.js 20+, Express 5, Prisma 7 + SQLite (адаптер better-sqlite3)           |
| Авторизация | JWT (`jsonwebtoken`), `bcryptjs`, cookie-parser                              |
| Почта       | Resend API или SMTP (`nodemailer`); dev-режим выводит код в ответе API       |
| ИИ          | OpenAI / Google Gemini / OpenRouter (выбирается через `AI_PROVIDER`)         |
| Frontend    | Ванильные HTML/CSS/JS, без сборщика                                          |
| Деплой      | Docker, Nginx reverse proxy                                                  |

## 📂 Структура проекта

```
study-dashboard-main/
├── public/                 # фронтенд (отдаётся express.static)
│   ├── index.html          # приложение (дашборд)
│   ├── auth.html           # вход / регистрация
│   ├── app.js              # вся логика дашборда + i18n
│   ├── auth.js             # логика авторизации
│   ├── dashboard-auth.js   # проверка токена на дашборде
│   ├── focus-timer.js      # виджет Pomodoro
│   ├── enhance.js          # анимация счётчиков метрик
│   ├── styles.css / auth.css
│   └── data/sat-question-bank.json
├── server/
│   ├── index.js            # Express-сервер и все API-роуты
│   ├── prisma/             # schema.prisma, миграции, dev.db
│   ├── scripts/            # send-test-email.js, seed-preview.mjs
│   └── .env.example        # шаблон переменных окружения
├── scripts/build-sat-bank.py
├── deploy/nginx.example.conf
├── Dockerfile / .dockerignore
└── package.json            # запускает server/ через --prefix
```

## 🚀 Локальный запуск

1. Откройте корень проекта.
2. Выполните `npm install` (корневой `postinstall` ставит зависимости `server/` и генерирует Prisma Client).
3. Создайте `server/.env` (скопируйте из `server/.env.example`). Для локальной разработки оставьте `RESEND_*` и `SMTP_*` пустыми — тогда почта работает в **dev-режиме** и код подтверждения возвращается прямо в ответе API.
4. Выполните `npm run dev`
5. Откройте `http://localhost:3000`
6. Проверка состояния: `GET http://localhost:3000/api/health`

> Демо-данные для предпросмотра можно засеять скриптом:
> `node server/scripts/seed-preview.mjs <token> http://localhost:3000 en` (язык: `en`/`ru`).

## ⚙️ Переменные окружения

Полный список — в `server/.env.example`. Ключевые:

| Переменная           | Назначение                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `HOST`               | Адрес прослушивания (для домена — `0.0.0.0`)                      |
| `PORT`               | Порт (обычно задаёт хостинг; локально `3000`)                     |
| `APP_URL`            | Публичный URL приложения                                          |
| `JWT_SECRET`         | Длинный случайный секрет для подписи токенов                      |
| `DATABASE_URL`       | Строка подключения Prisma (по умолчанию `file:./prisma/dev.db`)   |
| `AI_PROVIDER`        | `auto` / `openai` / `gemini` / `openrouter`                       |
| `OPENAI_API_KEY` и др. | Ключи провайдеров ИИ (без них ИИ работает в режиме настройки)   |
| `RESEND_API_KEY`     | Ключ Resend для отправки писем (иначе SMTP или dev-режим)         |
| `SMTP_*`             | Альтернатива Resend для отправки писем                            |

## 📜 npm-скрипты

| Команда              | Действие                                            |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Миграции + запуск сервера (разработка)              |
| `npm start`          | Миграции + запуск сервера (продакшен)               |
| `npm run db:migrate` | Применить миграции Prisma (`prisma migrate deploy`) |
| `npm run email:test` | Отправить тестовое письмо: `-- yourmail@gmail.com`  |

## 🌐 Запуск на домене

Для домена нужен VPS, Node.js-хостинг или сервер с reverse proxy, а не просто загрузка HTML-файлов.

1. На сервере выполните `npm install`
2. Для продакшена задайте переменные окружения в панели хостинга или в shell.
3. `server/.env` оставьте только для локальной разработки. На хостинге переменные из панели имеют приоритет и не затираются локальным `.env`.
4. Обязательно укажите:

   ```
   HOST=0.0.0.0
   APP_URL=https://your-domain.com
   JWT_SECRET=replace_with_long_random_secret
   ```

5. `PORT` обычно выставляет сам хостинг. Если нет, задайте его вручную, например `PORT=3000`.
6. Запустите проект командой `npm start`
7. После запуска проверьте `https://your-domain.com/api/health`
8. Привяжите домен к порту приложения через Nginx, Apache или панель хостинга.

Готовый пример reverse proxy лежит в `deploy/nginx.example.conf`.

## 📧 Resend для studydashboard.me

В проекте уже есть отправка писем через Resend. После верификации домена в Resend задайте на хостинге:

```
RESEND_API_KEY=re_xxxxxxxxx
RESEND_API_BASE_URL=https://api.resend.com
RESEND_FROM="Study Dashboard <no-reply@studydashboard.me>"
```

Если нужен адрес для ответов, дополнительно задайте `RESEND_REPLY_TO`.

Чтобы подключить домен:

1. В Resend откройте `Domains` и добавьте `studydashboard.me`.
2. В DNS-панели домена добавьте записи, которые Resend покажет для SPF и DKIM. Обычно для корневого домена это записи на `send.studydashboard.me` и `resend._domainkey.studydashboard.me`.
3. Добавьте DMARC TXT-запись на `_dmarc.studydashboard.me`, например `v=DMARC1; p=none;`.
4. Нажмите `Verify DNS Records` в Resend и дождитесь статуса `verified`.
5. Проверьте отправку: `npm run email:test -- yourmail@gmail.com`.

## 🐳 Docker

Если хостинг умеет запускать Docker-контейнеры, можно использовать готовые файлы `Dockerfile` и `.dockerignore`.

1. Соберите образ: `docker build -t study-dashboard .`
2. Запустите контейнер:

   ```
   docker run -d -p 3000:3000 --name study-dashboard \
     -e HOST=0.0.0.0 -e PORT=3000 \
     -e APP_URL=https://your-domain.com \
     -e JWT_SECRET=replace_with_long_random_secret \
     study-dashboard
   ```

## 🆕 Что нового в этом обновлении

- **Визуальное обновление**: более мягкие скруглённые углы, обновлённые тени и фокус-состояния, плавные микро-анимации (тёмная и светлая темы) + анимированная страница входа.
- **Фокус-таймер (Pomodoro)**: плавающий виджет с режимами «Фокус / Перерыв / Отдых», подсчётом сессий за день, сохранением состояния, поддержкой RU/EN и тем. Код изолирован в `public/focus-timer.js`.
- **Доступность и SEO**: ссылка «Перейти к содержимому», единые focus-ring, мета-теги `description`/`theme-color`/Open Graph на `index.html` и `auth.html`.
- **Локализация**: устранены пробелы в переводе EN (модалки, уведомления, ИИ-план, статусы ИИ) — динамический UI теперь переводится после вставки.
- **Зависимости и безопасность**: обновлены Prisma 7.8, better-sqlite3, nodemailer 9, cors, dotenv; устранены уязвимости в `path-to-regexp` и `qs` (транзитивные зависимости Express 5). Добавлен `postinstall: prisma generate`.
  - Остаются 3 уязвимости уровня *moderate* в `@prisma/dev` (`@hono/node-server`). Они затрагивают только команду `prisma dev`, которая в проекте не используется (используется `prisma migrate deploy` + адаптер better-sqlite3), поэтому в продакшен-рантайм не попадают. Откат Prisma до 6.x был бы регрессией, поэтому версия оставлена на 7.8.

## ❗ Важно

- Данные сейчас хранятся в `server/data.json` и `server/prisma/dev.db`.
- Для обычного VPS это работает, но для serverless/ephemeral-хостингов лучше перейти на PostgreSQL или Supabase.
- Названия предметов и задач — это пользовательский контент: они **не** переводятся автоматически при переключении RU/EN.
- Для быстрой проверки после деплоя используйте `GET /api/health`.

## 📄 Лицензия

Проект распространяется под лицензией **MIT** — см. файл [LICENSE](LICENSE).

© 2026 Dulat Tastanbay and Snegiryov Nikita

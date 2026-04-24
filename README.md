# Study Dashboard

Сайт больше не нужно запускать через `.bat`.

## Локальный запуск

1. Откройте корень проекта.
2. Выполните `npm install`
3. Выполните `npm run dev`
4. Откройте `http://localhost:3000`

## Запуск на домене

Это не статический сайт: у проекта есть Node.js/Express сервер, авторизация, база Prisma/SQLite и API.
Поэтому для домена нужен VPS, Node.js-хостинг или сервер с reverse proxy, а не просто загрузка HTML-файлов.

1. На сервере выполните `npm install`
2. Для продакшена задайте переменные окружения в панели хостинга или в shell.
3. `server/.env` оставьте только для локальной разработки. На хостинге переменные из панели теперь имеют приоритет и не затираются локальным `.env`.
4. Обязательно укажите:

`HOST=0.0.0.0`

`APP_URL=https://your-domain.com`

`JWT_SECRET=replace_with_long_random_secret`

5. `PORT` обычно выставляет сам хостинг. Если нет, задайте его вручную, например `PORT=3000`.
6. Запустите проект командой `npm start`
7. После запуска проверьте `https://your-domain.com/api/health`
8. Привяжите домен к порту приложения через Nginx, Apache или панель хостинга

Готовый пример reverse proxy лежит в `deploy/nginx.example.conf`.

## Resend для studydashboard.me

В проекте уже есть отправка писем через Resend. После верификации домена в Resend задайте на хостинге:

`RESEND_API_KEY=re_xxxxxxxxx`

`RESEND_API_BASE_URL=https://api.resend.com`

`RESEND_FROM="Study Dashboard <no-reply@studydashboard.me>"`

Если нужен адрес для ответов, дополнительно задайте `RESEND_REPLY_TO`.

Чтобы подключить домен:

1. В Resend откройте `Domains` и добавьте `studydashboard.me`.
2. В DNS-панели домена добавьте записи, которые Resend покажет для SPF и DKIM. Обычно для корневого домена это записи на `send.studydashboard.me` и `resend._domainkey.studydashboard.me`.
3. Добавьте DMARC TXT-запись на `_dmarc.studydashboard.me`, например `v=DMARC1; p=none;`.
4. Нажмите `Verify DNS Records` в Resend и дождитесь статуса `verified`.
5. Проверьте отправку: `npm run email:test -- yourmail@gmail.com`.

## Docker

Если хостинг умеет запускать Docker-контейнеры, можно использовать готовые файлы `Dockerfile` и `.dockerignore`.

1. Соберите образ: `docker build -t study-dashboard .`
2. Запустите контейнер:

`docker run -d -p 3000:3000 --name study-dashboard -e HOST=0.0.0.0 -e PORT=3000 -e APP_URL=https://your-domain.com -e JWT_SECRET=replace_with_long_random_secret study-dashboard`

## Важно

- Батник `start-study-dashboard.bat` больше не обязателен и нужен только как старый локальный способ запуска.
- Данные сейчас хранятся в `server/data.json` и `server/prisma/dev.db`.
- Для обычного VPS это работает, но для serverless/ephemeral-хостингов лучше перейти на PostgreSQL или Supabase.
- Для быстрой проверки после деплоя используйте `GET /api/health`.

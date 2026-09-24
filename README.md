# ZND

Статический фронт + API на Vercel.

## GitHub → Vercel

1. Залейте папку `znd` в репозиторий GitHub.
2. vercel.com → Add New → Project → этот репозиторий.
3. Framework Preset: Other.
4. Environment Variables:

- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID
- KV_REST_API_URL
- KV_REST_API_TOKEN

5. Deploy.

## Что нужно от вас

1. Бот в @BotFather, токен.
2. Написать боту /start.
3. Свой chat id (@userinfobot).
4. Бесплатная база Upstash Redis: https://upstash.com  
   REST URL и REST TOKEN.
5. После деплоя открыть в браузере один раз:

`https://api.telegram.org/botТОКЕН/setWebhook?url=https://ВАШ-ПРОЕКТ.vercel.app/api/telegram`

Без webhook кнопки в Telegram не работают.
Без Upstash кнопки не смогут зачислить баланс: на Vercel нет общей памяти между игроком и ботом.

Локально через index.html заявки остаются в браузере. На Vercel они уходят в API и в бота.

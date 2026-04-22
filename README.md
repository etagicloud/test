# test — Megorov launchpad

Тестовая страница на `https://megorov.com`. Next.js 15 + Postgres 16, дашборд про аналитику, считает визиты в реальном времени.

## Открыть в VS Code

```bash
code C:\beget\test
```

При первом открытии VS Code предложит установить рекомендованные расширения
(Docker, Tailwind, ESLint, GitLens) — соглашайся.

Дальше: `Ctrl+Shift+B` → запустится таска **«Старт локалки (БД + dev)»**.
Через 5–15 сек откроется http://localhost:3000.

Все таски (Ctrl+Shift+P → «Tasks: Run Task»):

| Таска | Что делает |
|-------|-----------|
| **Старт локалки (БД + dev)** | поднимает Postgres в Docker + `npm run dev` с hot-reload |
| **Стоп локалки** | гасит контейнер БД |
| **Полностью в Docker (без Node)** | если хочешь без `npm` — собирает app в контейнере |
| **Сбросить локалку** | пересоздаёт БД и `node_modules` с нуля |

## Локальная разработка

Один раз: установить [Docker Desktop](https://www.docker.com/products/docker-desktop/) и Node 20+.

```bash
# 1. Запустить app + Postgres локально
docker compose up

# Открыть http://localhost:3000
```

Если хочешь работать с горячей перезагрузкой (без докера для фронта):

```bash
docker compose up -d db                                  # только база
npm install                                              # один раз
DATABASE_URL=postgresql://test:testpass@localhost:5432/test npm run dev
```

## Деплой

`git push` в `main` → Coolify сам собирает Docker-образ и выкатывает.
Никаких ручных команд не нужно.

```bash
git add .
git commit -m "feat: что-то"
git push
# через ~60 сек обновлено на megorov.com
```

## Структура

```
src/
├── app/
│   ├── page.tsx          ← главная (SSR, пишет визит в БД, читает агрегаты)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── health/       ← GET /api/health  → {status, db}
│       └── stats/        ← GET /api/stats   → JSON со статистикой
└── lib/
    └── db.ts             ← пул pg + ensureSchema + getStats + recordVisit
```

## Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | строка подключения к Postgres |
| `BUILD_TIMESTAMP` | (опц.) ISO-дата сборки, отображается в футере |
| `SOURCE_COMMIT` | (опц.) SHA коммита, отображается в шапке |

В Coolify первая задаётся автоматически из подключённого ресурса Postgres.

## Где что в проде

- Сервер: Beget VPS `5.35.88.147`
- Панель: <https://panel.megorov.com>
- Прокси: Traefik v3 + Let's Encrypt
- БД: Postgres 16 (отдельный контейнер в Coolify)

# Paddle Up

Live match rotation and scoreboard for pickleball open play. One organizer creates a session, shares a 6-character code, and everyone in the group watches matches, scores, and the queue update in real time on their phones.

## What it does

- **Create a session** with a password and a 6-character join code.
- **Add players**, mark who's in or sitting out, and optionally set skill levels (casual ↔ competitive).
- **Auto-generate balanced matches** across 1–4 courts. The rotation tries to give everyone similar court time, rotate partners and opponents, and keep casual and competitive tiers separate when enabled.
- **Score from any phone.** Open a court's scoreboard page and tap to bump scores or record the final. All connected viewers see it instantly.
- **View-only is free.** Anyone with the code can watch; only people with the password can edit.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- [Supabase](https://supabase.com) — Postgres + Realtime (postgres_changes over WebSockets)
- Tailwind CSS 4
- TypeScript

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

Create a Supabase project, then apply the migrations in [supabase/migrations/](supabase/migrations/) in order:

- [0001_init.sql](supabase/migrations/0001_init.sql) — schema, password hashing, realtime publication
- [0002_sessions_by_code.sql](supabase/migrations/0002_sessions_by_code.sql)
- [0003_realtime_full.sql](supabase/migrations/0003_realtime_full.sql)
- [0004_delete_session.sql](supabase/migrations/0004_delete_session.sql)

### 3. Configure environment

Create a `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page — create or join a session |
| `/[code]` | Session dashboard — players, queue, matches, scores |
| `/[code]/court/[n]` | Full-screen scoreboard for court `n` |

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/sessions` | Create a new session, returns the 6-char code |
| `GET` | `/api/sessions/[code]` | Fetch current session state |
| `PATCH` | `/api/sessions/[code]` | Update state (requires password) |
| `DELETE` | `/api/sessions/[code]` | End session (requires password) |
| `POST` | `/api/sessions/[code]/verify` | Verify a password without mutating state |

## Project layout

```
src/
├── app/                  # Next.js App Router pages and API routes
│   ├── [code]/           # Session and court scoreboard pages
│   └── api/sessions/     # Session CRUD + password verify
├── components/           # UI: PlayerList, Scoreboard, CurrentMatch, ...
└── lib/
    ├── rotation.ts       # Match balancing algorithm
    ├── sessionHelpers.ts # Queue generation
    ├── sharedState.ts    # Realtime subscription + password-gated mutations
    └── supabase*.ts      # Client and server Supabase helpers
supabase/migrations/      # SQL schema and realtime setup
```

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

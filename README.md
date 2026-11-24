# CvSU Lost and Found System

A web platform for Cavite State University students, faculty and personnel to report lost belongings,
turn in found items, and claim them back through an administrator-verified process.

**Stack:** React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 · TanStack Query 5 · React Hook Form + Zod 4 ·
Supabase (Postgres, Auth, Storage, Row Level Security)

- Architecture, schema, security model and roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Database setup: [supabase/README.md](supabase/README.md)

## Requirements
- Node.js 20.19+ (developed on Node 24)
- A Supabase project (the free tier is enough)

## Getting started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up the database by following [supabase/README.md](supabase/README.md) (run the 7 migrations).
3. Create `.env.local` from the example and fill in your project's URL and anon/publishable key:
   ```bash
   cp .env.example .env.local
   ```
4. Start the dev server and open http://localhost:5173:
   ```bash
   npm run dev
   ```
5. Register an account, then make it super admin with `supabase/seed.sql`.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run test:db` | Run all migrations + the 112-check security test on an in-memory Postgres (no Supabase needed) |
| `npm run test:contract` | Check every frontend query, write and RPC call against the migrated schema and grants |
| `npm test` | Both of the above |

Full QA guide (automated checks + the manual checklist for a live project): [docs/TESTING.md](docs/TESTING.md)

## Security notes
- Only the **public** anon/publishable key is used in the browser. Never put the `service_role` key in
  any `VITE_` variable.
- Every permission is enforced in the database (RLS, column grants, role-checked RPCs). Hiding a button in
  the UI is never the protection.

## Project status
Phases 1–5 are complete: database, authentication, every student/faculty/personnel feature, and the
full admin area (moderation, claim verification and release, users and roles, categories, campus
locations, analytics with CSV export, activity logs, settings). Remaining: Phase 6 (end-to-end QA on a
live Supabase project) and Phase 7 (deployment guide). See the tracker in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#10-roadmap--progress-tracker).

# Smart CA Frontend (`saas`)

React + TypeScript UI for Smart CA. Business data is loaded and mutated through the **Go REST API** (`../Go`), not through a LocalStorage MockDatabase on the verified path.

> **Requires the Go backend** for login and business features.  
> **Docker image/Compose runtime was NOT verified** on the machine that authored the Docker files.

## Stack (from `package.json`)

| Library | Version range |
|---------|---------------|
| React / React DOM | ^19.2.7 |
| Vite | ^8.1.1 |
| TypeScript | ~6.0.2 |
| Tailwind CSS | ^4.3.2 |
| TanStack Query | ^5.101.2 |
| TanStack Table | ^8.21.3 |
| Zustand | ^5.0.14 |
| react-router | ^7.18.1 |
| react-hook-form / zod | ^7.81.0 / ^4.4.3 |
| recharts / framer-motion / lucide-react | as in package.json |
| Package manager | **npm** (`package-lock.json`) |

Local verification used **Node v22.20.0** / **npm 10.5.0**.

## Architecture

- Pages: `src/pages/*`
- API client: `src/services/httpClient.ts` → `VITE_API_BASE_URL`
- Auth token: `localStorage` key `smart-ca-token` (session token only; not a business DB)
- Server cache: TanStack Query
- UI shell state: Zustand

## Native development

```bash
# Terminal 1 — Go API
cd ../Go && go run ./cmd/api

# Terminal 2 — Vite
cd ../saas
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8080/api/v1
npm ci
npm run dev
```

Open `http://localhost:5173` or `http://127.0.0.1:5173` (both CORS-allowed by default backend config).

### Scripts

| Script | Command |
|--------|---------|
| Dev | `npm run dev` |
| Typecheck + build | `npm run build` (`tsc -b && vite build`) |
| Lint | `npm run lint` (oxlint) |
| Preview | `npm run preview` |
| Auth E2E | `npm run qa:auth` |
| Business QA | `npm run qa:business` |
| Browser QA | `npm run qa:browser` |

Build output directory: **`dist/`** (Vite default; `vite.config.ts` does not override `build.outDir`).

## Environment

See `.env.example`.

| Variable | Native | Docker image build |
|----------|--------|--------------------|
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | `/api/v1` |
| `VITE_APP_NAME` | `Smart CA` | `Smart CA` |

`VITE_*` values are **build-time**. Changing them requires rebuild (and Vite restart in dev).

Never put secrets in `VITE_*`.

## Docker image design

`Dockerfile`:

1. `node:22.20.0-bookworm-slim` — `npm ci`, `npm run build` with `VITE_API_BASE_URL=/api/v1`
2. `nginxinc/nginx-unprivileged:1.27.4-alpine` — serves `dist/`, listens **8080**

`nginx.conf`:

- `GET /health` → `ok`
- `/api/` → `proxy_pass http://api:8080` (Compose service DNS)
- SPA `try_files` → `index.html`
- Long cache for `/assets/`; `no-cache` for HTML
- Forwards `Authorization`, `X-Request-ID`, standard forwarded headers

**Do not** set `VITE_API_BASE_URL=http://api:8080` — browsers cannot resolve Compose DNS.

### Intended Compose usage

From workspace root (`D:\SmartCA`):

```bash
docker compose build
docker compose up -d
```

UI: http://localhost:8080  

These commands were **not** executed in the authoring environment.

## Auth integration

`AuthService.login` → `POST {API}/auth/login` → stores Bearer token → protected routes. Logout clears token and calls API logout when possible.

Demo users are shown on the login page; password `SmartCA@2025` matches Go seed.

## Known limitations

- No offline business data authority
- Document upload/preview are metadata / simulated content
- AI assistant replies are canned
- Docker build/run **not verified** here
- Backend restart resets API data (UI refresh alone does not)

## License

No license file is present in this repository at the time of writing.

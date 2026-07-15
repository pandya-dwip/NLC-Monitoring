# NLC Fleet Monitor -- Frontend

React/Vite/TypeScript dashboard for the NLC MQTT stress-testing framework. See the
[root README](../README.md) for what this project is and how to run the backend + frontend
together, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for this app's internal architecture
(data flow, routing, table composition) with diagrams.

## Quick start

```bash
npm install
cp .env.example .env   # VITE_API_URL / VITE_SOCKET_URL
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on `http://localhost:5173` |
| `npm run build` | Typecheck (`tsc -b`) + production build to `dist/` |
| `npm run lint` / `lint:fix` | ESLint (flat config, `eslint.config.js`) |
| `npm run format` | Prettier (with `prettier-plugin-tailwindcss` for class sorting) |
| `npm run preview` | Preview the production build locally |

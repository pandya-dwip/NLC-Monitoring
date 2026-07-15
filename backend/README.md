# NLC MQTT Simulator -- Backend

Node.js/TypeScript MQTT device simulation engine for the NLC stress-testing framework. See the
[root README](../README.md) for what this project is, full `.env` configuration reference, and how
to run the backend + frontend together, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for this
service's internal architecture (execution pool, publish/RPC flows, stress-mode strategies) with
diagrams.

## Quick start

```bash
npm install
cp .env.example .env   # point MQTT_HOST/PORT at a broker, or use the bundled test broker below
npm run broker:dev      # optional: a throwaway local MQTT broker, in another terminal
npm run dev              # tsx watch, hot-reloads on save
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run broker:dev` | Local throwaway MQTT broker (`scripts/local-broker.ts`), no ThingsBoard required |
| `npm run build` | `tsc -p tsconfig.json` -> `dist/` |
| `npm start` | Run the compiled build (`node dist/server.js`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Prettier |

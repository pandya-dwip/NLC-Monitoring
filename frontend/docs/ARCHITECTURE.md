# Frontend Architecture

The frontend is a React/Vite/TypeScript dashboard (HeroUI + Tailwind v4 for components, Recharts
for charts, TanStack Table for the data grids, Zustand for live state, React Query for REST
hydration/mutations) that visualizes the backend's fleet of simulated devices in real time.

See the [root README](../../README.md) for how to run it and its `.env` reference. This document
is the internal architecture: how data actually flows from the backend into the UI, as Mermaid
diagrams.

## The core rule: live data lives in Zustand, REST only hydrates and controls

`useSocketSubscriptions` (mounted once at the app root) is the **only** place that touches the
socket. Every page/table/chart reads from a Zustand store; nothing else subscribes to Socket.IO
events directly. React Query is used for two things only: painting each store before the socket's
own initial snapshot arrives, and simulation-control mutations (start/stop/pause/resume/scale).

```mermaid
flowchart TD
    Socket["socketClient.ts<br/>(singleton socket.io-client)"]
    Sub["useSocketSubscriptions<br/>(mounted once, in App.tsx)"]

    Socket -- "device:status" --> Sub
    Socket -- "mqtt:message" --> Sub
    Socket -- "command:received" --> Sub
    Socket -- "metrics:snapshot" --> Sub

    Sub --> DeviceStore["useDeviceStore<br/>Map&lt;clientId, DeviceState&gt;"]
    Sub --> MqttStore["useMqttMonitorStore<br/>ring buffer (500)"]
    Sub --> CmdStore["useCommandStore<br/>ring buffer (200)"]
    Sub --> MetricsStore["useMetricsStore<br/>latest + history (120)"]

    subgraph Hydration["React Query -- initial hydration only"]
        DevicesQ["useDevicesInitialQuery"]
        MqttQ["useMqttMonitorInitialQuery"]
        CmdQ["useCommandsInitialQuery"]
        MetricsQ["useMetricsInitialQuery"]
        ConfigQ["useConfigQuery"]
    end
    DevicesQ -.seeds.-> DeviceStore
    MqttQ -.seeds.-> MqttStore
    CmdQ -.seeds.-> CmdStore
    MetricsQ -.seeds.-> MetricsStore

    DeviceStore --> DeviceTable["tables/DeviceTable"]
    MqttStore --> MqttTable["tables/MqttMonitorTable"]
    CmdStore --> CmdTable["tables/CommandsTable"]
    MetricsStore --> StatTiles["components/StatTile ×N<br/>(OverviewPage)"]
    MetricsStore --> Charts["charts/TimeSeriesChart ×N<br/>(ChartsPage)"]
    MetricsStore --> SimControls["components/SimulationControls"]

    Controls["useSimulationControls<br/>(start/stop/pause/resume/scale)"] -- "POST /api/simulation/*" --> API["backend REST API"]
    SimControls --> Controls
```

## Initial page load

```mermaid
sequenceDiagram
    participant Browser
    participant App as App.tsx
    participant RQ as React Query
    participant Socket as socketClient
    participant Store as Zustand stores
    participant BE as Backend

    Browser->>App: mount
    App->>RQ: useDevicesInitialQuery / useMqttMonitorInitialQuery /<br/>useCommandsInitialQuery / useMetricsInitialQuery
    RQ->>BE: GET /api/devices, /api/mqtt/messages,<br/>/api/commands, /api/metrics/snapshot
    BE-->>RQ: initial data
    RQ->>Store: setAll() / hydrate() / setSnapshot()
    App->>Socket: connect (autoConnect: true)
    Socket->>BE: WebSocket handshake
    BE-->>Socket: device:status (full snapshot),<br/>metrics:snapshot (on connect)
    Socket->>Store: patchMany() / setSnapshot()
    Note over Store: from here on, every update<br/>arrives by push -- no polling
    BE-->>Socket: device:status / mqtt:message /<br/>command:received / metrics:snapshot (live)
    Socket->>Store: patch / append
    Store->>Browser: re-render (React)
```

## Pages and routing

```mermaid
flowchart LR
    App["App.tsx<br/>QueryClientProvider + BrowserRouter"]
    Layout["layouts/DashboardLayout<br/>(nav, sim status, controls, export, theme)"]

    App --> Layout
    Layout --> Overview["/ -- OverviewPage<br/>KPI tiles + headline charts"]
    Layout --> Devices["/devices -- DevicesPage<br/>DeviceTable"]
    Layout --> MqttMon["/mqtt-monitor -- MqttMonitorPage<br/>MqttMonitorTable"]
    Layout --> Commands["/commands -- CommandsPage<br/>CommandsTable"]
    Layout --> Charts["/charts -- ChartsPage<br/>10x TimeSeriesChart"]
```

## Table architecture

Every live table shares one chrome component (`tables/DataTable.tsx`) built on TanStack Table's
headless row model rendering a plain `<table>` -- not HeroUI's `Table` component, since HeroUI's
`Table` owns its own row/cell markup that doesn't compose with `flexRender`. Each concrete table is
just a column-definition file plus a store selector.

```mermaid
flowchart TD
    DataTable["tables/DataTable.tsx<br/>search + sort + pagination chrome,<br/>TanStack Table headless row model"]
    DataTable --> DeviceTable["DeviceTable.tsx<br/>columns: status, voltage, current, power,<br/>light state, firmware, counters..."]
    DataTable --> MqttMonitorTable["MqttMonitorTable.tsx<br/>columns: direction, topic, payload preview,<br/>QoS, size, latency, status"]
    DataTable --> CommandsTable["CommandsTable.tsx<br/>columns: kind, method, payload,<br/>execution time, response, status"]

    DeviceTable -. reads .-> DeviceStore["useDeviceStore"]
    MqttMonitorTable -. reads .-> MqttStore["useMqttMonitorStore"]
    CommandsTable -. reads .-> CmdStore["useCommandStore"]
```

Pagination caps rendered DOM rows regardless of fleet size, so this scales without virtualization
for the device counts this tool targets (tens of thousands, sharded across the backend's worker
pool -- see [`backend/docs/ARCHITECTURE.md`](../../backend/docs/ARCHITECTURE.md)).

## Directory reference

| Path | Responsibility |
|---|---|
| `types/` | hand-written TS types mirroring the backend's models (kept in sync manually -- separate packages) |
| `websocket/socketClient.ts` | singleton `socket.io-client` instance |
| `store/` | Zustand stores for push-driven live data: `useDeviceStore`, `useMqttMonitorStore`, `useCommandStore`, `useMetricsStore` |
| `hooks/` | `useSocketSubscriptions` (the only socket consumer) + React Query hooks for initial hydration and simulation-control mutations |
| `lib/` | `api.ts` (fetch helpers, `API_URL`), `format.ts` (number/byte/latency formatting), `rateSeries.ts` (derives per-second rates from cumulative metrics history) |
| `components/` | `StatTile`, `ConnectionStatusBadge`, `SocketConnectionIndicator`, `SimulationControls`, `ExportButtons`, `ThemeToggle` |
| `charts/TimeSeriesChart.tsx` | one reusable Recharts line chart, single axis only (no dual-axis charts anywhere) |
| `tables/` | `DataTable.tsx` (shared chrome) + the three column-definition files |
| `pages/` | `OverviewPage`, `DevicesPage`, `MqttMonitorPage`, `CommandsPage`, `ChartsPage` |
| `layouts/DashboardLayout.tsx` | header (nav, sim status, start/stop/pause/resume/rescale, export, theme) + router outlet |

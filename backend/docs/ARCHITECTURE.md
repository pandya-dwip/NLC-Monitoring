# Backend Architecture

The backend is a Node.js/TypeScript MQTT device simulation engine: it connects a fleet of
simulated NLC controllers to an MQTT broker (ThingsBoard or a local test broker), publishes
realistic telemetry, responds to RPC/attribute commands, and exposes everything it observes over a
REST API and Socket.IO for the dashboard in `frontend/`.

See the [root README](../../README.md) for how to run it and the full `.env` reference. This
document is the internal architecture: module structure, execution model, and the main request/
event flows, as Mermaid diagrams.

## Module structure

```mermaid
flowchart TD
    Server["server.ts<br/>(entrypoint)"]

    subgraph API["api/routes/"]
        direction TB
        Health["health.ts"]
        ConfigRoute["config.ts"]
        Devices["devices.ts"]
        Metrics["metrics.ts"]
        MqttMon["mqttMonitor.ts"]
        Commands["commands.ts"]
        Simulation["simulation.ts"]
        Export["exportRoutes.ts"]
    end

    SocketServer["websocket/socketServer.ts"]

    subgraph Workers["workers/"]
        direction TB
        Pool["pool.ts<br/>(selects active pool)"]
        WorkerPool["workerPool.ts"]
        ProcessPool["processPool.ts"]
        ExecBase["executionPoolBase.ts<br/>(BaseExecutionPool)"]
        PoolUnit["poolUnit.ts<br/>(PoolUnit adapter)"]
        FleetStore["fleetStore.ts<br/>(FleetStore)"]
        DeviceRunner["deviceRunner.ts<br/>(shared per-unit logic)"]
        DeviceWorker["deviceWorker.ts<br/>(worker_thread entry)"]
        DeviceProcess["deviceProcess.ts<br/>(child_process entry)"]
    end

    subgraph MQTT["mqtt/"]
        ConnMgr["connectionManager.ts"]
        DevClient["deviceClient.ts"]
    end

    subgraph Sim["simulator/"]
        Behavior["deviceBehavior.ts"]
        StressModes["stressModes/index.ts"]
    end

    subgraph Telemetry["telemetry/"]
        Template["payloadTemplate.ts"]
        Randomizer["randomizer.ts"]
    end

    RPC["rpc/commandHandler.ts"]
    ConfigMod["config/index.ts"]

    Server --> ConfigMod
    Server --> API
    Server --> SocketServer
    Server --> Pool

    Pool --> WorkerPool
    Pool --> ProcessPool
    WorkerPool --> ExecBase
    ProcessPool --> ExecBase
    WorkerPool --> PoolUnit
    ProcessPool --> PoolUnit
    ExecBase --> FleetStore

    WorkerPool -.spawns.-> DeviceWorker
    ProcessPool -.spawns.-> DeviceProcess
    DeviceWorker --> DeviceRunner
    DeviceProcess --> DeviceRunner
    DeviceRunner --> ConnMgr
    ConnMgr --> DevClient
    ConnMgr --> Behavior
    ConnMgr --> StressModes
    Behavior --> Template
    Behavior --> Randomizer
    DevClient --> RPC

    API --> FleetStore
    SocketServer --> FleetStore
```

Dashed arrows are process/thread spawns (`new Worker(...)` or `child_process.fork(...)`); solid
arrows are ordinary imports/calls within the same process.

## Execution pool abstraction

`workerPool.ts` (`worker_threads`, default) and `processPool.ts` (`child_process`,
`CLUSTER_MODE=true`) are both thin instantiations of the same `BaseExecutionPool` orchestration
logic, parametrized over a small `PoolUnit` transport-adapter interface so neither transport
duplicates bootstrap/start/stop/pause/resume/shutdown/rescale logic. `pool.ts` exports whichever is
active, and it's the only thing `server.ts` and the API routes import.

```mermaid
classDiagram
    class PoolUnit {
        <<interface>>
        +postMessage(msg)
        +onMessage(handler)
        +onError(handler)
        +onExit(handler)
        +terminate() Promise
    }

    class BaseExecutionPool {
        -units: PoolUnit[]
        -running: boolean
        -paused: boolean
        +bootstrap() Promise
        +start()
        +stop()
        +pause()
        +resume()
        +shutdown() Promise
        +rescale() Promise
        +isRunning() bool
        +isPaused() bool
    }
    BaseExecutionPool "1" --> "*" PoolUnit : orchestrates

    class spawnThreadUnit {
        <<function>>
        wraps worker_threads.Worker
    }
    class spawnProcessUnit {
        <<function>>
        wraps child_process.fork·result
    }
    spawnThreadUnit ..> PoolUnit : creates
    spawnProcessUnit ..> PoolUnit : creates

    class workerPool {
        <<const>>
        new BaseExecutionPool spawnThreadUnit
    }
    class processPool {
        <<const>>
        new BaseExecutionPool spawnProcessUnit
    }
    workerPool --> BaseExecutionPool
    processPool --> BaseExecutionPool
    workerPool ..> spawnThreadUnit
    processPool ..> spawnProcessUnit

    class pool {
        <<const, selected by CLUSTER_MODE>>
    }
    pool --> workerPool : CLUSTER_MODE=false
    pool --> processPool : CLUSTER_MODE=true
```

`deviceRunner.ts` mirrors this pattern one level down: `deviceWorker.ts` and `deviceProcess.ts` are
each a ~10-line entrypoint that calls `runDeviceRunner()` with a transport-specific `{ post,
onMessage }` adapter (`parentPort` vs `process.send`/`process.on('message')`); all the actual
per-unit logic (device-status/mqtt-message/command buffering, the 500ms flush, wiring a
`ConnectionManager`) lives once in `deviceRunner.ts`.

## Server bootstrap

```mermaid
sequenceDiagram
    participant Main as server.ts
    participant App as Express app
    participant Socket as Socket.IO server
    participant Pool as pool (workerPool/processPool)
    participant Loader as deviceLoader
    participant Unit as Execution unit(s)

    Main->>App: createApp() + listen(API_PORT)
    Main->>Socket: startSocketServer() + listen(SOCKET_PORT)
    Main->>Pool: bootstrap()
    Pool->>Loader: loadDeviceCredentials() + shardDevices()
    Pool->>Unit: spawn WORKER_COUNT units (thread or process)
    Unit-->>Pool: 'ready' (workerId, deviceCount)
    Pool->>Pool: fleetStore.registerWorker(workerId, deviceCount)
    Main->>Pool: start()
    Pool->>Unit: broadcast 'start'
    Unit->>Unit: ConnectionManager.start()<br/>(staggered DEVICE_BATCH_SIZE batches,<br/>each device connects with its own MQTT credentials)
```

## Publish tick

```mermaid
sequenceDiagram
    participant CM as ConnectionManager
    participant Strat as StressModeStrategy
    participant DB as deviceBehavior
    participant DC as DeviceClient
    participant Broker as MQTT Broker
    participant Unit as Execution unit<br/>(buffer, 500ms flush)
    participant FS as FleetStore (primary process)

    CM->>Strat: nextIntervalMs(baseIntervalMs, elapsedMs)
    Strat-->>CM: interval for SIMULATION_MODE
    CM->>DB: renderTelemetry(state, elapsedMs, enableRandomization)
    DB->>DB: voltage jitter, current/power from light state,<br/>energy counters, day/night schedule,<br/>randomizer.ts ranges + failure probabilities
    DB-->>CM: telemetry payload
    CM->>DC: publishTelemetry(payload)
    DC->>Broker: PUBLISH v1/devices/me/telemetry
    Broker-->>DC: PUBACK (latency measured)
    DC->>DC: state.messagesSent++, lastLatencyMs = ...
    DC->>Unit: emit('mqtt-message'), emit('status')
    Unit->>FS: postMessage(mqtt-message-batch, device-status-batch)
    FS->>FS: applyMqttEvents() / applyDeviceStates()
```

## Incoming RPC / attribute command

```mermaid
sequenceDiagram
    participant Broker as MQTT Broker
    participant DC as DeviceClient
    participant Parse as commandHandler.parseIncomingMessage
    participant Apply as commandHandler.applyCommandAndBuildResponse
    participant Unit as Execution unit
    participant FS as FleetStore

    Broker->>DC: MESSAGE v1/devices/me/rpc/request/{id}
    DC->>Parse: parseIncomingMessage(clientId, topic, payload)
    Parse-->>DC: IncomingCommand { kind: 'rpc', method, requestId, ... }
    DC->>Apply: applyCommandAndBuildResponse(command, state)
    Apply->>Apply: e.g. setLightState -> state.lightState = value,<br/>state.manualLightOverride = { value, expiresAt }<br/>(overrides day/night schedule until it expires)
    Apply-->>DC: { responseTopic, responsePayload }
    DC->>Broker: PUBLISH v1/devices/me/rpc/response/{id}
    DC->>Unit: emit('command', command, latencyMs, response)
    Unit->>FS: postMessage(command-received-batch)
    FS->>FS: applyCommands() -- ring buffer + totals
```

## Device connection lifecycle

```mermaid
stateDiagram-v2
    [*] --> connecting: DeviceClient.connect()
    connecting --> connected: MQTT 'connect'
    connecting --> error: MQTT 'error'
    connected --> connecting: MQTT 'reconnect'<br/>(reconnectCount++)
    connected --> disconnected: MQTT 'close'
    connecting --> disconnected: MQTT 'close'
    error --> connecting: AUTO_RECONNECT retry
    disconnected --> [*]: ConnectionManager.stop()
```

`ConnectionStatus` also defines an `offline` value (`models/device.ts`) that `FleetStore` already
filters for, but nothing in the simulator currently assigns it to a device -- it's reserved for a
future "randomly goes offline" behavior, not live yet.

## Stress-mode strategies

All ten `SIMULATION_MODE` values are `StressModeStrategy` implementations registered in
`simulator/stressModes/index.ts`, selected by `createStressModeStrategy()` and consumed by
`ConnectionManager` purely through `nextIntervalMs(baseIntervalMs, elapsedMs)` -- the scheduling
loop itself has no per-mode logic.

```mermaid
classDiagram
    class StressModeStrategy {
        <<interface>>
        +mode
        +nextIntervalMs(base, elapsed) number
    }
    StressModeStrategy <|.. ConstantStrategy
    StressModeStrategy <|.. RampUpStrategy
    StressModeStrategy <|.. RampDownStrategy
    StressModeStrategy <|.. RandomIntervalStrategy
    StressModeStrategy <|.. SpikeStrategy
    StressModeStrategy <|.. BurstStrategy
    StressModeStrategy <|.. HourWindowStrategy
    StressModeStrategy <|.. ScheduledStrategy
    StressModeStrategy <|.. ChaosStrategy

    class RampUpStrategy {
        3x base -> base over RAMP_UP_TIME
    }
    class RampDownStrategy {
        base -> 3x base over RAMP_DOWN_TIME
    }
    class RandomIntervalStrategy {
        base * [0.5, 1.5] every tick
    }
    class SpikeStrategy {
        base rate; SPIKE_DURATION_MS window every<br/>SPIKE_INTERVAL_MS at base/SPIKE_FACTOR
    }
    class BurstStrategy {
        BURST_SIZE messages rapid, then BURST_QUIET_MS idle<br/>(pure function of elapsed time --<br/>whole fleet bursts in sync)
    }
    class HourWindowStrategy {
        used for peak-hour and night:<br/>rate x during an hour window
    }
    class ScheduledStrategy {
        combines peak-hour + night windows
    }
    class ChaosStrategy {
        base * [CHAOS_MIN_FACTOR, CHAOS_MAX_FACTOR]
    }
```

## Data flow: FleetStore to the dashboard

```mermaid
flowchart LR
    Unit["Execution units<br/>(N shards)"] -- "postMessage<br/>(500ms batches)" --> FS["FleetStore"]
    FS -- "device ring state,<br/>MQTT ring buffer (2000),<br/>command ring buffer (500),<br/>rolling totals" --> Snapshot["buildMetricsSnapshot()"]
    FS --> REST["REST API<br/>(devices/mqtt/commands/metrics/export)"]
    FS -- "EventEmitter:<br/>device:status, mqtt:message,<br/>command:received" --> SocketIO["Socket.IO server"]
    Snapshot -- "every METRICS_INTERVAL" --> SocketIO
    REST --> Client["Dashboard (REST hydration)"]
    SocketIO --> Client2["Dashboard (live push)"]
```

## Directory reference

| Path | Responsibility |
|---|---|
| `config/index.ts` | `.env` loading + zod validation, typed `AppConfig` |
| `models/` | `DeviceState`, `TelemetryPayload`, `IncomingCommand`, `MetricsSnapshot`, `StressModeStrategy`, worker/process IPC message types |
| `logger/index.ts` | pino factory, one file per category (`mqtt`, `commands`, `errors`, `system`, `performance`) |
| `telemetry/` | payload-template loading, `AUTO_TIMESTAMP` substitution, range/failure randomization |
| `simulator/` | per-device physical behavior model, the stress-mode strategy registry |
| `mqtt/` | per-device `mqtt.js` client wrapper, the per-shard `ConnectionManager` |
| `rpc/commandHandler.ts` | classifies inbound RPC/attribute messages, applies simulated side effects, builds acks |
| `workers/` | the execution-pool abstraction described above, plus `FleetStore` |
| `websocket/socketServer.ts` | Socket.IO server, push-only |
| `api/routes/` | Express REST endpoints |
| `utils/` | device loading/selection, random helpers, CSV, dot-path get/set |
| `app.ts` / `server.ts` | Express app assembly / process entrypoint + graceful shutdown |

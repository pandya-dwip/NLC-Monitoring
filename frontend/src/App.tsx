import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OverviewPage } from './pages/OverviewPage';
import { DevicesPage } from './pages/DevicesPage';
import { DeviceHistoryPage } from './pages/DeviceHistoryPage';
import { MqttMonitorPage } from './pages/MqttMonitorPage';
import { CommandsPage } from './pages/CommandsPage';
import { ChartsPage } from './pages/ChartsPage';
import { useSocketSubscriptions } from './hooks/useSocketSubscriptions';
import { useDevicesInitialQuery } from './hooks/useDevicesInitialQuery';
import { useMqttMonitorInitialQuery } from './hooks/useMqttMonitorInitialQuery';
import { useCommandsInitialQuery } from './hooks/useCommandsInitialQuery';
import { useMetricsInitialQuery } from './hooks/useMetricsInitialQuery';

const queryClient = new QueryClient();

function LiveDataProvider({ children }: { children: ReactNode }) {
  useSocketSubscriptions();
  useDevicesInitialQuery();
  useMqttMonitorInitialQuery();
  useCommandsInitialQuery();
  useMetricsInitialQuery();
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LiveDataProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="device-history" element={<DeviceHistoryPage />} />
              <Route path="mqtt-monitor" element={<MqttMonitorPage />} />
              <Route path="commands" element={<CommandsPage />} />
              <Route path="charts" element={<ChartsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LiveDataProvider>
    </QueryClientProvider>
  );
}

export default App;

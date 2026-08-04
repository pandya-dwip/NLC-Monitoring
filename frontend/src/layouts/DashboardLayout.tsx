import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Gauge, History, LayoutDashboard, Radio, Terminal } from 'lucide-react';
import { SocketConnectionIndicator } from '../components/SocketConnectionIndicator';
import { SimulationControls } from '../components/SimulationControls';
import { ExportButtons } from '../components/ExportButtons';
import { ThemeToggle } from '../components/ThemeToggle';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/devices', label: 'Devices', icon: Gauge, end: false },
  { to: '/device-history', label: 'Device History', icon: History, end: false },
  { to: '/mqtt-monitor', label: 'MQTT Monitor', icon: Radio, end: false },
  { to: '/commands', label: 'Commands', icon: Terminal, end: false },
  { to: '/charts', label: 'Charts', icon: Activity, end: false },
];

export function DashboardLayout() {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <header className="flex flex-col gap-3 border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <h1 className="shrink-0 whitespace-nowrap text-lg font-semibold">NLC Fleet Monitor</h1>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent-soft text-accent-soft-foreground'
                      : 'text-muted hover:bg-surface-secondary hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SocketConnectionIndicator />
          <SimulationControls />
          <div className="h-5 w-px bg-separator" aria-hidden />
          <ExportButtons />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

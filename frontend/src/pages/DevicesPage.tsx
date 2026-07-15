import { DeviceTable } from '../tables/DeviceTable';

export function DevicesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Devices</h2>
      <DeviceTable />
    </div>
  );
}

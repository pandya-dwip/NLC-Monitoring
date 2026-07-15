import { MqttMonitorTable } from '../tables/MqttMonitorTable';

export function MqttMonitorPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Live MQTT Monitor</h2>
      <MqttMonitorTable />
    </div>
  );
}

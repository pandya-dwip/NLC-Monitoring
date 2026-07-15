import { CommandsTable } from '../tables/CommandsTable';

export function CommandsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Live Commands</h2>
      <CommandsTable />
    </div>
  );
}

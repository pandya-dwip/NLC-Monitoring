import { buttonVariants } from '@heroui/react';
import { Download } from 'lucide-react';
import { API_URL } from '../lib/api';

const linkClass = buttonVariants({ variant: 'outline', size: 'sm' });

export function ExportButtons() {
  return (
    <div className="flex items-center gap-2">
      <a className={linkClass} href={`${API_URL}/api/export/csv`} download>
        <Download className="h-4 w-4" aria-hidden />
        CSV
      </a>
      <a className={linkClass} href={`${API_URL}/api/export/json`} download>
        <Download className="h-4 w-4" aria-hidden />
        JSON
      </a>
      <a className={linkClass} href={`${API_URL}/api/export/metrics`} download>
        <Download className="h-4 w-4" aria-hidden />
        Metrics
      </a>
      <a className={linkClass} href={`${API_URL}/api/export/logs`} download>
        <Download className="h-4 w-4" aria-hidden />
        Logs
      </a>
    </div>
  );
}

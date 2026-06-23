import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { HealthExportPanel } from '@/components/health/features/export-backup/health-export-panel';
import { Download } from 'lucide-react';

export default async function HealthExportPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-brand-primary">
          <Download className="h-5 w-5" />
          <span className="text-sm font-medium">Backup</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Exportar dados de saúde</h1>
        <p className="max-w-xl text-sm text-text-muted">
          Salve uma cópia dos seus dados de nutrição, calorias e controle de peso antes de migrar de
          projeto ou em caso de perda no Supabase.
        </p>
      </header>

      <HealthExportPanel />
    </div>
  );
}

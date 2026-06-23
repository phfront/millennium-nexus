import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { FinanceExportPanel } from '@/components/finance/features/export-backup/finance-export-panel';
import { Download } from 'lucide-react';

export default async function FinanceExportPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-brand-primary">
          <Download className="h-5 w-5" />
          <span className="text-sm font-medium">Backup</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Exportar dados financeiros</h1>
        <p className="max-w-xl text-sm text-text-muted">
          Salve uma cópia completa das suas planilhas e do histórico de meses fechados antes de migrar
          de projeto ou em caso de perda no Supabase.
        </p>
      </header>

      <FinanceExportPanel />
    </div>
  );
}

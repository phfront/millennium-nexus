import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@phfront/millennium-ui';
import { Construction } from 'lucide-react';
import type { Module } from '@/types/database';

interface ModulePageProps {
  params: Promise<{ module_slug: string }>;
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { module_slug } = await params;
  const user = await getUser();
  if (!user) notFound();

  const supabase = await createClient();

  const { data: moduleData } = await supabase
    .from('modules')
    .select('*')
    .eq('slug', module_slug)
    .single();

  const module = moduleData as Module | null;

  if (!module || !module.is_active) {
    notFound();
  }

  const { data: denial } = await supabase
    .from('user_module_denials')
    .select('module_id')
    .eq('user_id', user.id)
    .eq('module_id', module.id)
    .maybeSingle();

  if (denial) {
    notFound();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <EmptyState
        className="py-8 [&>div:first-child]:bg-brand-primary/10 [&>div:first-child]:text-brand-primary"
        icon={<Construction size={32} strokeWidth={1.75} aria-hidden />}
        title={module.label}
        description="Este módulo está sendo desenvolvido. Em breve estará disponível aqui."
        action={
          <span className="text-xs text-text-muted font-mono bg-surface-3 px-3 py-1.5 rounded-md">
            /{module_slug}
          </span>
        }
      />
    </div>
  );
}

export async function generateMetadata({ params }: ModulePageProps) {
  const { module_slug } = await params;
  return {
    title: `${module_slug} — Millennium Nexus`,
  };
}

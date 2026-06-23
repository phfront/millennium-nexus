'use client';

import { useTransition } from 'react';
import { Button, Card, useToast } from '@phfront/millennium-ui';
import { updateHomeModulePreference } from '@/app/(portal)/profile/actions';
import type { HomeModuleSlug } from '@/lib/navigation/home-module';

type HomeModuleOption = {
  value: HomeModuleSlug;
  label: string;
  description: string;
};

interface HomeModuleChooserProps {
  options: HomeModuleOption[];
}

export function HomeModuleChooser({ options }: HomeModuleChooserProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  if (options.length === 0) {
    return (
      <section className="mx-auto flex max-w-2xl justify-center">
        <Card className="w-full border border-border bg-surface-2">
          <Card.Body className="py-10 text-center">
            <h1 className="text-xl font-semibold text-text-primary">Nenhum módulo disponível</h1>
            <p className="mt-2 text-sm text-text-muted">
              Ative ao menos um módulo para definir uma home principal.
            </p>
          </Card.Body>
        </Card>
      </section>
    );
  }

  function handleChoose(moduleSlug: HomeModuleSlug) {
    startTransition(async () => {
      const result = await updateHomeModulePreference(moduleSlug);

      if (!result.success) {
        toast.error('Erro ao salvar home', result.error);
        return;
      }

      window.location.assign('/');
    });
  }

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Escolha sua home principal</h1>
        <p className="mt-2 text-sm text-text-muted">
          Defina qual dashboard deve abrir quando você entrar no portal.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {options.map((option) => (
          <Card key={option.value} className="border border-border bg-surface-2">
            <Card.Body className="flex h-full flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">{option.label}</h2>
                <p className="mt-1 text-sm text-text-muted">{option.description}</p>
              </div>
              <Button
                onClick={() => handleChoose(option.value)}
                isLoading={isPending}
                className="mt-auto"
              >
                Usar como home
              </Button>
            </Card.Body>
          </Card>
        ))}
      </div>
    </section>
  );
}

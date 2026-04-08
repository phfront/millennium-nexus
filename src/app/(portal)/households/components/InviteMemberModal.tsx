'use client';

import { useState, useTransition } from 'react';
import { inviteMember } from '@/lib/households/actions';
import { Button, Input } from '@phfront/millennium-ui';
import { UserPlus } from 'lucide-react';

interface InviteMemberModalProps {
  householdId: string;
  householdName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InviteMemberModal({
  householdId,
  householdName,
  onClose,
  onSuccess,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Digite um e-mail válido.');
      return;
    }

    startTransition(async () => {
      try {
        await inviteMember(householdId, email.trim());
        setSuccess(true);
        setEmail('');
        onSuccess?.();
        setTimeout(onClose, 1500);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === 'already_member') setError('Este utilizador já é membro do grupo.');
        else if (msg === 'already_invited') setError('Este e-mail já tem um convite pendente.');
        else setError('Erro ao enviar convite. Tente novamente.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface-2 border border-border shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Convidar membro</h2>
            <p className="text-xs text-text-muted mt-0.5">{householdName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
          >
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <UserPlus size={20} className="text-green-400" />
            </div>
            <p className="text-sm font-medium text-text-primary">Convite enviado!</p>
            <p className="text-xs text-text-muted">
              O utilizador receberá a notificação ao entrar no Nexus.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                E-mail do convidado
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@email.com"
                autoFocus
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                isLoading={isPending}
                disabled={isPending || !email.trim()}
              >
                Convidar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

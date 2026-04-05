'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import { Button, Input, Switch, Card, Avatar, Divider, Select, PageHeader, useToast } from '@phfront/millennium-ui';
import { normalizeBrandHex } from '@/lib/brand-colors';
import { parseSupabaseError } from '@/lib/errors';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useUserStore } from '@/store/user-store';
import { syncBrandCookieAction } from '@/app/actions/brand-cookie';
import { useThemeStore } from '@/store/useThemeStore';
import { createClient } from '@/lib/supabase/client';
import { Camera } from 'lucide-react';
import { PushNotificationsCard } from '@/components/push/PushNotificationsCard';
import { PwaInstallCard } from '@/components/pwa/PwaInstallCard';
import type { Profile } from '@/types/database';

const TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo',    label: 'Brasil — Brasília / São Paulo (UTC-3)' },
  { value: 'America/Manaus',       label: 'Brasil — Manaus / Amazonas (UTC-4)' },
  { value: 'America/Belem',        label: 'Brasil — Belém / Pará (UTC-3)' },
  { value: 'America/Fortaleza',    label: 'Brasil — Fortaleza (UTC-3)' },
  { value: 'America/Noronha',      label: 'Brasil — Fernando de Noronha (UTC-2)' },
  { value: 'America/Rio_Branco',   label: 'Brasil — Rio Branco / Acre (UTC-5)' },
  { value: 'America/Buenos_Aires', label: 'Argentina — Buenos Aires (UTC-3)' },
  { value: 'America/Santiago',     label: 'Chile — Santiago (UTC-3/-4)' },
  { value: 'America/Lima',         label: 'Peru — Lima (UTC-5)' },
  { value: 'America/Bogota',       label: 'Colômbia — Bogotá (UTC-5)' },
  { value: 'America/Caracas',      label: 'Venezuela — Caracas (UTC-4)' },
  { value: 'America/New_York',     label: 'EUA — Nova York / Leste (UTC-5/-4)' },
  { value: 'America/Chicago',      label: 'EUA — Chicago / Centro (UTC-6/-5)' },
  { value: 'America/Denver',       label: 'EUA — Denver / Montanha (UTC-7/-6)' },
  { value: 'America/Los_Angeles',  label: 'EUA — Los Angeles / Pacífico (UTC-8/-7)' },
  { value: 'America/Toronto',      label: 'Canadá — Toronto (UTC-5/-4)' },
  { value: 'America/Vancouver',    label: 'Canadá — Vancouver (UTC-8/-7)' },
  { value: 'America/Mexico_City',  label: 'México — Cidade do México (UTC-6/-5)' },
  { value: 'Europe/Lisbon',        label: 'Portugal — Lisboa (UTC+0/+1)' },
  { value: 'Europe/London',        label: 'Reino Unido — Londres (UTC+0/+1)' },
  { value: 'Europe/Paris',         label: 'França — Paris (UTC+1/+2)' },
  { value: 'Europe/Berlin',        label: 'Alemanha — Berlim (UTC+1/+2)' },
  { value: 'Europe/Madrid',        label: 'Espanha — Madri (UTC+1/+2)' },
  { value: 'Europe/Rome',          label: 'Itália — Roma (UTC+1/+2)' },
  { value: 'Europe/Moscow',        label: 'Rússia — Moscou (UTC+3)' },
  { value: 'Asia/Dubai',           label: 'Emirados — Dubai (UTC+4)' },
  { value: 'Asia/Kolkata',         label: 'Índia — Calcutá (UTC+5:30)' },
  { value: 'Asia/Bangkok',         label: 'Tailândia — Bangkok (UTC+7)' },
  { value: 'Asia/Shanghai',        label: 'China — Xangai (UTC+8)' },
  { value: 'Asia/Tokyo',           label: 'Japão — Tóquio (UTC+9)' },
  { value: 'Australia/Sydney',     label: 'Austrália — Sydney (UTC+10/+11)' },
  { value: 'UTC',                  label: 'UTC (coordenado universal)' },
];

export default function ProfilePage() {
  const user = useCurrentUser();
  const setUser = useUserStore((s) => s.setUser);
  const profile = user?.profile ?? null;

  const { theme, setTheme } = useThemeStore();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'America/Sao_Paulo');
  const [brandPrimary, setBrandPrimary] = useState<string | null>(profile?.brand_primary_hex ?? null);
  const [brandSecondary, setBrandSecondary] = useState<string | null>(profile?.brand_secondary_hex ?? null);
  const [brandPrimaryText, setBrandPrimaryText] = useState(profile?.brand_primary_hex ?? '');
  const [brandSecondaryText, setBrandSecondaryText] = useState(profile?.brand_secondary_hex ?? '');
  const [isSaving, startSaving] = useTransition();
  const [isSavingColors, startSavingColors] = useTransition();
  const [isResettingPassword, startResetPassword] = useTransition();
  const [isResettingBrand, startResetBrand] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setAvatarUrl(profile.avatar_url ?? null);
      setTimezone(profile.timezone ?? 'America/Sao_Paulo');
      setBrandPrimary(profile.brand_primary_hex ?? null);
      setBrandSecondary(profile.brand_secondary_hex ?? null);
      setBrandPrimaryText(profile.brand_primary_hex ?? '');
      setBrandSecondaryText(profile.brand_secondary_hex ?? '');
    }
  }, [profile]);

  const DEFAULT_PRIMARY_PREVIEW = '#006437';
  const DEFAULT_SECONDARY_PREVIEW = '#beac4d';

  function updateProfileInStore(newProfile: Profile) {
    if (user) setUser({ ...user, profile: newProfile });
  }

  async function handleSaveProfile() {
    startSaving(async () => {
      if (!user) return;
      const supabase = createClient();

      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, avatar_url: avatarUrl, timezone, updated_at: new Date().toISOString() } as never)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        toast.error('Erro ao salvar', parseSupabaseError(error));
      } else {
        updateProfileInStore(data as Profile);
        toast.success('Salvo!', 'Suas alterações foram salvas com sucesso.');
      }
    });
  }

  async function handleResetBrandColors() {
    startResetBrand(async () => {
      if (!user) return;
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .update({
          brand_primary_hex: null,
          brand_secondary_hex: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        toast.error('Erro ao repor cores', parseSupabaseError(error));
        return;
      }
      setBrandPrimary(null);
      setBrandSecondary(null);
      setBrandPrimaryText('');
      setBrandSecondaryText('');
      updateProfileInStore(data as Profile);
      await syncBrandCookieAction(null, null);
      toast.success('Cores repostas', 'Primária e secundária voltaram ao padrão do tema.');
    });
  }

  async function saveBrandColors() {
    if (!user) return;
    const p = brandPrimaryText.trim() === '' ? null : normalizeBrandHex(brandPrimaryText);
    const s = brandSecondaryText.trim() === '' ? null : normalizeBrandHex(brandSecondaryText);
    if (brandPrimaryText.trim() !== '' && p === null) {
      toast.error('Hex inválido', 'Use formato #RRGGBB na cor primária ou deixe vazio.');
      return;
    }
    if (brandSecondaryText.trim() !== '' && s === null) {
      toast.error('Hex inválido', 'Use formato #RRGGBB na cor secundária ou deixe vazio.');
      return;
    }

    startSavingColors(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .update({
          brand_primary_hex: p,
          brand_secondary_hex: s,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        toast.error('Erro ao salvar cores', parseSupabaseError(error));
        return;
      }
      setBrandPrimary(p);
      setBrandSecondary(s);
      if (p) setBrandPrimaryText(p);
      else setBrandPrimaryText('');
      if (s) setBrandSecondaryText(s);
      else setBrandSecondaryText('');
      updateProfileInStore(data as Profile);
      await syncBrandCookieAction(p, s);
      toast.success('Cores salvas!');
    });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Erro no upload', parseSupabaseError(uploadError));
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl } as never)
      .eq('id', user.id);

    if (updateError) {
      toast.error('Erro ao salvar avatar', parseSupabaseError(updateError));
      return;
    }

    setAvatarUrl(publicUrl);
    if (profile) updateProfileInStore({ ...profile, avatar_url: publicUrl });
    toast.success('Avatar atualizado!');
  }

  async function handleResetPassword() {
    if (!user?.email) return;
    startResetPassword(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/profile`,
      });
      if (error) {
        toast.error('Erro', parseSupabaseError(error));
      } else {
        toast.success('E-mail enviado!', 'Verifique sua caixa de entrada para redefinir a senha.');
      }
    });
  }

  async function handleThemeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTheme: 'dark' | 'light' = e.target.checked ? 'dark' : 'light';
    setTheme(newTheme);

    if (!user) return;
    const supabase = createClient();
    await supabase
      .from('profiles')
      .update({ theme_preference: newTheme } as never)
      .eq('id', user.id);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        className="mb-0"
        title="Perfil & Configurações"
        subtitle="Gerencie seus dados pessoais e preferências."
      />

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-text-primary">Dados Pessoais</h2>
        </Card.Header>
        <Card.Body className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar
                src={avatarUrl}
                name={fullName || profile?.full_name || undefined}
                size="xl"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-primary text-white flex items-center justify-center hover:bg-(--color-brand-primary-hover) transition-colors shadow-md"
                aria-label="Alterar foto"
              >
                <Camera size={12} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                {fullName || 'Sem nome'}
              </p>
              <p className="text-xs text-text-muted">{user?.email}</p>
            </div>
          </div>

          <Divider />

          <Input
            label="Nome completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Seu nome completo"
          />

          <Input
            label="E-mail"
            type="email"
            value={user?.email ?? ''}
            disabled
            helperText="O e-mail não pode ser alterado diretamente."
          />
        </Card.Body>
        <Card.Footer className="justify-end">
          <Button onClick={handleSaveProfile} isLoading={isSaving}>
            Salvar alterações
          </Button>
        </Card.Footer>
      </Card>

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-text-primary">Segurança</h2>
        </Card.Header>
        <Card.Body className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Alterar senha</p>
            <p className="text-xs text-text-muted mt-0.5">
              Um e-mail de redefinição será enviado para {user?.email}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetPassword}
            isLoading={isResettingPassword}
          >
            Redefinir senha
          </Button>
        </Card.Body>
      </Card>

      <PwaInstallCard />

      <PushNotificationsCard />

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-text-primary">Cores da marca</h2>
        </Card.Header>
        <Card.Body className="space-y-5">
          <p className="text-xs text-text-muted">
            Personalize a cor primária e secundária da interface. Os valores são guardados na sua conta e espelhados num
            cookie para carregar mais depressa.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Primária</p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  aria-label="Cor primária"
                  value={brandPrimary ?? DEFAULT_PRIMARY_PREVIEW}
                  onChange={(e) => {
                    const v = normalizeBrandHex(e.target.value);
                    if (v) {
                      setBrandPrimary(v);
                      setBrandPrimaryText(v);
                    }
                  }}
                  className="h-10 w-14 cursor-pointer rounded-md border border-border bg-surface-2 p-0.5"
                />
                <Input
                  label="Hex"
                  value={brandPrimaryText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setBrandPrimaryText(raw);
                    const v = normalizeBrandHex(raw);
                    if (v) setBrandPrimary(v);
                    if (raw.trim() === '') setBrandPrimary(null);
                  }}
                  placeholder="#006437 ou vazio = padrão"
                  className="flex-1 min-w-32"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Secundária</p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  aria-label="Cor secundária"
                  value={brandSecondary ?? DEFAULT_SECONDARY_PREVIEW}
                  onChange={(e) => {
                    const v = normalizeBrandHex(e.target.value);
                    if (v) {
                      setBrandSecondary(v);
                      setBrandSecondaryText(v);
                    }
                  }}
                  className="h-10 w-14 cursor-pointer rounded-md border border-border bg-surface-2 p-0.5"
                />
                <Input
                  label="Hex"
                  value={brandSecondaryText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setBrandSecondaryText(raw);
                    const v = normalizeBrandHex(raw);
                    if (v) setBrandSecondary(v);
                    if (raw.trim() === '') setBrandSecondary(null);
                  }}
                  placeholder="#beac4d ou vazio = padrão"
                  className="flex-1 min-w-32"
                />
              </div>
            </div>
          </div>
        </Card.Body>
        <Card.Footer className="justify-between flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleResetBrandColors} isLoading={isResettingBrand}>
            Repor padrão do tema
          </Button>
          <Button onClick={saveBrandColors} isLoading={isSavingColors}>
            Salvar cores
          </Button>
        </Card.Footer>
      </Card>

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-text-primary">Preferências</h2>
        </Card.Header>
        <Card.Body className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Modo escuro</p>
              <p className="text-xs text-text-muted mt-0.5">
                Preferência salva na sua conta
              </p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onChange={handleThemeChange}
              aria-label="Alternar modo escuro"
            />
          </div>

          <Divider />

          <Select
            label="Fuso horário"
            value={timezone}
            options={TIMEZONE_OPTIONS}
            onChange={(v) => setTimezone(v)}
            helperText="Usado para calcular o dia correto nas metas e registros."
          />
        </Card.Body>
        <Card.Footer className="justify-end">
          <Button onClick={handleSaveProfile} isLoading={isSaving}>
            Salvar preferências
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

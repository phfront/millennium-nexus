# Millennium Nexus — Ambiente 100% local

Plano e guia para rodar **Supabase (Docker) + Next.js (host) + Tailscale (VPN)** na sua máquina, com até **3 usuários**, **$0 de cloud**.

---

## Arquitetura

```text
┌─ Windows (servidor) ──────────────────────────────────────┐
│  Tailscale (nativo)          → HTTPS para celular/PC     │
│  Next.js :3030 (Node)        → app + /api/cron/push      │
│  Task Scheduler              → cron push (15–30 min)     │
│  scripts/backup-db.ps1       → pg_dump diário            │
│                                                          │
│  ┌─ Docker (supabase start) ──────────────────────────┐   │
│  │  Postgres · Auth · PostgREST · Storage · Studio   │   │
│  │  :15021 API · :15022 DB · :15023 Studio           │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

| Componente | Docker? | Porta |
|------------|---------|-------|
| Postgres + Auth + API + Storage | **Sim** (`supabase start`) | 15021–15024 |
| Next.js (Nexus) | **Não** (Node no host) | 3030 |
| Tailscale | **Não** (app Windows) | — |
| Cron / backup | **Não** (scripts `.ps1`) | — |

---

## Fases de implementação

### Fase 0 — Pré-requisitos (você, uma vez)

- [ ] **Docker Desktop** instalado e rodando
- [ ] **Supabase CLI** (`supabase --version`)
- [ ] **Node.js 22+** + `npm install` no `millennium-nexus`
- [ ] **Tailscale** instalado ([tailscale.com](https://tailscale.com)) — plano Personal free (até 6 users)
- [ ] Exportar backups JSON (finance/health) e/ou `pg_dump` da cloud **antes** de desligar Supabase

### Fase 1 — Stack local (repo + scripts) ✅ neste PR

- [x] `supabase/config.toml` — auth na porta 3030, redirects Tailscale
- [x] `supabase/seed.sql` — bucket avatars, módulos ativos
- [x] `.env.local.example` — template de variáveis
- [x] `scripts/local-up.ps1` — sobe Supabase + gera `.env.local`
- [x] `scripts/local-down.ps1` — para containers
- [x] `scripts/local-status.ps1` — URLs e keys
- [x] `scripts/backup-db.ps1` / `restore-db.ps1`
- [x] `scripts/tailscale-serve.ps1` — expõe Next com HTTPS
- [x] `scripts/cron-push.ps1` — dispara push (Task Scheduler)
- [x] `src/app/api/cron/push/route.ts` — push no Next (substitui Edge Function)
- [x] `src/lib/push/send-push-notifications.ts` — lógica portada da Edge Function
- [x] `npm run local:*` — atalhos no package.json

### Fase 2 — Primeiro boot (você, ~30 min)

```powershell
cd C:\projects\millennium\millennium-nexus

# 1. Sobe Supabase + aplica 59 migrations + seed
npm run local:up

# 2. Copie VAPID e CRON_SECRET do .env.local.example para .env.local
#    (local-up preenche Supabase keys automaticamente)

# 3. App
npm run dev

# 4. Studio (criar usuários, ver dados)
#    http://127.0.0.1:15023

# 5. App
#    http://127.0.0.1:3030
```

**Criar 3 usuários:**

1. Pelo app (`/login` → cadastro, se habilitado) **ou**
2. Studio → Authentication → Add user **ou**
3. Inbucket (e-mails locais): http://127.0.0.1:15024

**Ativar módulos por usuário:** `/modules` no app (após login).

### Fase 3 — Restaurar dados da cloud

**Opção A — automático (recomendado)**

Copia usuários (`auth`), dados do app (`public`), metadados de arquivos (`storage`) e o bucket `avatars`:

```powershell
# 1. Login na CLI (uma vez):
supabase login

# 2. Local ja rodando (npm run local:up)

# 3. Pull da cloud (pede senha do Postgres da cloud):
npm run local:cloud-pull
```

Senha: Supabase Dashboard → **Project Settings → Database → Database password**.

Opcional no `.env` (gitignored): `SUPABASE_DB_PASSWORD=sua-senha` para nao digitar toda vez.

No Windows, a conexao direta `db.*.supabase.co` costuma falhar (IPv6). O script usa o **Session pooler** (IPv4). Se ainda falhar, copie a connection string do Dashboard (**Session pooler**) para `SUPABASE_DB_URL` no `.env`.

Flags uteis:

```powershell
# Pular arquivos do Storage (so banco):
powershell -ExecutionPolicy Bypass -File ./scripts/cloud-to-local.ps1 -SkipStorage

# Sem confirmacao:
powershell -ExecutionPolicy Bypass -File ./scripts/cloud-to-local.ps1 -Force
```

**Opção B — pg_dump manual (se a cloud nao responde via CLI)**

```powershell
# Dashboard → Database → Backups ou connection string direta:
pg_dump "postgresql://postgres.[ref]:[password]@...:5432/postgres" -Fc -f cloud.dump

npm run local:restore -- backups\cloud.dump
```

**Opção C — JSON export (finance + health)**

Importadores JSON: **fase futura** (export já existe em `/finance/export` e `/health/export`).

### Fase 4 — Acesso remoto

#### Opção A — Tailscale privado (mais seguro, app no celular)

```powershell
# No PC servidor (com Next rodando):
npm run local:tailscale

# Painel Tailscale → Invite → e-mail dos 2 outros usuários
# Cada um instala Tailscale no celular/PC
# Acessam a URL https://<machine>.<tailnet>.ts.net
```

**Auth redirects:** adicione sua URL Tailscale em `supabase/config.toml` → `[auth] additional_redirect_urls` e rode `supabase stop && supabase start`.

#### Opção B — URL fixa (recomendado se o PC reinicia)

**Tailscale Funnel** gera URL permanente `https://seu-pc.seu-tailnet.ts.net` — não muda ao reiniciar.

Setup **uma vez**:

```powershell
# 1. Tailscale instalado e logado
# 2. App rodando
npm run dev   # ou npm run local:prod para 24/7

# 3. Configura URL fixa + token + redirects
npm run tunnel:setup

# 4. Autostart apos login no Windows
npm run tunnel:install-autostart
```

Link salvo em `tunnels/access-link.txt` (gitignored). Guarde nos favoritos do celular.

Após reiniciar o PC: Docker + Tailscale sobem → Task Scheduler roda `tunnel:autostart` → funnel reativa a **mesma URL**.

#### Opção D - Produção local automática no login do Windows

Se você quer subir **backend + frontend em modo produção** ao entrar no Windows, sem abrir terminais:

```powershell
# Uma vez: registra a tarefa no Agendador
npm run prod:install-autostart

# Teste manual imediato
npm run prod:autostart
```

Pré-requisitos:

- Docker Desktop configurado para iniciar com o Windows
- `.env.local` já preenchido
- Build do Next gerada ao menos uma vez, ou o script fará `npm run build` quando necessário

Logs: `logs/prod-autostart.log`

#### Opção C — Cloudflare quick tunnel (URL temporaria, muda a cada sessao)

Expõe **só o Next (3030)**. O Supabase local passa pelo proxy `/supabase-api` — **não** abra a porta 15021 na internet.

Camadas de segurança:

1. **`TUNNEL_ACCESS_TOKEN`** — link secreto antes do login (`/?tunnel_token=...`)
2. **Login do app** — middleware Supabase
3. **(Opcional) Cloudflare Access** — OTP no seu e-mail, com domínio próprio

**Cloudflare (rápido, grátis):**

```powershell
# Terminal 1 — app local
npm run dev

# Terminal 2 — túnel (copie a URL *.trycloudflare.com)
npm run tunnel:cloudflare

# Terminal 3 — configura .env.local e gera link com token
npm run tunnel:env -- https://SUA-URL.trycloudflare.com

# Adicione a URL em supabase/config.toml → additional_redirect_urls
# Reinicie Supabase sem reset: npm run local:down && npm run local:up -SkipReset
# Reinicie o Next (Ctrl+C + npm run dev)
# Abra no celular o link com tunnel_token que o script imprimiu
```

**Tailscale Funnel (mesma ideia, URL *.ts.net):**

```powershell
npm run tunnel:funnel
npm run tunnel:env -- https://seu-pc.seu-tailnet.ts.net
```

**Desligar túnel:**

```powershell
npm run tunnel:down
# + Ctrl+C no cloudflared, se estiver rodando
```

**Cloudflare Access (máxima segurança sem app):** crie um túnel nomeado no painel Cloudflare Zero Trust, aponte um subdomínio seu (ex. `dev.seudominio.com`) e adicione política Access → *Allow* → *Emails* → seu e-mail. Aí dispensa o `tunnel_token` (pode remover `TUNNEL_ACCESS_TOKEN` do `.env.local`).

### Fase 5 — Push notifications

```powershell
# Task Scheduler: a cada 15 min
# Programa: powershell.exe
# Argumentos: -ExecutionPolicy Bypass -File C:\...\scripts\cron-push.ps1
```

Requisitos:

- `CRON_SECRET` no `.env.local`
- `NEXT_PUBLIC_VAPID_*` + `VAPID_PRIVATE_KEY`
- HTTPS (Tailscale Serve) para push no celular — **localhost OK só no PC**

### Fase 6 — Backup automático

```powershell
# Task Scheduler: diário 03:00
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
```

Backups em `backups/` (gitignored). Copie para nuvem/disco externo.

### Fase 7 — Desligar Supabase Cloud

Somente após:

- [ ] 3 usuários logam no local
- [ ] Dados restaurados e conferidos
- [ ] Backup local testado (`restore-db.ps1` em ambiente de teste)
- [ ] Tailscale OK no celular

---

## Variáveis de ambiente (`.env.local`)

| Variável | Origem |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:15021` — gerado por `local-up.ps1` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase status` |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase status` |
| `CRON_SECRET` | string longa aleatória (você define) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `npm run generate-vapid` ou reuse da cloud |
| `VAPID_PRIVATE_KEY` | idem |
| `VAPID_SUBJECT` | `mailto:seu@email.com` |

---

## Comandos úteis

| Comando | Ação |
|---------|------|
| `npm run local:dev` | Sobe Supabase sem resetar dados + inicia o Next.js |
| `npm run local:prod` | Sobe Supabase sem resetar dados + build + Next.js em produção |
| `npm run local:up` | Sobe Supabase + migrations + `.env.local` |
| `npm run local:down` | Para Supabase |
| `npm run local:status` | URLs, keys, health |
| `npm run local:backup` | pg_dump → `backups/` |
| `npm run local:restore -- arquivo.dump` | Restaura dump |
| `npm run local:cloud-pull` | Copia cloud → local (DB + avatars) |
| `npm run local:tailscale` | HTTPS na tailnet (Tailscale no celular) |
| `npm run tunnel:cloudflare` | Túnel público Cloudflare (só browser) |
| `npm run tunnel:funnel` | Túnel público Tailscale Funnel |
| `npm run tunnel:setup` | URL fixa Tailscale + `.env.local` + redirects (1x) |
| `npm run tunnel:autostart` | Sobe stack + funnel (pos-reboot) |
| `npm run tunnel:install-autostart` | Agenda autostart no login do Windows |
| `npm run prod:autostart` | Sobe stack local + Next em producao |
| `npm run prod:install-autostart` | Agenda backend + frontend em producao no login |
| `npm run tunnel:down` | Desliga funnel e restaura `.env.local` local |
| `npm run dev` | Next.js dev |
| `npm run build && npm start` | Next produção |

---

## Custos

| Item | Custo |
|------|-------|
| Supabase local | $0 |
| Tailscale (≤3 users) | $0 |
| Push (VAPID) | $0 |
| Supabase Cloud | cancelar após migração |
| Eletricidade PC 24/7 | variável |

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Docker não sobe | Verificar Docker Desktop rodando |
| `supabase start` falha | `supabase stop --no-backup` e tentar de novo |
| Login redirect loop | Conferir `site_url` e `additional_redirect_urls` no `config.toml` |
| Push não funciona no celular | Precisa HTTPS via Tailscale Serve |
| Módulos vazios | `/modules` → ativar; conferir `seed.sql` |
| Migration falha | `supabase db reset` (apaga dados locais) |

---

## O que **não** está nesta fase

- Import JSON (finance/health) — planejado
- Dockerizar Next.js — opcional, não necessário para 3 users
- SMTP produção — usar Inbucket local ou configurar `[auth.email.smtp]` no `config.toml`
- Edge Functions Supabase — substituídas por `/api/cron/push`

---

## Checklist final “100% local”

- [ ] Fase 0–1 concluídas
- [ ] Dados migrados (dump ou manual)
- [ ] 3 contas funcionando
- [ ] Tailscale + HTTPS
- [ ] Backup diário agendado
- [ ] Cron push (opcional) agendado
- [ ] Supabase Cloud cancelado/pausado

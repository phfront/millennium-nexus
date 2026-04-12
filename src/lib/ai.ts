/**
 * AI Provider utilities — lightweight fetch-based calls
 * No external SDKs needed, keeps bundle size minimal.
 */

export type AIProvider = 'openai' | 'gemini';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

// ─── Model Catalogs ────────────────────────────────────

export const AI_MODELS: Record<AIProvider, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido e barato)' },
    { value: 'gpt-4o', label: 'GPT-4o (melhor qualidade)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (mais barato)' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (rápido)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (recomendado)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (melhor qualidade)' },
  ],
};

export const AI_PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
];

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
};

// ─── System Prompt for Study Plan Generation ───────────

export const STUDY_PLAN_SYSTEM_PROMPT = `Você é um especialista em criar planos de estudo estruturados e detalhados.
Gere o plano no formato Markdown seguindo EXATAMENTE esta estrutura:

# Nome do Módulo
## Dia 1 - Título do dia
Conteúdo explicativo/instruções do dia aqui. Pode incluir contexto, links sugeridos, conceitos a dominar.

- [ ] Tarefa 1
  Descrição detalhada da tarefa com instruções claras
- [ ] Tarefa 2
  Descrição detalhada

# Outro Módulo
## Dia 2 - Título
...

REGRAS OBRIGATÓRIAS:
- Use "# " (H1) para módulos/seções temáticas
- Use "## Dia N - Título" para cada dia (N é sequencial global)
- Use "- [ ] " para tarefas de cada dia
- Indente com 2 espaços para descrições das tarefas
- Crie um plano REALISTA e DETALHADO
- Cada dia deve ter entre 2-5 tarefas
- Inclua instruções/contexto antes das tarefas de cada dia
- Organize em módulos temáticos lógicos
- Responda APENAS com o Markdown, sem explicações extras`;

// ─── Provider Call Functions ───────────────────────────

export async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error?.error?.message || `OpenAI API error: ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error?.error?.message || `Gemini API error: ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ─── Unified Call ──────────────────────────────────────

export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  switch (config.provider) {
    case 'openai':
      return callOpenAI(config.apiKey, config.model, systemPrompt, userPrompt);
    case 'gemini':
      return callGemini(config.apiKey, config.model, systemPrompt, userPrompt);
    default:
      throw new Error(`Provedor de IA não suportado: ${config.provider}`);
  }
}

// ─── Test Connection ───────────────────────────────────

export async function testAIConnection(config: AIConfig): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callAI(config, 'Responda apenas: OK', 'Teste de conexão');
    if (result && result.length > 0) {
      return { success: true, message: `Conexão OK! Modelo ${config.model} respondeu com sucesso.` };
    }
    return { success: false, message: 'Resposta vazia do provedor.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Falha na conexão.' };
  }
}

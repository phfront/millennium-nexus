'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Textarea, Select, Badge } from '@phfront/millennium-ui';
import { Sparkles, Loader2, AlertCircle, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { createLearningPlan, getUserAIConfig, saveFullLearningPlan } from '../actions';
import { parseMarkdownToPlan } from '@/lib/learningMarkdownParser';

export default function CreateLearningPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [schedulingType, setSchedulingType] = useState('relative');

  // AI state
  const [aiConfig, setAiConfig] = useState<{ ai_provider: string | null; ai_model: string | null } | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showAISection, setShowAISection] = useState(false);

  // Load AI config on mount
  useEffect(() => {
    getUserAIConfig().then(setAiConfig);
  }, []);

  const hasAI = aiConfig?.ai_provider && aiConfig?.ai_model;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const plan = await createLearningPlan(formData);
      router.push(`/learning/${plan.id}/edit`);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar plano.');
      setLoading(false);
    }
  }

  async function handleGenerateWithAI(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsGenerating(true);
    setAiError('');

    try {
      const formData = new FormData(e.currentTarget);
      const title = formData.get('title') as string;
      const description = formData.get('description') as string;

      if (!title?.trim()) {
        setAiError('Preencha o título do plano antes de gerar.');
        setIsGenerating(false);
        return;
      }

      if (!aiPrompt?.trim() || aiPrompt.trim().length < 10) {
        setAiError('Descreva o que quer estudar com pelo menos 10 caracteres.');
        setIsGenerating(false);
        return;
      }

      // Build a rich prompt combining title + description + user prompt
      const fullPrompt = [
        `Título do plano: ${title}`,
        description ? `Descrição/Objetivo: ${description}` : '',
        `\nInstruções do usuário:\n${aiPrompt}`,
      ].filter(Boolean).join('\n');

      // 1. Call AI to generate the plan markdown
      const aiResponse = await fetch('/api/ai/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt }),
      });

      const aiData = await aiResponse.json();

      if (!aiResponse.ok) {
        throw new Error(aiData.error || 'Erro ao gerar plano com IA.');
      }

      // 2. Create the plan in the database
      const plan = await createLearningPlan(formData);

      // 3. Save the generated content
      const parsedPlan = aiData.parsedPlan || parseMarkdownToPlan(aiData.markdown);
      await saveFullLearningPlan(plan.id, parsedPlan, null, {
        title,
        description: description || undefined,
      });

      // 4. Redirect to editor for review
      router.push(`/learning/${plan.id}/edit`);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Erro inesperado ao gerar plano.');
      setIsGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Novo Plano de Aprendizado</h2>
        <p className="text-text-secondary mt-1">Crie a estrutura base do seu plano. Depois você poderá organizar os dias e as tarefas.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={showAISection && hasAI ? handleGenerateWithAI : handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="title" className="text-sm font-medium text-text-primary">Título do Plano</label>
            <Input 
              id="title" 
              name="title" 
              placeholder="Ex: Plano de 30 dias — Crypto + Trading" 
              required 
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="text-sm font-medium text-text-primary">Descrição / Objetivo</label>
            <Textarea 
              id="description" 
              name="description" 
              placeholder="Desenvolver repertório de mercado crypto, trading e produto..." 
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Tipo de Agendamento</label>
            <input type="hidden" name="scheduling_type" value={schedulingType} />
            <Select 
              options={[
                { value: 'relative', label: 'Ritmo Livre (Dia 1, Dia 2, sem forçar data fixa)' },
                { value: 'calendar', label: 'Calendário (Dias fixos na agenda)' }
              ]} 
              value={schedulingType}
              onChange={setSchedulingType}
              placeholder="Selecione..."
            />
            <p className="text-xs text-text-secondary mt-1">
              "Ritmo Livre" não te penaliza se você ficar dias sem estudar. Sempre que voltar, fará o próximo dia do plano.
            </p>
          </div>

          {/* AI Section */}
          <div className="border-t border-border pt-4 mt-4">
            <button
              type="button"
              onClick={() => setShowAISection(!showAISection)}
              className="flex items-center gap-2 w-full text-left group cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-brand-primary/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-sm font-semibold text-text-primary group-hover:text-brand-primary transition-colors">
                  Gerar com IA
                </span>
                <Badge variant="info" className="text-[10px] px-1.5 py-0">Beta</Badge>
              </div>
              {showAISection 
                ? <ChevronUp className="w-4 h-4 text-text-muted" />
                : <ChevronDown className="w-4 h-4 text-text-muted" />
              }
            </button>

            {showAISection && (
              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {!hasAI ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
                    <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-warning">IA não configurada</p>
                      <p className="text-xs text-text-secondary">
                        Configure seu provedor de IA e API Key em{' '}
                        <a href="/profile" className="text-brand-primary underline hover:no-underline">
                          Perfil & Configurações
                        </a>{' '}
                        para usar esta funcionalidade.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text-primary block">
                        Descreva o que quer estudar
                      </label>
                      <Textarea
                        value={aiPrompt}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAiPrompt(e.target.value)}
                        placeholder={`Ex: Quero um plano de 30 dias para aprender React do zero ao avançado.\n\nInclua: fundamentos, hooks, state management, testes, deploy.\nNível: iniciante com experiência em JavaScript.\nTempo por dia: ~2 horas.`}
                        rows={5}
                      />
                      <p className="text-xs text-text-muted">
                        Quanto mais detalhado o prompt, melhor o plano gerado. Inclua: tema, duração, nível, tempo disponível.
                      </p>
                    </div>

                    {aiError && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{aiError}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <p className="text-xs text-text-muted">
                        Usando <span className="font-medium text-text-secondary">{aiConfig.ai_provider === 'openai' ? 'OpenAI' : 'Gemini'}</span> • {aiConfig.ai_model}
                      </p>
                      <Button type="submit" disabled={isGenerating || !aiPrompt.trim()} className="gap-2">
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Gerando plano...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4" />
                            Gerar Plano com IA
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer buttons */}
          {(!showAISection || !hasAI) && (
            <div className="pt-4 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => router.back()} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Criando...' : 'Criar Plano e Adicionar Dias'}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}

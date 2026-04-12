import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAI, STUDY_PLAN_SYSTEM_PROMPT } from '@/lib/ai';
import { parseMarkdownToPlan } from '@/lib/learningMarkdownParser';
import type { AIProvider } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
      return NextResponse.json(
        { error: 'O prompt deve ter pelo menos 10 caracteres.' },
        { status: 400 }
      );
    }

    // Fetch user's AI config
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('ai_provider, ai_api_key, ai_model')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Erro ao buscar configurações do perfil.' },
        { status: 500 }
      );
    }

    if (!profile.ai_provider || !profile.ai_api_key) {
      return NextResponse.json(
        { error: 'Configure seu provedor de IA e API Key nas configurações do perfil.' },
        { status: 400 }
      );
    }

    // Call AI provider
    const markdown = await callAI(
      {
        provider: profile.ai_provider as AIProvider,
        apiKey: profile.ai_api_key,
        model: profile.ai_model || 'gpt-4o-mini',
      },
      STUDY_PLAN_SYSTEM_PROMPT,
      prompt
    );

    // Parse the generated markdown to validate structure
    const parsedPlan = parseMarkdownToPlan(markdown);

    return NextResponse.json({
      markdown,
      parsedPlan,
    });
  } catch (error: any) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar plano com IA.' },
      { status: 500 }
    );
  }
}

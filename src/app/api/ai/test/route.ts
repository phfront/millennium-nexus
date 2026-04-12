import { NextRequest, NextResponse } from 'next/server';
import { testAIConnection } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, model } = await request.json();

    if (!provider || !apiKey || !model) {
      return NextResponse.json(
        { success: false, message: 'Provedor, API Key e modelo são obrigatórios.' },
        { status: 400 }
      );
    }

    const result = await testAIConnection({
      provider: provider as AIProvider,
      apiKey,
      model,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Erro ao testar conexão.' },
      { status: 500 }
    );
  }
}

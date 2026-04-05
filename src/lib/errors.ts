export type AppError = {
  code: string;
  message: string;
  details?: unknown;
};

import type { ZodError } from 'zod';

const SUPABASE_ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'E-mail não confirmado. Verifique sua caixa de entrada.',
  'User already registered': 'Este e-mail já está cadastrado.',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
  'Token has expired or is invalid': 'O link expirou ou é inválido. Solicite um novo.',
  'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'invalid_grant': 'Sessão inválida. Faça login novamente.',
  'over_email_send_rate_limit': 'Limite de envios atingido. Aguarde alguns minutos.',
  'signup_disabled': 'Cadastro de novos usuários está desativado.',
  'weak_password': 'Senha muito fraca. Use letras maiúsculas, minúsculas e números.',
};

export function parseSupabaseError(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado.';
  const message =
    (error as { message?: string })?.message ??
    (error as { error_description?: string })?.error_description ??
    String(error);
  return SUPABASE_ERROR_MESSAGES[message] ?? 'Ocorreu um erro inesperado. Tente novamente.';
}

export function parseZodError(error: ZodError): Record<string, string> {
  return error.errors.reduce<Record<string, string>>((acc, issue) => {
    const field = issue.path.join('.') || '_root';
    if (!acc[field]) acc[field] = issue.message;
    return acc;
  }, {});
}

export function createAppError(code: string, message: string, details?: unknown): AppError {
  return { code, message, details };
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as AppError).code === 'string' &&
    typeof (error as AppError).message === 'string'
  );
}

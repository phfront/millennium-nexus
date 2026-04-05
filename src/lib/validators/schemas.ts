import { z } from 'zod';
import { isValidCPF, isValidCNPJ } from './functions';

export const emailSchema = z
  .string()
  .min(1, 'E-mail é obrigatório')
  .email('E-mail inválido');

export const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
  .regex(/[0-9]/, 'Senha deve conter ao menos um número');

export const cpfSchema = z
  .string()
  .min(1, 'CPF é obrigatório')
  .refine((val) => isValidCPF(val), { message: 'CPF inválido' });

export const cnpjSchema = z
  .string()
  .min(1, 'CNPJ é obrigatório')
  .refine((val) => isValidCNPJ(val), { message: 'CNPJ inválido' });

export const phoneSchema = z
  .string()
  .min(1, 'Telefone é obrigatório')
  .regex(
    /^(\(?\d{2}\)?\s?)(\d{4,5}[-\s]?\d{4})$/,
    'Telefone inválido. Use o formato (XX) XXXXX-XXXX',
  );

export const cepSchema = z
  .string()
  .min(1, 'CEP é obrigatório')
  .regex(/^\d{5}-?\d{3}$/, 'CEP inválido. Use o formato XXXXX-XXX');

export const urlSchema = z
  .string()
  .min(1, 'URL é obrigatória')
  .url('URL inválida')
  .startsWith('https://', 'URL deve começar com https://');

export const uuidSchema = z
  .string()
  .uuid('UUID inválido');

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  theme_preference: 'dark' | 'light';
  /** IANA timezone identifier (ex: 'America/Sao_Paulo'). Default: 'America/Sao_Paulo'. */
  timezone: string;
  /** Cor primária da marca (`#rrggbb`). Null = padrão do tema. */
  brand_primary_hex: string | null;
  /** Cor secundária da marca (`#rrggbb`). Null = padrão do tema. */
  brand_secondary_hex: string | null;
  updated_at: string;
  is_admin: boolean;
  email: string | null;
  /** Provedor de IA: openai, gemini */
  ai_provider: 'openai' | 'gemini' | null;
  /** Chave de API para o provedor de IA */
  ai_api_key: string | null;
  /** Modelo preferido (ex: gpt-4o-mini, gemini-2.0-flash) */
  ai_model: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  profile: Profile | null;
};

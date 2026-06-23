export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  theme_preference: 'dark' | 'light';
  timezone: string;
  brand_primary_hex: string | null;
  brand_secondary_hex: string | null;
  updated_at: string;
  is_admin: boolean;
  email: string | null;
  ai_provider: 'openai' | 'gemini' | null;
  ai_api_key: string | null;
  ai_model: string | null;
  home_module_slug: 'finance' | 'health' | 'habits-goals' | null;
}

export interface UserModuleDenial {
  user_id: string;
  module_id: string;
}

export interface UserActiveModule {
  id: string;
  user_id: string;
  module_id: string;
  started_at: string;
  last_accessed_at: string | null;
}

export interface Module {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  icon_name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Omit<Profile, 'id'>>;
        Relationships: [];
      };
      modules: {
        Row: Module;
        Insert: Omit<Module, 'id' | 'created_at'>;
        Update: Partial<Omit<Module, 'id' | 'created_at'>>;
        Relationships: [];
      };
      user_module_denials: {
        Row: UserModuleDenial;
        Insert: UserModuleDenial;
        Update: Partial<UserModuleDenial>;
        Relationships: [];
      };
      user_active_modules: {
        Row: UserActiveModule;
        Insert: Omit<UserActiveModule, 'id' | 'started_at' | 'last_accessed_at'>;
        Update: Partial<Pick<UserActiveModule, 'last_accessed_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

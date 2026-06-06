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

export type DashboardWidgetBreakpoint = 'lg' | 'md' | 'sm';

export interface UserDashboardWidget {
  user_id: string;
  widget_key: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserDashboardWidgetLayout {
  user_id: string;
  widget_key: string;
  breakpoint: DashboardWidgetBreakpoint;
  x: number;
  y: number;
  w: number;
  h: number;
  unit_scale: number;
  updated_at: string;
}

export interface UserDashboardWidgetVisibility {
  user_id: string;
  widget_key: string;
  breakpoint: DashboardWidgetBreakpoint;
  is_visible: boolean;
  updated_at: string;
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
      user_dashboard_widgets: {
        Row: UserDashboardWidget;
        Insert: Omit<UserDashboardWidget, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<UserDashboardWidget, 'user_id' | 'widget_key' | 'created_at'>>;
        Relationships: [];
      };
      user_dashboard_widget_layouts: {
        Row: UserDashboardWidgetLayout;
        Insert: Omit<UserDashboardWidgetLayout, 'updated_at' | 'unit_scale'> & {
          updated_at?: string;
          unit_scale?: number;
        };
        Update: Partial<Omit<UserDashboardWidgetLayout, 'user_id' | 'widget_key' | 'breakpoint'>>;
        Relationships: [];
      };
      user_dashboard_widget_visibility: {
        Row: UserDashboardWidgetVisibility;
        Insert: Omit<UserDashboardWidgetVisibility, 'updated_at'> & { updated_at?: string };
        Update: Partial<Omit<UserDashboardWidgetVisibility, 'user_id' | 'widget_key' | 'breakpoint'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

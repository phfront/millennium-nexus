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
}

export interface Household {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string | null;
  invited_email: string;
  role: 'owner' | 'member';
  status: 'pending' | 'active';
  invited_by: string | null;
  created_at: string;
}

export interface List {
  id: string;
  owner_id: string;
  household_id: string | null;
  name: string;
  icon: string;
  color: string | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  notes: string | null;
  estimated_price: number | null;
  is_checked: boolean;
  added_by: string | null;
  checked_by: string | null;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
}

export interface UserModuleDenial {
  user_id: string;
  module_id: string;
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
      households: {
        Row: Household;
        Insert: Omit<Household, 'id' | 'created_at'>;
        Update: Partial<Omit<Household, 'id' | 'created_at'>>;
        Relationships: [];
      };
      household_members: {
        Row: HouseholdMember;
        Insert: Omit<HouseholdMember, 'id' | 'created_at'>;
        Update: Partial<Omit<HouseholdMember, 'id' | 'created_at'>>;
        Relationships: [];
      };
      lists: {
        Row: List;
        Insert: Omit<List, 'id' | 'created_at'>;
        Update: Partial<Omit<List, 'id' | 'created_at'>>;
        Relationships: [];
      };
      list_items: {
        Row: ListItem;
        Insert: Omit<ListItem, 'id' | 'created_at'>;
        Update: Partial<Omit<ListItem, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

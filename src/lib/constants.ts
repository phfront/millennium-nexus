export const PUBLIC_ROUTES = ['/login', '/reset-password'] as const;

export const DEFAULT_REDIRECT_AUTHENTICATED = '/';
export const DEFAULT_REDIRECT_UNAUTHENTICATED = '/login';

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

export const MODULE_STATUS = {
  ACTIVE: 'active',
  COMING_SOON: 'coming_soon',
} as const;

export const LIMITS = {
  AVATAR_MAX_SIZE_MB: 2,
  FULL_NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;

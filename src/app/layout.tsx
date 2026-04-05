import type { Metadata, Viewport } from 'next';
import type { CSSProperties } from 'react';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { getUser, getUserProfile } from '@/lib/auth';
import {
  resolveBrandColors,
  parseBrandCookie,
  brandColorsToCssProperties,
  NEXUS_BRAND_COOKIE_NAME,
} from '@/lib/brand-colors';
import { BrandColorsProvider } from '@/components/providers/BrandColorsProvider';
import { BrandResolvedServerProvider } from '@/components/providers/BrandResolvedServerProvider';
import { ToastProvider } from '@phfront/millennium-ui';
import { ThemeInitializer } from '@/components/providers/ThemeInitializer';
import { RegisterServiceWorker } from '@/components/pwa/RegisterServiceWorker';
import '@phfront/millennium-ui/styles';
import './globals.css';

const NEXUS_THEME_BOOTSTRAP = `(function(){var t=localStorage.getItem('nexus-theme');try{t=JSON.parse(t)?.state?.theme}catch(e){}if(t!=='light'){document.documentElement.classList.add('dark')}})()`;

export const metadata: Metadata = {
  title: 'Millennium Nexus',
  description: 'Portal centralizador do ecossistema Millennium Nexus',
  applicationName: 'Millennium Nexus',
  manifest: '/manifest.json',
  icons: {
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Millennium Nexus',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const user = await getUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const cookieRaw = cookieStore.get(NEXUS_BRAND_COOKIE_NAME)?.value;
  const brandResolved = resolveBrandColors({
    profile,
    cookie: parseBrandCookie(cookieRaw),
  });
  const brandCss = brandColorsToCssProperties(brandResolved) as CSSProperties;

  return (
    <html lang="pt-BR" suppressHydrationWarning style={brandCss}>
      <body className="bg-surface-1 text-text-primary antialiased">
        <Script
          id="nexus-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: NEXUS_THEME_BOOTSTRAP }}
        />
        <BrandResolvedServerProvider value={brandResolved}>
          <BrandColorsProvider>
            <RegisterServiceWorker />
            <ThemeInitializer />
            <ToastProvider position="top-right" />
            {children}
          </BrandColorsProvider>
        </BrandResolvedServerProvider>
      </body>
    </html>
  );
}

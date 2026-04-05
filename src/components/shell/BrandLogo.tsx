'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { NexusLogo } from '@phfront/millennium-ui';
import { useBrandResolvedFromServer } from '@/components/providers/BrandResolvedServerProvider';
import {
  readBrandCookieFromDocument,
  resolveBrandColors,
  shouldUseRasterBrandLogo,
} from '@/lib/brand-colors';
import { useUserStore } from '@/store/user-store';

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = 36, className = '', priority }: BrandLogoProps) {
  const serverResolved = useBrandResolvedFromServer();
  const profile = useUserStore((s) => s.user?.profile ?? null);

  const resolved = useMemo(() => {
    if (profile) {
      return resolveBrandColors({ profile, cookie: readBrandCookieFromDocument() });
    }
    return serverResolved;
  }, [profile, profile?.brand_primary_hex, profile?.brand_secondary_hex, serverResolved]);

  const useRaster = shouldUseRasterBrandLogo(resolved);

  if (useRaster) {
    return (
      <Image
        src="/logo.png"
        alt="Millennium Nexus"
        width={size}
        height={size}
        className={`object-contain shrink-0 ${className}`}
        priority={priority}
      />
    );
  }

  return <NexusLogo size={size} className={className} />;
}

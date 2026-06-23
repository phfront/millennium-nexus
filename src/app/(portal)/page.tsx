import { redirect } from 'next/navigation';
import { getUser, getUserProfile } from '@/lib/auth';
import { getNavModulesForUser } from '@/lib/navigation/get-nav-modules';
import {
  getAvailableHomeModuleOptions,
  getHomeModuleHref,
  isHomeModuleSlug,
} from '@/lib/navigation/home-module';
import { HomeModuleChooser } from '@/components/home/HomeModuleChooser';

export default async function HomePage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const [profile, modules] = await Promise.all([
    getUserProfile(user.id),
    getNavModulesForUser(user.id),
  ]);

  const availableOptions = getAvailableHomeModuleOptions(modules);
  const availableSlugs = new Set(availableOptions.map((option) => option.value));
  const preferredModuleSlug = isHomeModuleSlug(profile?.home_module_slug)
    ? profile.home_module_slug
    : null;

  if (preferredModuleSlug && availableSlugs.has(preferredModuleSlug)) {
    redirect(getHomeModuleHref(preferredModuleSlug));
  }

  return <HomeModuleChooser options={availableOptions} />;
}

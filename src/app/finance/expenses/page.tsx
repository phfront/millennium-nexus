import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { ExpensesPageClient } from './expenses-page-client';

export default async function ExpensesPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return <ExpensesPageClient />;
}

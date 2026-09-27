import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';
import { lirePanneIA, LIBELLES } from '@/lib/alerteIA';

import { ADMIN_EMAILS } from '@/lib/access';

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect('/');

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
  if (!ADMIN_EMAILS.includes(email)) redirect('/');

  // Bandeau rouge si l'IA est en panne (crédits, limite, clé) : voir lib/alerteIA.ts.
  const panne = await lirePanneIA();
  return <AdminDashboard panneIA={panne && { ...LIBELLES[panne.cause], depuis: panne.depuis }} />;
}

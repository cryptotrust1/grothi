import { signOut, getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function POST() {
  // Verify user is authenticated before allowing signout
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/signin');
  }
  
  await signOut();
  redirect('/');
}

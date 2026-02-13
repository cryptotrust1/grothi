import { redirect } from 'next/navigation';

// Redirect old image-style URL to new creative-style page
export default async function ImageStyleRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/bots/${id}/creative-style`);
}

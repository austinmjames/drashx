// Path: app/[inviteCode]/page.tsx
import { redirect } from 'next/navigation';

/**
 * Global Invite Link Interceptor
 * Catches visits to drashx.com/ABCDEF and redirects them to the 
 * reader view with the invite code safely attached as a query parameter.
 */
export default function InviteRoute({ params }: { params: { inviteCode: string } }) {
  redirect(`/read/Genesis/1?invite=${params.inviteCode}`);
}
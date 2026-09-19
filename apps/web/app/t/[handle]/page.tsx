import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { computeCredentialStatus } from '@kinderbase/types';
import { PublicProfileHero } from '@/components/public-profile/PublicProfileHero';
import { CredentialTable } from '@/components/public-profile/CredentialTable';
import { EmploymentHistory } from '@/components/public-profile/EmploymentHistory';
import { ConversionBar } from '@/components/public-profile/ConversionBar';

type Props = { params: { handle: string } };

async function getProfile(handle: string) {
  const supabase = createServiceClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, full_name, handle, profile_public, bio')
    .eq('handle', handle)
    .eq('profile_public', true)
    .is('deleted_at', null)
    .single();

  if (!user) return null;

  const { data: credentials } = await supabase
    .from('credentials')
    .select('*')
    .eq('user_id', user.id)
    .eq('show_on_profile', true)
    .is('deleted_at', null)
    .order('issued_at', { ascending: false });

  const { data: employment } = await supabase
    .from('employment_history')
    .select('*')
    .eq('user_id', user.id)
    .eq('show_on_profile', true)
    .order('start_date', { ascending: false });

  return {
    user,
    credentials: (credentials ?? []).map(c => ({
      ...c,
      status: computeCredentialStatus(c.expires_at),
    })),
    employment: employment ?? [],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile(params.handle);
  if (!profile) return { title: 'Profile not found' };

  const { user, credentials } = profile;
  const credCount = credentials.length;
  const description = `${user.full_name} — ${credCount} verified credential${credCount === 1 ? '' : 's'} on KinderBase.`;
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/t/${params.handle}`;

  return {
    title: `${user.full_name} | KinderBase`,
    description,
    openGraph: {
      title: `${user.full_name} | KinderBase`,
      description,
      url,
      siteName: 'KinderBase',
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: `${user.full_name} | KinderBase`,
      description,
    },
    alternates: { canonical: url },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const profile = await getProfile(params.handle);
  if (!profile) notFound();

  const { user, credentials, employment } = profile;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-6 space-y-4">
        <PublicProfileHero name={user.full_name} handle={user.handle ?? params.handle} bio={user.bio ?? null} />
        <CredentialTable credentials={credentials} />
        <EmploymentHistory history={employment} />
      </div>
      <ConversionBar name={user.full_name} handle={user.handle ?? params.handle} />
    </div>
  );
}

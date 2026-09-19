// Runs daily via Supabase cron scheduler.
// Sends email alerts at 60, 30, and 7 days before expiry, and on expiry.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALERT_DAYS = [60, 30, 7];

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  preschool_90hr: '90-Hour Preschool',
  infant_toddler_9hr: '9-Hour Infant/Toddler',
  communication_9hr: '9-Hour Communication',
  ada_training: 'ADA Training',
  first_aid_cpr: 'First Aid & CPR',
  child_abuse_prevention: 'Child Abuse Prevention',
  medication_administration: 'Medication Administration',
  cda: 'Child Development Associate (CDA)',
  directors_certification: "Director's Certification",
  college_degree: 'College Degree',
  other: 'Other',
};

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return new Response('RESEND_API_KEY not set', { status: 500 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build date targets: expired today + each alert window
  const targets: { date: string; daysUntil: number }[] = [
    { date: today.toISOString().split('T')[0], daysUntil: 0 },
    ...ALERT_DAYS.map(days => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return { date: d.toISOString().split('T')[0], daysUntil: days };
    }),
  ];

  let sent = 0;

  for (const { date, daysUntil } of targets) {
    const { data: credentials } = await supabase
      .from('credentials')
      .select('id, user_id, credential_type, custom_type_name, expires_at, users(email, full_name)')
      .eq('expires_at', date)
      .is('deleted_at', null);

    if (!credentials?.length) continue;

    for (const cred of credentials) {
      const user = cred.users as { email: string; full_name: string } | null;
      if (!user) continue;

      const credLabel =
        cred.credential_type === 'other' && cred.custom_type_name
          ? cred.custom_type_name
          : (CREDENTIAL_TYPE_LABELS[cred.credential_type] ?? cred.credential_type);

      const subject =
        daysUntil === 0
          ? `Your ${credLabel} credential has expired`
          : `Your ${credLabel} credential expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;

      const body =
        daysUntil === 0
          ? `Hi ${user.full_name},\n\nYour ${credLabel} credential expired today. Please renew it and upload the updated document to KinderBase.\n\nLog in at ${Deno.env.get('NEXT_PUBLIC_APP_URL')}/dashboard/credentials`
          : `Hi ${user.full_name},\n\nYour ${credLabel} credential expires on ${date} (${daysUntil} day${daysUntil === 1 ? '' : 's'} from now). Please renew it before it expires.\n\nLog in at ${Deno.env.get('NEXT_PUBLIC_APP_URL')}/dashboard/credentials`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'KinderBase <noreply@kinderbase.com>',
          to: user.email,
          subject,
          text: body,
        }),
      });

      if (res.ok) sent++;
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

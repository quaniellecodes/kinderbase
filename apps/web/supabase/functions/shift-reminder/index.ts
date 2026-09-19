// Runs on a schedule (e.g. every hour via Supabase cron).
// Finds staff clocked in for 8+ hours without clocking out and sends a push reminder.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const REMINDER_AFTER_HOURS = 8;

Deno.serve(async () => {
  const cutoff = new Date(Date.now() - REMINDER_AFTER_HOURS * 60 * 60 * 1000).toISOString();

  // Find open entries older than the cutoff
  const { data: entries } = await supabase
    .from('time_entries')
    .select('id, user_id, clocked_in_at')
    .is('clocked_out_at', null)
    .lt('clocked_in_at', cutoff);

  if (!entries?.length) return new Response('No long-running shifts', { status: 200 });

  const userIds = [...new Set(entries.map(e => e.user_id))];

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, user_id')
    .in('user_id', userIds);

  if (!tokens?.length) return new Response('No push tokens', { status: 200 });

  const tokenByUser = new Map<string, string[]>();
  for (const t of tokens) {
    if (!tokenByUser.has(t.user_id)) tokenByUser.set(t.user_id, []);
    tokenByUser.get(t.user_id)!.push(t.token);
  }

  const messages = entries.flatMap(entry => {
    const userTokens = tokenByUser.get(entry.user_id) ?? [];
    const hours = Math.floor((Date.now() - new Date(entry.clocked_in_at).getTime()) / 3600000);
    return userTokens.map(token => ({
      to: token,
      title: 'Shift reminder',
      body: `You've been clocked in for ${hours} hours. Don't forget to clock out.`,
      data: { screen: 'time' },
    }));
  });

  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  return new Response(`Sent ${messages.length} reminder(s)`, { status: 200 });
});

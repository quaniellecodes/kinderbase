-- Live thread updates (docs/sessions/05-MESSAGING.md §realtime). Add `messages`
-- to the realtime publication so the open thread refreshes when a new message
-- lands. RLS still governs what each subscriber receives — the authenticated
-- browser client only gets rows its `messages_read` policy allows, so DMs stay
-- private over the socket too. Idempotent: skip if already published.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

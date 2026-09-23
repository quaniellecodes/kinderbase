-- Private storage bucket for student documents. All access is mediated by the
-- service role in Server Actions / the signed-URL route handler (never public,
-- never direct-from-client), so no storage.objects RLS policies are needed —
-- mirrors the `credentials` bucket. Idempotent.
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

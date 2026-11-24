-- Optional housekeeping: run manually in the Supabase SQL editor.
-- Deletes guest (anonymous) accounts that were created more than 30 days ago.
-- Their wishlists, searches, feedback and share links are removed too (ON DELETE CASCADE).
-- Accounts that were upgraded with an email/password are NOT anonymous and are untouched.
delete from auth.users
where is_anonymous = true
  and created_at < now() - interval '30 days';

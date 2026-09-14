-- Run this AFTER you add your login in Supabase → Authentication → Users.
-- Change the email if you signed up with a different one.
insert into public.admins (user_id)
select id from auth.users where email = 'Breywhites7@gmail.com'
on conflict do nothing;

-- You should see "Success" and 1 row. If it says 0 rows, the email above
-- doesn't match the user you created — fix the email and run again.
select email, 'is admin' as status
from auth.users
where id in (select user_id from public.admins);

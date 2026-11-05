-- Apply after setup.sql. Submitted copies are shared; existing local drafts are preserved.
create or replace function savor_private.active_staff() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and status='Active');
$$;
create or replace function savor_private.active_head(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select savor_private.active_staff() and exists(select 1 from public.profiles where id=p_id and status='Active' and role in ('Department Head','Admin'));
$$;
revoke all on function savor_private.active_staff(), savor_private.active_head(uuid) from public,anon;
grant execute on function savor_private.active_staff(), savor_private.active_head(uuid) to authenticated;
create table public.head_contacts (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 whatsapp text not null default '' check(whatsapp='' or whatsapp ~ '^[1-9][0-9]{7,14}$')
);
alter table public.head_contacts enable row level security;
revoke all on public.head_contacts from anon,authenticated;
grant select,insert,update,delete on public.head_contacts to authenticated;
create policy head_contact_read on public.head_contacts for select to authenticated using ((select savor_private.active_staff()));
create policy head_contact_admin on public.head_contacts for all to authenticated using ((select savor_private.is_savor_admin())) with check ((select savor_private.is_savor_admin()));
create or replace function savor_private.staff_directory() returns table(id uuid,name text,department text,role text,email text,whatsapp text)
 language sql stable security definer set search_path='' as $$
 select p.id,p.name,p.department,p.role,p.email,coalesce(c.whatsapp,'') from public.profiles p left join public.head_contacts c on c.profile_id=p.id
 where savor_private.active_staff() and p.status='Active' order by p.name;
$$;
revoke all on function savor_private.staff_directory() from public,anon;
grant execute on function savor_private.staff_directory() to authenticated;
create function public.staff_directory() returns table(id uuid,name text,department text,role text,email text,whatsapp text)
 language sql stable security invoker set search_path='' as $$ select * from savor_private.staff_directory(); $$;
revoke all on function public.staff_directory() from public,anon;
grant execute on function public.staff_directory() to authenticated;
create table public.work_submissions (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null default auth.uid() references public.profiles(id),
 recipient_id uuid not null references public.profiles(id),
 module text not null check(length(module) between 1 and 100),
 title text not null check(length(title) between 1 and 140),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=65536),
 status text not null default 'Sent' check(status in ('Sent','Reviewed','Approved','Rejected')),
 created_at timestamptz not null default now()
);
create index work_submissions_sender_time on public.work_submissions(sender_id,created_at desc);
create index work_submissions_recipient_time on public.work_submissions(recipient_id,created_at desc);
alter table public.work_submissions enable row level security;
revoke all on public.work_submissions from anon,authenticated;
grant select,insert on public.work_submissions to authenticated;
grant update(status) on public.work_submissions to authenticated;
create policy submission_read on public.work_submissions for select to authenticated using (
 (select savor_private.active_staff()) and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid()) or (select savor_private.is_savor_admin())));
create policy submission_send on public.work_submissions for insert to authenticated with check (
 (select savor_private.active_staff()) and sender_id=(select auth.uid()) and savor_private.active_head(recipient_id) and status='Sent');
create policy submission_review on public.work_submissions for update to authenticated using (
 (select savor_private.active_staff()) and (recipient_id=(select auth.uid()) or (select savor_private.is_savor_admin()))) with check (
 (select savor_private.active_staff()) and (recipient_id=(select auth.uid()) or (select savor_private.is_savor_admin())));

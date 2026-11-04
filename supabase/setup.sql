-- Run once in a NEW Supabase project's SQL Editor. Keep email confirmation enabled.
begin;
create schema savor_private;
revoke all on schema savor_private from public, anon;
grant usage on schema savor_private to authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 name text not null,
 employee_code text not null default '',
 department text not null default '',
 role text not null default 'Employee' check(role in ('Employee','Department Head','Admin')),
 status text not null default 'Pending' check(status in ('Pending','Active','Inactive','Rejected')),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create function savor_private.is_savor_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role='Admin' and status='Active');
$$;
revoke all on function savor_private.is_savor_admin() from public;
grant execute on function savor_private.is_savor_admin() to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (id=(select auth.uid()) or (select savor_private.is_savor_admin()));

create function savor_private.handle_savor_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
declare configured boolean := lower(new.email)='alaminislam105655@gmail.com';
begin
 if TG_OP='INSERT' then
  insert into public.profiles(id,email,name,employee_code,department,role,status)
  values(new.id,new.email,
   case when configured then 'Al-amin Islam' else left(coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),100) end,
   left(coalesce(new.raw_user_meta_data->>'employee_code',''),40),
   left(coalesce(new.raw_user_meta_data->>'department',''),100),
   case when configured and new.email_confirmed_at is not null then 'Admin' else 'Employee' end,
   case when configured and new.email_confirmed_at is not null then 'Active' else 'Pending' end);
 else
  update public.profiles set email=new.email where id=new.id;
  if configured and new.email_confirmed_at is not null then
   update public.profiles set name='Al-amin Islam',role='Admin',status='Active' where id=new.id;
  end if;
 end if;
 return new;
end;
$$;
revoke all on function savor_private.handle_savor_auth_user() from public, anon, authenticated;
create trigger savor_auth_insert after insert on auth.users for each row execute function savor_private.handle_savor_auth_user();
create trigger savor_auth_verified after update of email,email_confirmed_at on auth.users for each row execute function savor_private.handle_savor_auth_user();

create function savor_private.admin_update_account(p_user uuid,p_role text,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare target_email text;
begin
 if not savor_private.is_savor_admin() then raise exception 'Administrator access required'; end if;
 if p_role not in ('Employee','Department Head','Admin') or p_status not in ('Pending','Active','Inactive','Rejected') or p_role is null or p_status is null then raise exception 'Invalid role or status'; end if;
 select email into target_email from public.profiles where id=p_user;
 if not found then raise exception 'Account not found'; end if;
 if lower(target_email)='alaminislam105655@gmail.com' then raise exception 'Configured Admin account is protected'; end if;
 update public.profiles set role=p_role,status=p_status where id=p_user;
end;
$$;
revoke all on function savor_private.admin_update_account(uuid,text,text) from public, anon;
grant execute on function savor_private.admin_update_account(uuid,text,text) to authenticated;
create function public.admin_update_account(p_user uuid,p_role text,p_status text) returns void
language sql security invoker set search_path='' as $$
 select savor_private.admin_update_account(p_user,p_role,p_status);
$$;
revoke all on function public.admin_update_account(uuid,text,text) from public, anon;
grant execute on function public.admin_update_account(uuid,text,text) to authenticated;

-- Backfill accounts created before this setup; roles never come from user metadata.
insert into public.profiles(id,email,name,employee_code,department,role,status)
select id,email,
 case when lower(email)='alaminislam105655@gmail.com' then 'Al-amin Islam' else left(coalesce(nullif(raw_user_meta_data->>'name',''),split_part(email,'@',1)),100) end,
 left(coalesce(raw_user_meta_data->>'employee_code',''),40),left(coalesce(raw_user_meta_data->>'department',''),100),
 case when lower(email)='alaminislam105655@gmail.com' and email_confirmed_at is not null then 'Admin' else 'Employee' end,
 case when lower(email)='alaminislam105655@gmail.com' and email_confirmed_at is not null then 'Active' else 'Pending' end
from auth.users on conflict(id) do nothing;
commit;

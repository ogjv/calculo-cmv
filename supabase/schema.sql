create extension if not exists pgcrypto;

create table if not exists public.restaurant_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id text not null unique,
  restaurant_name text not null,
  email text not null,
  photo_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.restaurant_workspaces (
  user_id uuid primary key references public.restaurant_accounts(user_id) on delete cascade,
  locale text not null default 'pt',
  state jsonb not null default '{}'::jsonb,
  upload_feedback jsonb not null default '[]'::jsonb,
  selected_period text not null default '__ALL_PERIODS__',
  selected_view text not null default '__TOTAL__',
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.restaurant_accounts enable row level security;
alter table public.restaurant_workspaces enable row level security;

drop policy if exists "restaurant_accounts_select_own" on public.restaurant_accounts;
create policy "restaurant_accounts_select_own"
on public.restaurant_accounts
for select
using (auth.uid() = user_id);

drop policy if exists "restaurant_accounts_insert_own" on public.restaurant_accounts;
create policy "restaurant_accounts_insert_own"
on public.restaurant_accounts
for insert
with check (auth.uid() = user_id);

drop policy if exists "restaurant_accounts_update_own" on public.restaurant_accounts;
create policy "restaurant_accounts_update_own"
on public.restaurant_accounts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "restaurant_workspaces_select_own" on public.restaurant_workspaces;
create policy "restaurant_workspaces_select_own"
on public.restaurant_workspaces
for select
using (auth.uid() = user_id);

drop policy if exists "restaurant_workspaces_insert_own" on public.restaurant_workspaces;
create policy "restaurant_workspaces_insert_own"
on public.restaurant_workspaces
for insert
with check (auth.uid() = user_id);

drop policy if exists "restaurant_workspaces_update_own" on public.restaurant_workspaces;
create policy "restaurant_workspaces_update_own"
on public.restaurant_workspaces
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

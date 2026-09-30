-- J & D 결혼 준비 장부 — 초기 스키마
--
-- 원칙
-- - 컬렉션 1개 = 테이블 1개. 원본 문서는 `data jsonb` 그대로 보관 (아티팩트 DB와 같은 모양).
-- - 자주 필터·정렬하는 필드는 data에서 뽑은 generated column → 앱은 data만 쓰면 되고 동기화 문제가 없다.
-- - 금액은 원 단위 정수 (jsonb number).
-- - RLS: allowed_emails 테이블에 있는 이메일로 로그인한 사용자만 읽기/쓰기.
--   테이블이 비어 있으면 아무도 접근 못 한다 (import 스크립트는 service role로 RLS 우회).

create extension if not exists pgcrypto;

-- ---------- 접근 허용 목록 ----------

create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  label text,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
-- 정책 없음 = 클라이언트에서 읽기/쓰기 불가. service role만 관리.

create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_allowed() from public;
grant execute on function public.is_allowed() to authenticated;

-- ---------- 공통: updated_at / updated_by ----------

create or replace function public.touch_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- 컬렉션 테이블을 만드는 헬퍼 (id text pk + data jsonb + 메타 + RLS + 트리거 + realtime)
create or replace function public._make_collection(tbl text)
returns void
language plpgsql
as $$
begin
  execute format($f$
    create table if not exists public.%1$I (
      id text primary key,
      data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      updated_by uuid references auth.users(id) on delete set null
    );
    alter table public.%1$I enable row level security;
    drop policy if exists "allowed read" on public.%1$I;
    drop policy if exists "allowed write" on public.%1$I;
    create policy "allowed read" on public.%1$I for select to authenticated using (public.is_allowed());
    create policy "allowed write" on public.%1$I for all to authenticated using (public.is_allowed()) with check (public.is_allowed());
    drop trigger if exists touch on public.%1$I;
    create trigger touch before insert or update on public.%1$I for each row execute function public.touch_row();
  $f$, tbl);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['planners','vendors','quotes','extras','halls','dresses','budget','homes','price_lists','settings'] loop
    perform public._make_collection(t);
  end loop;
end $$;

drop function public._make_collection(text);

-- ---------- 필터·정렬용 generated column ----------

alter table public.vendors
  add column if not exists cat text generated always as (data ->> 'cat') stored,
  add column if not exists status text generated always as (data ->> 'status') stored;
create index if not exists vendors_cat_idx on public.vendors (cat);

alter table public.halls
  add column if not exists zone text generated always as (data ->> 'zone') stored,
  add column if not exists gu text generated always as (data ->> 'gu') stored,
  add column if not exists hall_type text generated always as (data ->> 'type') stored,
  add column if not exists status text generated always as (data ->> 'status') stored,
  add column if not exists meal_min bigint generated always as ((data ->> 'mealMin')::numeric::bigint) stored;
create index if not exists halls_zone_gu_idx on public.halls (zone, gu);

alter table public.budget
  add column if not exists grp text generated always as (data ->> 'group') stored,
  add column if not exists sort_order int generated always as ((data ->> 'order')::numeric::int) stored;
create index if not exists budget_order_idx on public.budget (sort_order);

alter table public.extras
  add column if not exists sort_order int generated always as ((data ->> 'order')::numeric::int) stored;

alter table public.homes
  add column if not exists kind text generated always as (data ->> 'kind') stored,
  add column if not exists status text generated always as (data ->> 'status') stored;

alter table public.price_lists
  add column if not exists planner text generated always as (data ->> 'planner') stored;

-- settings는 1행 ('main')
alter table public.settings drop constraint if exists settings_single_row;
alter table public.settings add constraint settings_single_row check (id = 'main');

-- ---------- Realtime (P1: 두 사람 동시 편집) ----------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['planners','vendors','quotes','extras','halls','dresses','budget','homes','price_lists','settings'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- ---------- Storage: 사진 (비공개 버킷) ----------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos allowed read" on storage.objects;
drop policy if exists "photos allowed insert" on storage.objects;
drop policy if exists "photos allowed update" on storage.objects;
drop policy if exists "photos allowed delete" on storage.objects;
create policy "photos allowed read" on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_allowed());
create policy "photos allowed insert" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_allowed());
create policy "photos allowed update" on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_allowed());
create policy "photos allowed delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_allowed());

-- 0002 — 동시 편집 안전 저장 + 휴지통 + 수정자 기록 + 백업 버킷 + 새 컬렉션
--
-- 1) patch_doc: 바뀐 필드만 서버에서 깊은 병합 → 두 사람이 같은 문서의 다른 칸을 고쳐도 서로 덮어쓰지 않는다.
-- 2) 휴지통: 지운 문서를 trash에 30일 보관, 되살리기 가능.
-- 3) updated_email: 마지막으로 고친 사람 이메일 (화면에 "누가 언제" 표시용).
-- 4) backups 버킷: 매일 자동 백업 JSON (정책 없음 = service role만 접근).
-- 5) 새 컬렉션: guests(하객), gifts(축의금), payments(지불 일정), tasks(준비 체크리스트).
--
-- 여러 번 실행해도 안전하다.

-- ---------- 깊은 병합 (앱의 deepMerge와 같은 규칙: 객체끼리는 재귀, 나머지는 덮어씀) ----------

create or replace function public.jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
      coalesce(
        (select jsonb_object_agg(
                  coalesce(ka, kb),
                  case
                    when kb is null then va
                    when ka is null then vb
                    else public.jsonb_deep_merge(va, vb)
                  end)
           from jsonb_each(a) as x(ka, va)
           full join jsonb_each(b) as y(kb, vb) on ka = kb),
        '{}'::jsonb)
    else b
  end;
$$;

-- ---------- 허용된 테이블 이름 ----------

create or replace function public._ledger_table(tbl text)
returns text
language plpgsql
immutable
as $$
begin
  if tbl not in ('planners','vendors','quotes','extras','halls','dresses','budget','homes','price_lists','settings',
                 'guests','gifts','payments','tasks') then
    raise exception 'unknown table: %', tbl;
  end if;
  return tbl;
end;
$$;

-- ---------- 부분 저장 ----------
-- security invoker: 호출한 사용자의 RLS가 그대로 적용된다.

create or replace function public.patch_doc(tbl text, doc_id text, patch jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jsonb_typeof(patch) <> 'object' then
    raise exception 'patch must be an object';
  end if;
  execute format(
    'insert into public.%1$I as t (id, data) values ($1, $2)
       on conflict (id) do update set data = public.jsonb_deep_merge(t.data, excluded.data)',
    public._ledger_table(tbl))
  using doc_id, patch;
end;
$$;

revoke all on function public.patch_doc(text, text, jsonb) from public, anon;
grant execute on function public.patch_doc(text, text, jsonb) to authenticated;

-- ---------- 새 컬렉션 ----------

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
  foreach t in array array['guests','gifts','payments','tasks'] loop
    perform public._make_collection(t);
  end loop;
end $$;

drop function public._make_collection(text);

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['guests','gifts','payments','tasks'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- ---------- 수정자 기록 ----------

create or replace function public.touch_row()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_email := coalesce(auth.jwt() ->> 'email', new.updated_email);
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['planners','vendors','quotes','extras','halls','dresses','budget','homes','price_lists','settings',
                           'guests','gifts','payments','tasks'] loop
    execute format('alter table public.%I add column if not exists updated_email text', t);
  end loop;
end $$;

-- ---------- 휴지통 ----------

create table if not exists public.trash (
  id bigint generated always as identity primary key,
  tbl text not null,
  doc_id text not null,
  data jsonb not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid default auth.uid() references auth.users(id) on delete set null,
  deleted_email text default (auth.jwt() ->> 'email')
);
create index if not exists trash_deleted_at_idx on public.trash (deleted_at);

alter table public.trash enable row level security;
drop policy if exists "allowed read" on public.trash;
drop policy if exists "allowed write" on public.trash;
create policy "allowed read" on public.trash for select to authenticated using (public.is_allowed());
create policy "allowed write" on public.trash for all to authenticated using (public.is_allowed()) with check (public.is_allowed());

-- 문서를 지우면서 휴지통에 넣기 (한 트랜잭션)
create or replace function public.trash_doc(tbl text, doc_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tbl = 'settings' then
    raise exception 'settings cannot be deleted';
  end if;
  execute format(
    'with d as (delete from public.%1$I where id = $1 returning id, data)
     insert into public.trash (tbl, doc_id, data) select $2, d.id, d.data from d',
    public._ledger_table(tbl))
  using doc_id, tbl;
end;
$$;

-- 휴지통에서 되살리기 (같은 id가 이미 있으면 휴지통 내용으로 덮어씀)
create or replace function public.restore_doc(trash_id bigint)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare r public.trash;
begin
  delete from public.trash where id = trash_id returning * into r;
  if r.id is null then
    raise exception 'not found';
  end if;
  execute format(
    'insert into public.%1$I (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data',
    public._ledger_table(r.tbl))
  using r.doc_id, r.data;
  return r.tbl;
end;
$$;

-- 30일 지난 휴지통 비우기. 지운 문서 내용을 돌려준다 (앱이 사진 파일을 정리).
create or replace function public.purge_trash(days int default 30)
returns setof jsonb
language sql
security invoker
set search_path = public
as $$
  delete from public.trash where deleted_at < now() - make_interval(days => days) returning data;
$$;

revoke all on function public.trash_doc(text, text) from public, anon;
revoke all on function public.restore_doc(bigint) from public, anon;
revoke all on function public.purge_trash(int) from public, anon;
grant execute on function public.trash_doc(text, text) to authenticated;
grant execute on function public.restore_doc(bigint) to authenticated;
grant execute on function public.purge_trash(int) to authenticated;

-- ---------- 백업 버킷 (비공개, 정책 없음 → service role 전용) ----------

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

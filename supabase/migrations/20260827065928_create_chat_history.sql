create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_rooms_user_id_id_key unique (user_id, id),
  constraint chat_rooms_title_not_blank
    check (char_length(btrim(title)) between 1 and 120)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  room_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_room_owner_fkey
    foreign key (user_id, room_id)
    references public.chat_rooms (user_id, id)
    on delete cascade,
  constraint chat_messages_role_check
    check (role in ('user', 'assistant', 'notice')),
  constraint chat_messages_content_not_blank
    check (char_length(btrim(content)) between 1 and 50000)
);

create index chat_rooms_user_id_updated_at_idx
  on public.chat_rooms (user_id, updated_at desc);

create index chat_messages_user_id_room_id_created_at_idx
  on public.chat_messages (user_id, room_id, created_at, id);

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;

revoke all on table public.chat_rooms from anon;
revoke all on table public.chat_messages from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.chat_rooms to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;

create policy "chat_rooms_select_own"
  on public.chat_rooms
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "chat_rooms_insert_own"
  on public.chat_rooms
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "chat_rooms_update_own"
  on public.chat_rooms
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "chat_rooms_delete_own"
  on public.chat_rooms
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "chat_messages_select_own"
  on public.chat_messages
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "chat_messages_insert_own"
  on public.chat_messages
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "chat_messages_update_own"
  on public.chat_messages
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "chat_messages_delete_own"
  on public.chat_messages
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.touch_chat_room_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.chat_rooms
    set updated_at = now()
    where user_id = old.user_id and id = old.room_id;
    return old;
  end if;

  update public.chat_rooms
  set updated_at = now()
  where user_id = new.user_id and id = new.room_id;
  return new;
end;
$$;

revoke execute on function public.touch_chat_room_updated_at()
  from public, anon, authenticated;

create trigger chat_messages_touch_room
after insert or delete on public.chat_messages
for each row execute function public.touch_chat_room_updated_at();

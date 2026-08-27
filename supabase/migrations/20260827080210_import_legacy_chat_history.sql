create or replace function public.import_legacy_chat_history(p_rooms jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_room_count integer := 0;
  v_message_count integer := 0;
  v_total_messages integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_rooms is null or jsonb_typeof(p_rooms) <> 'array' then
    raise exception 'rooms must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rooms) > 250 then
    raise exception 'at most 250 rooms can be imported at once' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rooms) as room
    where jsonb_typeof(room) <> 'object'
       or jsonb_typeof(room -> 'messages') <> 'array'
  ) then
    raise exception 'each room must be an object with a messages array' using errcode = '22023';
  end if;

  select coalesce(sum(jsonb_array_length(room -> 'messages')), 0)::integer
    into v_total_messages
    from jsonb_array_elements(p_rooms) as room;

  if v_total_messages > 10000 then
    raise exception 'at most 10000 messages can be imported at once' using errcode = '22023';
  end if;

  insert into public.chat_rooms (id, user_id, title, created_at, updated_at)
  select
    (room ->> 'id')::uuid,
    v_user_id,
    room ->> 'title',
    (room ->> 'created_at')::timestamptz,
    (room ->> 'updated_at')::timestamptz
  from jsonb_array_elements(p_rooms) as room
  on conflict (id) do nothing;

  get diagnostics v_room_count = row_count;

  insert into public.chat_messages (id, user_id, room_id, role, content, created_at)
  select
    (message ->> 'id')::uuid,
    v_user_id,
    (room ->> 'id')::uuid,
    message ->> 'role',
    message ->> 'content',
    (message ->> 'created_at')::timestamptz
  from jsonb_array_elements(p_rooms) as room
  cross join lateral jsonb_array_elements(room -> 'messages') as message
  on conflict (id) do nothing;

  get diagnostics v_message_count = row_count;

  return jsonb_build_object(
    'rooms', v_room_count,
    'messages', v_message_count
  );
end;
$function$;

revoke all on function public.import_legacy_chat_history(jsonb) from public;
revoke all on function public.import_legacy_chat_history(jsonb) from anon;
grant execute on function public.import_legacy_chat_history(jsonb) to authenticated;

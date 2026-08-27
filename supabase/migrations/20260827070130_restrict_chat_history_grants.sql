revoke all privileges on table public.chat_rooms from authenticated;
revoke all privileges on table public.chat_messages from authenticated;

grant select, insert, update, delete on table public.chat_rooms to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;

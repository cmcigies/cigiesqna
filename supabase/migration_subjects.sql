create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

alter table subjects enable row level security;

create policy "subjects_select_all" on subjects
  for select using (auth.role() = 'authenticated');

create policy "subjects_write_teacher" on subjects
  for all using (auth.jwt() ->> 'email' = 'cmcigies@gmail.com')
  with check (auth.jwt() ->> 'email' = 'cmcigies@gmail.com');

insert into subjects (name)
select distinct coalesce(nullif(trim(subject), ''), '기타') from qa_items
on conflict (name) do nothing;

insert into subjects (name) values ('기타')
on conflict (name) do nothing;

alter table question_logs add column if not exists subject text;
alter table unanswered_questions add column if not exists subject text;
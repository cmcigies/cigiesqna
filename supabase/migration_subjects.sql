-- ⚠️ 이미 schema.sql + migration_mypage.sql을 실행하신 프로젝트에 실행하세요.

-- 1. 과목(카테고리) 목록 테이블
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

alter table subjects enable row level security;

create policy "subjects_select_all" on subjects
  for select using (auth.role() = 'authenticated');

-- ⚠️ 아래 'TEACHER_EMAIL_PLACEHOLDER'를 선생님 구글 이메일로 바꾼 후 실행하세요.
create policy "subjects_write_teacher" on subjects
  for all using (auth.jwt() ->> 'email' = 'TEACHER_EMAIL_PLACEHOLDER')
  with check (auth.jwt() ->> 'email' = 'TEACHER_EMAIL_PLACEHOLDER');

-- 2. 기존 qa_items에 있던 과목명들을 목록에 반영 (없으면 '기타'로 통일되어 있을 것)
insert into subjects (name)
select distinct coalesce(nullif(trim(subject), ''), '기타') from qa_items
on conflict (name) do nothing;

insert into subjects (name) values ('기타')
on conflict (name) do nothing;

-- 3. 질문 시 선택한 과목을 기록하기 위한 컬럼 추가
alter table question_logs add column if not exists subject text;
alter table unanswered_questions add column if not exists subject text;

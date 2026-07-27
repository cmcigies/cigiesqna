-- ⚠️ 아래 'TEACHER_EMAIL_PLACEHOLDER' 를 선생님 구글 이메일로 전부 바꾼 후 실행하세요.
-- 예: 'teacher@gmail.com'

create table if not exists qa_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  keywords text[] not null default '{}',
  subject text default '기타',
  created_at timestamptz default now()
);

create table if not exists unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  question text not null,
  status text not null default 'pending', -- pending | answered
  created_at timestamptz default now()
);

create table if not exists question_logs (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  question text not null,
  matched boolean not null,
  qa_item_id uuid references qa_items(id),
  created_at timestamptz default now()
);

alter table qa_items enable row level security;
alter table unanswered_questions enable row level security;
alter table question_logs enable row level security;

-- 로그인한 모든 사용자는 Q&A를 읽을 수 있음
create policy "qa_items_select_all" on qa_items
  for select using (auth.role() = 'authenticated');

-- 선생님 이메일만 Q&A 쓰기/수정/삭제 가능
create policy "qa_items_write_teacher" on qa_items
  for all using (auth.jwt() ->> 'email' = 'cmcigies@gmail.com')
  with check (auth.jwt() ->> 'email' = 'cmcigies@gmail.com');

-- 학생은 자기 미답변 질문만 등록 가능
create policy "unanswered_insert_own" on unanswered_questions
  for insert with check (auth.jwt() ->> 'email' = student_email);

-- 선생님만 미답변 질문 조회/수정 가능
create policy "unanswered_select_teacher" on unanswered_questions
  for select using (auth.jwt() ->> 'email' = 'cmcigies@gmail.com');

create policy "unanswered_update_teacher" on unanswered_questions
  for update using (auth.jwt() ->> 'email' = 'cmcigies@gmail.com');

-- 로그는 본인 것만 기록, 선생님은 전체 조회
create policy "logs_insert_own" on question_logs
  for insert with check (auth.jwt() ->> 'email' = student_email);

create policy "logs_select_teacher" on question_logs
  for select using (auth.jwt() ->> 'email' = 'cmcigies@gmail.com');

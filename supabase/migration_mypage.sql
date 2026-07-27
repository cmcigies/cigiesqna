-- ⚠️ 이미 schema.sql을 실행하신 기존 프로젝트에 마이페이지 기능을 추가하려면
-- 이 파일만 SQL Editor에서 실행하세요. (schema.sql을 다시 실행할 필요 없음)

-- 1. 미답변 질문이 나중에 어떤 Q&A로 답변됐는지 연결하기 위한 컬럼
alter table unanswered_questions
  add column if not exists answered_qa_item_id uuid references qa_items(id);

-- 2. 학생이 본인의 미답변 질문 상태를 조회할 수 있도록 허용
create policy "unanswered_select_own" on unanswered_questions
  for select using (auth.jwt() ->> 'email' = student_email);

-- 3. 학생이 본인의 질문 로그(질문 기록)를 조회할 수 있도록 허용
create policy "logs_select_own" on question_logs
  for select using (auth.jwt() ->> 'email' = student_email);

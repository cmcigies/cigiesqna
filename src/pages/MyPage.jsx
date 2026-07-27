import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function MyPage({ user }) {
  const [logs, setLogs] = useState([]);
  const [unanswered, setUnanswered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: logData, error: logErr }, { data: unansweredData, error: unErr }] = await Promise.all([
      supabase
        .from("question_logs")
        .select("id, question, subject, matched, created_at, qa_items(answer)")
        .eq("student_email", user.email)
        .order("created_at", { ascending: false }),
      supabase
        .from("unanswered_questions")
        .select("id, question, status, created_at, qa_items(answer)")
        .eq("student_email", user.email),
    ]);

    if (logErr) setError(logErr.message);
    else if (unErr) setError(unErr.message);

    setLogs(logData || []);
    setUnanswered(unansweredData || []);
    setLoading(false);
  }

  // 매칭 실패했던 질문이 이후 답변됐는지 가장 시간상 가까운 기록에서 찾기
  function findResolvedAnswer(log) {
    const candidates = unanswered.filter((u) => u.question === log.question);
    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) =>
        Math.abs(new Date(a.created_at) - new Date(log.created_at)) -
        Math.abs(new Date(b.created_at) - new Date(log.created_at))
    );
    return candidates[0];
  }

  if (loading) return <div className="mypage-empty muted">불러오는 중...</div>;
  if (error) return <div className="error-line">기록을 불러오지 못했어요: {error}</div>;
  if (logs.length === 0) {
    return <div className="mypage-empty muted">아직 질문한 기록이 없어요.</div>;
  }

  return (
    <div className="mypage-list">
      {logs.map((log) => {
        const directAnswer = log.qa_items?.answer;
        const resolved = !directAnswer ? findResolvedAnswer(log) : null;
        const resolvedAnswer = resolved?.status === "answered" ? resolved.qa_items?.answer : null;

        return (
          <div key={log.id} className="mypage-card">
            <div className="mypage-date">{formatDate(log.created_at)}</div>
            <div className="q-line">
              {log.subject && <span className="tag subject-tag">{log.subject}</span>} Q. {log.question}
            </div>
            {directAnswer ? (
              <div className="a-line">{directAnswer}</div>
            ) : resolvedAnswer ? (
              <>
                <div className="a-line">{resolvedAnswer}</div>
                <span className="tag muted">나중에 답변됨</span>
              </>
            ) : (
              <div className="a-line pending">답변 대기중이에요</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

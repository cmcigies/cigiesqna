import { useEffect, useState } from "react";
import { supabase, signOut } from "../supabaseClient";
import { matchQuestion } from "../lib/matching";
import MyPage from "./MyPage";

export default function StudentView({ user }) {
  const [tab, setTab] = useState("ask"); // ask | mypage
  const [qaList, setQaList] = useState([]);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState([]); // {question, answer|null, pending}
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    loadQaList();
  }, []);

  async function loadQaList() {
    const { data, error } = await supabase
      .from("qa_items")
      .select("id, question, answer, keywords, subject");
    if (error) {
      setLoadError(error.message);
      return;
    }
    setQaList(data || []);
  }

  async function handleAsk(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setQuery("");

    const { item, score } = matchQuestion(q, qaList);
    const matched = !!item;

    // 로그 기록 (실패해도 학생 화면 흐름은 막지 않음)
    await supabase.from("question_logs").insert({
      student_email: user.email,
      question: q,
      matched,
      qa_item_id: item?.id || null,
    });

    if (matched) {
      setHistory((h) => [...h, { question: q, answer: item.answer, pending: false }]);
      setLoading(false);
      return;
    }

    // 매칭 실패 → 미답변 큐 등록 + 선생님 이메일 알림
    await supabase.from("unanswered_questions").insert({
      student_email: user.email,
      question: q,
      status: "pending",
    });

    try {
      await fetch("/api/notify-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, studentEmail: user.email }),
      });
    } catch (err) {
      // 이메일 실패해도 미답변 큐에는 이미 저장되어 있으니 조용히 넘어감
      console.error("이메일 알림 실패:", err);
    }

    setHistory((h) => [...h, { question: q, answer: null, pending: true }]);
    setLoading(false);
  }

  return (
    <div className="student-screen">
      <header className="topbar">
        <span className="brand-mark small">Q&A</span>
        <div className="user-chip">
          {user.email}
          <button className="link-btn" onClick={signOut}>로그아웃</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "ask" ? "active" : ""} onClick={() => setTab("ask")}>
          질문하기
        </button>
        <button className={tab === "mypage" ? "active" : ""} onClick={() => setTab("mypage")}>
          마이페이지
        </button>
      </nav>

      {tab === "mypage" ? (
        <main className="chat-area">
          <MyPage user={user} />
        </main>
      ) : (
        <>
          <main className="chat-area">
            {history.length === 0 && (
              <div className="empty-state">
                <p>영어 수업 중 궁금한 걸 편하게 물어보세요.</p>
                <p className="muted">등록된 답변이 없으면 선생님께 바로 전달돼요.</p>
              </div>
            )}
            {history.map((h, i) => (
              <div key={i} className="qa-bubble">
                <div className="q-line">Q. {h.question}</div>
                {h.pending ? (
                  <div className="a-line pending">아직 등록된 답이 없어서 선생님께 전달했어요. 곧 답변해 주실 거예요!</div>
                ) : (
                  <div className="a-line">{h.answer}</div>
                )}
              </div>
            ))}
            {loadError && <div className="error-line">Q&A 목록을 불러오지 못했어요: {loadError}</div>}
          </main>

          <form className="ask-form" onSubmit={handleAsk}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="궁금한 걸 입력하세요 (예: 현재완료 언제 써요?)"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !query.trim()}>
              {loading ? "확인 중..." : "질문하기"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase, signOut } from "../supabaseClient";
import { matchQuestion } from "../lib/matching";
import MyPage from "./MyPage";

export default function StudentView({ user }) {
  const [tab, setTab] = useState("ask"); // ask | mypage
  const [qaList, setQaList] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState([]); // {question, answer|null, pending, subject}
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const [hasUnreadMyPage, setHasUnreadMyPage] = useState(false);
  const [myPageRefreshKey, setMyPageRefreshKey] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

  // 내 질문에 선생님이 답변을 등록하면(미답변 → 답변완료) 새로고침 없이 알림
  useEffect(() => {
    const channel = supabase
      .channel(`student-answers-${user.email}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "unanswered_questions",
          filter: `student_email=eq.${user.email}`,
        },
        (payload) => {
          if (payload.new.status === "answered" && payload.old.status !== "answered") {
            showToast(`"${payload.new.question}" 질문에 답변이 등록됐어요!`);
            setHasUnreadMyPage(true);
            setMyPageRefreshKey((k) => k + 1);
            loadInitialData(); // 다음 질문 매칭에 새 답변이 반영되도록 Q&A 목록 갱신
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email]);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  function openTab(nextTab) {
    setTab(nextTab);
    if (nextTab === "mypage") setHasUnreadMyPage(false);
  }

  async function loadInitialData() {
    const [{ data: qaData, error: qaErr }, { data: subjectData, error: subjectErr }] = await Promise.all([
      supabase.from("qa_items").select("id, question, answer, keywords, subject"),
      supabase.from("subjects").select("id, name").order("name", { ascending: true }),
    ]);
    if (qaErr) setLoadError(qaErr.message);
    else if (subjectErr) setLoadError(subjectErr.message);
    setQaList(qaData || []);
    setSubjects(subjectData || []);
  }

  async function handleAsk(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q || !selectedSubject || loading) return;
    setLoading(true);
    setQuery("");

    const scopedList = qaList.filter((item) => item.subject === selectedSubject);
    const { item } = matchQuestion(q, scopedList);
    const matched = !!item;

    // 로그 기록 (실패해도 학생 화면 흐름은 막지 않음)
    await supabase.from("question_logs").insert({
      student_email: user.email,
      question: q,
      subject: selectedSubject,
      matched,
      qa_item_id: item?.id || null,
    });

    if (matched) {
      setHistory((h) => [...h, { question: q, subject: selectedSubject, answer: item.answer, pending: false }]);
      setLoading(false);
      return;
    }

    // 매칭 실패 → 미답변 큐 등록 + 선생님 이메일 알림
    await supabase.from("unanswered_questions").insert({
      student_email: user.email,
      question: q,
      subject: selectedSubject,
      status: "pending",
    });

    try {
      await fetch("/api/notify-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, studentEmail: user.email, subject: selectedSubject }),
      });
    } catch (err) {
      // 이메일 실패해도 미답변 큐에는 이미 저장되어 있으니 조용히 넘어감
      console.error("이메일 알림 실패:", err);
    }

    setHistory((h) => [...h, { question: q, subject: selectedSubject, answer: null, pending: true }]);
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
        <button className={tab === "ask" ? "active" : ""} onClick={() => openTab("ask")}>
          질문하기
        </button>
        <button className={tab === "mypage" ? "active" : ""} onClick={() => openTab("mypage")}>
          마이페이지 {hasUnreadMyPage && <span className="dot" />}
        </button>
      </nav>

      {toast && <div className="toast">{toast}</div>}

      {tab === "mypage" ? (
        <main className="chat-area">
          <MyPage user={user} refreshKey={myPageRefreshKey} />
        </main>
      ) : (
        <>
          <main className="chat-area">
            {history.length === 0 && (
              <div className="empty-state">
                <p>영어 수업 중 궁금한 걸 편하게 물어보세요.</p>
                <p className="muted">과목을 먼저 선택한 뒤 질문할 수 있어요.</p>
              </div>
            )}
            {history.map((h, i) => (
              <div key={i} className="qa-bubble">
                <div className="q-line">
                  {h.subject && <span className="tag subject-tag">{h.subject}</span>} Q. {h.question}
                </div>
                {h.pending ? (
                  <div className="a-line pending">아직 등록된 답이 없어서 선생님께 전달했어요. 곧 답변해 주실 거예요!</div>
                ) : (
                  <div className="a-line">{h.answer}</div>
                )}
              </div>
            ))}
            {loadError && <div className="error-line">데이터를 불러오지 못했어요: {loadError}</div>}
          </main>

          <form className="ask-form subject-required" onSubmit={handleAsk}>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={loading}
              className="subject-select"
            >
              <option value="" disabled>과목 선택</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={selectedSubject ? "궁금한 걸 입력하세요" : "먼저 과목을 선택하세요"}
              disabled={loading || !selectedSubject}
            />
            <button type="submit" disabled={loading || !query.trim() || !selectedSubject}>
              {loading ? "확인 중..." : "질문하기"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

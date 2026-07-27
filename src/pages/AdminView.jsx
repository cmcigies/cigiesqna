import { useEffect, useState } from "react";
import { supabase, signOut } from "../supabaseClient";
import { suggestKeywords } from "../lib/matching";

export default function AdminView({ user }) {
  const [tab, setTab] = useState("pending"); // pending | list
  const [pending, setPending] = useState([]);
  const [qaList, setQaList] = useState([]);
  const [draftAnswers, setDraftAnswers] = useState({}); // id -> {answer, keywords, subject}
  const [newItem, setNewItem] = useState({ question: "", answer: "", keywords: "", subject: "" });
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [{ data: p }, { data: q }] = await Promise.all([
      supabase.from("unanswered_questions").select("*").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("qa_items").select("*").order("created_at", { ascending: false }),
    ]);
    setPending(p || []);
    setQaList(q || []);
  }

  function updateDraft(id, field, value) {
    setDraftAnswers((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  async function submitAnswer(pendingItem) {
    const draft = draftAnswers[pendingItem.id] || {};
    const answer = (draft.answer || "").trim();
    if (!answer) {
      setStatus("답변 내용을 입력해 주세요.");
      return;
    }
    const keywords =
      draft.keywords?.split(",").map((k) => k.trim()).filter(Boolean) ||
      suggestKeywords(pendingItem.question);

    const { data: inserted, error: insertErr } = await supabase
      .from("qa_items")
      .insert({
        question: pendingItem.question,
        answer,
        keywords,
        subject: draft.subject || "기타",
      })
      .select()
      .single();
    if (insertErr) {
      setStatus(`저장 실패: ${insertErr.message}`);
      return;
    }
    await supabase
      .from("unanswered_questions")
      .update({ status: "answered", answered_qa_item_id: inserted.id })
      .eq("id", pendingItem.id);
    setStatus("답변이 저장되고 목록에 반영됐어요.");
    loadAll();
  }

  async function addNewQaItem(e) {
    e.preventDefault();
    if (!newItem.question.trim() || !newItem.answer.trim()) return;
    const keywords = newItem.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    const { error } = await supabase.from("qa_items").insert({
      question: newItem.question.trim(),
      answer: newItem.answer.trim(),
      keywords,
      subject: newItem.subject || "기타",
    });
    if (error) {
      setStatus(`추가 실패: ${error.message}`);
      return;
    }
    setNewItem({ question: "", answer: "", keywords: "", subject: "" });
    loadAll();
  }

  async function deleteQaItem(id) {
    if (!confirm("이 Q&A를 삭제할까요?")) return;
    await supabase.from("qa_items").delete().eq("id", id);
    loadAll();
  }

  return (
    <div className="admin-screen">
      <header className="topbar">
        <span className="brand-mark small">Q&A 관리자</span>
        <div className="user-chip">
          {user.email}
          <button className="link-btn" onClick={signOut}>로그아웃</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>
          미답변 질문 {pending.length > 0 && <span className="badge">{pending.length}</span>}
        </button>
        <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>
          전체 Q&A 목록 ({qaList.length})
        </button>
      </nav>

      {status && <div className="status-line">{status}</div>}

      {tab === "pending" && (
        <div className="pending-list">
          {pending.length === 0 && <p className="muted">미답변 질문이 없어요. 👍</p>}
          {pending.map((p) => (
            <div key={p.id} className="pending-card">
              <div className="pending-q">
                <strong>{p.question}</strong>
                <span className="muted small"> · {p.student_email}</span>
              </div>
              <textarea
                placeholder="답변을 입력하세요"
                value={draftAnswers[p.id]?.answer || ""}
                onChange={(e) => updateDraft(p.id, "answer", e.target.value)}
              />
              <div className="row">
                <input
                  placeholder="키워드 (쉼표로 구분, 비워두면 자동 추출)"
                  value={draftAnswers[p.id]?.keywords || ""}
                  onChange={(e) => updateDraft(p.id, "keywords", e.target.value)}
                />
                <input
                  placeholder="과목 (예: 문법)"
                  value={draftAnswers[p.id]?.subject || ""}
                  onChange={(e) => updateDraft(p.id, "subject", e.target.value)}
                />
              </div>
              <button onClick={() => submitAnswer(p)}>답변 저장하고 목록에 추가</button>
            </div>
          ))}
        </div>
      )}

      {tab === "list" && (
        <div className="qa-list">
          <form className="add-form" onSubmit={addNewQaItem}>
            <h3>새 Q&A 직접 추가</h3>
            <input
              placeholder="질문"
              value={newItem.question}
              onChange={(e) => setNewItem({ ...newItem, question: e.target.value })}
            />
            <textarea
              placeholder="답변"
              value={newItem.answer}
              onChange={(e) => setNewItem({ ...newItem, answer: e.target.value })}
            />
            <div className="row">
              <input
                placeholder="키워드 (쉼표로 구분)"
                value={newItem.keywords}
                onChange={(e) => setNewItem({ ...newItem, keywords: e.target.value })}
              />
              <input
                placeholder="과목"
                value={newItem.subject}
                onChange={(e) => setNewItem({ ...newItem, subject: e.target.value })}
              />
            </div>
            <button type="submit">추가하기</button>
          </form>

          {qaList.map((item) => (
            <div key={item.id} className="qa-item-card">
              <div className="qa-item-q">{item.question}</div>
              <div className="qa-item-a">{item.answer}</div>
              <div className="qa-item-meta">
                <span className="tag">{item.subject}</span>
                {(item.keywords || []).map((k) => (
                  <span key={k} className="tag muted">{k}</span>
                ))}
                <button className="link-btn danger" onClick={() => deleteQaItem(item.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

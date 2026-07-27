import { useEffect, useState } from "react";
import { supabase, signOut } from "../supabaseClient";
import { suggestKeywords } from "../lib/matching";

const FALLBACK_SUBJECT = "기타";

export default function AdminView({ user }) {
  const [tab, setTab] = useState("pending"); // pending | list | settings
  const [pending, setPending] = useState([]);
  const [qaList, setQaList] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [draftAnswers, setDraftAnswers] = useState({}); // id -> {answer, keywords, subject}
  const [newItem, setNewItem] = useState({ question: "", answer: "", keywords: "", subject: "" });
  const [editDrafts, setEditDrafts] = useState({}); // qa_item id -> {question, answer, keywords, subject}
  const [editingId, setEditingId] = useState(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  // 학생이 새 질문을 올리면(매칭 실패) 새로고침 없이 미답변 목록에 반영 + 알림
  useEffect(() => {
    const channel = supabase
      .channel("admin-new-questions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "unanswered_questions" },
        (payload) => {
          setPending((prev) => {
            if (prev.some((p) => p.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          showToast(`새 질문이 도착했어요: ${payload.new.question}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadAll() {
    const [{ data: p }, { data: q }, { data: s }] = await Promise.all([
      supabase.from("unanswered_questions").select("*").eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("qa_items").select("*").order("created_at", { ascending: false }),
      supabase.from("subjects").select("*").order("name", { ascending: true }),
    ]);
    setPending(p || []);
    setQaList(q || []);
    setSubjects(s || []);
  }

  function subjectOptions() {
    return subjects.length > 0 ? subjects.map((s) => s.name) : [FALLBACK_SUBJECT];
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
        subject: draft.subject || pendingItem.subject || FALLBACK_SUBJECT,
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
      subject: newItem.subject || subjectOptions()[0] || FALLBACK_SUBJECT,
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
    const { error } = await supabase.from("qa_items").delete().eq("id", id);
    if (error) {
      setStatus(`삭제 실패: ${error.message}`);
      return;
    }
    setStatus("삭제됐어요.");
    loadAll();
  }

  async function deletePendingItem(id) {
    if (!confirm("이 질문을 목록에서 삭제할까요? (답변하지 않고 삭제)")) return;
    const { error } = await supabase.from("unanswered_questions").delete().eq("id", id);
    if (error) {
      setStatus(`삭제 실패: ${error.message}`);
      return;
    }
    setStatus("삭제됐어요.");
    loadAll();
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditDrafts((d) => ({
      ...d,
      [item.id]: {
        question: item.question,
        answer: item.answer,
        keywords: (item.keywords || []).join(", "),
        subject: item.subject || FALLBACK_SUBJECT,
      },
    }));
  }

  function updateEditDraft(id, field, value) {
    setEditDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  async function saveEdit(id) {
    const draft = editDrafts[id];
    if (!draft || !draft.question.trim() || !draft.answer.trim()) {
      setStatus("질문과 답변은 비워둘 수 없어요.");
      return;
    }
    const keywords = draft.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    const { error } = await supabase
      .from("qa_items")
      .update({
        question: draft.question.trim(),
        answer: draft.answer.trim(),
        keywords,
        subject: draft.subject || FALLBACK_SUBJECT,
      })
      .eq("id", id);
    if (error) {
      setStatus(`수정 실패: ${error.message}`);
      return;
    }
    setStatus("수정됐어요.");
    setEditingId(null);
    loadAll();
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function addSubject(e) {
    e.preventDefault();
    const name = newSubjectName.trim();
    if (!name) return;
    const { error } = await supabase.from("subjects").insert({ name });
    if (error) {
      setStatus(`과목 추가 실패: ${error.message}`);
      return;
    }
    setNewSubjectName("");
    loadAll();
  }

  async function deleteSubject(id, name) {
    if (name === FALLBACK_SUBJECT) {
      setStatus(`"${FALLBACK_SUBJECT}"는 기본 과목이라 삭제할 수 없어요.`);
      return;
    }
    if (!confirm(`"${name}" 과목을 삭제할까요? 이 과목으로 등록된 Q&A는 "${FALLBACK_SUBJECT}"로 남아있어요.`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) {
      setStatus(`과목 삭제 실패: ${error.message}`);
      return;
    }
    setStatus("과목이 삭제됐어요.");
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
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          설정
        </button>
      </nav>

      {status && <div className="status-line">{status}</div>}
      {toast && <div className="toast">{toast}</div>}

      {tab === "pending" && (
        <div className="pending-list">
          {pending.length === 0 && <p className="muted">미답변 질문이 없어요. 👍</p>}
          {pending.map((p) => (
            <div key={p.id} className="pending-card">
              <div className="pending-q">
                <strong>{p.question}</strong>
                <span className="muted small"> · {p.student_email}</span>
                {p.subject && <span className="tag muted"> {p.subject}</span>}
                <button className="link-btn danger pending-delete" onClick={() => deletePendingItem(p.id)}>삭제</button>
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
                <select
                  value={draftAnswers[p.id]?.subject || p.subject || FALLBACK_SUBJECT}
                  onChange={(e) => updateDraft(p.id, "subject", e.target.value)}
                >
                  {subjectOptions().map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
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
              <select
                value={newItem.subject || subjectOptions()[0] || FALLBACK_SUBJECT}
                onChange={(e) => setNewItem({ ...newItem, subject: e.target.value })}
              >
                {subjectOptions().map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <button type="submit">추가하기</button>
          </form>

          {qaList.map((item) =>
            editingId === item.id ? (
              <div key={item.id} className="qa-item-card">
                <input
                  value={editDrafts[item.id]?.question || ""}
                  onChange={(e) => updateEditDraft(item.id, "question", e.target.value)}
                />
                <textarea
                  value={editDrafts[item.id]?.answer || ""}
                  onChange={(e) => updateEditDraft(item.id, "answer", e.target.value)}
                />
                <div className="row">
                  <input
                    placeholder="키워드 (쉼표로 구분)"
                    value={editDrafts[item.id]?.keywords || ""}
                    onChange={(e) => updateEditDraft(item.id, "keywords", e.target.value)}
                  />
                  <select
                    value={editDrafts[item.id]?.subject || FALLBACK_SUBJECT}
                    onChange={(e) => updateEditDraft(item.id, "subject", e.target.value)}
                  >
                    {subjectOptions().map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="row">
                  <button onClick={() => saveEdit(item.id)}>저장</button>
                  <button className="secondary-btn" onClick={cancelEdit}>취소</button>
                </div>
              </div>
            ) : (
              <div key={item.id} className="qa-item-card">
                <div className="qa-item-q">{item.question}</div>
                <div className="qa-item-a">{item.answer}</div>
                <div className="qa-item-meta">
                  <span className="tag">{item.subject}</span>
                  {(item.keywords || []).map((k) => (
                    <span key={k} className="tag muted">{k}</span>
                  ))}
                  <button className="link-btn" onClick={() => startEdit(item)}>수정</button>
                  <button className="link-btn danger" onClick={() => deleteQaItem(item.id)}>삭제</button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="settings-panel">
          <div className="add-form">
            <h3>과목(카테고리) 관리</h3>
            <form className="row" onSubmit={addSubject}>
              <input
                placeholder="새 과목 이름 (예: 문법, 어휘, 독해)"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
              />
              <button type="submit">추가</button>
            </form>
            <div className="subject-list">
              {subjects.map((s) => (
                <div key={s.id} className="subject-row">
                  <span>{s.name}</span>
                  <button className="link-btn danger" onClick={() => deleteSubject(s.id, s.name)}>삭제</button>
                </div>
              ))}
            </div>
            <p className="muted small">
              학생이 질문할 때 여기 등록된 과목 중 하나를 선택해야 질문할 수 있어요.
              과목을 삭제해도 이미 등록된 Q&A는 그대로 남아있어요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

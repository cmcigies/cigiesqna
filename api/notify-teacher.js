import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }

  const { question, studentEmail } = req.body || {};
  if (!question) {
    return res.status(400).json({ error: "question이 필요합니다." });
  }

  try {
    await resend.emails.send({
      from: process.env.NOTIFY_FROM_EMAIL || "onboarding@resend.dev",
      to: process.env.TEACHER_EMAIL,
      subject: "새로운 미답변 질문이 있어요",
      html: `
        <p><strong>학생:</strong> ${escapeHtml(studentEmail || "알 수 없음")}</p>
        <p><strong>질문:</strong> ${escapeHtml(question)}</p>
        <p><a href="${process.env.APP_URL || ""}">관리자 페이지에서 답변하기</a></p>
      `,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("메일 발송 실패:", err);
    return res.status(500).json({ error: "메일 발송 실패" });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

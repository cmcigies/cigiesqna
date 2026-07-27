import { signInWithGoogle } from "../supabaseClient";

export default function Login() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-mark">Q&A</div>
        <h1>질문하기 전에</h1>
        <p>구글 계정으로 로그인하면 질문을 남길 수 있어요.</p>
        <button className="google-btn" onClick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.5 5.5 29.5 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l6-6C34.5 6.5 29.5 4.5 24 4.5c-7.9 0-14.7 4.5-18.1 11.1z"/>
            <path fill="#4CAF50" d="M24 44.5c5.4 0 10.3-1.9 14.1-5.1l-6.5-5.5C29.5 35.6 26.9 36.5 24 36.5c-5.3 0-9.8-3.4-11.4-8.1l-6.5 5C9.3 40 16 44.5 24 44.5z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.6-2.6 4.8-4.8 6.4l6.5 5.5C40.6 37.1 44.5 31.2 44.5 24c0-1.2-.1-2.4-.3-3.5z"/>
          </svg>
          구글 계정으로 로그인
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase, TEACHER_EMAIL } from "./supabaseClient";
import Login from "./pages/Login";
import StudentView from "./pages/StudentView";
import AdminView from "./pages/AdminView";
import "./styles.css";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = 로딩중

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="loading-screen">불러오는 중...</div>;
  }

  if (!session) {
    return <Login />;
  }

  const isTeacher = session.user.email === TEACHER_EMAIL;

  return isTeacher ? (
    <AdminView user={session.user} />
  ) : (
    <StudentView user={session.user} />
  );
}

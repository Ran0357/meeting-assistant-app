import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import MeetingApp from "./pages/MeetingApp";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { supabase } from "./lib/supabaseClient";

export default function App() {
  useEffect(() => {
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        await supabase.auth.signInAnonymously();
      }
    };

    initAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* ログインページ */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* ログイン後だけ入れる */}
        <Route
          path="/meeting"
          element={
            <ProtectedRoute>
              <MeetingApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

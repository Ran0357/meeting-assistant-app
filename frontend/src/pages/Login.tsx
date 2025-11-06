import { useState } from "react";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ API は Vite proxy に任せるので /api で OK
  const API_URL = "/api/auth";

  const submit = async () => {
    setError("");
    setLoading(true);

    const endpoint = mode === "login" ? "login" : "register";

    try {
      const res = await fetch(`${API_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || "エラーが発生しました");
        setLoading(false);
        return;
      }

      if (mode === "register") {
        alert("登録成功！メールを確認してください");
      } else {
        // ✅ ログイン成功 → トークンを保存
        if (data.access_token) {
          localStorage.setItem("access_token", data.access_token);
        }
        alert("ログイン成功！");
        window.location.href = "/meeting";
      }
    } catch (e) {
      console.error(e);
      setError("通信エラーが発生しました");
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 320, margin: "auto", marginTop: 50 }}>
      <h2>{mode === "login" ? "ログイン" : "新規登録"}</h2>

      {error && <div style={{ color: "red", marginBottom: 10 }}>{error}</div>}

      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <button onClick={submit} disabled={loading} style={{ width: "100%" }}>
        {loading
          ? "処理中..."
          : mode === "login"
          ? "ログイン"
          : "新規登録"}
      </button>

      <div style={{ marginTop: 12 }}>
        {mode === "login" ? (
          <span onClick={() => setMode("register")} style={{ cursor: "pointer", color: "blue" }}>
            アカウント作成はこちら
          </span>
        ) : (
          <span onClick={() => setMode("login")} style={{ cursor: "pointer", color: "blue" }}>
            すでにアカウントを持っていますか？ログイン
          </span>
        )}
      </div>
    </div>
  );
}

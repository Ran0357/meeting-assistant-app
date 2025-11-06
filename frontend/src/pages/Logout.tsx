// frontend/src/pages/Logout.tsx
import { useEffect } from "react";

export default function Logout() {
  useEffect(() => {
    const logout = async () => {
      try {
        await fetch("https://<backend-url>/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (e) {
        console.error(e);
      } finally {
        window.location.href = "/login";
      }
    };

    logout();
  }, []);

  return <div>ログアウト中...</div>;
}

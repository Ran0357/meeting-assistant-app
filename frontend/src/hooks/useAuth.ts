import { useState, useEffect } from "react";

interface User {
  email: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Unauthorized");

        const data = await res.json();

        setUser({ email: data.email });
      } catch (err) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [API_BASE_URL]);

  return { user, loading };
};

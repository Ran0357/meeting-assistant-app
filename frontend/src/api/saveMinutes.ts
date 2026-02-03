export async function saveMinutes(minutes: any, token: string) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const res = await fetch(`${API_BASE_URL}/api/save_minutes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(minutes),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return await res.json();
}

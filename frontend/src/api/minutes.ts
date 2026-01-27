export async function generateMinutes(transcript: string) {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/generate_minutes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ transcript }),
    }
  );

  if (!res.ok) throw new Error("議事録生成失敗");

  return await res.json();
}

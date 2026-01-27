export async function generateMinutes(transcript: string, token: string) {
  const baseUrl = process.env.VITE_API_BASE_URL || "";
  const res = await fetch(`${baseUrl}/api/generate_minutes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`, // ここを追加
    },
    body: JSON.stringify({ transcript }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`議事録生成失敗: ${res.status} ${text}`);
  }

  return await res.json();
}

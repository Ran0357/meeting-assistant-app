export async function generateMinutes(transcript: string, token: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";

  const res = await fetch(`${baseUrl}/api/generate_minutes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ transcript }),
  });

  if (!res.ok) {
    let errorText = "";
    try {
      errorText = await res.text();
    } catch {
      errorText = "No response body";
    }

    console.error("API Error:", {
      status: res.status,
      statusText: res.statusText,
      body: errorText,
    });

    throw new Error(`議事録生成失敗: ${res.status} ${errorText}`);
  }

  return res.json();
}

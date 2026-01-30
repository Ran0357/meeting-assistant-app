import { serve } from "std/http/server";

// CORSヘッダー
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ActionItem {
  description: string;
  owner_name?: string | null;
  due_date?: string | null;
}

serve(async (req: Request) => {
  // OPTIONS（プリフライト）リクエスト対応
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const items: ActionItem[] = body.items || [];

    if (!items.length) {
      return new Response(
        JSON.stringify({ error: "No items provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
    if (!SLACK_BOT_TOKEN) throw new Error("Slack bot token missing");

    const DEFAULT_CHANNEL = Deno.env.get("SLACK_DEFAULT_CHANNEL") || "#general";

    // Slack通知
    for (const item of items) {
      if (!item.description) continue;

      const text = `📌 *アクションアイテム*\n` +
                   `• 内容：${item.description}\n` +
                   `• 担当：${item.owner_name || "未設定"}\n` +
                   `• 期限：${item.due_date || "未定"}`;

      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: DEFAULT_CHANNEL,
          text,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error("Slack error:", data);
        throw new Error(data.error || "Slack post failed");
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Function error:", err);

    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

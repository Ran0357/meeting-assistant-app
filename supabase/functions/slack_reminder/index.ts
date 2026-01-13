import { serve } from "std/http/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { items } = await req.json();

    const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
    if (!SLACK_BOT_TOKEN) {
      throw new Error("Slack bot token missing");
    }

    // 🔽 送信先チャンネル（#general など）
    const DEFAULT_CHANNEL =
      Deno.env.get("SLACK_DEFAULT_CHANNEL") || "#general";

    for (const item of items) {
      if (!item.description || !item.due_date) continue;

      const text =
        `📌 *アクションアイテム*\n` +
        `• 内容：${item.description}\n` +
        `• 担当：${item.owner_name || "未設定"}\n` +
        `• 期限：${item.due_date}`;

      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
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
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 400,
      }
    );
  }
});

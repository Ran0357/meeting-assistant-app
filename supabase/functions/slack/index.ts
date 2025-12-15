import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "content-type, Authorization",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    const { text, actionItems } = await req.json();

    

    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
      });
    }

    // デバッグ用ログ
    const token = Deno.env.get("SLACK_BOT_TOKEN");
    const channel = Deno.env.get("SLACK_DEFAULT_CHANNEL");

     // Slack に送るメッセージ作成
    let message = text;

    if (actionItems && actionItems.length > 0) {
      const itemsText = actionItems
        .map((a: any, i: number) => `${i + 1}. ${a.description} 担当: ${a.owner_name || '未定'} 期限: ${a.due_date || '未定'}`)
        .join("\n");
      message += "\n\nアクションアイテム:\n" + itemsText;
    }

    const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text: message }),
    });

    const data = await slackRes.json();

    if (!data.ok) {
      console.log("Slack API error:", data);
      return new Response(JSON.stringify({ error: data.error }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    console.error("Function error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

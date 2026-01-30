import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

serve(async (_req) => {
  // =========================
  // Supabase client（service_role）
  // =========================
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // =========================
  // Slack設定
  // =========================
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  const channel = Deno.env.get("SLACK_DEFAULT_CHANNEL") || "#general";

  if (!token) {
    console.error("Slack token missing");
    return new Response("Slack token missing", { status: 500 });
  }

  // =========================
  // 明日（JST）の日付
  // =========================
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const tomorrow = new Date(jstNow);
  tomorrow.setDate(jstNow.getDate() + 1);

  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

  console.log("Tomorrow (JST):", tomorrowStr);

  // =========================
  // 前日通知対象を取得
  // =========================
  const { data: todos, error } = await supabase
    .from("document_todos")
    .select("*")
    .eq("due_date", tomorrowStr)
    .eq("notify_before", true)
    .is("notified_before_at", null);

  if (error) {
    console.error("DB error:", error);
    return new Response("DB error", { status: 500 });
  }

  if (!todos || todos.length === 0) {
    console.log("No reminder targets");
    return new Response("no targets", { status: 200 });
  }

  // =========================
  // Slack通知 & DB更新
  // =========================
  for (const todo of todos) {
    const text =
      `⏰ *明日が期限です！*\n` +
      `• 内容：${todo.description}\n` +
      `• 担当：${todo.owner_name || "未設定"}\n` +
      `• 期限：${todo.due_date}`;

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text,
      }),
    });

    const slackResult = await res.json();
    console.log("Slack response:", slackResult);

    if (!slackResult.ok) {
      console.error("Slack error:", slackResult);
      continue;
    }

    // 🔴 前日通知済みに更新
    await supabase
      .from("document_todos")
      .update({
        notified_before_at: new Date().toISOString(),
      })
      .eq("id", todo.id);
  }

  return new Response("ok", { status: 200 });
});

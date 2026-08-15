import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigin=(Deno.env.get("ALLOWED_ORIGIN")||"https://giansollie940.github.io").trim();
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin||"https://invalid.local",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const serviceRole = secretMap["default"] || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) return json(500, { ok: false, error: "Server secrets are missing" });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { ok: false, error: "Missing access token" });

    // Admin client is server-side only. We still authenticate the caller explicitly.
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (userError || !caller) return json(401, { ok: false, error: "Invalid session" });

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("role,active")
      .eq("id", caller.id)
      .single();

    if (profileError || !callerProfile?.active || callerProfile.role !== "teacher") {
      return json(403, { ok: false, error: "Chỉ giáo viên được đặt lại mật khẩu" });
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "");
    const newPassword = String(body?.newPassword || "");

    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      return json(400, { ok: false, error: "userId không hợp lệ" });
    }
    if (
      newPassword.length < 8
      || newPassword.length > 128
      || !/\p{L}/u.test(newPassword)
      || !/\d/u.test(newPassword)
    ) {
      return json(400, {
        ok: false,
        error: "Mật khẩu cần 8–128 ký tự và có cả chữ lẫn số"
      });
    }

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("role,active,student_code,full_name")
      .eq("id", userId)
      .single();

    if (targetError || !target) return json(404, { ok: false, error: "Không tìm thấy tài khoản" });
    if (target.role === "teacher") {
      return json(403, { ok: false, error: "Không đặt lại mật khẩu của giáo viên qua màn hình lớp" });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateError) return json(400, { ok: false, error: "Không cập nhật được mật khẩu" });

    await admin.from("audit_logs").insert({
      actor_id: caller.id,
      action: "ADMIN_RESET_PASSWORD",
      entity_type: "profile",
      entity_id: userId,
      new_data: { student_code: target.student_code, full_name: target.full_name },
    });

    return json(200, { ok: true, studentCode: target.student_code });
  } catch (err) {
    console.error(err);
    return json(500, {
      ok: false,
      code: "INTERNAL_ERROR",
      error: "Không thể hoàn tất yêu cầu. Vui lòng thử lại."
    });
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigin=(Deno.env.get("ALLOWED_ORIGIN")||"https://giansollie940.github.io").trim();
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin||"https://invalid.local",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status:number,body:unknown){
  return new Response(JSON.stringify(body),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"},
  });
}

function text(v:unknown,max=240){
  return String(v ?? "").replace(/\s+/g," ").trim().slice(0,max);
}

async function tryConsumeRateLimit(admin:any, actorId:string, action:string, maxCalls:number, windowSeconds:number){
  try{
    const now = new Date();
    const since = new Date(now.getTime()-windowSeconds*1000).toISOString();
    await admin.from("server_rate_limits").delete().lt("created_at", new Date(now.getTime()-86400000).toISOString());

    const { count, error:countError } = await admin
      .from("server_rate_limits")
      .select("id", { count:"exact", head:true })
      .eq("actor_id", actorId)
      .eq("action", action)
      .gte("created_at", since);

    if(countError) throw countError;
    if((count || 0) >= maxCalls){
      return {
        ok:false,
        status:429,
        body:{ ok:false, error:`Bạn thao tác quá nhanh. Vui lòng thử lại sau ${Math.ceil(windowSeconds/60)} phút.` }
      };
    }

    const { error:insertError } = await admin.from("server_rate_limits").insert({
      actor_id: actorId, action, created_at: now.toISOString()
    });
    if(insertError) throw insertError;
  }catch(error){
    console.warn("Rate limit soft-fail on audit-log:", error);
  }
  return { ok:true };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json(405,{ok:false,error:"Method not allowed"});

  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const secretMap=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const adminKey=secretMap["default"]
      || Object.values(secretMap).find(value=>typeof value==="string"&&value.startsWith("sb_secret_"))
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      || "";
    if(!url || !adminKey) return json(500,{ok:false,error:"Thiếu cấu hình máy chủ"});

    const authHeader=req.headers.get("Authorization")||"";
    const token=authHeader.replace(/^Bearer\s+/i,"").trim();
    if(!token) return json(401,{ok:false,error:"Thiếu phiên đăng nhập"});

    const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const { data:userData, error:userError } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if(userError || !caller) return json(401,{ok:false,error:"Phiên đăng nhập không hợp lệ"});

    const { data:profile, error:profileError } = await admin
      .from("profiles")
      .select("id,role,active")
      .eq("id", caller.id)
      .single();

    if(profileError || !profile?.active){
      return json(403,{ok:false,error:"Tài khoản không còn hoạt động"});
    }

    const body=await req.json().catch(()=>({}));
    const incoming = Array.isArray(body?.entries) ? body.entries.slice(0,20) : [];
    if(!incoming.length) return json(400,{ok:false,error:"Không có dữ liệu nhật ký"});

    const rate = await tryConsumeRateLimit(admin, caller.id, "audit_log_batch", 60, 300);
    if(rate.ok===false){}
    if(rate.ok===false) return json(rate.status!, rate.body);

    const rows = incoming
      .map((item:any)=>({
        actor_id: caller.id,
        action: text(item?.action || "Thay đổi", 120),
        entity_type: text(item?.entityType || "web_app", 48),
        entity_id: text(item?.entityId || "", 120),
        old_data: null,
        new_data: {
          detail: text(item?.detail || "", 600),
          source: "frontend-via-edge",
          role: profile.role || null,
        },
        created_at: item?.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString()
      }))
      .filter((row:any)=>row.action);

    if(!rows.length) return json(400,{ok:false,error:"Không có bản ghi hợp lệ"});

    const { error:insertError } = await admin.from("audit_logs").insert(rows);
    if(insertError) return json(500,{ok:false,error:"Không ghi được nhật ký hệ thống"});

    return json(200,{ok:true,count:rows.length});
  }catch(err){
    console.error(err);
    return json(500,{ok:false,code:"INTERNAL_ERROR",error:"Không thể hoàn tất yêu cầu. Vui lòng thử lại."});
  }
});

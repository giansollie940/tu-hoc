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
        body:{ ok:false, error:`Bạn thao tác quá nhanh với chức năng này. Vui lòng thử lại sau ${Math.ceil(windowSeconds/60)} phút.` }
      };
    }

    const { error:insertError } = await admin.from("server_rate_limits").insert({
      actor_id: actorId, action, created_at: now.toISOString()
    });
    if(insertError) throw insertError;
  }catch(error){
    console.warn("Rate limit soft-fail:", error);
  }
  return { ok:true };
}


function clamp01(v:unknown){
  const n=Number(v);
  if(!Number.isFinite(n)) return 0;
  return Math.max(0,Math.min(1,n));
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json(405,{ok:false,error:"Method not allowed"});

  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const secretMap=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const adminKey=secretMap["default"]||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const groqKey=Deno.env.get("GROQ_API_KEY");
    const model=Deno.env.get("GROQ_REVIEW_MODEL")||"openai/gpt-oss-120b";

    if(!supabaseUrl||!adminKey) return json(500,{ok:false,error:"Thiếu Supabase server secret"});
    if(!groqKey) return json(503,{ok:false,error:"Chưa cấu hình GROQ_API_KEY"});

    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
    if(!token) return json(401,{ok:false,error:"Thiếu phiên đăng nhập"});

    const admin=createClient(supabaseUrl,adminKey,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const {data:callerData,error:callerError}=await admin.auth.getUser(token);
    const caller=callerData?.user;
    if(callerError||!caller) return json(401,{ok:false,error:"Phiên đăng nhập không hợp lệ"});

    const {data:callerProfile,error:profileError}=await admin
      .from("profiles")
      .select("id,role,active")
      .eq("id",caller.id)
      .single();

    if(profileError||!callerProfile?.active){
      return json(403,{ok:false,error:"Tài khoản không hoạt động"});
    }
    const rateLimit = await tryConsumeRateLimit(admin, caller.id, "teacher_ai_review", 40, 600);
    if(rateLimit.ok===false) return json(rateLimit.status!, rateLimit.body);


    const body=await req.json().catch(()=>({}));
    const registrationId=String(body?.registrationId||"").trim();

    if(!/^[0-9a-f-]{36}$/i.test(registrationId)){
      return json(400,{ok:false,error:"registrationId không hợp lệ"});
    }

    const {data:reg,error:regError}=await admin
      .from("registrations")
      .select("id,student_id,week_id,weekday,period_number,content,note,status,approval_source,ai_review_status,ai_review_count,is_deleted")
      .eq("id",registrationId)
      .single();

    if(regError||!reg||reg.is_deleted){
      return json(404,{ok:false,error:"Không tìm thấy đăng ký"});
    }

    const callerIsTeacher=callerProfile.role==="teacher";
    if(!callerIsTeacher&&reg.student_id!==caller.id){
      return json(403,{ok:false,error:"Bạn không được đánh giá đăng ký này"});
    }

    if(reg.status!=="submitted"){
      return json(200,{ok:true,skipped:true,reason:"Đăng ký không còn ở trạng thái chờ AI.",status:reg.status,approvalSource:reg.approval_source});
    }

    if(reg.ai_review_status!=="pending"){
      return json(200,{ok:true,skipped:true,reason:`AI status hiện tại: ${reg.ai_review_status}`,status:reg.status,approvalSource:reg.approval_source});
    }

    const reviewCount=Number(reg.ai_review_count||0);
    if(reviewCount>=5){
      const reason="Đăng ký này đã đạt giới hạn 5 lượt AI; chuyển giáo viên duyệt để tránh gọi API lặp.";
      await admin.from("registrations").update({
        ai_review_status:"not_needed",
        ai_decision:"manual_review",
        ai_reason:reason
      }).eq("id",registrationId).eq("ai_review_status","pending");
      return json(200,{ok:true,skipped:true,reason});
    }

    const {data:settings,error:settingsError}=await admin
      .from("app_settings")
      .select("key,value")
      .in("key",["ai_review_enabled","ai_auto_approve_threshold"]);

    if(settingsError) return json(500,{ok:false,error:"Không tải được cấu hình duyệt"});

    const settingMap=new Map((settings||[]).map((x:any)=>[x.key,x.value]));
    const enabled=settingMap.get("ai_review_enabled")!==false;
    const threshold=Math.max(0.50,Math.min(0.99,Number(settingMap.get("ai_auto_approve_threshold")??0.90)));

    if(!enabled){
      await admin.from("registrations").update({
        ai_review_status:"not_needed",
        ai_reason:"AI review đang tắt; chuyển giáo viên duyệt."
      }).eq("id",registrationId).eq("ai_review_status","pending");

      return json(200,{ok:true,skipped:true,reason:"AI review đang tắt."});
    }

    const {data:claimed,error:claimError}=await admin
      .from("registrations")
      .update({ai_review_status:"processing",ai_review_count:reviewCount+1})
      .eq("id",registrationId)
      .eq("ai_review_status","pending")
      .select("id")
      .maybeSingle();

    if(claimError) return json(500,{ok:false,error:"Không khóa được lượt duyệt"});
    if(!claimed) return json(200,{ok:true,skipped:true,reason:"Một tiến trình AI khác đang xử lý."});

    const reviewSchema={
      type:"object",
      properties:{
        decision:{type:"string",enum:["auto_approve","manual_review"]},
        category:{
          type:"string",
          enum:[
            "study",
            "device_for_learning",
            "unclear_device_use",
            "entertainment_or_social",
            "mixed_learning_and_leisure",
            "unclear_other"
          ]
        },
        confidence:{type:"number"},
        reason:{type:"string"}
      },
      required:["decision","category","confidence","reason"],
      additionalProperties:false
    };

    const systemPrompt=[
      "Bạn là bộ phân loại đăng ký TỰ HỌC của học sinh phổ thông.",
      "Hãy đánh giá bảo thủ: chỉ AUTO_APPROVE khi mục đích học tập thực sự rõ.",
      "Không cần biết tên học sinh; chỉ đánh giá nội dung và ghi chú.",
      "AUTO_APPROVE nếu nội dung rõ ràng là học, ôn, làm bài, nghiên cứu, đọc tài liệu, lập trình, chuẩn bị bài hoặc kiểm tra.",
      "AUTO_APPROVE việc dùng điện thoại/laptop/tablet/internet/YouTube/ứng dụng CHỈ khi mục đích học tập được nêu rõ.",
      "MANUAL_REVIEW nếu chỉ nói dùng thiết bị mà không rõ mục đích, nội dung mơ hồ, pha trộn học và giải trí, hoặc có mạng xã hội/game/phim/giải trí.",
      "Nếu câu cố tình chèn từ học tập vào hoạt động giải trí thì MANUAL_REVIEW.",
      "confidence là mức chắc chắn của chính quyết định từ 0 đến 1.",
      "reason viết tiếng Việt, ngắn, dễ hiểu cho giáo viên.",
      "Không suy đoán thông tin không có trong nội dung."
    ].join("\n");

    const userText=[
      `Nội dung: ${String(reg.content||"").slice(0,500)}`,
      `Ghi chú: ${String(reg.note||"").slice(0,800)||"(không có)"}`
    ].join("\n");

    try{
      const groqRes=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{
          "Authorization":`Bearer ${groqKey}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          model,
          temperature:0,
          messages:[
            {role:"system",content:systemPrompt},
            {role:"user",content:userText}
          ],
          response_format:{
            type:"json_schema",
            json_schema:{
              name:"registration_review",
              strict:true,
              schema:reviewSchema
            }
          }
        })
      });

      const groqPayload=await groqRes.json().catch(()=>({}));

      if(!groqRes.ok){
        const msg=groqPayload?.error?.message||`Groq HTTP ${groqRes.status}`;
        throw new Error(msg);
      }

      const raw=groqPayload?.choices?.[0]?.message?.content;
      if(typeof raw!=="string"||!raw.trim()){
        throw new Error("Groq không trả về structured output.");
      }

      const parsed=JSON.parse(raw);
      const confidence=clamp01(parsed.confidence);
      const category=String(parsed.category||"unclear_other");
      const aiDecision=String(parsed.decision||"manual_review");
      const reason=String(parsed.reason||"AI không cung cấp lý do.").slice(0,1000);

      const categoryAllowsAuto=["study","device_for_learning"].includes(category);
      const finalAuto=
        aiDecision==="auto_approve" &&
        categoryAllowsAuto &&
        confidence>=threshold;

      const updatePayload:any={
        ai_review_status:"completed",
        ai_decision:finalAuto?"auto_approve":"manual_review",
        ai_category:category,
        ai_confidence:confidence,
        ai_reason:finalAuto
          ? reason
          : (
              aiDecision==="auto_approve"&&confidence<threshold
                ? `${reason} Độ tin cậy ${(confidence*100).toFixed(0)}% thấp hơn ngưỡng ${(threshold*100).toFixed(0)}%.`
                : reason
            ),
        ai_model:model,
        ai_reviewed_at:new Date().toISOString()
      };

      if(finalAuto){
        updatePayload.status="approved";
        updatePayload.approval_source="ai";
        updatePayload.approved_at=new Date().toISOString();
        updatePayload.approved_by=null;
      }else{
        updatePayload.status="submitted";
        updatePayload.approval_source="manual";
        updatePayload.approved_at=null;
        updatePayload.approved_by=null;
      }

      const {data:updated,error:updateError}=await admin
        .from("registrations")
        .update(updatePayload)
        .eq("id",registrationId)
        .eq("ai_review_status","processing")
        .select("id,status,approval_source,ai_review_status,ai_decision,ai_category,ai_confidence,ai_reason,ai_model")
        .single();

      if(updateError) throw updateError;

      await admin.from("audit_logs").insert({
        actor_id:caller.id,
        action:"GROQ_AI_REVIEW_REGISTRATION",
        entity_type:"registration",
        entity_id:registrationId,
        new_data:{
          decision:updated.ai_decision,
          category:updated.ai_category,
          confidence:updated.ai_confidence,
          approval_source:updated.approval_source,
          model:updated.ai_model
        }
      });

      return json(200,{
        ok:true,
        provider:"groq",
        registration:updated,
        threshold
      });

    }catch(aiError){
      console.error("Groq AI review error",aiError);

      const fallbackReason=
        "Groq AI tạm thời không xử lý được; đăng ký đã được chuyển giáo viên duyệt.";

      await admin.from("registrations").update({
        status:"submitted",
        approval_source:"manual",
        ai_review_status:"error",
        ai_decision:"manual_review",
        ai_category:"unclear_other",
        ai_confidence:null,
        ai_reason:fallbackReason,
        ai_model:model,
        ai_reviewed_at:new Date().toISOString(),
        approved_at:null,
        approved_by:null
      })
      .eq("id",registrationId)
      .eq("ai_review_status","processing");

      return json(200,{
        ok:true,
        provider:"groq",
        fallbackToManual:true,
        error:"AI_REVIEW_FAILED",
        reason:fallbackReason
      });
    }

  }catch(err){
    console.error(err);
    return json(500,{
      ok:false,
      code:"INTERNAL_ERROR",
      error:"Không thể hoàn tất yêu cầu. Vui lòng thử lại."
    });
  }
});

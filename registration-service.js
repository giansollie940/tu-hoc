import { normalizeDeviceChoice } from "../features/registration/registration-domain.js";
import { getSupabaseClient } from "./supabase-client.js";

export const REGISTRATION_COLUMNS = [
  "id",
  "student_id",
  "week_id",
  "weekday",
  "period_number",
  "content",
  "note",
  "status",
  "teacher_comment",
  "approval_source",
  "auto_review_reason",
  "ai_review_status",
  "ai_decision",
  "ai_category",
  "ai_confidence",
  "ai_reason",
  "ai_model",
  "ai_reviewed_at",
  "ai_review_count",
  "is_emergency",
  "emergency_reason",
  "emergency_requested_at",
  "uses_electronic_device",
  "device_detection_source",
  "device_detection_confidence",
  "is_deleted",
  "submitted_at",
  "updated_at",
  "approved_at"
].join(",");

export function mapRegistration(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    weekId: row.week_id,
    dow: Number(row.weekday) - 1,
    period: Number(row.period_number),
    content: row.content,
    note: row.note ?? "",
    status: row.status,
    teacherComment: row.teacher_comment ?? "",
    approvalSource: row.approval_source ?? "manual",
    autoReviewReason: row.auto_review_reason ?? "",
    aiReviewStatus: row.ai_review_status ?? "not_needed",
    aiDecision: row.ai_decision ?? "",
    aiCategory: row.ai_category ?? "",
    aiConfidence: row.ai_confidence == null ? null : Number(row.ai_confidence),
    aiReason: row.ai_reason ?? "",
    aiModel: row.ai_model ?? "",
    aiReviewedAt: row.ai_reviewed_at ?? null,
    aiReviewCount: Number(row.ai_review_count ?? 0),
    isEmergency: row.is_emergency === true,
    emergencyReason: row.emergency_reason ?? "",
    emergencyRequestedAt: row.emergency_requested_at ?? null,
    usesElectronicDevice: row.uses_electronic_device === true,
    deviceDetectionSource: row.device_detection_source ?? "",
    deviceDetectionConfidence: row.device_detection_confidence == null ? null : Number(row.device_detection_confidence),
    isDeleted: row.is_deleted === true,
    submittedAt: row.submitted_at ?? null,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    approvedAt: row.approved_at ? new Date(row.approved_at).getTime() : null
  };
}

function registrationRow(registration, { includeIdentity = true } = {}) {
  const row = {
    content: String(registration.content ?? "").trim(),
    note: String(registration.note ?? "").trim() || null,
    status: registration.status,
    teacher_comment: registration.teacherComment || null,
    uses_electronic_device: normalizeDeviceChoice(registration.usesElectronicDevice),
    updated_at: new Date().toISOString()
  };
  if (includeIdentity) {
    row.student_id = registration.studentId;
    row.week_id = registration.weekId;
    row.weekday = Number(registration.dow) + 1;
    row.period_number = Number(registration.period);
  }
  if (registration.status === "submitted") row.submitted_at = new Date().toISOString();
  return row;
}

export function createRegistrationService(client) {
  return {
    async loadWeekRegistrations({ weekId, role, studentId }) {
      let query = client
        .from("registrations")
        .select(REGISTRATION_COLUMNS)
        .eq("week_id", weekId)
        .eq("is_deleted", false);
      if (role === "student") query = query.eq("student_id", studentId);
      const { data, error } = await query.order("weekday").order("period_number");
      if (error) throw error;
      return (data ?? []).map(mapRegistration);
    },

    async saveRegistration(registration) {
      const hasServerId = /^[0-9a-f-]{36}$/i.test(String(registration.id ?? ""));
      const query = hasServerId
        ? client.from("registrations").update(registrationRow(registration, { includeIdentity: false })).eq("id", registration.id)
        : client.from("registrations").insert(registrationRow(registration));
      const { data, error } = await query.select(REGISTRATION_COLUMNS).single();
      if (error) throw error;
      return mapRegistration(data);
    },

    async emergencyRegister(payload) {
      const body = {
        weekId: payload.weekId,
        weekday: Number(payload.weekday),
        periodNumber: Number(payload.periodNumber),
        content: String(payload.content ?? "").trim(),
        note: String(payload.note ?? "").trim(),
        reason: String(payload.reason ?? "").trim(),
        usesElectronicDevice: normalizeDeviceChoice(payload.usesElectronicDevice)
      };
      const { data, error } = await client.functions.invoke("emergency-register", { body });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Không đăng ký bổ sung được.");
      return data.registration ? mapRegistration(data.registration) : null;
    },

    async requestAiReview(registrationId) {
      const { data, error } = await client.functions.invoke("ai-review-registration", {
        body: { registrationId }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Không gửi được yêu cầu AI.");
      return data;
    }
  };
}

let defaultService;
export function registrationService() {
  defaultService ??= createRegistrationService(getSupabaseClient());
  return defaultService;
}

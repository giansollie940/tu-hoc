import { REGISTRATION_COLUMNS, mapRegistration } from "./registration-service.js";
import { getSupabaseClient } from "./supabase-client.js";

const MEMBER_COLUMNS = "id,student_code,full_name,role,class_name,active";

function mapMember(row) {
  return {
    id: row.id,
    code: row.student_code ?? "",
    name: row.full_name,
    role: row.role,
    className: row.class_name ?? "",
    active: row.active !== false
  };
}

export function createDashboardService(client) {
  return {
    async loadClassWeek({ weekId }) {
      const [membersResult, registrationsResult] = await Promise.all([
        client.from("class_members").select(MEMBER_COLUMNS).eq("active", true).order("full_name"),
        client
          .from("registrations")
          .select(REGISTRATION_COLUMNS)
          .eq("week_id", weekId)
          .eq("is_deleted", false)
          .in("status", ["submitted", "needs_revision", "approved"])
          .order("weekday")
          .order("period_number")
      ]);
      if (membersResult.error) throw membersResult.error;
      if (registrationsResult.error) throw registrationsResult.error;
      return {
        users: (membersResult.data ?? []).map(mapMember),
        registrations: (registrationsResult.data ?? []).map(mapRegistration)
      };
    }
  };
}

let defaultService;
export function dashboardService() {
  defaultService ??= createDashboardService(getSupabaseClient());
  return defaultService;
}

import { validateStudentPassword } from "../features/account/password-policy.js";
import { getSupabaseClient } from "./supabase-client.js";

export function normalizeLoginCode(code) {
  return String(code ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function createAuthService(client, config = globalThis.APP_CONFIG ?? {}) {
  function codeToEmail(code) {
    const local = normalizeLoginCode(code);
    if (!local) throw new Error("Mã đăng nhập không hợp lệ.");
    const domain = String(config.loginDomain ?? "users.example.com").trim().toLowerCase();
    return local + "@" + domain;
  }

  return {
    codeToEmail,

    async signInWithCode(code, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email: codeToEmail(code),
        password: String(password ?? "")
      });
      if (error) throw error;
      return data.user;
    },

    async getAuthenticatedUser() {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },

    async loadCurrentProfile(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("id,student_code,full_name,role,class_name,active")
        .eq("id", userId)
        .single();
      if (error) throw error;
      if (!data?.active) throw new Error("Tài khoản đã bị khóa.");
      return {
        id: data.id,
        code: data.student_code ?? "",
        name: data.full_name,
        role: data.role,
        className: data.class_name ?? "",
        active: data.active !== false
      };
    },

    async changeOwnPassword({ currentPassword, newPassword }) {
      const result = validateStudentPassword(newPassword);
      if (!result.valid) {
        throw new Error("Mật khẩu mới cần ít nhất 8 ký tự và có cả chữ lẫn số.");
      }
      const { data: currentData, error: currentError } = await client.auth.getUser();
      if (currentError) throw currentError;
      const currentUser = currentData?.user;
      if (!currentUser?.email) throw new Error("Không xác định được tài khoản hiện tại.");

      const { error: reauthError } = await client.auth.signInWithPassword({
        email: currentUser.email,
        password: String(currentPassword ?? "")
      });
      if (reauthError) {
        const error = new Error("Mật khẩu hiện tại không đúng.");
        error.code = "CURRENT_PASSWORD_INVALID";
        throw error;
      }

      const { data, error } = await client.auth.updateUser({ password: String(newPassword) });
      if (error) throw error;
      return data.user;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
  };
}

let defaultService;
export function authService() {
  defaultService ??= createAuthService(getSupabaseClient());
  return defaultService;
}

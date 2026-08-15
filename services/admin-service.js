import { getSupabaseClient } from "./supabase-client.js";

export function createAdminService(client) {
  async function invoke(name, body = {}) {
    const { data, error } = await client.functions.invoke(name, { body });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error ?? "Không thể hoàn tất thao tác quản trị.");
    return data;
  }

  return {
    listUsers: () => invoke("admin-list-users"),
    createUser: changes => invoke("admin-create-user", changes),
    updateUser: (userId, changes) => invoke("admin-update-user", { userId, ...changes }),
    deleteUser: (userId, confirmCode) => invoke("admin-delete-user", { userId, confirmCode }),
    resetPassword: (userId, newPassword) => invoke("admin-reset-password", { userId, newPassword })
  };
}

let defaultService;
export function adminService() {
  defaultService ??= createAdminService(getSupabaseClient());
  return defaultService;
}

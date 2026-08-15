let singleton = null;

function runtimeConfig() {
  return globalThis.APP_CONFIG ?? {};
}

export function isSupabaseConfigured(config = runtimeConfig()) {
  const url = String(config?.projectUrl ?? "").trim();
  const key = String(config?.publishableKey ?? config?.anonKey ?? "").trim();
  return /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i.test(url) && key.length > 20;
}

export function clearLegacyPersistentAuth(config = runtimeConfig()) {
  try {
    const projectRef = new URL(config.projectUrl).hostname.split(".")[0];
    if (projectRef) globalThis.localStorage?.removeItem("sb-" + projectRef + "-auth-token");
  } catch {
    // Invalid configuration is handled by getSupabaseClient.
  }
}

export function getSupabaseClient({
  config = runtimeConfig(),
  library = globalThis.supabase
} = {}) {
  if (singleton) return singleton;
  if (!isSupabaseConfigured(config)) {
    throw new Error("Supabase chưa được cấu hình hợp lệ.");
  }
  if (!library?.createClient) {
    throw new Error("Không tải được thư viện Supabase.");
  }

  clearLegacyPersistentAuth(config);
  const key = String(config.publishableKey ?? config.anonKey);
  singleton = library.createClient(config.projectUrl, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: globalThis.sessionStorage
    }
  });
  return singleton;
}

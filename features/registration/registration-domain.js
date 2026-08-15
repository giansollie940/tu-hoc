const COUNTED_STATUSES = new Set(["submitted", "needs_revision", "approved"]);

export function normalizeDeviceChoice(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

export function isCountedRegistration(registration) {
  return Boolean(
    registration
    && !registration.isDeleted
    && COUNTED_STATUSES.has(registration.status)
  );
}

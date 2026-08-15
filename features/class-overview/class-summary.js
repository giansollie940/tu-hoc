import { isCountedRegistration } from "../registration/registration-domain.js";

export function summarizeSession({ registrations = [], activeStudentIds = [] } = {}) {
  const activeIds = new Set(activeStudentIds.map(String));
  const registered = new Map();

  for (const registration of registrations) {
    const studentId = String(registration?.studentId ?? "");
    if (!activeIds.has(studentId) || !isCountedRegistration(registration)) continue;

    const current = registered.get(studentId) ?? false;
    registered.set(studentId, current || registration.usesElectronicDevice === true);
  }

  const registeredStudentIds = [...registered.keys()];
  const deviceCount = [...registered.values()].filter(Boolean).length;

  return {
    registeredCount: registeredStudentIds.length,
    missingCount: Math.max(0, activeIds.size - registeredStudentIds.length),
    deviceCount,
    registeredStudentIds
  };
}

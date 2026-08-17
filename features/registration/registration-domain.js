const COUNTED_STATUSES=new Set(["submitted","needs_revision","approved"]);

export function isCountedRegistration(registration){
  return Boolean(
    registration
    && !registration.isDeleted
    && COUNTED_STATUSES.has(registration.status)
  );
}

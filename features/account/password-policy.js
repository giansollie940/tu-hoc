export function validateStudentPassword(password) {
  const value = String(password ?? "");
  const hasMinLength = value.length >= 8;
  const hasLetterAndNumber = /\p{L}/u.test(value) && /\d/u.test(value);

  return {
    valid: hasMinLength && hasLetterAndNumber,
    hasMinLength,
    hasLetterAndNumber
  };
}

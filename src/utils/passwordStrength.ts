// Password Strength & Security Validator

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0 to 4
  label: 'Very Weak' | 'Weak' | 'Moderate' | 'Strong';
  color: string;
  meetsMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  errors: string[];
}

export function validateStrongPassword(password: string): PasswordStrengthResult {
  const meetsMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

  let score = 0;
  if (password.length >= 8) score++;
  if (hasUpper && hasLower) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;

  const errors: string[] = [];
  if (!meetsMinLength) errors.push('Minimum 8 characters required');
  if (!hasUpper) errors.push('At least 1 uppercase letter (A-Z) required');
  if (!hasLower) errors.push('At least 1 lowercase letter (a-z) required');
  if (!hasNumber) errors.push('At least 1 number (0-9) required');
  if (!hasSpecial) errors.push('At least 1 special character (!@#$%^&*) required');

  let label: 'Very Weak' | 'Weak' | 'Moderate' | 'Strong' = 'Very Weak';
  let color = 'bg-rose-500';

  if (score === 4 && meetsMinLength) {
    label = 'Strong';
    color = 'bg-emerald-500';
  } else if (score === 3) {
    label = 'Moderate';
    color = 'bg-amber-500';
  } else if (score >= 1) {
    label = 'Weak';
    color = 'bg-rose-500';
  }

  const isValid = meetsMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  return {
    isValid,
    score,
    label,
    color,
    meetsMinLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    errors,
  };
}

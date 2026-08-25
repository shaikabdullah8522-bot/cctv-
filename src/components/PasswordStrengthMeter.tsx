import React from 'react';
import { validateStrongPassword } from '../utils/passwordStrength';
import { Check, X, ShieldAlert, ShieldCheck } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
  showRequirements?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showRequirements = true,
}) => {
  const strength = validateStrongPassword(password);

  if (!password) {
    return (
      <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
        <span>Strong password required: 8+ chars with uppercase, lowercase, number & symbol</span>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 text-xs">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-medium">Password Strength:</span>
          <span
            className={`font-bold font-mono ${
              strength.label === 'Strong'
                ? 'text-emerald-600'
                : strength.label === 'Moderate'
                ? 'text-amber-600'
                : 'text-rose-600'
            }`}
          >
            {strength.label}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              strength.score >= 1
                ? strength.score === 4
                  ? 'bg-emerald-500'
                  : strength.score === 3
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
                : 'bg-transparent'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              strength.score >= 2
                ? strength.score === 4
                  ? 'bg-emerald-500'
                  : strength.score === 3
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
                : 'bg-transparent'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              strength.score >= 3
                ? strength.score === 4
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
                : 'bg-transparent'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              strength.score >= 4 ? 'bg-emerald-500' : 'bg-transparent'
            }`}
          />
        </div>
      </div>

      {/* Criteria Checklist */}
      {showRequirements && (
        <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div
            className={`flex items-center gap-1.5 ${
              strength.meetsMinLength ? 'text-emerald-600 font-semibold' : 'text-slate-500'
            }`}
          >
            {strength.meetsMinLength ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <span>8+ characters</span>
          </div>

          <div
            className={`flex items-center gap-1.5 ${
              strength.hasUpper && strength.hasLower ? 'text-emerald-600 font-semibold' : 'text-slate-500'
            }`}
          >
            {strength.hasUpper && strength.hasLower ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <span>Upper & lowercase</span>
          </div>

          <div
            className={`flex items-center gap-1.5 ${
              strength.hasNumber ? 'text-emerald-600 font-semibold' : 'text-slate-500'
            }`}
          >
            {strength.hasNumber ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <span>At least 1 number</span>
          </div>

          <div
            className={`flex items-center gap-1.5 ${
              strength.hasSpecial ? 'text-emerald-600 font-semibold' : 'text-slate-500'
            }`}
          >
            {strength.hasSpecial ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            <span>Special symbol (!@#$)</span>
          </div>
        </div>
      )}
    </div>
  );
};

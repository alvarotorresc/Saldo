import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, className = '', ...rest }: InputProps) {
  return (
    <label className="block">
      {label && <span className="block text-xs text-muted mb-1.5">{label}</span>}
      <input
        {...rest}
        className={`w-full h-11 px-3 rounded-xl bg-elevated border border-border text-text placeholder:text-dim outline-none focus:border-borderStrong ${className}`}
      />
      {hint && <span className="block text-[11px] text-dim mt-1">{hint}</span>}
    </label>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = '', ...rest }: TextareaProps) {
  return (
    <label className="block">
      {label && <span className="block text-xs text-muted mb-1.5">{label}</span>}
      <textarea
        {...rest}
        className={`w-full px-3 py-2 rounded-xl bg-elevated border border-border text-text placeholder:text-dim outline-none focus:border-borderStrong min-h-[70px] ${className}`}
      />
    </label>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = '', children, ...rest }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="block text-xs text-muted mb-1.5">{label}</span>}
      <select
        {...rest}
        className={`w-full h-11 px-3 rounded-xl bg-elevated border border-border text-text outline-none focus:border-borderStrong ${className}`}
      >
        {children}
      </select>
    </label>
  );
}

"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputClassName = ["passwordInput", className].filter(Boolean).join(" ");

  return (
    <div className="passwordInputShell">
      <input {...props} className={inputClassName} type={isVisible ? "text" : "password"} />
      <button
        aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={isVisible}
        className="passwordVisibilityButton"
        onClick={() => setIsVisible((current) => !current)}
        title={isVisible ? "Ocultar senha" : "Mostrar senha"}
        type="button"
      >
        {isVisible ? (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m3 3 18 18" />
            <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
            <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.3 0 9 4.7 9 8a8.8 8.8 0 0 1-2 4.1" />
            <path d="M6.6 6.6C4.4 8 3 10.1 3 12c0 3.3 3.7 8 9 8 1.5 0 2.9-.4 4.1-1" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 12s3.7-8 9-8 9 8 9 8-3.7 8-9 8-9-8-9-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

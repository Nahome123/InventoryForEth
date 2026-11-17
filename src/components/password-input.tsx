"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Password field with an eye button to show or hide what was typed. */
export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input {...props} type={show ? "text" : "password"} className={`${props.className ?? "input"} pr-11`} autoCapitalize="none" spellCheck={false} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-3 hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </span>
  );
}

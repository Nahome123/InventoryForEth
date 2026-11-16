"use client";

import { useActionState, useState } from "react";
import { loginAction } from "../auth-actions";
import { Field, FormMessage, SubmitButton } from "@/components/form";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  // Controlled so a failed attempt doesn't wipe the username (React resets uncontrolled fields after an action).
  const [username, setUsername] = useState("");
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <Field label="Username">
        <input className="input" name="username" autoComplete="username" autoCapitalize="none" required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field label="Password">
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="btn-primary min-h-12 w-full text-[15px]" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

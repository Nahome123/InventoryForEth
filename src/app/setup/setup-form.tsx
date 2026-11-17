"use client";

import { useEffect, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { setupAction } from "../auth-actions";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";

export function SetupForm({ currencies, timeZones }: { currencies: string[]; timeZones: string[] }) {
  const { state, onSubmit, pending } = useActionForm(setupAction, null);
  const [tz, setTz] = useState("UTC");
  useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz) setTz(browserTz);
  }, []);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormMessage state={state} />
      <fieldset className="space-y-4">
        <legend className="sr-only">Store</legend>
        <div className="eyebrow" aria-hidden>Store</div>
        <Field label="Store name">
          <input className="input" name="storeName" required placeholder="e.g. Family General Store" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency">
            <select className="input" name="currency" defaultValue="ETB">
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Time zone" hint="Used for daily sales totals.">
            <select className="input" name="timezone" value={tz} onChange={(e) => setTz(e.target.value)}>
              {!timeZones.includes(tz) && <option>{tz}</option>}
              {timeZones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-4 border-t border-dashed border-line-strong pt-6">
        <legend className="sr-only">Owner account</legend>
        <div className="eyebrow" aria-hidden>Owner account</div>
        <Field label="Your full name">
          <input className="input" name="fullName" required autoComplete="name" />
        </Field>
        <Field label="Username" hint="Used to sign in.">
          <input className="input" name="username" required autoCapitalize="none" autoComplete="username" pattern="[a-zA-Z0-9._\-]{3,32}" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" hint="At least 8 characters.">
            <PasswordInput className="input" name="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm password">
            <PasswordInput className="input" name="confirm" minLength={8} required autoComplete="new-password" />
          </Field>
        </div>
      </fieldset>
      <SubmitButton pending={pending} className="btn-primary min-h-12 w-full text-[15px]" pendingText="Creating…">
        Create store
      </SubmitButton>
    </form>
  );
}

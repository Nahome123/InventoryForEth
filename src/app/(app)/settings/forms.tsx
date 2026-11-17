"use client";

import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { PasswordInput } from "@/components/password-input";
import { addOriginAction, addUserAction, saveSettingsAction, updateOriginAction, updateUserAction } from "./actions";

const ROLES = [
  ["cashier", "Sales staff"],
  ["manager", "Manager"],
  ["owner", "Owner"],
] as const;

export function StoreSettingsForm({
  initial,
  currencies,
  timeZones,
}: {
  initial: { storeName: string; currency: string; timezone: string; defaultLeadTimeDays: number; coverDays: number };
  currencies: string[];
  timeZones: string[];
}) {
  const { state, onSubmit, pending } = useActionForm(saveSettingsAction, null);
  const cur = currencies.includes(initial.currency) ? currencies : [initial.currency, ...currencies];
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Store name">
        <input className="input" name="storeName" defaultValue={initial.storeName} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency">
          <select className="input" name="currency" defaultValue={initial.currency}>
            {cur.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Time zone">
          <select className="input" name="timezone" defaultValue={initial.timezone}>
            {!timeZones.includes(initial.timezone) && <option>{initial.timezone}</option>}
            {timeZones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        <Field label="Default supplier lead time (days)" hint="Used for products without their own lead time.">
          <input className="input" name="defaultLeadTimeDays" type="number" min={0} max={365} defaultValue={initial.defaultLeadTimeDays} />
        </Field>
        <Field label="Restock cover (days)" hint="How many days of sales a restock should cover after it arrives.">
          <input className="input" name="coverDays" type="number" min={1} max={365} defaultValue={initial.coverDays} />
        </Field>
      </div>
      <SubmitButton pending={pending}>Save settings</SubmitButton>
    </form>
  );
}

export function AddUserForm() {
  const { state, onSubmit, pending } = useActionForm(addUserAction, null);
  return (
    <form onSubmit={onSubmit} className="space-y-3" key={state?.ok}>
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <input className="input" name="fullName" required autoComplete="off" />
        </Field>
        <Field label="Username">
          <input className="input" name="username" required autoCapitalize="none" autoComplete="off" />
        </Field>
        <Field label="Temporary password" hint="At least 8 characters.">
          <PasswordInput className="input" name="password" minLength={8} required autoComplete="new-password" />
        </Field>
        <Field label="Role">
          <select className="input" name="role" defaultValue="cashier">
            {ROLES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <SubmitButton pending={pending}>Add person</SubmitButton>
    </form>
  );
}

export function EditUserForm({ user, isMe }: { user: { id: number; fullName: string; username: string; role: string; active: boolean }; isMe: boolean }) {
  const { state, onSubmit, pending } = useActionForm(updateUserAction.bind(null, user.id), null);
  return (
    <form onSubmit={onSubmit} className="grid items-end gap-2 sm:grid-cols-[1fr_140px_160px_auto_auto]">
      <Field label="Name">
        <input className="input" name="fullName" defaultValue={user.fullName} />
      </Field>
      <Field label="Role">
        <select className="input" name="role" defaultValue={user.role}>
          {ROLES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="New password">
        <PasswordInput className="input" name="password" minLength={8} placeholder="unchanged" autoComplete="new-password" />
      </Field>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={user.active} disabled={isMe} />
        Active
        {isMe && <input type="hidden" name="active" value="on" />}
      </label>
      <SubmitButton pending={pending} className="btn-secondary">Save</SubmitButton>
      {(state?.error || state?.ok) && (
        <div className="sm:col-span-5">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

export function AddOriginForm() {
  const { state, onSubmit, pending } = useActionForm(addOriginAction, null);
  return (
    <form onSubmit={onSubmit} className="space-y-2" key={state?.ok}>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <input className="input flex-1" name="name" placeholder="China supplier (name)" aria-label="New origin name" required />
        <SubmitButton pending={pending} className="btn-secondary">
          Add
        </SubmitButton>
      </div>
    </form>
  );
}

export function EditOriginForm({ origin }: { origin: { id: number; name: string; active: boolean } }) {
  const { state, onSubmit, pending } = useActionForm(updateOriginAction.bind(null, origin.id), null);
  return (
    <form onSubmit={onSubmit} className="grid items-center gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input className="input" name="name" defaultValue={origin.name} aria-label="Origin name" required translate="no" />
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={origin.active} />
        Show on sales
      </label>
      <SubmitButton pending={pending} className="btn-secondary">
        Save
      </SubmitButton>
      {(state?.error || state?.ok) && (
        <div className="sm:col-span-3">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

"use client";

import { startTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";

export type ActionState = { error?: string; ok?: string; errors?: string[] } | null;

/**
 * Like useActionState, but submits via onSubmit so React does NOT auto-reset the form afterwards.
 * That way a validation error never wipes what the person typed. Forms that should clear on
 * success remount themselves (key={state?.ok}).
 */
export function useActionForm<S>(fn: (state: S, fd: FormData) => Promise<S>, initial: S) {
  const [state, dispatch, pending] = useActionState<S, FormData>(fn as (s: Awaited<S>, fd: FormData) => Promise<S>, initial as Awaited<S>);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
  return { state, onSubmit, pending };
}

export function SubmitButton({ children, pendingText, className = "btn-primary", pending: pendingProp, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending || rest.disabled} className={className} {...rest}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error || state.errors?.length)
    return (
      <div role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
        {state.error}
        {state.errors?.length ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {state.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  if (state.ok)
    return (
      <div role="status" className="rounded-xl bg-good-soft px-4 py-3 text-sm text-good">
        {state.ok}
      </div>
    );
  return null;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

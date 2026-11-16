/** An error whose message is safe and useful to show to the person using the app. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof UserError) return err.message;
  const code = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
  if (code === "23505") return "That value is already used by another record (must be unique).";
  console.error(err);
  return "Something went wrong. Please try again.";
}

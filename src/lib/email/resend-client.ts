import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();

/** Resend client; null when API key is not configured (emails are skipped). */
export const resend = apiKey ? new Resend(apiKey) : null;

/** Must be a verified domain/sender in Resend. Override with RESEND_FROM if needed. */
export function getEmailFrom(): string {
  return process.env.RESEND_FROM?.trim() || "Studara <noreply@studara.org>";
}

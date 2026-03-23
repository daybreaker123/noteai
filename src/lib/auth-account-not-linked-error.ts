/**
 * NextAuth's OAuth callback (`core/routes/callback.js`) maps errors with
 * `name === "AccountNotLinkedError"` to `?error=OAuthAccountNotLinked`.
 * The official class is not exported from the `next-auth` package surface, so we define a compatible error.
 */
export class AccountNotLinkedError extends Error {
  override name = "AccountNotLinkedError";

  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

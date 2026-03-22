"use client";

import { Button, Input } from "@/components/ui";
import { Card } from "@/components/ui";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export function LoginPanel({
  onSubmit,
  error,
  callbackUrl,
  csrfToken,
  useFormPost = false,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string;
  callbackUrl: string;
  csrfToken?: string | null;
  useFormPost?: boolean;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-white">Log in</h2>
      <form
        method="post"
        action={useFormPost && csrfToken ? "/api/auth/callback/credentials" : undefined}
        onSubmit={useFormPost && csrfToken ? undefined : onSubmit}
        className="mt-4 space-y-3"
      >
        {useFormPost && csrfToken ? (
          <>
            <input name="csrfToken" type="hidden" defaultValue={csrfToken} />
            <input name="callbackUrl" type="hidden" defaultValue={callbackUrl} />
          </>
        ) : null}
        <Input
          name="email"
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
        />
        <Input
          name="password"
          type="password"
          placeholder="Password"
          required
          autoComplete="current-password"
        />
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={useFormPost && !csrfToken}
        >
          {useFormPost && !csrfToken ? "Loading…" : "Log in"}
        </Button>
      </form>
      <GoogleSignInButton callbackUrl={callbackUrl} />
    </Card>
  );
}

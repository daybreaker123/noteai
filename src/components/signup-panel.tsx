"use client";

import { Button, Input } from "@/components/ui";
import { Card } from "@/components/ui";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export function SignupPanel({
  onSubmit,
  error,
  callbackUrl = "/auth/callback?next=%2Fdashboard",
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string;
  /** Post-login redirect chain: `/auth/callback?next=...` (default: dashboard) */
  callbackUrl?: string;
}) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-white">Sign up</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <Input
          name="name"
          type="text"
          placeholder="Name (optional)"
          autoComplete="name"
        />
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
          placeholder="Password (min 6 chars)"
          required
          minLength={6}
          autoComplete="new-password"
        />
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}
        <Button type="submit" className="w-full">
          Create account
        </Button>
      </form>
      <GoogleSignInButton callbackUrl={callbackUrl} />
    </Card>
  );
}

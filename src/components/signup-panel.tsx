"use client";

import { signIn } from "next-auth/react";
import { Button, Input } from "@/components/ui";
import { Card } from "@/components/ui";

export function SignupPanel({
  onSubmit,
  error,
  callbackUrl = "/dashboard",
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string;
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
      <div className="mt-4 border-t border-white/10 pt-4">
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl })}
        >
          Continue with Google
        </Button>
      </div>
    </Card>
  );
}

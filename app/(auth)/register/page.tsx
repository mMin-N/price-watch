"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/components/google-auth-button";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) {
      setError("You must agree to the Terms and Privacy Policy");
      return;
    }
    setLoading(true);
    setError(null);
    setVerifyMessage(null);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      setVerifyMessage("Check your email to verify your account, then sign in.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="p-0">
      <h1 className="mb-6 text-2xl font-semibold">Register</h1>
      <GoogleAuthButton label="Sign up with Google" />
      <div className="my-4 flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-200" />
        or
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded border px-3 py-2"
        />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="underline">
              Privacy Policy
            </Link>
          </span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {verifyMessage && (
          <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {verifyMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Login
        </Link>
      </p>
    </main>
  );
}

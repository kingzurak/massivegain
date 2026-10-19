"use client";

import { useState, FormEvent, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import { createClient } from "@/lib/supabase/client";

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref")?.trim() || undefined;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmailNotice, setCheckEmailNotice] = useState(false);

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = "Enter your full name.";
    if (!email.trim()) errors.email = "Enter your email address.";
    else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Choose a password.";
    else if (password.length < 8) errors.password = "Use at least 8 characters.";
    if (!confirmPassword) errors.confirmPassword = "Confirm your password.";
    else if (password && confirmPassword !== password) errors.confirmPassword = "Passwords don't match.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!validate()) return;

    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(referralCode ? { referral_code: referralCode } : {}),
        },
      },
    });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    if (data.session) {
      // Email confirmation is off — the user is already signed in.
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Email confirmation is required before a session exists.
    setCheckEmailNotice(true);
  }

  if (checkEmailNotice) {
    return (
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-2xl text-navy-900">Check your email</h1>
        <p className="mt-3 text-sm text-ink-muted">
          We sent a confirmation link to <span className="font-medium text-ink">{email}</span>.
          Confirm your address, then log in to reach your dashboard.
        </p>
        <Link href="/login" className="mt-6 inline-block">
          <Button size="lg">Go to login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-2xl text-navy-900">Create your account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {referralCode ? "You were invited to MassiveGain.ng — welcome!" : "Get started with MassiveGain.ng."}
      </p>

      {formError && (
        <div className="mt-6 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {formError}
        </div>
      )}

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <FormField
          label="Full name"
          placeholder="Adaeze Okoye"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fieldErrors.fullName}
          autoComplete="name"
          maxLength={200}
          required
        />
        <FormField
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
          required
        />
        <FormField
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint={!fieldErrors.password ? "At least 8 characters." : undefined}
          autoComplete="new-password"
          required
        />
        <FormField
          label="Confirm password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
          required
        />
        <Button size="lg" type="submit" disabled={submitting} className="mt-1">
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brick-600 hover:text-brick-700">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <>
      <Navbar />
      <main className="container-page flex justify-center py-16 md:py-24">
        <Suspense fallback={null}>
          <RegisterForm />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

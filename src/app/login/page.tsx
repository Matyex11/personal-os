import { LoginForm } from "@/components/auth/login-form";
import { PageHeader } from "@/components/layout/page-header";
import { safeNextPath } from "@/lib/auth/safe-next-path";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Sign in"
        description="Email and password via Personal OS DEV Supabase Auth, with magic-link fallback. Existing accounts only — no public signup or recovery."
      />
      {params.error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          Sign-in could not be completed. Try email and password, or request a new magic link.
        </p>
      ) : null}
      <LoginForm nextPath={safeNextPath(params.next)} />
    </div>
  );
}

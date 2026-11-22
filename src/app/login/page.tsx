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
        description="Email magic link via Personal OS DEV Supabase Auth. No password stored in this app. Existing accounts only — no public signup."
      />
      {params.error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          Sign-in could not be completed. Request a new magic link.
        </p>
      ) : null}
      <LoginForm nextPath={safeNextPath(params.next)} />
    </div>
  );
}

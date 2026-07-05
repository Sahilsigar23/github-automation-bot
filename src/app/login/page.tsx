import Link from "next/link";
import { redirect } from "next/navigation";
import { Webhook, AlertCircle, ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { GithubSignInButton } from "@/components/auth/github-sign-in-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Webhook className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in with GitHub to manage your automations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Sign-in failed ({error}). Please try again — make sure you
                authorise the requested repository permissions.
              </span>
            </div>
          )}
          <GithubSignInButton className="w-full" />
          <p className="text-center text-xs text-muted-foreground">
            We request repo, webhook and profile scopes so the bot can read your
            repositories and act on your behalf. Your token is encrypted at rest.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

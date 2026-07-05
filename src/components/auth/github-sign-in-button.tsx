"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GithubSignInButton({
  className,
  callbackUrl = "/dashboard",
  size = "lg",
  label = "Continue with GitHub",
}: {
  className?: string;
  callbackUrl?: string;
  size?: "default" | "sm" | "lg";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size={size}
      className={cn("gap-2", className)}
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void signIn("github", { callbackUrl });
      }}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Github className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}

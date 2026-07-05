"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Webhook,
  Bot,
  Bell,
  Github,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Settings {
  aiEnabled: boolean;
  slackEnabled: boolean;
  githubLogin: string | null;
  personalSlackConfigured: boolean;
  globalSlackConfigured: boolean;
  aiConfigured: boolean;
  webhookSecretConfigured: boolean;
  webhookUrl: string;
}

function ConfiguredBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge variant="success" className="gap-1">
      <ShieldCheck className="h-3 w-3" /> Configured
    </Badge>
  ) : (
    <Badge variant="warning" className="gap-1">
      <ShieldAlert className="h-3 w-3" /> Not set
    </Badge>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [slackUrl, setSlackUrl] = useState("");
  const [savingSlack, setSavingSlack] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { settings: Settings };
      setSettings(data.settings);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Failed to save");
    }
  };

  const toggle = async (key: "aiEnabled" | "slackEnabled", value: boolean) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
    try {
      await patch({ [key]: value });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      void load();
    }
  };

  const saveSlack = async (clear = false) => {
    setSavingSlack(true);
    try {
      await patch({ slackWebhookUrl: clear ? "" : slackUrl.trim() });
      toast.success(clear ? "Personal Slack webhook cleared" : "Slack webhook saved");
      setSlackUrl("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSlack(false);
    }
  };

  if (!settings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure notifications, AI enrichment and webhook delivery.
        </p>
      </div>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Webhook endpoint
          </CardTitle>
          <CardDescription>
            Point your repository webhooks here. The signing secret is set via
            the GITHUB_WEBHOOK_SECRET environment variable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Payload URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={settings.webhookUrl} className="font-mono text-xs" />
              <CopyButton value={settings.webhookUrl} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Content type <code className="text-xs">application/json</code> ·
              signature <code className="text-xs">HMAC-SHA256</code>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Secret</span>
              <ConfiguredBadge ok={settings.webhookSecretConfigured} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> AI enrichment
          </CardTitle>
          <CardDescription>
            Summarise issues/PRs and suggest a priority + label using Gemini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">API key</span>
            <ConfiguredBadge ok={settings.aiConfigured} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Enable AI analysis</Label>
              <p className="text-xs text-muted-foreground">
                Requires GEMINI_API_KEY to be set.
              </p>
            </div>
            <Switch
              checked={settings.aiEnabled}
              disabled={!settings.aiConfigured}
              onCheckedChange={(v) => void toggle("aiEnabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Slack */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Slack notifications
          </CardTitle>
          <CardDescription>
            A personal Incoming Webhook overrides the global one. Stored
            encrypted; never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Global webhook</span>
            <ConfiguredBadge ok={settings.globalSlackConfigured} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Personal webhook
            </span>
            <ConfiguredBadge ok={settings.personalSlackConfigured} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Enable Slack</Label>
              <p className="text-xs text-muted-foreground">
                Turn off to silence all Slack notifications.
              </p>
            </div>
            <Switch
              checked={settings.slackEnabled}
              onCheckedChange={(v) => void toggle("slackEnabled", v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slack-url">Personal Slack webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="slack-url"
                type="url"
                placeholder="https://hooks.slack.com/services/…"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
              />
              <Button
                onClick={() => void saveSlack(false)}
                disabled={savingSlack || !slackUrl.trim()}
              >
                {savingSlack ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
            {settings.personalSlackConfigured && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => void saveSlack(true)}
              >
                Clear personal webhook
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">GitHub account</span>
            <span className="font-medium">
              {settings.githubLogin ? `@${settings.githubLogin}` : "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Zap, Tag, MessageSquare, Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RuleDialog } from "@/components/dashboard/rule-dialog";
import { eventTypeLabel } from "@/lib/format";
import type { RuleItem, RepoItem } from "@/types/api";

function actionSummary(rule: RuleItem): { icon: typeof Tag; text: string } {
  if (rule.action === "ADD_LABEL")
    return { icon: Tag, text: `Add label "${rule.actionValue ?? ""}"` };
  if (rule.action === "ADD_COMMENT")
    return { icon: MessageSquare, text: "Post comment" };
  return { icon: Bell, text: "Notify only" };
}

export function RulesView({
  initialRepositoryId,
}: {
  initialRepositoryId?: string;
}) {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [repoFilter, setRepoFilter] = useState<string>(
    initialRepositoryId ?? "all",
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RuleItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [reposRes, rulesRes] = await Promise.all([
        fetch("/api/repositories", { cache: "no-store" }),
        fetch("/api/rules", { cache: "no-store" }),
      ]);
      const reposData = (await reposRes.json()) as { repositories: RepoItem[] };
      const rulesData = (await rulesRes.json()) as { rules: RuleItem[] };
      setRepos(reposData.repositories);
      setRules(rulesData.rules);
    } catch {
      toast.error("Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const repoOptions = useMemo(
    () => repos.map((r) => ({ id: r.id, fullName: r.fullName })),
    [repos],
  );

  const visibleRules =
    repoFilter === "all"
      ? rules
      : rules.filter((r) => r.repositoryId === repoFilter);

  const toggleEnabled = async (rule: RuleItem, enabled: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled } : r)),
    );
    const res = await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      toast.error("Failed to update rule");
      void load();
    }
  };

  const remove = async (rule: RuleItem) => {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    const res = await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Rule deleted");
      void load();
    } else {
      toast.error("Failed to delete rule");
    }
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (rule: RuleItem) => {
    setEditing(rule);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rules</h1>
          <p className="text-sm text-muted-foreground">
            Define what happens when events match. Rules live in the database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {repos.length > 0 && (
            <Select value={repoFilter} onValueChange={setRepoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All repositories</SelectItem>
                {repoOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={openNew} disabled={repos.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> New rule
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Zap className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">Connect a repository first</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Rules run against a connected repository&apos;s events.
          </p>
          <Button asChild className="mt-4">
            <Link href="/repositories">Connect a repository</Link>
          </Button>
        </div>
      ) : visibleRules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Zap className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No rules yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first rule — e.g. label issues that contain “bug”.
          </p>
          <Button onClick={openNew} className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> New rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRules.map((rule) => {
            const action = actionSummary(rule);
            return (
              <Card key={rule.id} className={rule.enabled ? "" : "opacity-60"}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{rule.name}</p>
                      <Badge variant="outline" className="font-mono text-xs">
                        {rule.repository.fullName}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        {eventTypeLabel(rule.eventType)}
                        {rule.keyword
                          ? ` · ${rule.matchField} contains “${rule.keyword}”`
                          : " · any"}
                      </span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        <action.icon className="h-3.5 w-3.5" />
                        {action.text}
                      </span>
                      {rule.slackEnabled && (
                        <Badge variant="secondary" className="gap-1">
                          <Bell className="h-3 w-3" /> Slack
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => void toggleEnabled(rule, v)}
                      aria-label="Toggle rule"
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void remove(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        repos={repoOptions}
        rule={editing}
        defaultRepositoryId={
          repoFilter !== "all" ? repoFilter : initialRepositoryId
        }
        onSaved={load}
      />
    </div>
  );
}

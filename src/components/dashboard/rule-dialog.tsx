"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_TYPES, MATCH_FIELDS, RULE_ACTIONS } from "@/lib/constants";
import type { RuleItem } from "@/types/api";

interface RepoOption {
  id: string;
  fullName: string;
}

interface FormState {
  name: string;
  repositoryId: string;
  eventType: string;
  matchField: string;
  keyword: string;
  action: string;
  actionValue: string;
  slackEnabled: boolean;
  enabled: boolean;
}

function initialState(
  rule: RuleItem | null,
  repos: RepoOption[],
  defaultRepositoryId?: string,
): FormState {
  return {
    name: rule?.name ?? "",
    repositoryId:
      rule?.repositoryId ?? defaultRepositoryId ?? repos[0]?.id ?? "",
    eventType: rule?.eventType ?? "issues",
    matchField: rule?.matchField ?? "title",
    keyword: rule?.keyword ?? "bug",
    action: rule?.action ?? "ADD_LABEL",
    actionValue: rule?.actionValue ?? "bug",
    slackEnabled: rule?.slackEnabled ?? true,
    enabled: rule?.enabled ?? true,
  };
}

export function RuleDialog({
  open,
  onOpenChange,
  repos,
  rule,
  defaultRepositoryId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repos: RepoOption[];
  rule: RuleItem | null;
  defaultRepositoryId?: string;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(rule, repos, defaultRepositoryId),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialState(rule, repos, defaultRepositoryId));
  }, [open, rule, repos, defaultRepositoryId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Give the rule a name");
    if (!form.repositoryId) return toast.error("Select a repository");
    if (form.action !== "NONE" && !form.actionValue.trim()) {
      return toast.error(
        form.action === "ADD_LABEL"
          ? "Enter the label to add"
          : "Enter the comment text",
      );
    }

    setSaving(true);
    try {
      const isEdit = Boolean(rule);
      const url = isEdit ? `/api/rules/${rule!.id}` : "/api/rules";
      const method = isEdit ? "PATCH" : "POST";
      const body = {
        name: form.name.trim(),
        repositoryId: form.repositoryId,
        eventType: form.eventType,
        matchField: form.matchField,
        keyword: form.keyword.trim(),
        action: form.action,
        actionValue: form.action === "NONE" ? "" : form.actionValue.trim(),
        slackEnabled: form.slackEnabled,
        enabled: form.enabled,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to save rule");
      }
      toast.success(isEdit ? "Rule updated" : "Rule created");
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            Rules are evaluated on every matching event. Nothing is hardcoded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Name</Label>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Label bug issues"
            />
          </div>

          <div className="space-y-2">
            <Label>Repository</Label>
            <Select
              value={form.repositoryId}
              onValueChange={(v) => set("repositoryId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {repos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select
                value={form.eventType}
                onValueChange={(v) => set("eventType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Match field</Label>
              <Select
                value={form.matchField}
                onValueChange={(v) => set("matchField", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_FIELDS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-keyword">Keyword contains</Label>
            <Input
              id="rule-keyword"
              value={form.keyword}
              onChange={(e) => set("keyword", e.target.value)}
              placeholder="bug"
            />
            <p className="text-xs text-muted-foreground">
              Case-insensitive substring. Leave empty to match every event.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={form.action} onValueChange={(v) => set("action", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_ACTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.action === "ADD_LABEL" && (
            <div className="space-y-2">
              <Label htmlFor="rule-label">Label to add</Label>
              <Input
                id="rule-label"
                value={form.actionValue}
                onChange={(e) => set("actionValue", e.target.value)}
                placeholder="bug"
              />
              <p className="text-xs text-muted-foreground">
                Created automatically on GitHub if it doesn&apos;t exist.
              </p>
            </div>
          )}

          {form.action === "ADD_COMMENT" && (
            <div className="space-y-2">
              <Label htmlFor="rule-comment">Comment template</Label>
              <Textarea
                id="rule-comment"
                rows={3}
                value={form.actionValue}
                onChange={(e) => set("actionValue", e.target.value)}
                placeholder="Thanks @{{author}}! We'll review {{title}} soon."
              />
              <p className="text-xs text-muted-foreground">
                Variables: {"{{author}}"}, {"{{title}}"}, {"{{repo}}"},{" "}
                {"{{number}}"}, {"{{url}}"}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Send Slack notification</Label>
              <p className="text-xs text-muted-foreground">
                Notify Slack when this rule matches.
              </p>
            </div>
            <Switch
              checked={form.slackEnabled}
              onCheckedChange={(v) => set("slackEnabled", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Enabled</Label>
              <p className="text-xs text-muted-foreground">
                Disabled rules are skipped during processing.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => set("enabled", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {rule ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

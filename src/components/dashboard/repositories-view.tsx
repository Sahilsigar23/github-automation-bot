"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  GitBranch,
  Lock,
  Globe,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  Search,
  Webhook,
  CheckCircle2,
  Zap,
  Inbox,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { RepoItem, RepoAvailable } from "@/types/api";

export function RepositoriesView() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/repositories", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load repositories");
      const data = (await res.json()) as { repositories: RepoItem[] };
      setRepos(data.repositories);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async (repo: RepoItem) => {
    if (
      !window.confirm(
        `Disconnect ${repo.fullName}? Its rules and the GitHub webhook will be removed.`,
      )
    )
      return;
    const res = await fetch(`/api/repositories/${repo.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(`Disconnected ${repo.fullName}`);
      void load();
    } else {
      toast.error("Failed to disconnect repository");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repositories</h1>
          <p className="text-sm text-muted-foreground">
            Connect a repository to start receiving and automating its events.
          </p>
        </div>
        <ConnectRepoDialog
          connectedFullNames={repos.map((r) => r.fullName)}
          onConnected={load}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <GitBranch className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No repositories connected</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Connect one of your GitHub repositories to receive webhook events and
            run automation rules.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <Card key={repo.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{repo.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {repo.fullName}
                    </p>
                  </div>
                  <Badge variant={repo.private ? "secondary" : "outline"} className="gap-1">
                    {repo.private ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Globe className="h-3 w-3" />
                    )}
                    {repo.private ? "Private" : "Public"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    variant={repo.webhookActive ? "success" : "warning"}
                    className="gap-1"
                  >
                    <Webhook className="h-3 w-3" />
                    {repo.webhookActive ? "Webhook active" : "Webhook manual"}
                  </Badge>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Zap className="h-3 w-3" /> {repo._count.rules} rules
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Inbox className="h-3 w-3" /> {repo._count.events} events
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="secondary" className="flex-1">
                    <Link href={`/rules?repositoryId=${repo.id}`}>
                      <Zap className="mr-1.5 h-3.5 w-3.5" /> Rules
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={repo.htmlUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void disconnect(repo)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectRepoDialog({
  connectedFullNames,
  onConnected,
}: {
  connectedFullNames: string[];
  onConnected: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<RepoAvailable[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const connectedSet = new Set(connectedFullNames);

  const loadAvailable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/repositories/available", {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to load repositories");
      }
      const data = (await res.json()) as { repositories: RepoAvailable[] };
      setAvailable(data.repositories);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
      setAvailable([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && available === null) void loadAvailable();
  };

  const connect = async (fullName: string) => {
    setConnecting(fullName);
    try {
      const res = await fetch("/api/repositories/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const data = (await res.json()) as { warning?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      if (data.warning) toast.warning(data.warning);
      else toast.success(`Connected ${fullName}`);
      await onConnected();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnecting(null);
    }
  };

  const filtered = (available ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Connect repository
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect a repository</DialogTitle>
          <DialogDescription>
            Pick a repository you own. We&apos;ll register a webhook so events
            start flowing in.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter repositories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto scrollbar-thin">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No repositories found.
            </p>
          ) : (
            filtered.map((repo) => {
              const isConnected =
                repo.alreadyConnected || connectedSet.has(repo.fullName);
              return (
                <div
                  key={repo.githubId}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {repo.private ? (
                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      {repo.fullName}
                    </p>
                  </div>
                  {isConnected ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={connecting !== null}
                      onClick={() => void connect(repo.fullName)}
                    >
                      {connecting === repo.fullName ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

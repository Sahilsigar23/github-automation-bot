import { Octokit } from "@octokit/rest";
import { DEFAULT_LABEL_COLOR, SUBSCRIBED_EVENTS } from "@/lib/constants";

/** Error carrying the upstream GitHub HTTP status for precise handling. */
export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

function toGitHubError(err: unknown): GitHubError {
  const e = err as { status?: number; message?: string };
  return new GitHubError(e?.message ?? "GitHub request failed", e?.status ?? 500);
}

function client(token: string): Octokit {
  return new Octokit({ auth: token, userAgent: "github-automation-bot/1.0" });
}

export interface GitHubRepo {
  githubId: string;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
}

/** Repositories the authenticated user owns, most-recently-updated first. */
export async function listRepositories(token: string): Promise<GitHubRepo[]> {
  try {
    const octokit = client(token);
    const repos = await octokit.paginate(
      octokit.repos.listForAuthenticatedUser,
      { affiliation: "owner", sort: "updated", per_page: 100 },
    );
    return repos.map((r) => ({
      githubId: String(r.id),
      name: r.name,
      fullName: r.full_name,
      owner: r.owner.login,
      private: r.private,
      htmlUrl: r.html_url,
      defaultBranch: r.default_branch ?? "main",
    }));
  } catch (err) {
    throw toGitHubError(err);
  }
}

/** Fetch a single repository (confirms the user actually has access). */
export async function getRepository(
  token: string,
  owner: string,
  repo: string,
): Promise<GitHubRepo> {
  try {
    const { data } = await client(token).repos.get({ owner, repo });
    return {
      githubId: String(data.id),
      name: data.name,
      fullName: data.full_name,
      owner: data.owner.login,
      private: data.private,
      htmlUrl: data.html_url,
      defaultBranch: data.default_branch ?? "main",
    };
  } catch (err) {
    throw toGitHubError(err);
  }
}

export interface CreatedWebhook {
  id: number;
  active: boolean;
}

/**
 * Register (or re-use) a repo webhook pointing at this app. Idempotent: if a
 * hook for the same URL already exists, its id is returned instead of erroring.
 */
export async function createWebhook(
  token: string,
  owner: string,
  repo: string,
  url: string,
  secret: string,
): Promise<CreatedWebhook> {
  const octokit = client(token);
  try {
    const { data } = await octokit.repos.createWebhook({
      owner,
      repo,
      name: "web",
      active: true,
      events: SUBSCRIBED_EVENTS,
      config: {
        url,
        content_type: "json",
        secret,
        insecure_ssl: "0",
      },
    });
    return { id: data.id, active: data.active };
  } catch (err) {
    const ghErr = toGitHubError(err);
    // 422 = a hook with this config already exists → find and reuse it.
    if (ghErr.status === 422) {
      const existing = await findWebhookByUrl(token, owner, repo, url);
      if (existing) return existing;
    }
    throw ghErr;
  }
}

async function findWebhookByUrl(
  token: string,
  owner: string,
  repo: string,
  url: string,
): Promise<CreatedWebhook | null> {
  try {
    const octokit = client(token);
    const hooks = await octokit.repos.listWebhooks({ owner, repo, per_page: 100 });
    const match = hooks.data.find((h) => h.config?.url === url);
    return match ? { id: match.id, active: match.active } : null;
  } catch {
    return null;
  }
}

export async function deleteWebhook(
  token: string,
  owner: string,
  repo: string,
  hookId: number,
): Promise<void> {
  try {
    await client(token).repos.deleteWebhook({ owner, repo, hook_id: hookId });
  } catch (err) {
    const ghErr = toGitHubError(err);
    if (ghErr.status === 404) return; // already gone — treat as success
    throw ghErr;
  }
}

/** Ensure a label exists, creating it if necessary. Returns whether created. */
export async function ensureLabel(
  token: string,
  owner: string,
  repo: string,
  name: string,
): Promise<{ created: boolean }> {
  const octokit = client(token);
  try {
    await octokit.issues.getLabel({ owner, repo, name });
    return { created: false };
  } catch (err) {
    const ghErr = toGitHubError(err);
    if (ghErr.status !== 404) throw ghErr;
    try {
      await octokit.issues.createLabel({
        owner,
        repo,
        name,
        color: DEFAULT_LABEL_COLOR,
        description: "Added automatically by github-automation-bot",
      });
      return { created: true };
    } catch (createErr) {
      throw toGitHubError(createErr);
    }
  }
}

/** Add labels to an issue or pull request (PRs share the issues API). */
export async function addLabels(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
): Promise<void> {
  try {
    await client(token).issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  } catch (err) {
    throw toGitHubError(err);
  }
}

/** Post a comment on an issue or pull request. Returns the comment URL. */
export async function createComment(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<string> {
  try {
    const { data } = await client(token).issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    return data.html_url;
  } catch (err) {
    throw toGitHubError(err);
  }
}

/** Split "owner/repo" into its parts. */
export function splitFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: "${fullName}"`);
  }
  return { owner, repo };
}

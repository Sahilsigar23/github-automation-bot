import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Octokit so we can exercise github.ts logic without the network.
const mocks = vi.hoisted(() => ({
  getLabel: vi.fn(),
  createLabel: vi.fn(),
  addLabels: vi.fn(),
  createComment: vi.fn(),
}));

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    issues: {
      getLabel: mocks.getLabel,
      createLabel: mocks.createLabel,
      addLabels: mocks.addLabels,
      createComment: mocks.createComment,
    },
  })),
}));

import {
  ensureLabel,
  addLabels,
  createComment,
  splitFullName,
  GitHubError,
} from "@/lib/github";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("splitFullName", () => {
  it("splits owner/repo", () => {
    expect(splitFullName("octo/hello-world")).toEqual({
      owner: "octo",
      repo: "hello-world",
    });
  });

  it("throws on invalid input", () => {
    expect(() => splitFullName("nope")).toThrow();
  });
});

describe("ensureLabel", () => {
  it("does not create the label when it already exists", async () => {
    mocks.getLabel.mockResolvedValue({ data: { name: "bug" } });
    const res = await ensureLabel("token", "octo", "repo", "bug");
    expect(res.created).toBe(false);
    expect(mocks.createLabel).not.toHaveBeenCalled();
  });

  it("creates the label when it is missing (404)", async () => {
    mocks.getLabel.mockRejectedValue({ status: 404, message: "Not Found" });
    mocks.createLabel.mockResolvedValue({ data: { name: "bug" } });
    const res = await ensureLabel("token", "octo", "repo", "bug");
    expect(res.created).toBe(true);
    expect(mocks.createLabel).toHaveBeenCalledOnce();
  });

  it("rethrows non-404 errors as GitHubError", async () => {
    mocks.getLabel.mockRejectedValue({ status: 500, message: "boom" });
    await expect(ensureLabel("token", "octo", "repo", "bug")).rejects.toThrow(
      GitHubError,
    );
  });
});

describe("addLabels", () => {
  it("passes labels to the issues API", async () => {
    mocks.addLabels.mockResolvedValue({ data: [] });
    await addLabels("token", "octo", "repo", 5, ["bug"]);
    expect(mocks.addLabels).toHaveBeenCalledWith({
      owner: "octo",
      repo: "repo",
      issue_number: 5,
      labels: ["bug"],
    });
  });
});

describe("createComment", () => {
  it("returns the created comment URL", async () => {
    mocks.createComment.mockResolvedValue({
      data: { html_url: "https://gh/issues/5#comment-1" },
    });
    const url = await createComment("token", "octo", "repo", 5, "hello");
    expect(url).toBe("https://gh/issues/5#comment-1");
  });
});

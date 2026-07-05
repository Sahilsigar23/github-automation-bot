import { describe, it, expect } from "vitest";
import {
  ruleInputSchema,
  connectRepoSchema,
  settingsSchema,
} from "@/lib/validations";

describe("ruleInputSchema", () => {
  const valid = {
    name: "Label bugs",
    repositoryId: "repo_1",
    eventType: "issues",
    keyword: "bug",
    matchField: "title",
    action: "ADD_LABEL",
    actionValue: "bug",
    slackEnabled: true,
    enabled: true,
  };

  it("accepts a valid rule", () => {
    expect(ruleInputSchema.safeParse(valid).success).toBe(true);
  });

  it("applies defaults for optional fields", () => {
    const parsed = ruleInputSchema.parse({
      name: "Minimal",
      repositoryId: "repo_1",
      eventType: "push",
      action: "NONE",
    });
    expect(parsed.matchField).toBe("title");
    expect(parsed.slackEnabled).toBe(true);
    expect(parsed.keyword).toBe("");
  });

  it("requires a label value for ADD_LABEL", () => {
    const res = ruleInputSchema.safeParse({ ...valid, actionValue: "" });
    expect(res.success).toBe(false);
  });

  it("requires comment text for ADD_COMMENT", () => {
    const res = ruleInputSchema.safeParse({
      ...valid,
      action: "ADD_COMMENT",
      actionValue: "",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an unknown event type", () => {
    const res = ruleInputSchema.safeParse({ ...valid, eventType: "release" });
    expect(res.success).toBe(false);
  });
});

describe("connectRepoSchema", () => {
  it("accepts owner/repo", () => {
    expect(connectRepoSchema.safeParse({ fullName: "octo/repo" }).success).toBe(
      true,
    );
  });

  it("rejects a bare name", () => {
    expect(connectRepoSchema.safeParse({ fullName: "repo" }).success).toBe(
      false,
    );
  });
});

describe("settingsSchema", () => {
  it("accepts a valid Slack webhook URL", () => {
    const res = settingsSchema.safeParse({
      slackWebhookUrl: "https://hooks.slack.com/services/T/B/x",
    });
    expect(res.success).toBe(true);
  });

  it("accepts an empty string (clearing the webhook)", () => {
    expect(settingsSchema.safeParse({ slackWebhookUrl: "" }).success).toBe(true);
  });

  it("rejects a non-Slack URL", () => {
    const res = settingsSchema.safeParse({
      slackWebhookUrl: "https://evil.example.com/hook",
    });
    expect(res.success).toBe(false);
  });
});

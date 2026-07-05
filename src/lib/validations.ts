import { z } from "zod";

/** Allowed values kept in sync with the Prisma enums / constants. */
export const eventTypeEnum = z.enum(["issues", "pull_request", "push"]);
export const matchFieldEnum = z.enum(["title", "body", "any"]);
export const ruleActionEnum = z.enum(["ADD_LABEL", "ADD_COMMENT", "NONE"]);

/**
 * Rule create/update payload. Cross-field rule: label/comment actions require
 * an `actionValue` (the label name or comment template).
 */
export const ruleInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    repositoryId: z.string().min(1, "Repository is required"),
    eventType: eventTypeEnum,
    keyword: z.string().trim().max(200).optional().default(""),
    matchField: matchFieldEnum.default("title"),
    action: ruleActionEnum.default("ADD_LABEL"),
    actionValue: z.string().trim().max(2000).optional().default(""),
    slackEnabled: z.boolean().default(true),
    enabled: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.action === "ADD_LABEL" && !data.actionValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionValue"],
        message: "A label name is required for the Add Label action",
      });
    }
    if (data.action === "ADD_COMMENT" && !data.actionValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionValue"],
        message: "Comment text is required for the Post Comment action",
      });
    }
  });

export type RuleInput = z.infer<typeof ruleInputSchema>;

/** Partial schema for PATCH updates (any subset of fields). */
export const ruleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  eventType: eventTypeEnum.optional(),
  keyword: z.string().trim().max(200).optional(),
  matchField: matchFieldEnum.optional(),
  action: ruleActionEnum.optional(),
  actionValue: z.string().trim().max(2000).optional(),
  slackEnabled: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export type RuleUpdate = z.infer<typeof ruleUpdateSchema>;

/** Connect-repository payload — server re-fetches details from GitHub. */
export const connectRepoSchema = z.object({
  fullName: z
    .string()
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, "Expected owner/repository"),
});

export type ConnectRepoInput = z.infer<typeof connectRepoSchema>;

/** Settings payload. Empty Slack URL clears the personal override. */
export const settingsSchema = z.object({
  slackWebhookUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .startsWith("https://hooks.slack.com/", "Must be a Slack Incoming Webhook URL")
    .or(z.literal(""))
    .optional(),
  aiEnabled: z.boolean().optional(),
  slackEnabled: z.boolean().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

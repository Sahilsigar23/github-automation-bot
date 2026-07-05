import { GoogleGenerativeAI } from "@google/generative-ai";
import { env, isAiConfigured } from "@/lib/env";
import type { AIResult } from "@/types";

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
type ValidPriority = (typeof VALID_PRIORITIES)[number];

function normalizePriority(value: unknown): ValidPriority {
  const up = String(value ?? "").toUpperCase();
  return (VALID_PRIORITIES as readonly string[]).includes(up)
    ? (up as ValidPriority)
    : "MEDIUM";
}

/**
 * Ask Gemini to summarise an issue/PR and suggest a priority + label.
 * Returns strict JSON. Throws on misconfiguration or upstream failure — the
 * caller records the failure and continues (AI is best-effort enrichment).
 */
export async function analyzeEvent(input: {
  eventType: string;
  title: string;
  body: string | null;
}): Promise<AIResult> {
  if (!isAiConfigured()) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const kind = input.eventType === "pull_request" ? "pull request" : "issue";
  const body = (input.body ?? "").slice(0, 4000);

  const prompt = [
    `You are a triage assistant for a GitHub repository.`,
    `Analyze the following ${kind} and respond with ONLY a JSON object:`,
    `{`,
    `  "summary": "one or two sentence plain-English summary",`,
    `  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",`,
    `  "suggestedLabel": "a single short kebab-case label, or null"`,
    `}`,
    ``,
    `Title: ${input.title}`,
    `Body: ${body || "(no description provided)"}`,
  ].join("\n");

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed: {
    summary?: unknown;
    priority?: unknown;
    suggestedLabel?: unknown;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON output");
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "No summary available.";

  const suggestedLabel =
    typeof parsed.suggestedLabel === "string" && parsed.suggestedLabel.trim()
      ? parsed.suggestedLabel.trim().toLowerCase()
      : null;

  return {
    summary,
    priority: normalizePriority(parsed.priority),
    suggestedLabel,
    model: env.GEMINI_MODEL,
    raw: parsed,
  };
}

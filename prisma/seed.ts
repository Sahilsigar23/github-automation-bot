/**
 * Seed script — idempotent demo data so the dashboard renders with content
 * before any real webhook arrives. Safe to run repeatedly.
 *
 *   pnpm db:seed
 *
 * NOTE: the demo user has no real GitHub token, so no live GitHub/Slack calls
 * are made from seeded data — it exists purely to populate the UI.
 */
import { PrismaClient, Priority } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding demo data…");

  const user = await prisma.user.upsert({
    where: { email: "demo@github-automation-bot.dev" },
    update: {},
    create: {
      email: "demo@github-automation-bot.dev",
      name: "Demo User",
      githubId: "583231",
      githubLogin: "octocat",
      image: "https://avatars.githubusercontent.com/u/583231?v=4",
    },
  });

  const repo = await prisma.repository.upsert({
    where: { fullName: "octocat/Hello-World" },
    update: { userId: user.id },
    create: {
      userId: user.id,
      githubId: BigInt(1296269),
      name: "Hello-World",
      fullName: "octocat/Hello-World",
      owner: "octocat",
      private: false,
      htmlUrl: "https://github.com/octocat/Hello-World",
      defaultBranch: "master",
      webhookActive: true,
    },
  });

  // Rules — not hardcoded in the engine; they live here in the DB.
  const bugRule = await prisma.rule.upsert({
    where: { id: "seed-rule-bug" },
    update: {},
    create: {
      id: "seed-rule-bug",
      userId: user.id,
      repositoryId: repo.id,
      name: 'Label "bug" issues',
      eventType: "issues",
      keyword: "bug",
      matchField: "title",
      action: "ADD_LABEL",
      actionValue: "bug",
      slackEnabled: true,
      enabled: true,
    },
  });

  await prisma.rule.upsert({
    where: { id: "seed-rule-pr-thanks" },
    update: {},
    create: {
      id: "seed-rule-pr-thanks",
      userId: user.id,
      repositoryId: repo.id,
      name: "Thank new pull requests",
      eventType: "pull_request",
      keyword: "",
      matchField: "any",
      action: "ADD_COMMENT",
      actionValue:
        "Thanks for the contribution, @{{author}}! A maintainer will review **{{title}}** shortly. 🙌",
      slackEnabled: true,
      enabled: true,
    },
  });

  // A sample processed event so charts / tables are populated.
  const event = await prisma.webhookEvent.upsert({
    where: { deliveryId: "seed-delivery-0001" },
    update: {},
    create: {
      deliveryId: "seed-delivery-0001",
      eventType: "issues",
      action: "opened",
      repositoryId: repo.id,
      repoFullName: repo.fullName,
      senderLogin: "octocat",
      title: "Login button throws a bug on Safari",
      number: 42,
      htmlUrl: "https://github.com/octocat/Hello-World/issues/42",
      status: "PROCESSED",
      processingMs: 812,
      processedAt: new Date(),
      payload: {
        action: "opened",
        issue: {
          number: 42,
          title: "Login button throws a bug on Safari",
          body: "Steps to reproduce: click login on Safari 17. A bug appears in console.",
          html_url: "https://github.com/octocat/Hello-World/issues/42",
          user: { login: "octocat" },
        },
        repository: { full_name: "octocat/Hello-World" },
        sender: { login: "octocat" },
      },
    },
  });

  await prisma.aIAnalysis.upsert({
    where: { webhookEventId: event.id },
    update: {},
    create: {
      webhookEventId: event.id,
      summary:
        "A user reports the login button triggers a JavaScript error on Safari 17, blocking authentication for Safari visitors.",
      priority: Priority.HIGH,
      suggestedLabel: "bug",
      model: "gemini-2.0-flash",
      latencyMs: 540,
      cached: true,
    },
  });

  await prisma.gitHubAction.create({
    data: {
      webhookEventId: event.id,
      actionType: "ADD_LABEL",
      target: "issue #42 → bug",
      status: "SUCCESS",
      latencyMs: 210,
      responseUrl: "https://github.com/octocat/Hello-World/issues/42",
    },
  });

  await prisma.slackDelivery.create({
    data: {
      webhookEventId: event.id,
      messageText:
        "🐛 New issue in octocat/Hello-World: Login button throws a bug on Safari",
      status: "SUCCESS",
      statusCode: 200,
      latencyMs: 95,
    },
  });

  await prisma.actionLog.createMany({
    data: [
      {
        webhookEventId: event.id,
        ruleId: bugRule.id,
        step: "MATCH",
        status: "SUCCESS",
        message: 'Rule "Label bug issues" matched keyword "bug" in title',
        latencyMs: 3,
      },
      {
        webhookEventId: event.id,
        ruleId: bugRule.id,
        step: "ADD_LABEL",
        status: "SUCCESS",
        message: 'Applied label "bug" to issue #42',
        latencyMs: 210,
      },
      {
        webhookEventId: event.id,
        ruleId: bugRule.id,
        step: "SLACK",
        status: "SUCCESS",
        message: "Slack notification delivered",
        latencyMs: 95,
      },
    ],
  });

  console.log("✅ Seed complete:");
  console.log(`   user:  ${user.email}`);
  console.log(`   repo:  ${repo.fullName}`);
  console.log(`   rules: 2, events: 1 (fully processed)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

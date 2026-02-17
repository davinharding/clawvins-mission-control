#!/usr/bin/env node
/**
 * Import Davin's todos from Clawvin into Mission Control
 */

import { db, createTask } from '../server/db.js';

const todos = [
  {
    title: "Set Up Email for Iris (Outreach)",
    description: "Blocks outreach entirely. Pick provider (Resend recommended, free 100/day), set up sending address (e.g. outreach@stagesnap.xyz), configure DNS records (SPF/DKIM) for deliverability.",
    priority: "high",
    status: "backlog",
    assignedAgent: "agent-iris",
  },
  {
    title: "Persistent Twitter Access via Bird Skill",
    description: "Cookie auth expires constantly. Create Twitter Developer account/app, get OAuth tokens from developer portal, configure bird skill with persistent token auth. Enables both Alpha (scraping) and Nova (posting).",
    priority: "high",
    status: "backlog",
    assignedAgent: "agent-alpha",
  },
  {
    title: "Plaid Integration for Personal Finance",
    description: "Automates financial tracking. Connect Plaid API (free tier for dev/personal), replace manual Google Sheet updates, feed into Ledger agent. Foundation for potential Mint replacement product idea.",
    priority: "high",
    status: "backlog",
    assignedAgent: "agent-ledger",
  },
  {
    title: "Individual Discord Apps per Agent",
    description: "Each agent gets their own Discord bot app with identity, avatar, and scoped permissions. Only Clawvin gets Manage Channels, others get minimal perms.",
    priority: "medium",
    status: "backlog",
    assignedAgent: "user-davin",
  },
  {
    title: "Twitter Access for Nova",
    description: "Brand content needs a channel. Depends on persistent Twitter access being done first. Either share Alpha's tokens or create @stagesnap_ai.",
    priority: "medium",
    status: "backlog",
    assignedAgent: "agent-nova",
  },
  {
    title: "Notion Integration",
    description: "Sync leads CSV to Notion as a visual layer. CSV remains source of truth, Notion = view layer. Quality of life upgrade.",
    priority: "medium",
    status: "backlog",
    assignedAgent: "user-davin",
  },
  {
    title: "Buffer/Later for Instagram Scheduling",
    description: "Buffer (free tier) or Later for scheduling. Only matters once we have content worth posting regularly.",
    priority: "low",
    status: "backlog",
    assignedAgent: "agent-iris",
  },
  {
    title: "StageSnap Twitter Account",
    description: "Create @stagesnap_ai or similar. Brand separation is good but not urgent until Nova is actively posting.",
    priority: "low",
    status: "backlog",
    assignedAgent: "agent-nova",
  },
  {
    title: "LinkedIn Company Page",
    description: "Create Harding Labs or StageSnap page. Good for credibility but low ROI until we have customers/content.",
    priority: "low",
    status: "backlog",
    assignedAgent: "user-davin",
  },
  {
    title: "Termius + Tailscale for Mobile VPS Access",
    description: "Tailscale on VPS + Termius on phone. Convenient for on-the-go but not blocking anything.",
    priority: "low",
    status: "backlog",
    assignedAgent: "user-davin",
  },
  {
    title: "Giphy/Tenor API Keys",
    description: "Set up proper API keys for GIF/meme sharing. Workaround exists, lowest priority.",
    priority: "low",
    status: "backlog",
    assignedAgent: "user-davin",
  },
];

console.log(`Importing ${todos.length} todos...`);

let imported = 0;
for (const todo of todos) {
  try {
    createTask({
      title: todo.title,
      description: todo.description,
      status: todo.status,
      assignedAgent: todo.assignedAgent,
      priority: todo.priority,
      tags: ['imported', 'davin'],
      createdBy: 'user-davin',
    });
    imported++;
    console.log(`✓ ${todo.title}`);
  } catch (err) {
    console.error(`✗ Failed to import: ${todo.title}`, err.message);
  }
}

console.log(`\nImported ${imported}/${todos.length} todos successfully!`);

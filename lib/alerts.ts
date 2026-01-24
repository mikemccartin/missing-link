/**
 * Slack Alert Notifications for missing.link
 *
 * Sends webhook notifications when citations are found.
 */

import { MentionResult } from "./monitor";

export interface SlackMessage {
  text: string;
  blocks?: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    fields?: Array<{ type: string; text: string }>;
  }>;
}

/**
 * Send a Slack notification when missing.link is cited by an AI platform.
 */
export async function sendCitationAlert(result: MentionResult): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  // Skip if no webhook configured or no citation
  if (!webhookUrl || !result.cited) {
    return false;
  }

  const platformNames: Record<string, string> = {
    perplexity: "Perplexity",
    chatgpt: "ChatGPT",
    google: "Google AI Mode",
  };

  const platformName = platformNames[result.platform] || result.platform;

  const message: SlackMessage = {
    text: `Citation Found! missing.link was cited by ${platformName} for ${result.entityName}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "missing.link Cited!",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Entity:*\n${result.entityName}`,
          },
          {
            type: "mrkdwn",
            text: `*Platform:*\n${platformName}`,
          },
          {
            type: "mrkdwn",
            text: `*Citation URL:*\n${result.citedUrl || "N/A"}`,
          },
          {
            type: "mrkdwn",
            text: `*Timestamp:*\n${new Date(result.timestamp).toUTCString()}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Answer Excerpt:*\n>${result.answerExcerpt.slice(0, 200)}...`,
        },
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error(`Slack webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`[Alert] Slack notification sent for ${result.entityName} on ${platformName}`);
    return true;
  } catch (error) {
    console.error("Error sending Slack alert:", error);
    return false;
  }
}

/**
 * Send a summary alert after a monitoring run (optional, for daily/weekly summaries).
 */
export async function sendMonitoringSummary(
  totalChecks: number,
  citations: number,
  platformBreakdown: Record<string, { checked: number; cited: number }>
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return false;
  }

  // Only send summary if there are results
  if (totalChecks === 0) {
    return false;
  }

  const platformSummary = Object.entries(platformBreakdown)
    .map(([platform, stats]) => {
      const name =
        platform === "perplexity"
          ? "Perplexity"
          : platform === "chatgpt"
            ? "ChatGPT"
            : platform === "google"
              ? "Google AI Mode"
              : platform;
      return `${name}: ${stats.cited}/${stats.checked}`;
    })
    .join(" | ");

  const emoji = citations > 0 ? ":tada:" : ":mag:";
  const statusText = citations > 0 ? "Citations Found!" : "No Citations Yet";

  const message: SlackMessage = {
    text: `AI Monitoring Complete: ${citations}/${totalChecks} citations`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${statusText}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Total Checks:*\n${totalChecks}`,
          },
          {
            type: "mrkdwn",
            text: `*Citations Found:*\n${citations}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*By Platform:*\n${platformSummary}`,
        },
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (error) {
    console.error("Error sending Slack summary:", error);
    return false;
  }
}

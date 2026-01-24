import { NextResponse } from "next/server";
import {
  monitorAllEntities,
  saveResults,
  MentionResult,
  MonitoringRunResult,
} from "@/lib/monitor";
import { sendCitationAlert } from "@/lib/alerts";
import { storeDailyAggregate } from "@/lib/redis";

// Vercel Cron runs this weekly on Mondays at 9am UTC
// Configure in vercel.json

export const maxDuration = 300; // 5 minutes max for Pro plan
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron (optional security)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, verify it
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting AI monitoring run...");

    // Run monitoring for all entities across all platforms
    const results = await monitorAllEntities(
      ["perplexity", "chatgpt", "google"],
      false // not verbose in cron context
    );

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No entities to monitor",
        timestamp: new Date().toISOString(),
      });
    }

    // Save results to content/ai-mentions/
    const runResult = saveResults(results);

    // Store daily aggregate in Redis for historical tracking
    await storeDailyAggregate(runResult);

    // Send Slack alerts for any citations found
    const citedResults = results.filter((r) => r.cited);
    for (const result of citedResults) {
      await sendCitationAlert(result);
    }

    console.log(
      `[Cron] Completed: ${results.length} checks, ${citedResults.length} citations`
    );

    return NextResponse.json({
      success: true,
      timestamp: runResult.timestamp,
      totalChecks: runResult.totalChecks,
      citations: runResult.citations,
      platformBreakdown: runResult.platformBreakdown,
      alertsSent: citedResults.length,
    });
  } catch (error) {
    console.error("[Cron] Error during monitoring:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

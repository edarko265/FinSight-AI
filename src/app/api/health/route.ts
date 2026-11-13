/**
 * Liveness and build-info endpoint. Used to confirm which commit is deployed.
 * Returns no secrets and touches no customer data.
 */
export function GET(): Response {
  return Response.json({
    status: "ok",
    service: "finsight-ai",
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "unknown",
  });
}

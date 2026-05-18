import { createApp } from "./app";
import { logProductionWarnings } from "./dev/log-production-warnings";
import { initRateLimitRedis } from "./platform/http/middleware/rate-limit.middleware";
import { startAllWorkers } from "./platform/jobs/start-workers";

const port = Number(process.env.PORT || 3333);

async function main(): Promise<void> {
  try {
    await initRateLimitRedis();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn("[redis] rate-limit em memoria local (falha ao conectar):", message);
  }

  const app = createApp();
  logProductionWarnings();

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[saas-core] running on port ${port}`);
    startAllWorkers();
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[saas-core] falha no boot:", error);
  process.exit(1);
});

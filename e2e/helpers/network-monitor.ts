import type { Page, Request, Response } from "@playwright/test";

export type NetworkEntry = {
  method: string;
  url: string;
  status?: number;
  timestamp: string;
};

export class NetworkMonitor {
  readonly entries: NetworkEntry[] = [];
  readonly consoleErrors: string[] = [];

  attach(page: Page): void {
    page.on("request", (req: Request) => {
      const url = req.url();
      const path = url.includes("/v1/") ? url : "";
      if (!path.includes("/v1/")) {
        return;
      }
      this.entries.push({
        method: req.method(),
        url,
        timestamp: new Date().toISOString()
      });
    });

    page.on("response", async (res: Response) => {
      const url = res.url();
      if (!url.includes("/v1/")) {
        return;
      }
      const match = this.entries.findLast((e) => e.url === url && e.status === undefined);
      if (match) {
        match.status = res.status();
      } else {
        this.entries.push({
          method: res.request().method(),
          url,
          status: res.status(),
          timestamp: new Date().toISOString()
        });
      }
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.consoleErrors.push(msg.text());
      }
    });
  }

  findResponse(pathPart: string, method?: string): NetworkEntry | undefined {
    return this.entries.find(
      (e) => e.url.includes(pathPart) && (!method || e.method === method) && e.status !== undefined
    );
  }

  lastResponse(pathPart: string, method?: string): NetworkEntry | undefined {
    const filtered = this.entries.filter(
      (e) => e.url.includes(pathPart) && (!method || e.method === method) && e.status !== undefined
    );
    return filtered[filtered.length - 1];
  }

  clear(): void {
    this.entries.length = 0;
    this.consoleErrors.length = 0;
  }
}

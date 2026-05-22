import { test as base } from "@playwright/test";
import { NetworkMonitor } from "../helpers/network-monitor";

export const test = base.extend<{ net: NetworkMonitor }>({
  net: async ({ page }, use) => {
    const net = new NetworkMonitor();
    net.attach(page);
    await use(net);
  }
});

export { expect } from "@playwright/test";

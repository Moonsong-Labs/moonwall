import { MoonwallContext, contextCreator, runNetworkOnly } from "../lib/globalContext";

let teardown = false;

export default async function () {
  if (process.env.MOON_RECYCLE !== "true") {
    console.log("running global setup");
    await contextCreator();
    await runNetworkOnly();

    return async () => {
      if (teardown) throw new Error("teardown called twice");
      teardown = true;
      return new Promise<void>((resolve) => MoonwallContext.destroy().then(() => resolve()));
    };
  }
}

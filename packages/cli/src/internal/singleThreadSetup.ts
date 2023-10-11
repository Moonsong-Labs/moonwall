import { MoonwallContext, contextCreator } from "../lib/globalContext";

let teardown = false;

export default async function () {
  console.log("running lgobal setup");
  const ctx = await contextCreator();

  return async () => {
    if (teardown) {
      throw new Error("teardown called twice");
    }
    teardown = true;
    return new Promise<void>(async (resolve) => {
      await ctx.disconnect();
      return MoonwallContext.destroy().then(() => resolve());
    });
  };
}

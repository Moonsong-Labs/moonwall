import { MoonwallContext } from "./globalContext";

const debug = require("debug")("global");


console.log("helllooo")
MoonwallContext.printStats()

export function mochaGlobalSetup() {
  console.log('mocha global setup');
  MoonwallContext.printStats()
  debug("please help me")
}

export function mochaGlobalTeardown() {
  console.log('mocha global Teardown');
}

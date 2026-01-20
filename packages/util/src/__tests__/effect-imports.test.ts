import { describe, expect, it } from "bun:test";
import { Effect, pipe } from "effect";
import { FileSystem } from "@effect/platform";

describe("Effect imports", () => {
  it("should import Effect core module", () => {
    expect(Effect).toBeDefined();
    expect(Effect.succeed).toBeDefined();
    expect(Effect.fail).toBeDefined();
    expect(Effect.map).toBeDefined();
    expect(Effect.flatMap).toBeDefined();
  });

  it("should run a simple Effect", async () => {
    const program = Effect.succeed(42);
    const result = await Effect.runPromise(program);
    expect(result).toBe(42);
  });

  it("should use pipe with Effect", async () => {
    const program = pipe(
      Effect.succeed(10),
      Effect.map((n) => n * 2),
      Effect.flatMap((n) => Effect.succeed(n + 5))
    );
    const result = await Effect.runPromise(program);
    expect(result).toBe(25);
  });

  it("should import @effect/platform FileSystem", () => {
    expect(FileSystem).toBeDefined();
    expect(FileSystem.FileSystem).toBeDefined();
  });
});

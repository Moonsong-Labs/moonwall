import { CommandExecutor, FileSystem, Path } from "@effect/platform-node";
import { Layer } from "effect";

export const LocalEnvironment = FileSystem.layer.pipe(
  Layer.provideMerge(CommandExecutor.layer),
  Layer.merge(Path.layer)
);

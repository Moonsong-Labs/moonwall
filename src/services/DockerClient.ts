import Docker from "dockerode";
import { Context, Data, Effect, Layer } from "effect";

export class DockerError extends Data.TaggedError("DockerError")<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

export class DockerClient extends Context.Tag("DockerClient")<
  DockerClient,
  {
    readonly listContainers: (
      filters: Record<string, string[]>
    ) => Effect.Effect<Docker.ContainerInfo[], DockerError>;
    readonly stopContainer: (id: string) => Effect.Effect<void, DockerError>;
    readonly removeContainer: (id: string) => Effect.Effect<void, DockerError>;
  }
>() {}

export const DockerClientLive = Layer.sync(DockerClient, () => {
  const docker = new Docker();
  return {
    listContainers: (filters) =>
      Effect.tryPromise({
        try: () => docker.listContainers({ filters }),
        catch: (cause) => new DockerError({ cause, operation: "listContainers" }),
      }),
    stopContainer: (id) =>
      Effect.tryPromise({
        try: () =>
          docker
            .getContainer(id)
            .stop()
            .then(() => {}),
        catch: (cause) => new DockerError({ cause, operation: "stopContainer" }),
      }),
    removeContainer: (id) =>
      Effect.tryPromise({
        try: () =>
          docker
            .getContainer(id)
            .remove()
            .then(() => {}),
        catch: (cause) => new DockerError({ cause, operation: "removeContainer" }),
      }),
  };
});

// Points `import ... from "@minecraft/server"` at the local mock.
export async function resolve(specifier, context, next) {
  if (specifier === "@minecraft/server") {
    return { url: new URL("./mock-server.mjs", import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}

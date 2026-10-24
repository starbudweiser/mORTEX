import { homedir, tmpdir } from "node:os";
import { join } from "node:path/posix";

import type { DarwinPathBase, IDarwinPathProvider } from "@vortex/shared/filesystem";
import { DarwinPath, QualifiedPath, PathProviderError } from "@vortex/shared/filesystem";

/**
 * Node-backed implementation of {@link IDarwinPathProvider} (mORTEX).
 *
 * Same contract as `LinuxPathProvider`: a pure factory returning
 * `native://` {@link QualifiedPath}s for well-known macOS locations.
 */
export class DarwinPathProvider implements IDarwinPathProvider {
  readonly platform = "darwin" as const;

  fromBase(base: DarwinPathBase): Promise<QualifiedPath> {
    const library = join(homedir(), "Library");
    let path: string;
    if (base === "home") path = homedir();
    else if (base === "temp") path = tmpdir();
    else if (base === DarwinPath.appSupport) path = join(library, "Application Support");
    else if (base === DarwinPath.caches) path = join(library, "Caches");
    else if (base === DarwinPath.logs) path = join(library, "Logs");
    else {
      const exhausted: never = base;
      return Promise.reject(new PathProviderError(`Unknown base '${String(exhausted)}'`));
    }
    return Promise.resolve(QualifiedPath.fromNative(path));
  }
}

import { open, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PROFILE_LOCK_FILE } from "./constants.js";

export interface ProfileLock {
  release(): Promise<void>;
}

export async function acquireProfileLock(
  profileDirectory: string,
): Promise<ProfileLock> {
  const lockPath = path.join(profileDirectory, PROFILE_LOCK_FILE);
  const handle = await open(lockPath, "wx").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST") {
        throw new Error(
          `Profile at "${profileDirectory}" is already in use. Close the other multicheese session using this profile and try again.`,
        );
      }

      throw error;
    },
  );

  await handle.writeFile(`${process.pid}\n`, "utf8");

  let released = false;

  const cleanup = (): void => {
    if (released) {
      return;
    }

    released = true;
    void handle.close().catch(() => undefined);
    void rm(lockPath, { force: true });
  };

  const onSigInt = (): never => {
    cleanup();
    process.exit(130);
  };

  const onSigTerm = (): never => {
    cleanup();
    process.exit(143);
  };

  process.once("exit", cleanup);
  process.once("SIGINT", onSigInt);
  process.once("SIGTERM", onSigTerm);

  return {
    release() {
      cleanup();
      process.removeListener("exit", cleanup);
      process.removeListener("SIGINT", onSigInt);
      process.removeListener("SIGTERM", onSigTerm);
      return Promise.resolve();
    },
  };
}

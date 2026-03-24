import { open, readFile, rm } from "node:fs/promises";
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
  const handle = await openLockFile(lockPath, profileDirectory);

  await handle.writeFile(`${process.pid}\n`, "utf8");

  let released = false;

  const cleanupAsync = async (): Promise<void> => {
    if (released) {
      return;
    }

    released = true;
    await handle.close().catch(() => undefined);
    await rm(lockPath, { force: true }).catch(() => undefined);
  };

  const cleanup = (): void => {
    void cleanupAsync();
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
    async release() {
      process.removeListener("exit", cleanup);
      process.removeListener("SIGINT", onSigInt);
      process.removeListener("SIGTERM", onSigTerm);
      await cleanupAsync();
    },
  };
}

async function openLockFile(lockPath: string, profileDirectory: string) {
  try {
    return await open(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }

  if (!(await isStaleLock(lockPath))) {
    throw createProfileInUseError(profileDirectory);
  }

  await rm(lockPath, { force: true });

  return open(lockPath, "wx").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") {
      throw createProfileInUseError(profileDirectory);
    }

    throw error;
  });
}

async function isStaleLock(lockPath: string): Promise<boolean> {
  const contents = await readFile(lockPath, "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return "";
      }

      throw error;
    },
  );
  const pid = Number.parseInt(contents.trim(), 10);

  if (!Number.isInteger(pid) || pid <= 0) {
    return true;
  }

  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code === "ESRCH") {
      return true;
    }

    if (errno.code === "EPERM") {
      return false;
    }

    throw error;
  }
}

function createProfileInUseError(profileDirectory: string): Error {
  return new Error(
    `Profile at "${profileDirectory}" is already in use. Close the other multicheese session using this profile and try again.`,
  );
}

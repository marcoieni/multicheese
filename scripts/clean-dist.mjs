import { rm } from "node:fs/promises";
import { getDistDir } from "./dist-path.mjs";

await rm(getDistDir(), { recursive: true, force: true });

import { rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

await rm(path.join(process.cwd(), "dist"), { recursive: true, force: true });

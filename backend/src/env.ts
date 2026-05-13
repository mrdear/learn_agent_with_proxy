import dotenv from "dotenv";
import path from "node:path";

const envPath = path.resolve(import.meta.dirname, "../.env");

dotenv.config({
  path: envPath,
  override: true,
});


import type { Provider } from "../proxy.js";
import { anthropicStrategy } from "./anthropic.js";
import { openaiStrategy } from "./openai.js";
import type { RelayStrategy } from "./types.js";

export function getRelayStrategy(provider: Provider): RelayStrategy {
  return provider === "anthropic" ? anthropicStrategy : openaiStrategy;
}

export type { PreparedRelayRequest, RelayRequest, RelayStrategy } from "./types.js";

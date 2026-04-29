import type { Provider } from "../proxy.js";
import { anthropicStrategy } from "./anthropic.js";
import { openaiStrategy } from "./openai.js";
import { openaiResponsesStrategy } from "./openai-responses.js";
import type { RelayStrategy } from "./types.js";

export function getRelayStrategy(provider: Provider): RelayStrategy {
  if (provider === "anthropic") return anthropicStrategy;
  if (provider === "openai-responses") return openaiResponsesStrategy;
  return openaiStrategy;
}

export type { PreparedRelayRequest, RelayRequest, RelayStrategy } from "./types.js";

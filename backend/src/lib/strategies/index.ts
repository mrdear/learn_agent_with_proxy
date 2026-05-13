import type { Provider } from "../proxy.js";
import { anthropicStrategy } from "./anthropic.js";
import { openaiStrategy } from "./openai.js";
import { openaiResponsesStrategy } from "./openai-responses.js";
import type { RelayStrategy } from "./types.js";

const strategies: Record<Provider, RelayStrategy> = {
  openai: openaiStrategy,
  anthropic: anthropicStrategy,
  "openai-responses": openaiResponsesStrategy,
};

export function getRelayStrategy(provider: Provider): RelayStrategy {
  return strategies[provider];
}

export type { PreparedRelayRequest, RelayRequest, RelayStrategy } from "./types.js";

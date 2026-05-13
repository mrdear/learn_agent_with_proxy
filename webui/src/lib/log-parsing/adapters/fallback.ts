import type { LogAdapter } from "./types";
import { getParams, getTools } from "./shared";

export const fallbackAdapter: LogAdapter = {
  protocol: "unknown",
  matches() {
    return true;
  },
  parseRequest(input) {
    return {
      messages: [],
      systemPrompt: null,
      tools: getTools(input.requestBody),
      params: getParams(input.requestBody),
    };
  },
  parseResponse(input) {
    return {
      items: [],
      raw: input.responseBody,
      effectiveBody: input.effectiveResponseBody,
      hasToolCalls: false,
    };
  },
};

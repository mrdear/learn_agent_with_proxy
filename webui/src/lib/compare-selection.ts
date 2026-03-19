const STORAGE_KEY = "learn-agent-with-proxy.compare-selection";

export function saveCompareSelection(ids: [number, number]): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function loadCompareSelection(): [number, number] | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "number" &&
      typeof parsed[1] === "number"
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // Ignore invalid stored values.
  }

  return null;
}

export function clearCompareSelection(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

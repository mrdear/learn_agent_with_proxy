import { EventEmitter } from "node:events";
import type { ProxyEventMap } from "./types.js";

class ProxyEventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof ProxyEventMap>(event: K, data: ProxyEventMap[K]): void {
    this.emitter.emit(event, data);
  }

  on<K extends keyof ProxyEventMap>(event: K, handler: (data: ProxyEventMap[K]) => void): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  off<K extends keyof ProxyEventMap>(event: K, handler: (data: ProxyEventMap[K]) => void): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }
}

export const proxyEventBus = new ProxyEventBus();

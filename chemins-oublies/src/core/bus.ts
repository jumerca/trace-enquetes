// Bus d'événements minimal entre systèmes (jeu ↔ interface).
type Fn = (...a: any[]) => void;
class Bus {
  private m = new Map<string, Set<Fn>>();
  on(ev: string, fn: Fn): () => void {
    if (!this.m.has(ev)) this.m.set(ev, new Set());
    this.m.get(ev)!.add(fn);
    return () => this.m.get(ev)?.delete(fn);
  }
  emit(ev: string, ...a: any[]): void { this.m.get(ev)?.forEach((f) => f(...a)); }
  clear(): void { this.m.clear(); }
}
export const bus = new Bus();

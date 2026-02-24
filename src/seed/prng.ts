export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    // LCG from Numerical Recipes
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(minInclusive: number, maxInclusive: number): number {
    if (maxInclusive < minInclusive) {
      throw new Error("Invalid int range");
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.next() * span);
  }

  pick<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return arr[this.int(0, arr.length - 1)];
  }
}

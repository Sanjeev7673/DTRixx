declare module "cubejs" {
  export default class Cube {
    constructor(state?: any);
    move(algorithm: string): Cube;
    solve(maxDepth?: number): string;
    asString(): string;
    isSolved(): boolean;
    static fromString(str: string): Cube;
    static initSolver(): void;
  }
}

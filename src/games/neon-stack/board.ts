import { COLS, TOTAL_ROWS } from './config';
import { CELLS, type PieceType, type Rotation } from './pieces';

export type Grid = (PieceType | null)[][];

/** The well: TOTAL_ROWS rows (hidden spawn rows first) of COLS cells. */
export class Board {
  grid: Grid = [];

  constructor(grid?: Grid) {
    if (grid) this.grid = grid.map(row => [...row]);
    else this.clear();
  }

  clear(): void {
    this.grid = Array.from({ length: TOTAL_ROWS }, () => Array<PieceType | null>(COLS).fill(null));
  }

  clone(): Board {
    return new Board(this.grid);
  }

  /** Walls and floor count as filled; open sky above the well does not. */
  filled(x: number, y: number): boolean {
    if (x < 0 || x >= COLS || y >= TOTAL_ROWS) return true;
    return y >= 0 && this.grid[y][x] !== null;
  }

  fits(type: PieceType, rot: Rotation, x: number, y: number): boolean {
    return CELLS[type][rot].every(c => !this.filled(x + c.x, y + c.y));
  }

  place(type: PieceType, rot: Rotation, x: number, y: number): void {
    for (const c of CELLS[type][rot]) {
      const row = y + c.y;
      if (row >= 0) this.grid[row][x + c.x] = type;
    }
  }

  /** Lowest y the piece can drop to from y. */
  dropY(type: PieceType, rot: Rotation, x: number, y: number): number {
    while (this.fits(type, rot, x, y + 1)) y++;
    return y;
  }

  fullRows(): number[] {
    return this.grid.flatMap((row, y) => (row.every(c => c !== null) ? [y] : []));
  }

  removeRows(rows: readonly number[]): void {
    const keep = this.grid.filter((_, y) => !rows.includes(y));
    const fresh = rows.map(() => Array<PieceType | null>(COLS).fill(null));
    this.grid = [...fresh, ...keep];
  }

  get empty(): boolean {
    return this.grid.every(row => row.every(c => c === null));
  }

  /** Height of the tallest column, in rows (0 = empty well). */
  get stackHeight(): number {
    const top = this.grid.findIndex(row => row.some(c => c !== null));
    return top === -1 ? 0 : TOTAL_ROWS - top;
  }
}

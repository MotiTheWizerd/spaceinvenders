export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Rotation = 0 | 1 | 2 | 3;

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export const TYPES: readonly PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** Spawn orientation of each piece inside its bounding box ('#' = block). */
const SHAPES: Readonly<Record<PieceType, readonly string[]>> = {
  I: ['....', '####', '....', '....'],
  O: ['##', '##'],
  T: ['.#.', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
};

const rotateCW = (m: readonly string[]): string[] =>
  m.map((_, r) => m.map((_, c) => m[m.length - 1 - c][r]).join(''));

const cellsOf = (m: readonly string[]): Cell[] =>
  m.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === '#' ? [{ x, y }] : [])));

/** Blocks of each piece in each rotation (0 = spawn, then clockwise), relative to its box's top-left. */
export const CELLS: Readonly<Record<PieceType, readonly (readonly Cell[])[]>> = Object.fromEntries(
  TYPES.map(t => {
    const states = [SHAPES[t]];
    for (let i = 1; i < 4; i++) states.push(rotateCW(states[i - 1]));
    return [t, states.map(cellsOf)];
  }),
) as Record<PieceType, Cell[][]>;

/** Spawn column of the piece's box: centred, leaning left. */
export const spawnX = (type: PieceType): number => (type === 'O' ? 4 : 3);

// SRS wall kicks, as published (x right, y UP); converted to y-down below.
type KickTable = Readonly<Record<string, readonly [number, number][]>>;
const JLSTZ_KICKS: KickTable = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const I_KICKS: KickTable = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
const NO_KICK: readonly [number, number][] = [[0, 0]];

/** Offsets (x right, y down) to try in order when rotating from one state to another. */
export function kicks(type: PieceType, from: Rotation, to: Rotation): readonly [number, number][] {
  if (type === 'O') return NO_KICK;
  const table = type === 'I' ? I_KICKS : JLSTZ_KICKS;
  return table[`${from}${to}`].map(([x, y]) => [x, -y] as [number, number]);
}

/** The "7-bag": every run of seven pieces contains each piece once, in random order. */
export class Bag {
  private pieces: PieceType[] = [];

  next(): PieceType {
    if (!this.pieces.length) {
      this.pieces = [...TYPES];
      for (let i = this.pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.pieces[i], this.pieces[j]] = [this.pieces[j], this.pieces[i]];
      }
    }
    return this.pieces.pop()!;
  }
}

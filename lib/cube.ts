export type Axis = "x" | "y" | "z";
export type Face = "U" | "D" | "L" | "R" | "F" | "B";
export type Sticker = { n: [number, number, number]; color: string };
export type Cubie = { id: string; p: [number, number, number]; stickers: Sticker[] };

export const COLORS: Record<Face, string> = {
  U: "#f8fafc", D: "#facc15", L: "#fb5b5b", R: "#ff8a3d", F: "#34d399", B: "#4f8cff"
};

const solved = (): Cubie[] => {
  const out: Cubie[] = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const stickers: Sticker[] = [];
    if (y === 1) stickers.push({ n: [0, 1, 0], color: COLORS.U });
    if (y === -1) stickers.push({ n: [0, -1, 0], color: COLORS.D });
    if (x === -1) stickers.push({ n: [-1, 0, 0], color: COLORS.L });
    if (x === 1) stickers.push({ n: [1, 0, 0], color: COLORS.R });
    if (z === 1) stickers.push({ n: [0, 0, 1], color: COLORS.F });
    if (z === -1) stickers.push({ n: [0, 0, -1], color: COLORS.B });
    out.push({ id: `${x},${y},${z}`, p: [x, y, z], stickers });
  }
  return out;
};

export const initialCube = () => solved();

export const cloneCube = (cube: Cubie[]): Cubie[] => cube.map(c => ({
  id: c.id,
  p: [...c.p] as [number, number, number],
  stickers: c.stickers.map(s => ({ n: [...s.n] as [number, number, number], color: s.color }))
}));

const rotateVec = (v: [number, number, number], axis: Axis, dir: 1 | -1): [number, number, number] => {
  const [x, y, z] = v;
  if (axis === "x") return dir === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === "y") return dir === 1 ? [z, y, -x] : [-z, y, x];
  return dir === 1 ? [-y, x, z] : [y, -x, z];
};

const defs: Record<Face, { axis: Axis; layer: number; dir: 1 | -1 }> = {
  R: { axis: "x", layer: 1, dir: -1 },
  L: { axis: "x", layer: -1, dir: 1 },
  U: { axis: "y", layer: 1, dir: 1 },
  D: { axis: "y", layer: -1, dir: -1 },
  F: { axis: "z", layer: 1, dir: -1 },
  B: { axis: "z", layer: -1, dir: 1 }
};

export const invertMove = (move: string) => move.endsWith("2") ? move : move.endsWith("'") ? move[0] : `${move[0]}'`;

export const applyMove = (cube: Cubie[], notation: string): Cubie[] => {
  const face = notation[0] as Face;
  const def = defs[face];
  if (!def) return cloneCube(cube);
  const turns = notation.endsWith("2") ? 2 : notation.endsWith("'") ? 3 : 1;
  let next = cloneCube(cube);
  for (let t = 0; t < turns; t++) {
    const axisIndex = def.axis === "x" ? 0 : def.axis === "y" ? 1 : 2;
    next = next.map(c => {
      if (c.p[axisIndex] !== def.layer) return c;
      return {
        ...c,
        p: rotateVec(c.p, def.axis, def.dir),
        stickers: c.stickers.map(s => ({ ...s, n: rotateVec(s.n, def.axis, def.dir) }))
      };
    });
  }
  return next;
};

export const scramble = (length = 20) => {
  const faces = Object.keys(defs) as Face[];
  const suffixes = ["", "'", "2"];
  const result: string[] = [];
  let last = "";
  while (result.length < length) {
    const face = faces[Math.floor(Math.random() * faces.length)];
    if (face === last) continue;
    result.push(face + suffixes[Math.floor(Math.random() * suffixes.length)]);
    last = face;
  }
  return result;
};

export const isSolved = (cube: Cubie[]) => {
  const target = solved();
  return cube.every(c => {
    const t = target.find(x => x.id === c.id);
    if (!t || c.p.join(",") !== t.p.join(",")) return false;
    return c.stickers.every(s => t.stickers.some(x => x.color === s.color && x.n.join(",") === s.n.join(",")));
  });
};

export const progressPercent = (cube: Cubie[]) => {
  const target = solved();
  let correct = 0, total = 0;
  for (const c of cube) {
    const t = target.find(x => x.id === c.id)!;
    total += 1 + c.stickers.length;
    if (c.p.join(",") === t.p.join(",")) correct++;
    for (const s of c.stickers) if (t.stickers.some(x => x.color === s.color && x.n.join(",") === s.n.join(","))) correct++;
  }
  return Math.round((correct / total) * 100);
};

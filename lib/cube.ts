export type Axis = "x" | "y" | "z";
export type Face = "U" | "D" | "L" | "R" | "F" | "B";
export type Sticker = { n: [number, number, number]; color: string };
export type Cubie = { id: string; p: [number, number, number]; stickers: Sticker[] };

export const COLORS: Record<Face, string> = {
  U: "#f8fafc", D: "#ffd54a", L: "#ff5f73",
  R: "#ff934d", F: "#36d399", B: "#5b8cff",
};

export const FACE_NORMALS: Record<Face, [number, number, number]> = {
  U: [0, 1, 0], D: [0, -1, 0], L: [-1, 0, 0],
  R: [1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
};

const DEFS: Record<Face, { axis: Axis; side: 1 | -1; dir: 1 | -1 }> = {
  R: { axis: "x", side: 1, dir: -1 },
  L: { axis: "x", side: -1, dir: 1 },
  U: { axis: "y", side: 1, dir: 1 },
  D: { axis: "y", side: -1, dir: -1 },
  F: { axis: "z", side: 1, dir: -1 },
  B: { axis: "z", side: -1, dir: 1 },
};

const FACES: Face[] = ["U", "R", "F", "D", "L", "B"];

export function invertMove(move: string) {
  const m = move.trim();
  if (m.endsWith("2")) return m;
  return m.endsWith("'") ? m.slice(0, -1) : m + "'";
}

export function tokenizeMoves(input: string) {
  return input.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function normalizeMove(token: string) {
  const m = token.trim().replace(/’/g, "'");
  const match = m.match(/^([2-9]?)([URFDLBurfdlb])([wW]?)(2|')?$/);
  if (!match) return null;

  const [, depthRaw, rawFace, wideRaw, suffix = ""] = match;
  const face = rawFace.toUpperCase() as Face;
  const depth = Number(depthRaw || 1);
  const wide = Boolean(wideRaw) || rawFace === rawFace.toLowerCase();

  if (depth < 1 || depth > 15) return null;
  return {
    face,
    depth,
    wide,
    suffix,
    notation: `${depth > 1 ? depth : ""}${face}${wide ? "w" : ""}${suffix}`,
  };
}

export function validateNotation(input: string) {
  const tokens = tokenizeMoves(input);
  const invalid = tokens.filter((t) => !normalizeMove(t));
  return { valid: tokens.length > 0 && invalid.length === 0, invalid };
}

function rotateVec(
  v: [number, number, number],
  axis: Axis,
  dir: 1 | -1
): [number, number, number] {
  const [x, y, z] = v;
  if (axis === "x") return dir === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === "y") return dir === 1 ? [z, y, -x] : [-z, y, x];
  return dir === 1 ? [-y, x, z] : [y, -x, z];
}

function layerCoordinate(size: number, face: Face, depth: number) {
  const max = size - 1;
  const offset = 2 * (depth - 1);
  return DEFS[face].side === 1 ? max - offset : -max + offset;
}

function createSolved(size: number): Cubie[] {
  const max = size - 1;
  const coords = Array.from({ length: size }, (_, i) => 2 * i - max);
  const result: Cubie[] = [];

  for (const x of coords) {
    for (const y of coords) {
      for (const z of coords) {
        const stickers: Sticker[] = [];

        for (const face of FACES) {
          const n = FACE_NORMALS[face];
          const visible =
            (face === "U" && y === max) ||
            (face === "D" && y === -max) ||
            (face === "R" && x === max) ||
            (face === "L" && x === -max) ||
            (face === "F" && z === max) ||
            (face === "B" && z === -max);

          if (visible) stickers.push({ n: [...n] as [number, number, number], color: COLORS[face] });
        }

        result.push({ id: `${x},${y},${z}`, p: [x, y, z], stickers });
      }
    }
  }

  return result;
}

export const initialCube = (size = 3) => createSolved(Math.max(2, Math.min(15, size)));

export const cloneCube = (cube: Cubie[]) =>
  cube.map((c) => ({
    id: c.id,
    p: [...c.p] as [number, number, number],
    stickers: c.stickers.map((s) => ({
      n: [...s.n] as [number, number, number],
      color: s.color,
    })),
  }));

function applyLayer(cube: Cubie[], face: Face, size: number, depth: number) {
  const def = DEFS[face];
  const axisIndex = def.axis === "x" ? 0 : def.axis === "y" ? 1 : 2;
  const layer = layerCoordinate(size, face, depth);

  return cube.map((cubie) => {
    if (cubie.p[axisIndex] !== layer) return cubie;

    return {
      ...cubie,
      p: rotateVec(cubie.p, def.axis, def.dir),
      stickers: cubie.stickers.map((s) => ({
        ...s,
        n: rotateVec(s.n, def.axis, def.dir),
      })),
    };
  });
}

export function applyMove(cube: Cubie[], notation: string, size = 3) {
  const parsed = normalizeMove(notation);
  if (!parsed || parsed.depth > size) return cloneCube(cube);

  const layerCount = parsed.wide ? Math.min(2, size - parsed.depth + 1) : 1;
  const turns = parsed.suffix === "2" ? 2 : parsed.suffix === "'" ? 3 : 1;

  let next = cloneCube(cube);
  for (let depth = parsed.depth; depth < parsed.depth + layerCount; depth++) {
    for (let i = 0; i < turns; i++) {
      next = applyLayer(next, parsed.face, size, depth);
    }
  }
  return next;
}

export function applyAlgorithm(cube: Cubie[], algorithm: string, size = 3) {
  return tokenizeMoves(algorithm).reduce(
    (state, move) => applyMove(state, move, size),
    cloneCube(cube)
  );
}

export function scramble(length = 20, size = 3) {
  const result: string[] = [];
  let lastAxis: Axis | null = null;
  const suffixes = ["", "'", "2"];

  while (result.length < length) {
    const face = FACES[Math.floor(Math.random() * FACES.length)];
    if (DEFS[face].axis === lastAxis) continue;

    result.push(face + suffixes[Math.floor(Math.random() * suffixes.length)]);
    lastAxis = DEFS[face].axis;
  }

  return result;
}

function cubeSize(cube: Cubie[]) {
  return Math.round(Math.cbrt(cube.length));
}

export function isSolved(cube: Cubie[]) {
  const size = cubeSize(cube);
  const target = createSolved(size);

  return cube.every((cubie) => {
    const expected = target.find((x) => x.id === cubie.id);
    if (!expected || cubie.p.join(",") !== expected.p.join(",")) return false;
    if (cubie.stickers.length !== expected.stickers.length) return false;

    return cubie.stickers.every((s) =>
      expected.stickers.some(
        (e) => e.color === s.color && e.n.join(",") === s.n.join(",")
      )
    );
  });
}

export function progressPercent(cube: Cubie[]) {
  const size = cubeSize(cube);
  const target = createSolved(size);
  let total = 0;
  let correct = 0;

  for (const cubie of cube) {
    const expected = target.find((x) => x.id === cubie.id);
    if (!expected) continue;

    total++;
    if (cubie.p.join(",") === expected.p.join(",")) correct++;

    for (const sticker of cubie.stickers) {
      total++;
      if (
        expected.stickers.some(
          (e) =>
            e.color === sticker.color &&
            e.n.join(",") === sticker.n.join(",")
        )
      ) {
        correct++;
      }
    }
  }

  return total ? Math.round((correct / total) * 100) : 0;
}

function colorToFace() {
  return Object.fromEntries(
    Object.entries(COLORS).map(([face, color]) => [color, face])
  ) as Record<string, Face>;
}

export function cubeFacelets(cube: Cubie[], size = 3) {
  const max = size - 1;
  const map = colorToFace();

  const get = (face: Face, row: number, col: number) => {
    let x = 0, y = 0, z = 0;

    if (face === "U") { y = max; x = 2 * col - max; z = max - 2 * row; }
    if (face === "R") { x = max; z = 2 * col - max; y = max - 2 * row; }
    if (face === "F") { z = max; x = 2 * col - max; y = max - 2 * row; }
    if (face === "D") { y = -max; x = 2 * col - max; z = 2 * row - max; }
    if (face === "L") { x = -max; z = max - 2 * col; y = max - 2 * row; }
    if (face === "B") { z = -max; x = max - 2 * col; y = max - 2 * row; }

    const cubie = cube.find((c) => c.p[0] === x && c.p[1] === y && c.p[2] === z);
    const normal = FACE_NORMALS[face];
    const sticker = cubie?.stickers.find((s) => s.n.join(",") === normal.join(","));
    return sticker ? map[sticker.color] : "?";
  };

  return FACES.map((face) =>
    Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => get(face, r, c)).join("")
    ).join("")
  ).join("");
}

export function validateFacelets(facelets: string, size = 3) {
  const expected = size * size;
  if (facelets.length !== expected * 6) return false;
  const allowed = new Set(FACES);
  if (facelets.split("").some((x) => !allowed.has(x as Face))) return false;
  return FACES.every((face) => facelets.split("").filter((x) => x === face).length === expected);
}

export const patterns = [
  { name: "Checkerboard", algorithm: "U2 D2 F2 B2 R2 L2" },
  { name: "Superflip", algorithm: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2" },
  { name: "Four Spots", algorithm: "U D' R L' F B' U D'" },
  { name: "Crosses", algorithm: "F R' F' R U R U' R'" },
];

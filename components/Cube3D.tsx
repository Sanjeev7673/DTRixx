"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { FACE_NORMALS, normalizeMove, type Cubie, type Face } from "../lib/cube";

const faces: Face[] = ["F", "B", "R", "L", "U", "D"];
const AXIS: Record<Face, "x" | "y" | "z"> = {
  F: "z", B: "z", R: "x", L: "x", U: "y", D: "y",
};

const DIR: Record<Face, 1 | -1> = {
  F: -1, B: 1, R: -1, L: 1, U: 1, D: -1,
};

function stickerColor(cubie: Cubie, face: Face) {
  const n = FACE_NORMALS[face];
  return cubie.stickers.find(
    (s) => s.n[0] === n[0] && s.n[1] === n[1] && s.n[2] === n[2]
  )?.color;
}

function layerCoordinate(size: number, face: Face, depth: number) {
  const max = size - 1;
  const offset = 2 * (depth - 1);
  const positive = face === "R" || face === "U" || face === "F";
  return positive ? max - offset : -max + offset;
}

function Sticker({
  color, face, size, onDown, onUp,
}: {
  color: string; face: Face; size: number;
  onDown: (e: any) => void; onUp: (e: any) => void;
}) {
  const unit = 2.45 / (size + 1.1);
  const offset = unit * 0.9;
  const s = unit * 1.72;

  const rotation: Record<Face, [number, number, number]> = {
    F: [0, 0, 0], B: [0, Math.PI, 0],
    R: [0, Math.PI / 2, 0], L: [0, -Math.PI / 2, 0],
    U: [-Math.PI / 2, 0, 0], D: [Math.PI / 2, 0, 0],
  };

  const position: Record<Face, [number, number, number]> = {
    F: [0, 0, offset], B: [0, 0, -offset],
    R: [offset, 0, 0], L: [-offset, 0, 0],
    U: [0, offset, 0], D: [0, -offset, 0],
  };

  return (
    <mesh
      rotation={rotation[face]}
      position={position[face]}
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      <planeGeometry args={[s, s]} />
      <meshStandardMaterial color={color} roughness={0.25} metalness={0.04} />
    </mesh>
  );
}

function CubieMesh({
  cubie, turn, size, beginSwipe, endSwipe,
}: {
  cubie: Cubie; turn: any; size: number;
  beginSwipe: (face: Face, x: number, y: number, id: number) => void;
  endSwipe: (face: Face, x: number, y: number, id: number) => void;
}) {
  const parsed = turn?.move ? normalizeMove(turn.move) : null;
  const moveFace = parsed?.face;
  const axis = moveFace ? AXIS[moveFace] : "x";
  const axisIndex = axis === "x" ? 0 : axis === "y" ? 1 : 2;

  let affected = false;
  if (parsed && moveFace) {
    const count = parsed.wide ? Math.min(2, size - parsed.depth + 1) : 1;
    const wanted: number[] = [];
    for (let d = parsed.depth; d < parsed.depth + count; d++) {
      wanted.push(layerCoordinate(size, moveFace, d));
    }
    affected = wanted.includes(cubie.p[axisIndex]);
  }

  const unit = 2.45 / (size + 1.1);
  const side = unit * 1.78;
  const base = new THREE.Vector3(
    cubie.p[0] * unit,
    -cubie.p[1] * unit,
    cubie.p[2] * unit
  );

  let angle = 0;
  if (affected && parsed && moveFace) {
    const turns = parsed.suffix === "2" ? 2 : 1;
    const direction = (DIR[moveFace] * (parsed.suffix === "'" ? -1 : 1)) as number;
    angle = direction * Math.PI / 2 * turns * turn.progress;
    const v = new THREE.Vector3(
      axis === "x" ? 1 : 0,
      axis === "y" ? 1 : 0,
      axis === "z" ? 1 : 0
    );
    base.applyAxisAngle(v, angle);
  }

  const colors = faces
    .map((f) => [f, stickerColor(cubie, f)] as const)
    .filter(([, color]) => Boolean(color));

  return (
    <group
      position={[base.x, base.y, base.z]}
      rotation={
        axis === "x" ? [angle, 0, 0] :
        axis === "y" ? [0, angle, 0] : [0, 0, angle]
      }
    >
      <mesh>
        <boxGeometry args={[side, side, side]} />
        <meshStandardMaterial color="#10131d" roughness={0.5} />
      </mesh>

      {colors.map(([face, color]) => (
        <Sticker
          key={face}
          color={color!}
          face={face}
          size={size}
          onDown={(e) => {
            e.stopPropagation();
            beginSwipe(face, e.clientX, e.clientY, e.pointerId);
          }}
          onUp={(e) => {
            e.stopPropagation();
            endSwipe(face, e.clientX, e.clientY, e.pointerId);
          }}
        />
      ))}
    </group>
  );
}

function CubeScene({
  cube, size, turn, onSwipe,
}: {
  cube: Cubie[]; size: number; turn: any; onSwipe: (move: string) => void;
}) {
  const start = useRef<{ face: Face; x: number; y: number; id: number } | null>(null);
  const controls = useRef<any>(null);

  const begin = (face: Face, x: number, y: number, id: number) => {
    if (turn) return;
    start.current = { face, x, y, id };
    if (controls.current) controls.current.enabled = false;
  };

  const end = (face: Face, x: number, y: number, id: number) => {
    const s = start.current;
    start.current = null;
    if (controls.current) controls.current.enabled = true;
    if (!s || turn || s.id !== id) return;

    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;

    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const sign = horizontal ? dx > 0 : dy > 0;

    const map: Record<Face, string> = {
      F: horizontal ? (sign ? "F" : "F'") : (sign ? "F" : "F'"),
      B: horizontal ? (sign ? "B'" : "B") : (sign ? "B'" : "B"),
      R: horizontal ? (sign ? "R" : "R'") : (sign ? "R'" : "R"),
      L: horizontal ? (sign ? "L'" : "L") : (sign ? "L" : "L'"),
      U: horizontal ? (sign ? "U" : "U'") : (sign ? "B" : "B'"),
      D: horizontal ? (sign ? "D'" : "D") : (sign ? "F" : "F'"),
    };

    onSwipe(map[face]);
  };

  return (
    <Canvas
      camera={{ position: [4.8, 4.3, 6.3], fov: 32 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <color attach="background" args={["#080a13"]} />
      <ambientLight intensity={2.1} />
      <directionalLight position={[5, 7, 8]} intensity={3.5} />
      <directionalLight position={[-5, 2, -4]} intensity={1.25} />

      <group>
        {cube.map((cubie) => (
          <CubieMesh
            key={cubie.id}
            cubie={cubie}
            turn={turn}
            size={size}
            beginSwipe={begin}
            endSwipe={end}
          />
        ))}
      </group>

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom
        minDistance={Math.max(3.2, 4.2 - 0.1 * size)}
        maxDistance={10 + size * 0.3}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.8}
        zoomSpeed={0.8}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI - 0.12}
      />

      <ContactShadows position={[0, -2.1, 0]} opacity={0.35} scale={7} blur={2.4} far={5} />
    </Canvas>
  );
}

export default function Cube3D({
  cube, size, onMove, command, disabled = false,
}: {
  cube: Cubie[]; size: number; onMove: (move: string) => void;
  command?: { id: number; move: string }; disabled?: boolean;
}) {
  const [turn, setTurn] = useState<any>(null);
  const queued = useRef<string | null>(null);

  const request = (move: string) => {
    if (disabled || turn || queued.current) return;

    queued.current = move;
    setTurn({ move, progress: 0 });

    const started = performance.now();
    const duration = 180;

    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - p) * (1 - p);
      setTurn((t: any) => (t ? { ...t, progress: eased } : t));

      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        const finalMove = queued.current;
        queued.current = null;
        setTurn(null);
        if (finalMove) onMove(finalMove);
      }
    };

    requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (command?.move) request(command.move);
  }, [command?.id]);

  return (
    <div className="cube3d-root">
      <CubeScene cube={cube} size={size} turn={turn} onSwipe={request} />
      <div className="cube3d-hint">
        SWIPE A FACE · DRAG OUTSIDE TO ROTATE · SCROLL TO ZOOM
      </div>
    </div>
  );
}

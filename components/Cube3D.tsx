"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Cubie, Sticker } from "../lib/cube";

const FACE_NORMALS = {
  F: [0,0,1], B: [0,0,-1], R: [1,0,0], L: [-1,0,0], U: [0,1,0], D: [0,-1,0]
} as const;

const AXIS = { F:"z", B:"z", R:"x", L:"x", U:"y", D:"y" } as const;
const LAYER = { F:1, B:-1, R:1, L:-1, U:1, D:-1 } as const;
const DIR = { F:-1, B:1, R:-1, L:1, U:1, D:-1 } as const;

type Move = string;
type ActiveTurn = { move: Move; progress: number };

function faceColor(cubie: Cubie, normal: readonly number[]) {
  return cubie.stickers.find(s => s.n[0] === normal[0] && s.n[1] === normal[1] && s.n[2] === normal[2])?.color ?? "#111827";
}

function Sticker({ color, face, onDown, onUp }: {
  color: string; face: keyof typeof FACE_NORMALS;
  onDown?: (e: any) => void; onUp?: (e: any) => void;
}) {
  const transforms: Record<string,[number,number,number]> = {
    F:[0,0,0.305], B:[0,Math.PI,0.305], R:[0,Math.PI/2,0.305], L:[0,-Math.PI/2,0.305],
    U:[Math.PI/2,0,0.305], D:[-Math.PI/2,0,0.305]
  };
  const [rx,ry,z] = transforms[face];
  return <mesh
    rotation={[rx,ry,0]}
    position={face==="F"?[0,0,z]:face==="B"?[0,0,-z]:face==="R"?[z,0,0]:face==="L"?[-z,0,0]:face==="U"?[0,z,0]:[0,-z,0]}
    onPointerDown={onDown}
    onPointerUp={onUp}
  >
    <planeGeometry args={[0.56,0.56]} />
    <meshStandardMaterial color={color} roughness={0.28} metalness={0.04} />
  </mesh>;
}

function CubieMesh({ cubie, turn, beginSwipe, endSwipe }: {
  cubie: Cubie; turn: ActiveTurn | null;
  beginSwipe: (face:keyof typeof FACE_NORMALS, x:number, y:number) => void;
  endSwipe: (face:keyof typeof FACE_NORMALS, x:number, y:number) => void;
}) {
  const affected = !!turn && cubie.p[AXIS[turn.move[0] as keyof typeof AXIS]==="x"?0:AXIS[turn.move[0] as keyof typeof AXIS]==="y"?1:2] === LAYER[turn.move[0] as keyof typeof LAYER];
  const axis = turn ? AXIS[turn.move[0] as keyof typeof AXIS] : "x";
  const turns = turn?.move.endsWith("2") ? 2 : 1;
  const baseAngle = turn ? DIR[turn.move[0] as keyof typeof DIR] * Math.PI/2 * (turn.move.endsWith("'") ? -1 : 1) * (turns===2?2:1) : 0;
  const progressAngle = baseAngle * (turn?.progress ?? 0);

  const position:[number,number,number] = [cubie.p[0]*0.62,-cubie.p[1]*0.62,cubie.p[2]*0.62];
  const groupProps:any = { position, rotation:[0,0,0] };
  if (affected) {
    groupProps.position=[0,0,0];
    groupProps.rotation=axis==="x"?[progressAngle,0,0]:axis==="y"?[0,progressAngle,0]:[0,0,progressAngle];
  }

  const sticker = (face:keyof typeof FACE_NORMALS) => {
    const n=FACE_NORMALS[face];
    const color=faceColor(cubie,n);
    if (color==="#111827") return null;
    return <Sticker key={face} color={color} face={face}
      onDown={(e)=>{e.stopPropagation();beginSwipe(face,e.clientX,e.clientY)}}
      onUp={(e)=>{e.stopPropagation();endSwipe(face,e.clientX,e.clientY)}} />;
  };

  return <group {...groupProps}>
    <mesh>
      <boxGeometry args={[0.58,0.58,0.58]} />
      <meshStandardMaterial color="#111827" roughness={0.42} />
    </mesh>
    {(["F","B","R","L","U","D"] as const).map(sticker)}
  </group>;
}

function CubeScene({ cube, turn, onSwipe, setOrbiting }: {
  cube:Cubie[]; turn:ActiveTurn|null; onSwipe:(move:string)=>void; setOrbiting:(v:boolean)=>void;
}) {
  const start=useRef<{face:keyof typeof FACE_NORMALS;x:number;y:number}|null>(null);
  const controls=useRef<any>(null);

  const beginSwipe=(face:keyof typeof FACE_NORMALS,x:number,y:number)=>{
    if(turn) return;
    start.current={face,x,y};
    if(controls.current) controls.current.enabled=false;
  };
  const endSwipe=(face:keyof typeof FACE_NORMALS,x:number,y:number)=>{
    const s=start.current; start.current=null;
    if(controls.current) controls.current.enabled=true;
    if(!s || turn) return;
    const dx=x-s.x, dy=y-s.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<22) return;
    const horizontal=Math.abs(dx)>Math.abs(dy);
    const positive=horizontal?dx>0:dy<0;
    const suffix=positive?"":"'";
    const map:any={
      F: horizontal ? (dx>0?"F":"F'") : (dy<0?"F'":"F"),
      B: horizontal ? (dx>0?"B'":"B") : (dy<0?"B":"B'"),
      R: horizontal ? (dx>0?"R":"R'") : (dy<0?"R'":"R"),
      L: horizontal ? (dx>0?"L'":"L") : (dy<0?"L":"L'"),
      U: horizontal ? (dx>0?"U":"U'") : (dy<0?"B":"F"),
      D: horizontal ? (dx>0?"D'":"D") : (dy<0?"F":"B")
    };
    onSwipe(map[face]);
  };

  return <Canvas
    camera={{position:[4.8,4.4,6.4],fov:34}}
    dpr={[1,1.7]}
    gl={{antialias:true, alpha:true}}
    onPointerMissed={()=>setOrbiting(false)}
    style={{width:"100%",height:"100%",touchAction:"none"}}
  >
    <color attach="background" args={["#080a13"]} />
    <ambientLight intensity={2.1}/>
    <directionalLight position={[5,7,8]} intensity={3.5}/>
    <directionalLight position={[-5,2,-4]} intensity={1.2}/>
    <group rotation={[0,0,0]}>
      {cube.map(c=><CubieMesh key={c.id} cubie={c} turn={turn} beginSwipe={beginSwipe} endSwipe={endSwipe}/>)}
    </group>
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableZoom
      minDistance={4.5}
      maxDistance={10}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.8}
      zoomSpeed={0.8}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI-0.2}
      onStart={()=>setOrbiting(true)}
      onEnd={()=>setOrbiting(false)}
    />
    <ContactShadows position={[0,-2.2,0]} opacity={0.35} scale={7} blur={2.5} far={5}/>
  </Canvas>;
}

export default function Cube3D({ cube, onMove, disabled=false }: {
  cube:Cubie[]; onMove:(move:string)=>void; disabled?:boolean;
}) {
  const [turn,setTurn]=useState<ActiveTurn|null>(null);
  const queued=useRef<Move|null>(null);

  const request=(move:string)=>{
    if(disabled || turn || queued.current) return;
    queued.current=move;
    setTurn({move,progress:0});
    const started=performance.now();
    const duration=190;
    const tick=(now:number)=>{
      const p=Math.min(1,(now-started)/duration);
      setTurn(t=>t?{...t,progress:1-(1-p)*(1-p)}:t);
      if(p<1) requestAnimationFrame(tick);
      else {
        const m=queued.current; queued.current=null; setTurn(null);
        if(m) onMove(m);
      }
    };
    requestAnimationFrame(tick);
  };

  return <div className="cube3d-root">
    <CubeScene cube={cube} turn={turn} onSwipe={request} setOrbiting={()=>{}} />
    <div className="cube3d-hint">SWIPE A FACE TO TURN · DRAG OUTSIDE TO ROTATE · SCROLL TO ZOOM</div>
  </div>;
}

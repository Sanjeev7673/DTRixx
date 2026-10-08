"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { FACE_NORMALS, type Cubie, type Face } from "../lib/cube";

const faces=["F","B","R","L","U","D"] as const;
const AXIS:{[k:string]:"x"|"y"|"z"}={F:"z",B:"z",R:"x",L:"x",U:"y",D:"y"};
const LAYER:{[k:string]:number}={F:1,B:-1,R:1,L:-1,U:1,D:-1};
const DIR:{[k:string]:number}={F:-1,B:1,R:-1,L:1,U:1,D:-1};

function stickerColor(cubie:Cubie,face:Face){
  const n=FACE_NORMALS[face];
  return cubie.stickers.find(s=>s.n[0]===n[0]&&s.n[1]===n[1]&&s.n[2]===n[2])?.color;
}

function Sticker({color,face,size,onDown,onUp}:{color:string;face:Face;size:number;onDown:(e:any)=>void;onUp:(e:any)=>void}){
  const unit=2.45/(size+1.1), offset=unit*0.89, s=unit*1.65;
  const transforms:Record<Face,[number,number,number]>={
    F:[0,0,offset],B:[0,Math.PI,-offset],R:[0,Math.PI/2,offset],L:[0,-Math.PI/2,offset],
    U:[Math.PI/2,0,offset],D:[-Math.PI/2,0,offset]
  };
  const [rx,ry]=transforms[face];
  const position:Record<Face,[number,number,number]>={F:[0,0,offset],B:[0,0,-offset],R:[offset,0,0],L:[-offset,0,0],U:[0,offset,0],D:[0,-offset,0]};
  return <mesh rotation={[rx,ry,0]} position={position[face]} onPointerDown={onDown} onPointerUp={onUp}>
    <planeGeometry args={[s,s]}/><meshStandardMaterial color={color} roughness={0.24} metalness={0.05}/>
  </mesh>;
}

function CubieMesh({cubie,turn,size,beginSwipe,endSwipe}:{cubie:Cubie;turn:any;size:number;beginSwipe:(face:Face,x:number,y:number,id:number)=>void;endSwipe:(face:Face,x:number,y:number,id:number)=>void}){
  const max=size-1;
  const moveFace=turn?.move?.[0] as Face|undefined;
  const axis=moveFace?AXIS[moveFace]:"x";
  const axisIndex=axis==="x"?0:axis==="y"?1:2;
  const layer=moveFace?LAYER[moveFace]*max:999;
  const affected=!!turn&&cubie.p[axisIndex]===layer;
  const unit=2.45/(size+1.1);
  const side=unit*1.78;
  const base=new THREE.Vector3(cubie.p[0]*unit,-cubie.p[1]*unit,cubie.p[2]*unit);
  let angle=0;
  if(affected){
    const turns=turn.move.endsWith("2")?2:1;
    const dir=DIR[moveFace!]*(turn.move.endsWith("'")?-1:1);
    angle=dir*Math.PI/2*turns*turn.progress;
    const v=new THREE.Vector3(axis==="x"?1:0,axis==="y"?1:0,axis==="z"?1:0);
    base.applyAxisAngle(v,angle);
  }
  const colors=faces.map(f=>[f,stickerColor(cubie,f as Face)] as const).filter(([,c])=>!!c);
  return <group position={[base.x,base.y,base.z]} rotation={axis==="x"?[angle,0,0]:axis==="y"?[0,angle,0]:[0,0,angle]}>
    <mesh><boxGeometry args={[side,side,side]}/><meshStandardMaterial color="#10131d" roughness={0.5}/></mesh>
    {colors.map(([f,c])=><Sticker key={f} color={c!} face={f as Face} size={size}
      onDown={e=>{e.stopPropagation();beginSwipe(f as Face,e.clientX,e.clientY,e.pointerId)}}
      onUp={e=>{e.stopPropagation();endSwipe(f as Face,e.clientX,e.clientY,e.pointerId)}}/>)}
  </group>;
}

function CubeScene({cube,size,turn,onSwipe}:{cube:Cubie[];size:number;turn:any;onSwipe:(move:string)=>void}){
  const start=useRef<{face:Face;x:number;y:number;id:number}|null>(null);
  const controls=useRef<any>(null);
  const begin=(face:Face,x:number,y:number,id:number)=>{
    if(turn)return;start.current={face,x,y,id};
    try{(event?.target as Element)?.setPointerCapture?.(id)}catch{}
    if(controls.current)controls.current.enabled=false;
  };
  const end=(face:Face,x:number,y:number,id:number)=>{
    const s=start.current;start.current=null;if(controls.current)controls.current.enabled=true;
    if(!s||turn)return;
    try{(event?.target as Element)?.releasePointerCapture?.(id)}catch{}
    const dx=x-s.x,dy=y-s.y;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
    const h=Math.abs(dx)>=Math.abs(dy);
    const map:Record<string,string>={
      F:h?(dx>0?"F":"F'"):(dy<0?"F'":"F"),
      B:h?(dx>0?"B'":"B"):(dy<0?"B":"B'"),
      R:h?(dx>0?"R":"R'"):(dy<0?"R'":"R"),
      L:h?(dx>0?"L'":"L"):(dy<0?"L":"L'"),
      U:h?(dx>0?"U":"U'"):(dy<0?"B":"B'"),
      D:h?(dx>0?"D'":"D"):(dy<0?"F":"F'")
    };
    onSwipe(map[face]);
  };
  return <Canvas camera={{position:[4.8,4.3,6.3],fov:32}} dpr={[1,1.8]} gl={{antialias:true,alpha:true}}
    style={{width:"100%",height:"100%",touchAction:"none"}}>
    <color attach="background" args={["#080a13"]}/>
    <ambientLight intensity={2.2}/><directionalLight position={[5,7,8]} intensity={3.6}/><directionalLight position={[-5,2,-4]} intensity={1.3}/>
    <group>{cube.map(c=><CubieMesh key={c.id} cubie={c} turn={turn} size={size} beginSwipe={begin} endSwipe={end}/>)}</group>
    <OrbitControls ref={controls} enablePan={false} enableZoom minDistance={Math.max(3.4,4.2-0.12*size)} maxDistance={10+size*.3}
      enableDamping dampingFactor={.08} rotateSpeed={.8} zoomSpeed={.8} minPolarAngle={.12} maxPolarAngle={Math.PI-.12}/>
    <ContactShadows position={[0,-2.1,0]} opacity={.35} scale={7} blur={2.4} far={5}/>
  </Canvas>;
}

export default function Cube3D({cube,size,onMove,command,disabled=false}:{cube:Cubie[];size:number;onMove:(move:string)=>void;command?:{id:number;move:string};disabled?:boolean}){
  const [turn,setTurn]=useState<any>(null);const queued=useRef<string|null>(null);
  const request=(move:string)=>{
    if(disabled||turn||queued.current)return;queued.current=move;setTurn({move,progress:0});
    const started=performance.now(),duration=180;
    const tick=(now:number)=>{
      const p=Math.min(1,(now-started)/duration);setTurn((t:any)=>t?{...t,progress:1-(1-p)*(1-p)}:t);
      if(p<1)requestAnimationFrame(tick);else{const m=queued.current;queued.current=null;setTurn(null);if(m)onMove(m);}
    };requestAnimationFrame(tick);
  };
  useEffect(()=>{if(command?.move)request(command.move)},[command?.id]);
  return <div className="cube3d-root"><CubeScene cube={cube} size={size} turn={turn} onSwipe={request}/><div className="cube3d-hint">SWIPE A FACE · DRAG OUTSIDE TO ROTATE · SCROLL TO ZOOM</div></div>;
}

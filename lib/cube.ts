export type Axis = "x" | "y" | "z";
export type Face = "U" | "D" | "L" | "R" | "F" | "B";
export type Sticker = { n: [number, number, number]; color: string };
export type Cubie = { id: string; p: [number, number, number]; stickers: Sticker[] };

export const COLORS: Record<Face, string> = {
  U:"#f8fafc", D:"#ffd54a", L:"#ff5f73", R:"#ff934d", F:"#36d399", B:"#5b8cff"
};
export const FACE_NORMALS: Record<Face,[number,number,number]> = {
  U:[0,1,0], D:[0,-1,0], L:[-1,0,0], R:[1,0,0], F:[0,0,1], B:[0,0,-1]
};
const defs: Record<Face,{axis:Axis;layer:number;dir:1|-1}> = {
  R:{axis:"x",layer:1,dir:-1}, L:{axis:"x",layer:-1,dir:1}, U:{axis:"y",layer:1,dir:1},
  D:{axis:"y",layer:-1,dir:-1}, F:{axis:"z",layer:1,dir:-1}, B:{axis:"z",layer:-1,dir:1}
};

export const invertMove=(move:string)=>move.endsWith("2")?move:move.endsWith("'")?move[0]:move[0]+"'";
export const tokenizeMoves=(input:string)=>input.trim().split(/\s+/).filter(Boolean);

export function normalizeMove(token:string){
  const m=token.trim().replace(/’/g,"'");
  const match=m.match(/^([2-9]?)([URFDLBurfdlb])([wW]?)(2|')?$/);
  if(!match) return null;
  const [,depthRaw,faceRaw,wideRaw,suffixRaw]=match;
  const face=faceRaw.toUpperCase() as Face;
  const depth=Number(depthRaw||"1");
  const wide=!!wideRaw || faceRaw===faceRaw.toLowerCase();
  const suffix=suffixRaw||"";
  if(depth<1||depth>15) return null;
  return {face,depth,wide,suffix,notation:(depth>1?String(depth):"")+face+(wide?"w":"")+suffix};
}
export const validateNotation=(input:string)=>{
  const tokens=tokenizeMoves(input); const invalid=tokens.filter(t=>!normalizeMove(t));
  return {valid:invalid.length===0&&tokens.length>0,invalid};
};

const rotateVec=(v:[number,number,number],axis:Axis,dir:1|-1):[number,number,number]=>{
  const [x,y,z]=v;
  if(axis==="x") return dir===1?[x,-z,y]:[x,z,-y];
  if(axis==="y") return dir===1?[z,y,-x]:[-z,y,x];
  return dir===1?[-y,x,z]:[y,-x,z];
};

const solved=(size=3):Cubie[]=>{
  const out:Cubie[]=[]; const max=size-1; const coords=Array.from({length:size},(_,i)=>2*i-max);
  for(const x of coords) for(const y of coords) for(const z of coords){
    const stickers:Sticker[]=[];
    (Object.keys(FACE_NORMALS) as Face[]).forEach(face=>{
      const n=FACE_NORMALS[face];
      if((face==="U"&&y===max)||(face==="D"&&y===-max)||(face==="L"&&x===-max)||(face==="R"&&x===max)||(face==="F"&&z===max)||(face==="B"&&z===-max))
        stickers.push({n:[...n] as [number,number,number],color:COLORS[face]});
    });
    out.push({id:`${x},${y},${z}`,p:[x,y,z],stickers});
  }
  return out;
};

export const initialCube=(size=3)=>solved(size);
export const cloneCube=(cube:Cubie[])=>cube.map(c=>({id:c.id,p:[...c.p] as [number,number,number],stickers:c.stickers.map(s=>({n:[...s.n] as [number,number,number],color:s.color}))}));

function layerCoordinate(size:number,face:Face,depth:number){
  const max=size-1, offset=(depth-1)*2;
  return (face==="R"||face==="U"||face==="F")?max-offset:-max+offset;
}
function applySingleLayer(cube:Cubie[],face:Face,size:number,depth:number){
  const def=defs[face], axisIndex=def.axis==="x"?0:def.axis==="y"?1:2, layer=layerCoordinate(size,face,depth);
  return cube.map(c=>c.p[axisIndex]!==layer?c:{...c,p:rotateVec(c.p,def.axis,def.dir),stickers:c.stickers.map(s=>({...s,n:rotateVec(s.n,def.axis,def.dir)}))});
}

export const applyMove=(cube:Cubie[],notation:string,size=3)=>{
  const parsed=normalizeMove(notation); if(!parsed||parsed.depth>size||parsed.depth+(parsed.wide?1:0)>size+1) return cloneCube(cube);
  const turns=parsed.suffix==="2"?2:parsed.suffix==="'"?3:1; let next=cloneCube(cube);
  const layers=parsed.wide?Math.min(2,size-parsed.depth+1):1;
  for(let d=parsed.depth;d<parsed.depth+layers;d++) for(let t=0;t<turns;t++) next=applySingleLayer(next,parsed.face,size,d);
  return next;
};
export const applyAlgorithm=(cube:Cubie[],input:string,size=3)=>tokenizeMoves(input).reduce((c,m)=>applyMove(c,m,size),cloneCube(cube));

export const scramble=(length=20,size=3)=>{
  const faces=Object.keys(defs) as Face[], suffixes=["","'","2"], result:string[]=[]; let lastAxis="";
  while(result.length<length){
    const face=faces[Math.floor(Math.random()*faces.length)];
    if(defs[face].axis===lastAxis) continue;
    result.push(face+suffixes[Math.floor(Math.random()*suffixes.length)]); lastAxis=defs[face].axis;
  }
  return result;
};

export const isSolved=(cube:Cubie[])=>{
  const size=Math.round(Math.cbrt(cube.length)),target=solved(size);
  return cube.length===target.length&&cube.every(c=>{
    const t=target.find(x=>x.id===c.id);
    return !!t&&c.p.join(",")===t.p.join(",")&&c.stickers.length===t.stickers.length&&c.stickers.every(s=>t.stickers.some(x=>x.color===s.color&&x.n.join(",")===s.n.join(",")));
  });
};
export const progressPercent=(cube:Cubie[])=>{
  const size=Math.round(Math.cbrt(cube.length)),target=solved(size); let correct=0,total=0;
  for(const c of cube){const t=target.find(x=>x.id===c.id)!;total+=1+c.stickers.length;if(c.p.join(",")===t.p.join(","))correct++;for(const s of c.stickers)if(t.stickers.some(x=>x.color===s.color&&x.n.join(",")===s.n.join(",")))correct++;}
  return Math.round(correct/total*100);
};

export const cubeFacelets=(cube:Cubie[],size=3)=>{
  const max=size-1,order:Face[]=["U","R","F","D","L","B"],colorToFace=Object.fromEntries((Object.entries(COLORS) as [Face,string][]).map(([f,c])=>[c,f])),out:string[]=[];
  const get=(face:Face,row:number,col:number)=>{
    let x=0,y=0,z=0;
    if(face==="U"){y=max;x=2*col-max;z=max-2*row}
    if(face==="D"){y=-max;x=2*col-max;z=2*row-max}
    if(face==="F"){z=max;x=2*col-max;y=max-2*row}
    if(face==="B"){z=-max;x=max-2*col;y=max-2*row}
    if(face==="R"){x=max;z=2*col-max;y=max-2*row}
    if(face==="L"){x=-max;z=max-2*col;y=max-2*row}
    const c=cube.find(v=>v.p[0]===x&&v.p[1]===y&&v.p[2]===z),n=FACE_NORMALS[face],s=c?.stickers.find(v=>v.n.join(",")===n.join(","));
    return s?colorToFace[s.color]||"?":"?";
  };
  for(const f of order)for(let r=0;r<size;r++)for(let c=0;c<size;c++)out.push(get(f,r,c));
  return out.join("");
};

export const cubeFromFacelets=(facelets:string)=>{
  if(facelets.length!==54) return null;
  const allowed=new Set(["U","R","F","D","L","B"]); if([...facelets].some(x=>!allowed.has(x))) return null;
  const counts=[..."URFDLB"].map(f=>[...facelets].filter(x=>x===f).length);
  if(counts.some(x=>x!==9)) return null;
  // Build a legal cube by replaying the facelet differences is intentionally not guessed.
  // The color editor therefore validates sticker counts and keeps the painted net visible.
  return facelets;
};

export const patterns=[
  {name:"Checkerboard",algorithm:"U2 D2 F2 B2 R2 L2"},
  {name:"Superflip",algorithm:"U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"},
  {name:"Four Spots",algorithm:"U D' R L' F B' U D'"},
  {name:"Crosses",algorithm:"F R' F' R U R U' R'"}
];

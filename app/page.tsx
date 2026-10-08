"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyAlgorithm, applyMove, cloneCube, cubeFacelets, initialCube, invertMove, isSolved,
  patterns, progressPercent, scramble as makeScramble, tokenizeMoves, validateNotation, type Cubie
} from "../lib/cube";

const Cube3D=dynamic(()=>import("../components/Cube3D"),{ssr:false});
const SIZES=Array.from({length:14},(_,i)=>i+2);
const PAINT_COLORS:Record<string,string>={U:"#f8fafc",R:"#ff934d",F:"#36d399",D:"#ffd54a",L:"#ff5f73",B:"#5b8cff"};
const FACES=["U","R","F","D","L","B"] as const;
const MODES=[["simulator","SIMULATOR"],["challenge","CHALLENGE"],["solver","SOLVER"]] as const;
type Panel="moves"|"solver"|"patterns"|"colors"|"learn"|"stats"|null;

export default function Home(){
  const [size,setSize]=useState(3);
  const [cube,setCube]=useState<Cubie[]>(()=>initialCube(3));
  const [history,setHistory]=useState<string[]>([]);
  const [future,setFuture]=useState<string[]>([]);
  const [scramble,setScramble]=useState<string[]>([]);
  const [mode,setMode]=useState("simulator");
  const [panel,setPanel]=useState<Panel>(null);
  const [sequence,setSequence]=useState("");
  const [message,setMessage]=useState("Ready");
  const [command,setCommand]=useState<{id:number;move:string}>();
  const [commandId,setCommandId]=useState(0);
  const [elapsed,setElapsed]=useState(0);
  const [started,setStarted]=useState<number|null>(null);
  const [challengeSeconds,setChallengeSeconds]=useState(60);
  const [best,setBest]=useState<number|null>(null);
  const [solution,setSolution]=useState<string[]>([]);
  const [solutionIndex,setSolutionIndex]=useState(0);
  const [solving,setSolving]=useState(false);
  const [painted,setPainted]=useState(()=>cubeFacelets(initialCube(3),3).split(""));
  const [paintColor,setPaintColor]=useState("U");
  const autoRef=useRef<number|null>(null);

  const solved=isSolved(cube), progress=progressPercent(cube);
  const timeLabel=mode==="challenge"?String(Math.max(0,challengeSeconds-elapsed)).padStart(2,"0")+"s":elapsed+"s";

  useEffect(()=>{
    const stored=localStorage.getItem("cube-mind-best-"+size); if(stored)setBest(Number(stored));
  },[size]);

  useEffect(()=>{
    if(!started)return;
    const id=window.setInterval(()=>{
      const s=Math.floor((Date.now()-started)/1000);setElapsed(s);
      if(mode==="challenge"&&s>=challengeSeconds){setStarted(null);setMessage("Time up — review your attempt.");}
    },100);
    return()=>clearInterval(id);
  },[started,mode,challengeSeconds]);

  const commitMove=(move:string)=>{
    if(mode==="challenge"&&!started&&!solved)setStarted(Date.now());
    setCube(c=>applyMove(c,move,size));setHistory(h=>[...h,move]);setFuture([]);
    setMessage(move+" applied");
  };
  const requestMove=(move:string)=>{
    if(!move)return;
    const id=commandId+1;setCommandId(id);setCommand({id,move});
  };
  const scrambleCube=()=>{
    const seq=makeScramble(size===2?10:size===3?20:Math.min(40,size*5),size);
    setCube(c=>applyAlgorithm(c,seq.join(" "),size));setScramble(seq);setHistory([]);setFuture([]);setElapsed(0);setStarted(null);setSolution([]);setSolutionIndex(0);
    setMessage("Scrambled — your turn");
  };
  const reset=()=>{
    setCube(initialCube(size));setHistory([]);setFuture([]);setScramble([]);setElapsed(0);setStarted(null);setSolution([]);setSolutionIndex(0);setMessage("Solved state");
  };
  const undo=()=>{const m=history.at(-1);if(!m)return;setCube(c=>applyMove(c,invertMove(m),size));setHistory(h=>h.slice(0,-1));setFuture(f=>[m,...f]);};
  const redo=()=>{const m=future[0];if(!m)return;setCube(c=>applyMove(c,m,size));setFuture(f=>f.slice(1));setHistory(h=>[...h,m]);};
  const changeSize=(n:number)=>{setSize(n);setCube(initialCube(n));setHistory([]);setFuture([]);setScramble([]);setSolution([]);setSolutionIndex(0);setElapsed(0);setStarted(null);setMessage(n+"×"+n+" cube ready");};

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
      const k=e.key;
      if(["u","d","l","r","f","b"].includes(k.toLowerCase())){
        e.preventDefault();requestMove(k.toUpperCase()+(e.shiftKey?"'":""));return;
      }
      if(k===" "){e.preventDefault();scrambleCube();}
      if(k==="z"&&e.ctrlKey){e.preventDefault();undo();}
      if(k==="y"&&e.ctrlKey){e.preventDefault();redo();}
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  });

  useEffect(()=>{
    if(solved&&history.length&&started){
      const s=Math.floor((Date.now()-started)/1000);setElapsed(s);setStarted(null);
      if(!best||s<best){setBest(s);localStorage.setItem("cube-mind-best-"+size,String(s));}
      setMessage("Solved in "+s+"s");
    }
  },[solved,history.length,started,best,size]);

  const recent=useMemo(()=>history.slice(-24),[history]);

  const runSequence=()=>{
    const check=validateNotation(sequence);
    if(!check.valid){setMessage("Invalid move: "+check.invalid.join(", "));return;}
    const moves=tokenizeMoves(sequence);
    moves.forEach((m,i)=>setTimeout(()=>requestMove(m),i*205));
    setMessage(moves.length+" moves queued");
  };

  const solveCurrent=async(faceletOverride?:string)=>{
    if(size!==3){setMessage("The built-in solver currently supports 3×3.");return;}
    try{
      setSolving(true);setMessage("Preparing solver…");
      const mod:any=await import("cubejs");const Cube=mod.default||mod;
      Cube.initSolver();
      const facelets=faceletOverride||cubeFacelets(cube,3);
      const c=Cube.fromString(facelets);
      const alg=String(c.solve()||"").trim();
      const moves=alg?alg.split(/\s+/):[];
      setSolution(moves);setSolutionIndex(0);setMessage(moves.length?moves.length+" solution moves found":"Cube is already solved");
    }catch(e){setMessage("This cube state could not be solved. Check the colors.");}
    finally{setSolving(false);}
  };

  const stepSolution=(dir:1|-1)=>{
    if(!solution.length)return;
    const next=solutionIndex+(dir===1?1:-1);
    if(next<0||next>solution.length)return;
    if(dir===1){requestMove(solution[solutionIndex]);setSolutionIndex(next);}
    else if(solutionIndex>0){setCube(c=>applyMove(c,invertMove(solution[solutionIndex-1]),size));setHistory(h=>h.slice(0,-1));setSolutionIndex(next);}
  };

  const autoSolve=()=>{
    if(autoRef.current!==null){clearInterval(autoRef.current);autoRef.current=null;return;}
    autoRef.current=window.setInterval(()=>{
      setSolutionIndex(i=>{
        if(i>=solution.length){if(autoRef.current!==null)clearInterval(autoRef.current);autoRef.current=null;return i;}
        requestMove(solution[i]);return i+1;
      });
    },260);
  };

  const checkPainted=()=>{
    const counts=[..."URFDLB"].map(f=>painted.filter(x=>x===f).length);
    setMessage(counts.every(x=>x===9)?"Valid color counts — ready to solve":"Each color must appear exactly 9 times");
  };

  const applyPattern=(algorithm:string)=>{
    setSequence(algorithm);setCube(c=>applyAlgorithm(c,algorithm,size));setHistory(tokenizeMoves(algorithm));setFuture([]);setScramble([]);setMessage("Pattern applied");
  };

  return <main className="game-shell">
    <header className="game-top">
      <div className="game-brand"><span className="brand-cube">◆</span><div><b>CUBE MIND</b><small>THINK · SOLVE · GROW</small></div></div>
      <nav className="top-menu">{MODES.map(([id,label])=><button key={id} className={mode===id?"active":""} onClick={()=>setMode(id)}>{label}</button>)}</nav>
      <div className="top-actions"><span className="live-dot">● LIVE</span><select value={size} onChange={e=>changeSize(Number(e.target.value))}>{SIZES.map(n=><option key={n} value={n}>{n}×{n}</option>)}</select><button onClick={()=>setPanel("stats")} className="avatar">SK</button></div>
    </header>

    <section className="game-main">
      <aside className="left-rail">
        <div className="eyebrow">ONLINE CUBE LAB</div>
        <h1>Play the<br/><em>cube.</em></h1>
        <p>Turn layers with your fingers, type algorithms, scramble, learn patterns and watch a solution play back.</p>
        <div className="rail-actions">
          <button onClick={scrambleCube}>↻ SCRAMBLE</button><button onClick={reset}>□ RESET</button>
        </div>
        <div className="rail-stats"><div><b>{history.length}</b><span>MOVES</span></div><div><b>{progress}%</b><span>STATE</span></div><div><b>{best?best+"s":"—"}</b><span>BEST</span></div></div>
      </aside>

      <section className="cube-stage">
        <div className="stage-top"><span className="size-pill">{size}×{size}</span><span className="status-pill">{solved?"SOLVED":"IN PLAY"}</span><b>{timeLabel}</b></div>
        <Cube3D cube={cube} size={size} onMove={commitMove} command={command}/>
        <div className="stage-controls">
          <button onClick={undo} disabled={!history.length}>↶</button>
          <button onClick={redo} disabled={!future.length}>↷</button>
          <button className="main-cta" onClick={scrambleCube}>NEW SCRAMBLE</button>
          <button onClick={()=>setPanel("moves")}>MOVES</button>
        </div>
        <div className="gesture-bar"><span>SWIPE FACE</span><i>→</i><span>TURN LAYER</span><i>•</i><span>DRAG OUTSIDE</span><i>→</i><span>ROTATE</span><i>•</i><span>SCROLL</span><i>→</i><span>ZOOM</span></div>
      </section>

      <aside className="right-rail">
        <div className="rail-card">
          <div className="card-title"><span>MOVE PAD</span><button onClick={()=>setPanel("moves")}>OPEN</button></div>
          <div className="move-grid">{FACES.map(f=><button key={f} onClick={()=>requestMove(f)}>{f}</button>)}</div>
          <div className="move-grid secondary">{FACES.map(f=><button key={f+"p"} onClick={()=>requestMove(f+"'")}>{f}'</button>)}</div>
          <div className="move-row"><button onClick={()=>requestMove("U2")}>U2</button><button onClick={()=>requestMove("R2")}>R2</button><button onClick={()=>requestMove("F2")}>F2</button><button onClick={()=>requestMove("D2")}>D2</button></div>
        </div>

        <div className="rail-card compact">
          <div className="card-title"><span>SCRAMBLE</span><button onClick={scrambleCube}>NEW</button></div>
          <code>{scramble.length?scramble.join(" "):"Press NEW to generate a scramble"}</code>
        </div>

        <div className="rail-card compact">
          <div className="card-title"><span>RECENT</span><button onClick={()=>setHistory([])}>CLEAR</button></div>
          <div className="history">{recent.length?recent.map((m,i)=><b key={i}>{m}</b):<span>—</span>}</div>
        </div>

        <div className="rail-card tool-list">
          <button onClick={()=>setPanel("solver")}><span>◎</span><div><b>SOLVER</b><small>Find + play solution</small></div><i>→</i></button>
          <button onClick={()=>setPanel("patterns")}><span>✦</span><div><b>PATTERNS</b><small>Algorithms & effects</small></div><i>→</i></button>
          <button onClick={()=>setPanel("colors")}><span>◈</span><div><b>COLOR PICKER</b><small>Enter a physical cube</small></div><i>→</i></button>
          <button onClick={()=>setPanel("learn")}><span>?</span><div><b>LEARN</b><small>Notation & solving basics</small></div><i>→</i></button>
        </div>
      </aside>
    </section>

    <footer className="game-bottom">
      <div className="bottom-message"><span className="pulse"/>{message}</div>
      <div className="bottom-links"><button onClick={()=>setPanel("learn")}>HOW TO PLAY</button><button onClick={()=>setPanel("moves")}>NOTATION</button><button onClick={()=>setPanel("solver")}>SOLVER</button></div>
      <div className="bottom-progress"><span style={{width:progress+"%"}}/></div><b>{progress}%</b>
    </footer>

    {panel&&<div className="game-overlay" onClick={()=>setPanel(null)}>
      <div className="overlay-card wide" onClick={e=>e.stopPropagation()}>
        <button className="close" onClick={()=>setPanel(null)}>×</button>

        {panel==="moves"&&<div className="overlay-content">
          <span className="eyebrow">MOVE ENGINE</span><h2>Type any algorithm.</h2><p>Supports face turns, prime turns, half turns, wide turns and deeper layers such as <b>Rw</b>, <b>2F</b> and <b>3Rw2</b> where the cube size allows it.</p>
          <div className="sequence-box"><input value={sequence} onChange={e=>setSequence(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")runSequence()}} placeholder="F R2 U' L F2"/><button onClick={runSequence}>PLAY</button></div>
          <div className="notation-grid">{["U U' U2","R R' R2","F F' F2","D D' D2","L L' L2","B B' B2","Rw Rw' Rw2","2F 2F' 2F2"].map(x=><b key={x}>{x}</b>)}</div>
          <div className="keyboard-note">Keyboard: U D L R F B · Shift = prime · Space = scramble · Ctrl+Z / Ctrl+Y = undo / redo</div>
        </div>}

        {panel==="solver"&&<div className="overlay-content">
          <span className="eyebrow">3×3 SOLVER</span><h2>Find the shortest practical route.</h2><p>The built-in 3×3 solver uses a Kociemba-style two-phase solver library. For larger cubes, use the simulator and algorithms.</p>
          <div className="solver-actions"><button className="primary-wide" disabled={solving||size!==3} onClick={()=>solveCurrent()}>{solving?"PREPARING…":"SOLVE CURRENT CUBE"}</button><button onClick={()=>{setSolution([]);setSolutionIndex(0)}}>CLEAR</button></div>
          {solution.length>0&&<div className="solution-panel"><div className="solution-head"><b>{solution.length} MOVES</b><span>{solutionIndex}/{solution.length}</span></div><div className="solution-moves">{solution.map((m,i)=><button className={i<solutionIndex?"done":i===solutionIndex?"current":""} key={i} onClick={()=>{if(i===solutionIndex)stepSolution(1)}}>{m}</button>)}</div><div className="solution-controls"><button onClick={()=>stepSolution(-1)}>← PREV</button><button className="primary-wide" onClick={()=>stepSolution(1)}>NEXT →</button><button onClick={autoSolve}>{autoRef.current!==null?"PAUSE":"PLAY ALL"}</button></div></div>}
          {size!==3&&<div className="notice">Solver playback is enabled for 3×3 first; NxN simulation, notation and patterns work across supported sizes.</div>}
        </div>}

        {panel==="patterns"&&<div className="overlay-content">
          <span className="eyebrow">PATTERN LAB</span><h2>Make the cube look different.</h2><p>Each pattern shows the algorithm used to produce it. Reset to return to solved.</p>
          <div className="pattern-grid">{patterns.map(p=><button key={p.name} onClick={()=>applyPattern(p.algorithm)}><strong>{p.name}</strong><code>{p.algorithm}</code><span>APPLY →</span></button>)}</div>
        </div>}

        {panel==="colors"&&<div className="overlay-content">
          <span className="eyebrow">COLOR PICKER</span><h2>Enter the cube in your hand.</h2><p>Paint the 54 stickers, check that each color appears nine times, then send the state to the 3×3 solver.</p>
          <div className="color-palette">{FACES.map(f=><button key={f} className={paintColor===f?"selected":""} onClick={()=>setPaintColor(f)}>{f}</button>)}</div>
          <div className="sticker-net">{["U","R","F","D","L","B"].map((f,fi)=><div className={"net-face face-"+f} key={f}><span>{f}</span>{Array.from({length:9},(_,i)=>{const idx=fi*9+i;return <button key={idx} style={{backgroundColor:PAINT_COLORS[painted[idx]]||"#171a27"}} onClick={()=>setPainted(p=>p.map((v,j)=>j===idx?paintColor:v))}/>} )}</div>)}</div>
          <div className="solver-actions"><button onClick={checkPainted}>CHECK</button><button className="primary-wide" onClick={()=>solveCurrent(painted.join(""))}>SOLVE PAINTED CUBE</button><button onClick={()=>setPainted(cubeFacelets(initialCube(3),3).split(""))}>RESET COLORS</button></div>
        </div>}

        {panel==="learn"&&<div className="overlay-content">
          <span className="eyebrow">LEARN MODE</span><h2>Everything starts with notation.</h2>
          <div className="learn-grid"><div><b>01 · HOLD</b><p>Keep the cube facing you consistently. F = front, B = back, U = up, D = down, L = left, R = right.</p></div><div><b>02 · TURN</b><p>A letter is a quarter turn. Apostrophe means counter-clockwise. 2 means a half turn.</p></div><div><b>03 · PLAY</b><p>Drag outside the cube to orbit. Swipe a sticker to turn its layer. Scroll or pinch to zoom.</p></div><div><b>04 · PRACTICE</b><p>Scramble, try a solution, undo mistakes and replay the solver one move at a time.</p></div></div>
        </div>}

        {panel==="stats"&&<div className="overlay-content">
          <span className="eyebrow">SESSION</span><h2>Your cube session.</h2>
          <div className="big-stats"><div><b>{elapsed}s</b><span>TIME</span></div><div><b>{history.length}</b><span>MOVES</span></div><div><b>{progress}%</b><span>STATE</span></div><div><b>{best?best+"s":"—"}</b><span>PERSONAL BEST</span></div></div>
          <div className="stat-note">Gameplay metrics are derived from cube interaction; they are not IQ or psychological scores.</div>
        </div>}
      </div>
    </div>}
  </main>;
}

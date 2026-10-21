#!/usr/bin/env node
// Deterministic logic comparison and CPU microbenchmark; does not predict in-game FPS.
'use strict';
const {execFileSync}=require('node:child_process'),{performance}=require('node:perf_hooks');
const {source,scenario,FILE}=require('../tests/helpers/healer-harness.cjs');
const options=Object.fromEntries(process.argv.slice(2).map(arg=>{const m=/^--(baseline|iterations)=(.+)$/.exec(arg);if(!m)throw Error('Unknown argument '+arg);return[m[1],m[2]];}));
const ref=options.baseline||'main', N=options.iterations==null?20000:Number(options.iterations);
if(!Number.isSafeInteger(N)||N<100||N>1e6)throw Error('iterations must be 100..1000000');
let before;try{before=execFileSync('git',['show',`${ref}:${FILE}`],{encoding:'utf8',maxBuffer:4e6});}
catch{console.error('Missing baseline. git fetch origin main; or --baseline=origin/main');process.exit(1);}
const after=source(),pct=(x,y)=>((x/y-1)*100).toFixed(1)+'%';
function heal(js,n,power){const s=scenario(js,{power});s.cast(n);return s.victims[0].hp;}
function cost(js,n){const s=scenario(js),run=iters=>{const t=performance.now();for(let i=0;i<iters;i++){s.clock.time=i*3.51;s.victims[0].hp=0;s.cast(n);}return (performance.now()-t)*1e6/(iters*n);};run(Math.min(N,4000));return Array.from({length:5},()=>run(N)).sort((a,b)=>a-b)[2];}
console.log(`Healing benchmark vs ${ref} (${N} iterations, median of five samples)`);
console.log('healers  attack  before HP  after HP  healing delta');
for(const n of [1,2,3]){for(const power of [1,1.4,3]){const x=heal(before,n,power),y=heal(after,n,power);console.log(n,power,x.toFixed(1),y.toFixed(1),pct(y,x));}const x=cost(before,n),y=cost(after,n);console.log(`CPU ${n} healer(s): ${x.toFixed(0)} -> ${y.toFixed(0)} ns/cast (${pct(y,x)})`);}
console.log('Only a microbenchmark: gameplay FPS, success rates and multiplayer need separate testing.');

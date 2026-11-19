global.satellite=require('satellite.js');const S=require('../src/screen.js');const fs=require('fs');
const cat=JSON.parse(fs.readFileSync(process.env.CAT||'cat.json','utf8'));const recs=S.makeRecs(cat);
const t0=Date.parse(process.env.T0||'2026-11-19T17:30:00Z'); const hours=+process.argv[2]||1;
const T=Date.now(); const res=S.screen(recs,{t0,hours,step:20,thresh:+(process.argv[4]||5),onProgress:(p,c)=>{if(Math.round(p*100)%10===0)process.stderr.write(`${(p*100).toFixed(0)}% cand=${c} ${((Date.now()-T)/1000).toFixed(0)}s\n`);}});
console.log('hours',hours,'secs',((Date.now()-T)/1000).toFixed(1),'events',res.events.length,'formation',res.formation,'cand',res.candidates);
const byKind={};for(const e of res.events){const k=[recs[e.a].group,recs[e.b].group].sort().join('-');byKind[k]=(byKind[k]||0)+1;}console.log(byKind);
for(const e of res.events.slice(0,8))console.log(recs[e.a].name,'x',recs[e.b].name,new Date(e.t).toISOString(),e.miss.toFixed(3),'km vrel',e.vrel.toFixed(2),'alt',e.alt.toFixed(0));
if(process.argv[3]) fs.writeFileSync(process.argv[3],JSON.stringify({t0,hours,step:20,thresh:+(process.argv[4]||5),formation:res.formation,events:res.events.map(e=>[e.a,e.b,Math.round(e.t),+e.miss.toFixed(4),+e.vrel.toFixed(4),+e.radial.toFixed(4),+e.along.toFixed(4),+e.cross.toFixed(4),+e.alt.toFixed(1)])}));

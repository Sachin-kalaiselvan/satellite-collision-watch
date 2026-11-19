const fs=require('fs');const dir=(process.argv[2]||'data/celestrak/tle').replace(/\/?$/,'/');
const cs=l=>{let s=0;for(const ch of l.slice(0,68)){if(ch>='0'&&ch<='9')s+=+ch;else if(ch==='-')s+=1;}return s%10;};
// group membership from specific files, then everything else in active.tle
const order=['stations','starlink','oneweb','kuiper','qianfan','hulianwang','geo','gnss','weather','resource','science','military','cubesat','amateur','planet','spire','iridium-NEXT','fengyun-1c-debris','cosmos-2251-debris','iridium-33-debris','cosmos-1408-debris','active'];
const map={stations:'stations',starlink:'starlink',oneweb:'oneweb',kuiper:'kuiper',qianfan:'chinese',hulianwang:'chinese',geo:'geo',gnss:'navigation',weather:'weather',resource:'resource',science:'science',military:'military',cubesat:'smallsat',amateur:'smallsat',planet:'resource',spire:'smallsat','iridium-NEXT':'other','fengyun-1c-debris':'debris','cosmos-2251-debris':'debris','iridium-33-debris':'debris','cosmos-1408-debris':'debris',active:'other'};
const out=new Map();let bad=0,dup=0,stale=0;const ref=26323.73;
for(const f of order){const p=dir+f+'.tle';if(!fs.existsSync(p))continue;const L=fs.readFileSync(p,'utf8').split(/\r?\n/).filter(x=>x.trim());
 for(let i=0;i+2<L.length+1;i+=3){const n=L[i]?.trim(),a=L[i+1],b=L[i+2];if(!a||!b||a[0]!=='1'||b[0]!=='2'){bad++;continue;}
  if(cs(a)!==+a[68]||cs(b)!==+b[68]||!/^[\x20-\x7e]+$/.test(n)){bad++;continue;}
  const ep=+a.slice(18,32); if(ref-ep>14){stale++;continue;}
  const id=a.slice(2,7).trim(); if(out.has(id)){dup++;continue;} out.set(id,[n.replace(/\s+/g,' ').slice(0,40),a.trimEnd(),b.trimEnd(),map[f]]);}}
const g={};for(const r of out.values())g[r[3]]=(g[r[3]]||0)+1;
console.log('records',out.size,'bad',bad,'dup',dup,'stale>14d',stale,g);
fs.writeFileSync('cat.json','[\n'+[...out.values()].map(r=>JSON.stringify(r)).join(',\n')+'\n]');console.log(fs.statSync('cat.json').size);

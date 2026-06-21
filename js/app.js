const STORE='golfStatsRoundsV3';
let rounds=JSON.parse(localStorage.getItem(STORE)||'[]');
let charts={};

const $=id=>document.getElementById(id);
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const pct=(h,t)=>t?Math.round(h/t*100)+'%':'—';

function parseCSV(text){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'&&q&&n==='"'){cell+='"';i++}
    else if(c==='"'){q=!q}
    else if(c===','&&!q){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!q){
      if(cell||row.length){row.push(cell);rows.push(row);row=[];cell=''}
      if(c==='\r'&&n==='\n')i++;
    } else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows.filter(r=>r.some(x=>String(x).trim()));
}

function findKey(obj,names){
  const keys=Object.keys(obj);
  return keys.find(k=>names.some(n=>k.toLowerCase().replace(/[^a-z0-9]/g,'').includes(n)));
}

function truthy(v){
  return ['yes','y','true','1','hit','gir','fairway'].includes(String(v||'').trim().toLowerCase());
}

function num(v){
  const n=parseFloat(String(v||'').replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:null;
}

function summarize(file,rows){
  const headers=rows[0].map(h=>String(h).trim());
  const data=rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  const sample=data[0]||{};

  const holeScoreK=findKey(sample,['holescore']);
  const roundScoreK=findKey(sample,['roundscore']);
  const holeK=findKey(sample,['hole']);
  const parK=findKey(sample,['holepar','par']);
  const firK=findKey(sample,['fairway','fir']);
  const girK=findKey(sample,['greeninregulation','gir','green']);
  const puttK=findKey(sample,['putt']);
  const clubK=findKey(sample,['club']);
  const distK=findKey(sample,['distance','totaldistance','carry']);
  const sideK=findKey(sample,['offline','left','right','dispersion']);
  const dateK=findKey(sample,['date','rounddate']);

  let holes={},putts=0,firHit=0,firTot=0,girHit=0,girTot=0;
  let clubs={},disp=[];

  data.forEach(r=>{
    const h=holeK?num(r[holeK]):null;

    if(h){
      holes[h]=holes[h]||{score:0,par:null};
      if(holeScoreK&&num(r[holeScoreK])!==null)holes[h].score=Math.max(holes[h].score,num(r[holeScoreK]));
      if(parK&&num(r[parK])!==null)holes[h].par=num(r[parK]);
    }

    if(firK){firTot++; if(truthy(r[firK]))firHit++}
    if(girK){girTot++; if(truthy(r[girK]))girHit++}
    if(puttK&&num(r[puttK])!==null)putts+=num(r[puttK]);

    const club=clubK?String(r[clubK]).trim():'';
    const d=distK?num(r[distK]):null;

    if(club&&d){
      clubs[club]=clubs[club]||[];
      clubs[club].push(d);
    }

    const off=sideK?num(r[sideK]):null;
    if(d||off)disp.push({x:off||0,y:d||0,club:club||'shot'});
  });

  const score = roundScoreK && num(data[0]?.[roundScoreK]) !== null
    ? num(data[0][roundScoreK])
    : Object.values(holes).reduce((s,h)=>s+(h.score||0),0);

  const date=dateK&&data[0]?.[dateK]?data[0][dateK]:file.replace(/\.csv$/i,'');

  return {
    id:Date.now()+Math.random(),
    file,
    date,
    shots:data.length,
    score:score||null,
    firHit,
    firTot,
    girHit,
    girTot,
    putts:putts||null,
    holes,
    clubs,
    disp,
    equipment:{
      ball:$('ballInput')?.value||'',
      driver:$('driverInput')?.value||'',
      driverSetting:$('driverSettingInput')?.value||'',
      irons:$('ironsInput')?.value||'',
      conditions:$('conditionsInput')?.value||'',
      notes:$('notesInput')?.value||''
    }
  };
}

function save(){
  localStorage.setItem(STORE,JSON.stringify(rounds));
}

function render(){
  const scores=rounds.map(r=>r.score).filter(Boolean);

  $('kpiRounds').textContent=rounds.length;
  $('kpiScore').textContent=avg(scores)?.toFixed(1)||'—';
  $('kpiBest').textContent=scores.length?Math.min(...scores):'—';
  $('kpiFir').textContent=pct(rounds.reduce((s,r)=>s+r.firHit,0),rounds.reduce((s,r)=>s+r.firTot,0));
  $('kpiGir').textContent=pct(rounds.reduce((s,r)=>s+r.girHit,0),rounds.reduce((s,r)=>s+r.girTot,0));
  $('kpiPutts').textContent=avg(rounds.map(r=>r.putts).filter(Boolean))?.toFixed(1)||'—';

  $('roundRows').innerHTML=rounds.map(r=>`
    <tr>
      <td>${r.date}<br><small>${r.equipment?.ball||''}</small></td>
      <td>${r.score??'—'}</td>
      <td>${pct(r.firHit,r.firTot)}</td>
      <td>${pct(r.girHit,r.girTot)}</td>
      <td>${r.putts??'—'}</td>
      <td>${r.shots}</td>
    </tr>
  `).join('');

  drawCharts();
}

function chart(id,type,data,opts={}){
  if(charts[id])charts[id].destroy();
  charts[id]=new Chart($(id),{
    type,
    data,
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#eef5f2'}}},
      scales:{
        x:{ticks:{color:'#97a6b5'},grid:{color:'#2c3a49'}},
        y:{ticks:{color:'#97a6b5'},grid:{color:'#2c3a49'}}
      },
      ...opts
    }
  });
}

function drawCharts(){
  const labels=rounds.map(r=>r.date);

  chart('scoreChart','line',{
    labels,
    datasets:[{label:'Score',data:rounds.map(r=>r.score),tension:.25}]
  });

  chart('driveChart','bar',{
    labels,
    datasets:[{label:'Avg shot distance',data:rounds.map(r=>avg(r.disp.map(d=>d.y).filter(Boolean)))}]
  });

  let clubMap={};
  rounds.forEach(r=>Object.entries(r.clubs).forEach(([c,arr])=>{
    clubMap[c]=(clubMap[c]||[]).concat(arr);
  }));

  const clubs=Object.keys(clubMap).sort((a,b)=>avg(clubMap[b])-avg(clubMap[a]));

  chart('clubChart','bar',{
    labels:clubs,
    datasets:[{label:'Avg distance',data:clubs.map(c=>avg(clubMap[c]).toFixed(0))}]
  },{indexAxis:'y'});

  const holeLabels=[...Array(18)].map((_,i)=>i+1);

  chart('holeChart','bar',{
    labels:holeLabels,
    datasets:[{label:'Avg score by hole',data:holeLabels.map(h=>avg(rounds.map(r=>r.holes[h]?.score).filter(Boolean)))}]
  });

  chart('accuracyChart','bar',{
    labels,
    datasets:[
      {label:'FIR %',data:rounds.map(r=>r.firTot?Math.round(r.firHit/r.firTot*100):null)},
      {label:'GIR %',data:rounds.map(r=>r.girTot?Math.round(r.girHit/r.girTot*100):null)},
      {label:'Putts',data:rounds.map(r=>r.putts)}
    ]
  });

  const pts=rounds.flatMap(r=>r.disp);

  chart('dispersionChart','scatter',{
    datasets:[{label:'Shots',data:pts.map(p=>({x:p.x,y:p.y}))}]
  });
}

$('csvInput').addEventListener('change',async e=>{
  for(const f of e.target.files){
    const text=await f.text();
    rounds.push(summarize(f.name,parseCSV(text)));
  }
  save();
  $('status').textContent=`Loaded ${e.target.files.length} file(s).`;
  render();
});

$('exportData').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(rounds,null,2)],{type:'application/json'}));
  a.download='golf-stats-backup.json';
  a.click();
};

$('clearData').onclick=()=>{
  if(confirm('Clear all locally stored golf dashboard data?')){
    rounds=[];
    save();
    render();
  }
};

render();

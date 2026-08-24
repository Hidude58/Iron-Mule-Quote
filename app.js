(()=>{
'use strict';
const $=id=>document.getElementById(id);
const pricingDefaults={fullJunk:550,fullEstate:625,fullConstruction:675,fullYard:475,fullAppliance:500,margin:10,minimum:95,roundTo:25};
const costDefaults={jobType:'junk',loadPct:.5,miles:34,mileRate:1.10,dumpFee:72,laborHours:1.5,laborRate:40,specialFee:25};
let photoFiles=[]; let aiResult=null; let currentJobId=null;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(+v)?+v:0));
const getJSON=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??fallback}catch{return fallback}};
const setJSON=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
function pricing(){return Object.fromEntries(Object.keys(pricingDefaults).map(k=>[k,clamp($(k).value,0,k==='margin'?200:100000)]));}
function baseRate(){const p=pricing(); return {junk:p.fullJunk,estate:p.fullEstate,construction:p.fullConstruction,yard:p.fullYard,appliance:p.fullAppliance}[$('jobType').value]||p.fullJunk;}
function calc(){
 const pct=clamp($('loadPct').value,0,4),miles=clamp($('miles').value,0,5000),mileRate=clamp($('mileRate').value,0,20),dump=clamp($('dumpFee').value,0,50000),hours=clamp($('laborHours').value,0,500),laborRate=clamp($('laborRate').value,0,1000),special=clamp($('specialFee').value,0,50000),p=pricing();
 const load=baseRate()*pct,mileage=miles*mileRate,labor=hours*laborRate,subtotal=load+mileage+labor+dump+special,target=Math.max(p.minimum,subtotal*(1+p.margin/100)),quote=Math.ceil(target/Math.max(1,p.roundTo))*Math.max(1,p.roundTo),direct=mileage+labor+dump+special,spread=Math.max(0,quote-direct);
 $('loadCost').textContent=money(load);$('mileageCost').textContent=money(mileage);$('laborCost').textContent=money(labor);$('dumpCost').textContent=money(dump);$('specialCost').textContent=money(special);$('subtotal').textContent=money(subtotal);$('quote').textContent=money(quote);$('profit').textContent=money(spread);
 return {pct,miles,mileRate,dump,hours,laborRate,special,load,mileage,labor,subtotal,quote,spread};
}
function loadSettings(){const p=getJSON('imPricing',pricingDefaults);Object.keys(pricingDefaults).forEach(k=>$(k).value=p[k]??pricingDefaults[k]);$('aiEndpoint').value=localStorage.getItem('imAiEndpoint')||'';updateEndpointStatus();}
function saveSettings(){setJSON('imPricing',pricing());localStorage.setItem('imAiEndpoint',$('aiEndpoint').value.trim());updateEndpointStatus();calc();}
function updateEndpointStatus(){const v=$('aiEndpoint').value.trim();$('endpointStatus').className='status '+(v?'good':'');$('endpointStatus').textContent=v?'AI endpoint configured.':'AI endpoint not configured.';}
function resetJob(){currentJobId=null;aiResult=null;photoFiles=[];$('photos').value='';$('thumbs').innerHTML='';['customerName','customerPhone','address','notes'].forEach(id=>$(id).value='');Object.entries(costDefaults).forEach(([k,v])=>$(k).value=v);renderAI(null);calc();}
function renderAI(r){
 if(!r){$('analysisLoad').textContent='Manual';$('analysisWeight').textContent='Manual';$('analysisLabor').textContent='Manual';$('analysisConfidence').textContent='—';$('detectedItems').innerHTML='';$('aiNotes').textContent='';return}
 $('analysisLoad').textContent=`~${Math.round(r.load_percent||0)}%`;$('analysisWeight').textContent=`${Math.round(r.weight_low_lb||0).toLocaleString()}–${Math.round(r.weight_high_lb||0).toLocaleString()} lb`;$('analysisLabor').textContent=r.labor_difficulty||'Unknown';$('analysisConfidence').textContent=`${Math.round((r.confidence||0)*100)}%`;
 $('detectedItems').innerHTML=(r.detected_items||[]).slice(0,12).map(x=>`<li>${escapeHtml(x)}</li>`).join('');$('aiNotes').textContent=r.notes||'';
}
const escapeHtml=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function fileToDataURL(file){
 const img=await createImageBitmap(file);const max=1280,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);img.close?.();return c.toDataURL('image/jpeg',.72);
}
async function analyzePhotos(){
 const endpoint=$('aiEndpoint').value.trim();if(!endpoint){setAIStatus('Set your AI Worker URL in Settings first.','bad');showTab('settings');return}if(!photoFiles.length){setAIStatus('Upload at least one photo first.','bad');return}
 $('analyzeBtn').disabled=true;setAIStatus('Compressing photos and asking AI to estimate the load…','work');
 try{
  const images=[];for(const f of photoFiles.slice(0,5))images.push(await fileToDataURL(f));
  const res=await fetch(endpoint.replace(/\/$/,'')+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images,job_type:$('jobType').value,notes:$('notes').value.slice(0,1200)})});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`AI request failed (${res.status})`);aiResult=data;
  const pct=clamp((data.load_percent||50)/100,.05,3);const allowed=[.15,.25,.5,.75,1,1.25,1.5,2];$('loadPct').value=allowed.reduce((a,b)=>Math.abs(b-pct)<Math.abs(a-pct)?b:a,allowed[0]);if(Number.isFinite(+data.labor_hours))$('laborHours').value=clamp(data.labor_hours,0,100);if(Number.isFinite(+data.special_fee_suggestion))$('specialFee').value=clamp(data.special_fee_suggestion,0,5000);
  renderAI(data);calc();setAIStatus('AI analysis complete. Review the estimate before quoting the customer.','good');
 }catch(err){setAIStatus(err.message||'AI analysis failed.','bad')}finally{$('analyzeBtn').disabled=false}
}
function setAIStatus(msg,type=''){$('aiStatus').className='status '+type;$('aiStatus').textContent=msg}
function jobData(){const c=calc();return{id:currentJobId||crypto.randomUUID(),createdAt:new Date().toISOString(),customerName:$('customerName').value.trim(),customerPhone:$('customerPhone').value.trim(),address:$('address').value.trim(),jobType:$('jobType').value,notes:$('notes').value.trim(),loadPct:+$('loadPct').value,miles:+$('miles').value,mileRate:+$('mileRate').value,dumpFee:+$('dumpFee').value,laborHours:+$('laborHours').value,laborRate:+$('laborRate').value,specialFee:+$('specialFee').value,quote:c.quote,subtotal:c.subtotal,spread:c.spread,ai:aiResult};}
function saveJob(){const j=jobData(),jobs=getJSON('imJobs',[]),idx=jobs.findIndex(x=>x.id===j.id);if(idx>=0)jobs[idx]={...jobs[idx],...j,updatedAt:new Date().toISOString()};else jobs.unshift(j);setJSON('imJobs',jobs.slice(0,250));currentJobId=j.id;renderHistory();alert('Quote saved on this device.');}
function renderHistory(){const jobs=getJSON('imJobs',[]),wrap=$('historyList');if(!jobs.length){wrap.innerHTML='<div class="empty">No saved quotes yet.</div>';return}wrap.innerHTML=jobs.map(j=>`<article class="job" data-id="${escapeHtml(j.id)}"><div class="jobtop"><div><div class="jobname">${escapeHtml(j.customerName||'Unnamed customer')}</div><div class="jobmeta">${escapeHtml(j.address||'No address')} • ${new Date(j.createdAt).toLocaleDateString()}</div></div><div class="jobquote">${money(j.quote)}</div></div><div class="jobmeta">${escapeHtml(j.jobType)} • ${Math.round((j.loadPct||0)*100)}% load • ${j.miles||0} mi</div><div class="jobbuttons"><button data-act="open">Open</button><button data-act="delete" class="danger">Delete</button></div></article>`).join('');}
function openJob(id){const j=getJSON('imJobs',[]).find(x=>x.id===id);if(!j)return;currentJobId=j.id;['customerName','customerPhone','address','notes','jobType','loadPct','miles','mileRate','dumpFee','laborHours','laborRate','specialFee'].forEach(k=>{if(j[k]!==undefined)$(k).value=j[k]});aiResult=j.ai||null;renderAI(aiResult);setAIStatus(aiResult?'Loaded saved AI analysis.':'Saved job loaded. Add photos if you want a new AI analysis.','good');calc();showTab('estimate');}
function showTab(name){['estimate','history','settings'].forEach(n=>{$('tab-'+n).classList.toggle('hidden',n!==name)});document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));if(name==='history')renderHistory();}
function exportJobs(){const blob=new Blob([JSON.stringify(getJSON('imJobs',[]),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='iron-mule-jobs.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
Object.keys(costDefaults).forEach(id=>$(id).addEventListener('input',calc));Object.keys(pricingDefaults).forEach(id=>$(id).addEventListener('input',saveSettings));$('aiEndpoint').addEventListener('change',saveSettings);$('recalc').addEventListener('click',calc);$('newQuote').addEventListener('click',resetJob);$('saveJob').addEventListener('click',saveJob);$('analyzeBtn').addEventListener('click',analyzePhotos);$('exportBtn').addEventListener('click',exportJobs);$('resetSettings').addEventListener('click',()=>{Object.entries(pricingDefaults).forEach(([k,v])=>$(k).value=v);saveSettings()});$('clearHistoryBtn').addEventListener('click',()=>{if(confirm('Delete all saved jobs on this device?')){localStorage.removeItem('imJobs');renderHistory()}});
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
$('historyList').addEventListener('click',e=>{const btn=e.target.closest('button'),job=e.target.closest('.job');if(!btn||!job)return;const id=job.dataset.id;if(btn.dataset.act==='open')openJob(id);if(btn.dataset.act==='delete'&&confirm('Delete this saved job?')){setJSON('imJobs',getJSON('imJobs',[]).filter(x=>x.id!==id));renderHistory()}});
$('photos').addEventListener('change',e=>{photoFiles=[...e.target.files].filter(f=>f.type.startsWith('image/')).slice(0,5);$('thumbs').innerHTML='';photoFiles.forEach(f=>{const img=document.createElement('img'),u=URL.createObjectURL(f);img.src=u;img.alt='Job photo';img.onload=()=>URL.revokeObjectURL(u);$('thumbs').appendChild(img)});setAIStatus(photoFiles.length?`${photoFiles.length} photo${photoFiles.length===1?'':'s'} ready for AI analysis.`:'Upload photos, then tap Analyze Photos with AI.','');});
let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBox').classList.add('show')});$('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBox').classList.remove('show')});window.addEventListener('appinstalled',()=>$('installBox').classList.remove('show'));if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
loadSettings();resetJob();renderHistory();
})();

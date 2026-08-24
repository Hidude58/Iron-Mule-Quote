(() => {
  const $ = id => document.getElementById(id);
  const baseRates = {junk:550, estate:625, construction:675, yard:475, appliance:500};
  const defaults = {jobType:'junk',loadPct:'0.5',miles:'34',mileRate:'1.10',dumpFee:'72',laborHours:'1.5',laborRate:'40',specialFee:'25',margin:'10',minimum:'95'};
  const fields = Object.keys(defaults);
  const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  const num = (id,min=0,max=1e6) => { let v=parseFloat($(id).value); if(!Number.isFinite(v)) v=0; return Math.min(max,Math.max(min,v)); };

  function save(){
    const data={}; fields.forEach(k=>data[k]=$(k).value); localStorage.setItem('ironMuleQuoteSettings',JSON.stringify(data));
  }
  function load(){
    try{ const saved=JSON.parse(localStorage.getItem('ironMuleQuoteSettings')||'{}'); fields.forEach(k=>$(k).value=saved[k] ?? defaults[k]); }
    catch{ fields.forEach(k=>$(k).value=defaults[k]); }
  }
  function recalc(){
    const pct=num('loadPct',0,3), miles=num('miles',0,1000), mileRate=num('mileRate',0,10), dump=num('dumpFee',0,10000), laborHours=num('laborHours',0,100), laborRate=num('laborRate',0,500), special=num('specialFee',0,5000), margin=num('margin',0,200)/100, minimum=num('minimum',0,5000);
    const fullRate=baseRates[$('jobType').value]||550;
    const loadCost=fullRate*pct, mileage=miles*mileRate, labor=laborHours*laborRate, subtotal=loadCost+mileage+labor+dump+special;
    const target=Math.max(minimum,subtotal*(1+margin)), quote=Math.ceil(target/25)*25, spread=Math.max(0,quote-(mileage+labor+dump+special));
    $('loadCost').textContent=money(loadCost); $('mileageCost').textContent=money(mileage); $('laborCost').textContent=money(labor); $('dumpCost').textContent=money(dump); $('specialCost').textContent=money(special); $('subtotal').textContent=money(subtotal); $('quote').textContent=money(quote); $('profit').textContent=money(spread);
    $('analysisLoad').textContent=pct>=1?'1+ trailer loads':`~${Math.round(pct*100)}% trailer`;
    $('analysisLabor').textContent=laborHours<=.75?'Light labor':laborHours<=2?'Medium labor':'Heavy labor';
    const low=Math.round((pct*1400)/50)*50, high=Math.round((pct*2000)/50)*50; $('analysisWeight').textContent=`~${low.toLocaleString()}–${high.toLocaleString()} lb`;
    save();
  }

  load(); fields.forEach(id=>$(id).addEventListener('input',recalc)); $('recalc').addEventListener('click',recalc);
  $('reset').addEventListener('click',()=>{fields.forEach(k=>$(k).value=defaults[k]); localStorage.removeItem('ironMuleQuoteSettings'); recalc();});

  $('photos').addEventListener('change', e => {
    const files=[...e.target.files].slice(0,5); $('thumbs').innerHTML='';
    files.forEach(file=>{ if(!file.type.startsWith('image/')) return; const img=document.createElement('img'); img.alt='Uploaded job photo'; const url=URL.createObjectURL(file); img.src=url; img.onload=()=>URL.revokeObjectURL(url); $('thumbs').appendChild(img); });
    $('analysisConfidence').textContent=files.length?`${files.length} photo${files.length===1?'':'s'} loaded`:'Manual estimate';
  });

  let deferredPrompt=null; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBox').classList.add('show');});
  $('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBox').classList.remove('show');});
  window.addEventListener('appinstalled',()=>{$('installBox').classList.remove('show');});

  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  recalc();
})();

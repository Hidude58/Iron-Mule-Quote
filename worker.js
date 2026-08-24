// Cloudflare Worker for Iron Mule Quote.
// Required secret: OPENAI_API_KEY
// Optional variable: ALLOWED_ORIGIN = https://hidude58.github.io
// Deploy this Worker separately from GitHub Pages.

function cors(origin, allowed) {
  const ok = !allowed || origin === allowed;
  return {
    'Access-Control-Allow-Origin': ok ? (origin || allowed || '*') : allowed,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin, env.ALLOWED_ORIGIN);
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
    if (url.pathname !== '/analyze' || request.method !== 'POST') return new Response(JSON.stringify({error:'Not found'}), {status:404, headers});
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return new Response(JSON.stringify({error:'Origin not allowed'}), {status:403, headers});
    if (!env.OPENAI_API_KEY) return new Response(JSON.stringify({error:'OPENAI_API_KEY is not configured on the Worker'}), {status:500, headers});

    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({error:'Invalid JSON'}), {status:400, headers}); }
    const images = Array.isArray(body.images) ? body.images.slice(0,5) : [];
    if (!images.length || images.some(x => typeof x !== 'string' || !x.startsWith('data:image/'))) return new Response(JSON.stringify({error:'Send 1–5 image data URLs'}), {status:400, headers});
    const totalChars = images.reduce((n,x)=>n+x.length,0);
    if (totalChars > 12_000_000) return new Response(JSON.stringify({error:'Images are too large'}), {status:413, headers});

    const prompt = `You estimate junk-removal jobs from photos for a hauling company. Analyze only what is visible and be conservative about uncertainty. Return ONLY valid JSON with this exact shape:\n{
"load_percent": number,
"weight_low_lb": number,
"weight_high_lb": number,
"labor_difficulty": "Light"|"Medium"|"Heavy"|"Very Heavy",
"labor_hours": number,
"detected_items": string[],
"special_fee_suggestion": number,
"confidence": number,
"notes": string
}\nRules: load_percent is percent of a typical 14–16 ft dump trailer, may exceed 100 if clearly multiple loads. confidence is 0 to 1. Do not claim exact weight from images. Flag dense materials (concrete, dirt, shingles, tile, brick), appliances, tires, mattresses, refrigerant items, batteries, paint/chemicals, or other disposal-sensitive items in notes. special_fee_suggestion is a conservative USD suggestion and can be 0. Estimated labor_hours means crew loading time, not driving. Job type: ${String(body.job_type||'junk').slice(0,40)}. User notes: ${String(body.notes||'').slice(0,1200)}`;
    const content = [{type:'input_text', text:prompt}, ...images.map(image_url=>({type:'input_image', image_url, detail:'low'}))];

    const ai = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'gpt-5.6-luna', input:[{role:'user', content}], max_output_tokens:700})
    });
    const raw = await ai.json().catch(()=>({}));
    if (!ai.ok) return new Response(JSON.stringify({error:raw?.error?.message || 'OpenAI request failed'}), {status:502, headers});
    const text = raw.output_text || (raw.output||[]).flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text || '';
    let data;
    try { data = JSON.parse(text.trim().replace(/^```json\s*/i,'').replace(/```$/,'')); }
    catch { return new Response(JSON.stringify({error:'AI returned an unreadable estimate. Try again.', raw:text.slice(0,500)}), {status:502, headers}); }
    const clean = {
      load_percent: Math.max(5, Math.min(300, Number(data.load_percent)||50)),
      weight_low_lb: Math.max(0, Math.min(50000, Number(data.weight_low_lb)||0)),
      weight_high_lb: Math.max(0, Math.min(50000, Number(data.weight_high_lb)||0)),
      labor_difficulty: ['Light','Medium','Heavy','Very Heavy'].includes(data.labor_difficulty)?data.labor_difficulty:'Medium',
      labor_hours: Math.max(.25, Math.min(100, Number(data.labor_hours)||1.5)),
      detected_items: Array.isArray(data.detected_items)?data.detected_items.slice(0,15).map(x=>String(x).slice(0,100)):[],
      special_fee_suggestion: Math.max(0, Math.min(5000, Number(data.special_fee_suggestion)||0)),
      confidence: Math.max(0, Math.min(1, Number(data.confidence)||.5)),
      notes: String(data.notes||'').slice(0,1200)
    };
    if (clean.weight_high_lb < clean.weight_low_lb) [clean.weight_low_lb,clean.weight_high_lb]=[clean.weight_high_lb,clean.weight_low_lb];
    return new Response(JSON.stringify(clean), {status:200, headers});
  }
};

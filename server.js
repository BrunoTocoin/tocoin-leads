const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && req.url === '/logo-tocoin.png') {
    const img = fs.readFileSync(path.join(__dirname, 'logo-tocoin.png'));
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(img);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/gerar') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { promptLado1, promptLado2, tipo, material, cores, imageBase64 } = JSON.parse(body);

        // Product type mapping
        const tipoMap = {
          'Moeda Personalizada': 'challenge coin',
          'Brevê Militar': 'military brevet pin badge'
        };
        const tip = tipoMap[tipo] || 'challenge coin';
        const isBrève = tipo === 'Brevê Militar';
        const hasColor = cores === 'Colorida';

        // Finish description per plating
        const finishMap = {
          'Bronze Envelhecido': `antique bronze plating: warm golden-dark tone with deep grey-black patina filling all recesses and engravings, strong two-tone contrast between bright raised areas and near-black recessed areas, matte-satin surface with fine granular texture on flat zones`,
          'Prata Envelhecido': `antique silver plating: cold grey-silver tone with near-black patina deep in all recesses, matte-frosted surface on flat areas, sharp contrast between bright silver high points and darkened shadowed recesses, cold metallic temperature`,
          'Ouro Brilho': `polished gold plating: intense saturated warm yellow-gold, highly reflective mirror-polished surface with no patina or darkening in recesses, specular highlights on edges and raised elements, slight brushed matte texture on flat background contrasting with polished relief`,
          'Ouro Envelhecido': `antique gold plating: warm golden tone with subtle brown-black patina in recesses, matte-satin surface, premium aged appearance with warm temperature`,
          'Níquel Brilho': `polished nickel plating: bright cold white-silver tone, highly reflective mirror-polished surface with no patina, very clean and modern appearance, extremely bright specular highlights, cold temperature`,
          'Cobre Envelhecido': `antique copper plating: warm reddish-pink copper tone with dramatic near-black patina in all recesses, strong contrast between bright copper-rose raised areas and very dark recesses, matte surface with visible fine texture`
        };
        const finish = finishMap[material] || finishMap['Bronze Envelhecido'];

        // Enamel description
        const enamelDesc = hasColor
          ? `vibrant hard enamel fills in the recessed areas with flat saturated colors (red, blue, green, black, yellow as appropriate), colors are opaque and glossy contrasting with the metal finish`
          : `no enamel or color fills — pure metallic surface throughout, all depth created by relief and patina contrast only`;

        // Shape description
        const shapeDesc = isBrève
          ? `custom shield or badge shape (not circular), with possible extended elements like wings or decorative protrusions beyond the main body outline, thin profile designed to be pinned to a uniform`
          : `perfectly circular coin shape with defined edge rim, thick profile, designed to be held in hand`;

        // Composition
        const compositionDesc = isBrève
          ? `single ${tip} shown frontally centered in frame`
          : `two ${tip}s shown side by side horizontally centered: LEFT coin (front face): ${promptLado1 || 'decorative front face with central emblem and text around the border'}. RIGHT coin (back face): ${promptLado2 || 'decorative back face with complementary design'}`;

        const prompt = `Photorealistic macro product photography of a Brazilian custom ${tip} manufactured by Tocoin. ${compositionDesc}. PLATING: ${finish}. ENAMEL: ${enamelDesc}. SHAPE: ${shapeDesc}. DESIGN ELEMENTS: ${promptLado1}${isBrève ? '' : ` | verso: ${promptLado2}`}. PHOTOGRAPHY STYLE: perfectly flat frontal view with no perspective tilt, dramatic side lighting from the left creating depth on the relief, dark charcoal background (#3d3d3c), ultra-sharp macro focus, 8k resolution, professional numismatic product photography quality, metallic reflections faithful to the plating type.`;

        const modelos = [
          'gemini-3.1-flash-image-preview',
          'gemini-3-pro-image-preview',
          'gemini-2.5-flash-image',
        ];

        const parts = [];
        if (imageBase64) {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
          parts.push({ text: `Use this image as style and composition reference. Generate a similar ${tip} with these specifications: ${prompt}` });
        } else {
          parts.push({ text: prompt });
        }

        let imageData = null;
        let erroFinal = '';

        for (const modelo of modelos) {
          try {
            console.log('[GERAR] Tentando modelo:', modelo);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_KEY}`;
            const geminiRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
              })
            });
            const data = await geminiRes.json();
            if (!geminiRes.ok) { erroFinal = data.error?.message || `HTTP ${geminiRes.status}`; continue; }
            const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imgPart) { imageData = { mimeType: imgPart.inlineData.mimeType, data: imgPart.inlineData.data, modelo }; break; }
          } catch(e) { erroFinal = e.message; }
        }

        if (!imageData) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: erroFinal }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...imageData }));

      } catch(e) {
        console.error('[GERAR] Erro:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lead') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const lead = JSON.parse(body);
        console.log('[LEAD] Salvando:', lead.nome, lead.email);
        const supRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(lead)
        });
        const resText = await supRes.text();
        console.log('[LEAD] Status:', supRes.status, resText);
        let leadId = null;
        try { const rows = JSON.parse(resText); if (rows[0]?.id) leadId = rows[0].id; } catch(e) {}
        res.writeHead(supRes.ok ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: supRes.ok, id: leadId }));
      } catch(e) {
        console.error('[LEAD] Erro:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lead-update') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id, email, quantidade, prazo, segmento, instituicao } = JSON.parse(body);
        console.log('[LEAD-UPDATE] id:', id, 'email:', email);
        const filter = id ? `id=eq.${id}` : `email=eq.${encodeURIComponent(email)}`;
        const supRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?${filter}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ quantidade, prazo, segmento, instituicao })
        });
        const resText = await supRes.text();
        console.log('[LEAD-UPDATE] Status:', supRes.status, resText);
        res.writeHead(supRes.ok ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: supRes.ok }));
      } catch(e) {
        console.error('[LEAD-UPDATE] Erro:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`Tocoin Leads na porta ${PORT}`));

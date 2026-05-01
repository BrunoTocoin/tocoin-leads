const http = require('http');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const LOGO_PATH = path.join(__dirname, 'logo-tocoin.png');

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
    const img = fs.readFileSync(LOGO_PATH);
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(img);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/gerar') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { promptLado1, promptLado2, tipo, material, imageBase64 } = JSON.parse(body);

        const matMap = {
          'Dourado': 'polished gold with warm reflections',
          'Prateado': 'polished silver with cool reflections',
          'Bronze Envelhecido': 'antique bronze with subtle patina in the recesses',
          'Níquel Preto': 'black nickel with dark metallic sheen',
          'Dourado com Esmalte': 'gold with vibrant colored enamel fills'
        };
        const tipoMap = {
          'Challenge Coin': 'challenge coin',
          'Brevê Militar': 'military brevet pin',
          'Medalha': 'medal',
          'Moeda Comemorativa': 'commemorative coin'
        };

        const mat = matMap[material] || 'polished gold';
        const tip = tipoMap[tipo] || 'challenge coin';

        const baseStyle = `Professional product photography of a ${tip}. Material: ${mat}. Background: flat #3d3d3c dark charcoal gradient. Camera angle: perfectly flat frontal view, no tilt. Lighting: dramatic side light from the left highlighting the relief. 3D volume: high relief with medium-depth shadows on engravings. If bronze or antique finish: subtle patina in recesses. Resolution: photorealistic macro, 8k, sharp details, metallic depth.`;

        const prompt = `Two-sided ${tip} shown side by side on the same image. LEFT SIDE (front face): ${promptLado1}. RIGHT SIDE (back face): ${promptLado2}. Both coins share the same style: ${baseStyle} Show both faces clearly separated in a single horizontal composition, both perfectly centered and aligned.`;

        const modelos = [
          'gemini-3.1-flash-image-preview',
          'gemini-3-pro-image-preview',
          'gemini-2.5-flash-image',
        ];

        const parts = [];
        if (imageBase64) {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
          parts.push({ text: `Use this image as style reference. ${prompt}` });
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

        // Add watermark
        try {
          const imgBuffer = Buffer.from(imageData.data, 'base64');
          const coinImg = await loadImage(imgBuffer);
          const logoImg = await loadImage(LOGO_PATH);

          const canvas = createCanvas(coinImg.width, coinImg.height);
          const ctx = canvas.getContext('2d');

          ctx.drawImage(coinImg, 0, 0);

          // Logo watermark bottom right
          const logoW = coinImg.width * 0.18;
          const logoH = (logoImg.height / logoImg.width) * logoW;
          const margin = coinImg.width * 0.02;
          ctx.globalAlpha = 0.55;
          ctx.drawImage(logoImg, coinImg.width - logoW - margin, coinImg.height - logoH - margin, logoW, logoH);
          ctx.globalAlpha = 1;

          // Copyright text
          const fontSize = Math.round(coinImg.width * 0.018);
          ctx.font = `${fontSize}px Arial`;
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.textAlign = 'center';
          ctx.fillText('© Tocoin Moedas e Medalhas — Imagem gerada por IA. Uso exclusivo para visualização.', coinImg.width / 2, coinImg.height - Math.round(coinImg.height * 0.015));

          const finalBuffer = canvas.toBuffer('image/jpeg', { quality: 0.92 });
          const finalB64 = finalBuffer.toString('base64');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, mimeType: 'image/jpeg', data: finalB64, modelo: imageData.modelo }));
        } catch(e) {
          console.warn('[WATERMARK] Erro ao adicionar marca d\'água, retornando imagem original:', e.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...imageData }));
        }

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
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(lead)
        });
        const resText = await supRes.text();
        console.log('[LEAD] Status:', supRes.status, resText);
        res.writeHead(supRes.ok ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: supRes.ok }));
      } catch(e) {
        console.error('[LEAD] Erro:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`Tocoin Leads na porta ${PORT}`));

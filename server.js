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

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve index.html
  if (req.method === 'GET' && req.url === '/') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Proxy: gerar imagem via Gemini
  if (req.method === 'POST' && req.url === '/api/gerar') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { prompt, imageBase64 } = JSON.parse(body);

        // Descobrir modelo disponível — tenta em ordem
        const modelos = [
          'gemini-3.1-flash-image-preview',
          'gemini-3-pro-image-preview',
          'gemini-2.5-flash-image',
        ];

        const parts = [];
        if (imageBase64) {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
          parts.push({ text: prompt });
        } else {
          parts.push({ text: prompt });
        }

        let imageData = null;
        let erroFinal = '';

        for (const modelo of modelos) {
          try {
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
            if (!geminiRes.ok) {
              erroFinal = data.error?.message || `HTTP ${geminiRes.status}`;
              continue;
            }

            const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imgPart) {
              imageData = { mimeType: imgPart.inlineData.mimeType, data: imgPart.inlineData.data, modelo };
              break;
            }
          } catch(e) {
            erroFinal = e.message;
          }
        }

        if (imageData) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...imageData }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: erroFinal }));
        }

      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Proxy: salvar lead no Supabase
  if (req.method === 'POST' && req.url === '/api/lead') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const lead = JSON.parse(body);
        console.log('[LEAD] Tentando salvar:', JSON.stringify(lead));
        console.log('[LEAD] SUPABASE_URL:', SUPABASE_URL);
        console.log('[LEAD] SUPABASE_KEY presente:', !!SUPABASE_KEY);

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
        console.log('[LEAD] Status Supabase:', supRes.status);
        console.log('[LEAD] Resposta Supabase:', resText);

        res.writeHead(supRes.ok ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: supRes.ok, status: supRes.status, response: resText }));
      } catch(e) {
        console.error('[LEAD] Erro:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Tocoin Leads rodando na porta ${PORT}`);
});

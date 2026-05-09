const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.GEMINI_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const RESEND_KEY = process.env.RESEND_KEY;

const LIMITE_GERACOES = 3;

async function verificarLimite(email) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&select=total_geracoes`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const rows = await res.json();
    if (!rows || rows.length === 0) return { permitido: true, total: 0 };
    const total = rows[0].total_geracoes || 0;
    return { permitido: total < LIMITE_GERACOES, total };
  } catch(e) {
    console.warn('[LIMITE] Erro ao verificar:', e.message);
    return { permitido: true, total: 0 };
  }
}

async function incrementarGeracoes(email, leadId) {
  try {
    const filter = leadId ? `id=eq.${leadId}` : `email=eq.${encodeURIComponent(email)}`;
    await fetch(`${SUPABASE_URL}/rest/v1/leads?${filter}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ total_geracoes: await getTotal(email) + 1 })
    });
  } catch(e) {
    console.warn('[LIMITE] Erro ao incrementar:', e.message);
  }
}

async function getTotal(email) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&select=total_geracoes`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    return rows?.[0]?.total_geracoes || 0;
  } catch(e) { return 0; }
}

async function uploadImagem(imageBase64, mimeType, leadEmail) {
  try {
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `${Date.now()}-${(leadEmail || 'lead').replace(/[^a-z0-9]/gi, '_')}.${ext}`;
    const buffer = Buffer.from(imageBase64, 'base64');

    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/visualizacoes/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: buffer
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.warn('[UPLOAD] Falha:', uploadRes.status, err);
      return null;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/visualizacoes/${fileName}`;
    console.log('[UPLOAD] Sucesso:', publicUrl);
    return publicUrl;
  } catch(e) {
    console.error('[UPLOAD] Erro:', e.message);
    return null;
  }
}


async function enviarEmailLead(lead, imagemUrl) {
  try {
    const imgHtml = imagemUrl
      ? `<div style="margin: 24px 0; text-align: center;">
          <img src="${imagemUrl}" alt="Visualização gerada" style="max-width: 100%; border-radius: 8px; border: 1px solid #e0e0e0;">
          <p style="font-size: 11px; color: #999; margin-top: 8px;">© Tocoin Moedas e Medalhas — Imagem gerada por IA</p>
        </div>`
      : '<p style="color:#999; font-size:13px;">Nenhuma imagem gerada ainda.</p>';

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"></head>
    <body style="margin:0; padding:0; background:#f5f5f5; font-family: 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 600px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <div style="background: #2e2e2f; padding: 28px 32px; text-align: center;">
          <img src="https://tocoin.com.br/wp-content/uploads/2026/03/LogoTocoinpq.png" alt="Tocoin" style="height: 50px;">
          <p style="color: #bba05a; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; margin: 12px 0 0;">Novo Lead — Visualizador IA</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px;">
          <h2 style="font-size: 20px; color: #222; margin: 0 0 24px;">Novo lead cadastrado</h2>

          <!-- Lead info -->
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #999; width: 140px;">Nome</td>
              <td style="padding: 10px 0; color: #222; font-weight: 500;">${lead.nome || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #999;">WhatsApp</td>
              <td style="padding: 10px 0; color: #222;">${lead.telefone || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #999;">E-mail</td>
              <td style="padding: 10px 0; color: #222;">${lead.email || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #999;">Tipo</td>
              <td style="padding: 10px 0; color: #222;">${lead.tipo || '—'}</td>
            </tr>

            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #999;">Quantidade</td>
              <td style="padding: 10px 0; color: #222;">${lead.quantidade || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #999;">Prazo</td>
              <td style="padding: 10px 0; color: #222;">${lead.prazo || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 10px 0; color: #999;">Segmento</td>
              <td style="padding: 10px 0; color: #222;">${lead.segmento || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #999;">Instituição</td>
              <td style="padding: 10px 0; color: #222;">${lead.instituicao || '—'}</td>
            </tr>
          </table>

          <!-- Image -->
          ${imgHtml}

          <!-- CTA -->
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://wa.me/55${(lead.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${lead.nome}! Vi que você criou uma visualização no Visualizador da Tocoin. Posso te ajudar com um orçamento?`)}"
              style="display: inline-block; background: #25D366; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Abrir WhatsApp
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9f9f9; padding: 16px 32px; text-align: center; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 11px; color: #bbb; margin: 0;">© 2026 Tocoin Moedas e Medalhas · tocoin.com.br</p>
        </div>
      </div>
    </body>
    </html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: 'Visualizador Tocoin <brunolima@tocoin.com.br>',
        to: ['brunolima@tocoin.com.br', 'consultor@tocoin.com.br'],
        subject: `Novo lead: ${lead.nome || 'Sem nome'} — Visualizador Tocoin`,
        html
      })
    });

    const data = await res.json();
    console.log('[EMAIL] Status:', res.status, data.id || data.message || '');
  } catch(e) {
    console.error('[EMAIL] Erro:', e.message);
  }
}

async function atualizarImagemLead(leadId, email, imagemUrl) {
  try {
    const filter = leadId ? `id=eq.${leadId}` : `email=eq.${encodeURIComponent(email)}`;
    await fetch(`${SUPABASE_URL}/rest/v1/leads?${filter}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ imagem_url: imagemUrl })
    });
    console.log('[IMAGEM-LEAD] URL salva no lead');
  } catch(e) {
    console.warn('[IMAGEM-LEAD] Erro ao salvar URL:', e.message);
  }
}

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

  if (req.method === 'GET' && req.url === '/admin') {
    const html = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
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
        const { promptLado1, promptLado2, tipo, material, cores, imageBase64, leadId, email } = JSON.parse(body);

        // Check generation limit
        if (email) {
          const { permitido, total } = await verificarLimite(email);
          if (!permitido) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: false, 
              limitExceeded: true,
              error: `Limite de ${LIMITE_GERACOES} visualizações atingido para este e-mail.`
            }));
            return;
          }
        }

        const tipoMap = {
          'Moeda Personalizada': 'challenge coin',
          'Brevê Militar': 'military brevet pin badge'
        };
        const tip = tipoMap[tipo] || 'challenge coin';
        const isBrève = tipo === 'Brevê Militar';
        const hasColor = cores === 'Colorida';

        const finishMap = {
          'Bronze Envelhecido': `antique bronze plating: warm golden-dark tone with deep grey-black patina filling all recesses and engravings, strong two-tone contrast between bright raised areas and near-black recessed areas, matte-satin surface with fine granular texture on flat zones`,
          'Prata Envelhecido': `antique silver plating: cold grey-silver tone with near-black patina deep in all recesses, matte-frosted surface on flat areas, sharp contrast between bright silver high points and darkened shadowed recesses, cold metallic temperature`,
          'Ouro Brilho': `polished gold plating: intense saturated warm yellow-gold, highly reflective mirror-polished surface with no patina or darkening in recesses, specular highlights on edges and raised elements, slight brushed matte texture on flat background contrasting with polished relief`,
          'Cobre Envelhecido': `antique copper plating: warm reddish-pink copper tone with dramatic near-black patina in all recesses, strong contrast between bright copper-rose raised areas and very dark recesses, matte surface with visible fine texture`,
          'Níquel Brilho': `polished nickel plating: bright cold white-silver tone, highly reflective mirror-polished surface with no patina, very clean and modern appearance, extremely bright specular highlights, cold temperature`,
          'Prata Brilho': `polished silver plating: bright cold white-silver tone, highly reflective mirror-polished surface with no patina, very clean and modern appearance`
        };
        const finish = finishMap[material] || finishMap['Bronze Envelhecido'];

        const enamelDesc = hasColor
          ? `vibrant hard enamel fills in the recessed areas with flat saturated colors (red, blue, green, black, yellow as appropriate to the design), colors are opaque and glossy contrasting with the metal finish`
          : `no enamel or color fills — pure metallic surface throughout, all depth created by relief and patina contrast only`;

        const shapeDesc = isBrève
          ? `custom shape (shield, badge, or as described by the client — could be shield, eagle, star, or any custom silhouette), with possible extended decorative elements beyond the main body outline, thin profile designed to be pinned to a uniform`
          : `perfectly circular coin shape with defined edge rim, thick profile, designed to be held in hand`;

        const compositionDesc = isBrève
          ? `single ${tip} centered in frame, front face design: ${promptLado1 || 'decorative front face with central emblem'}`
          : `two ${tip}s shown side by side horizontally: LEFT coin (front face): ${promptLado1 || 'decorative front face with central emblem and text around the border'}. RIGHT coin (back face): ${promptLado2 || 'decorative back face with complementary design'}`;

        const prompt = `Photorealistic macro product photography of a Brazilian custom ${tip} manufactured by Tocoin Moedas e Medalhas. ${compositionDesc}. PLATING: ${finish}. ENAMEL: ${enamelDesc}. SHAPE: ${shapeDesc}. PHOTOGRAPHY STYLE: the coin(s) must appear as GEOMETRICALLY PERFECT CIRCLES — not oval, not elliptical, not stretched. Camera is 100% perpendicular to the coin face, zero tilt, zero angle, zero perspective distortion. The image aspect ratio must NOT stretch or compress the coins. Each coin occupies no more than 35% of the image width, leaving generous empty space (at least 15% padding) on all sides — top, bottom, left and right — so the coins float comfortably in the frame without touching any edge. Dramatic side lighting from the left highlighting the relief. Dark charcoal background (#3d3d3c). Ultra-sharp macro focus, 8k resolution, professional numismatic product photography. CRITICAL: coins must be PERFECTLY ROUND circles, never oval or elongated.`;

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

        // Increment generation counter
        if (email) await incrementarGeracoes(email, leadId);

        // Upload image to Supabase Storage
        const imagemUrl = await uploadImagem(imageData.data, imageData.mimeType, email || `lead_${Date.now()}`);

        // Save image URL to lead record
        if (imagemUrl && (leadId || email)) {
          await atualizarImagemLead(leadId, email, imagemUrl);
        }



        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...imageData, imagemUrl }));

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
        console.log('[LEAD] Status:', supRes.status);
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

  if (req.method === 'POST' && req.url === '/api/lead-patch') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id, material, cores, tipo, descricao } = JSON.parse(body);
        if (!id) { res.writeHead(400); res.end('{}'); return; }
        const supRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ material, cores, tipo, descricao })
        });
        console.log('[LEAD-PATCH] Status:', supRes.status);
        res.writeHead(supRes.ok ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: supRes.ok }));
      } catch(e) {
        console.error('[LEAD-PATCH] Erro:', e.message);
        res.writeHead(500); res.end('{}');
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

        // Send email with complete lead data after update
        if (supRes.ok) {
          try {
            const filter = id ? `id=eq.${id}` : `email=eq.${encodeURIComponent(email)}`;
            const leadRes = await fetch(
              `${SUPABASE_URL}/rest/v1/leads?${filter}&select=*&limit=1`,
              { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            );
            const rows = await leadRes.json();
            if (rows && rows[0]) {
              const fullLead = {
                ...rows[0],
                quantidade, prazo, segmento, instituicao
              };
              await enviarEmailLead(fullLead, rows[0].imagem_url);
            }
          } catch(e) { console.warn('[EMAIL] Skip:', e.message); }
        }
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

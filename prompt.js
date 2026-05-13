// ============================================================
// PROMPT DE GERAÇÃO DE IMAGEM — TOCOIN VISUALIZADOR
// Edite este arquivo para ajustar o prompt da IA
// ============================================================

function gerarPrompt({ tipo, material, cores, promptLado1, promptLado2 }) {

  // Tipo de produto
  const tipoMap = {
    'Moeda Personalizada': 'challenge coin',
    'Brevê Militar': 'military brevet pin badge'
  };
  const tip = tipoMap[tipo] || 'challenge coin';
  const isBrève = tipo === 'Brevê Militar';
  const hasColor = cores === 'Colorida';

  // ============================================================
  // DESCRIÇÃO DOS BANHOS
  // Edite aqui para ajustar como cada banho é descrito para a IA
  // ============================================================
  const finishMap = {
    'Bronze Envelhecido': `antique bronze plating: warm golden-dark tone with deep grey-black patina filling all recesses and engravings, strong two-tone contrast between bright raised areas and near-black recessed areas, matte-satin surface with fine granular texture on flat zones`,
    'Prata Envelhecido': `antique silver plating: cold grey-silver tone with near-black patina deep in all recesses, matte-frosted surface on flat areas, sharp contrast between bright silver high points and darkened shadowed recesses, cold metallic temperature`,
    'Ouro Brilho': `polished gold plating: intense saturated warm yellow-gold, highly reflective mirror-polished surface with no patina or darkening in recesses, specular highlights on edges and raised elements, slight brushed matte texture on flat background contrasting with polished relief`,
    'Cobre Envelhecido': `antique copper plating: warm reddish-pink copper tone with dramatic near-black patina in all recesses, strong contrast between bright copper-rose raised areas and very dark recesses, matte surface with visible fine texture`,
    'Níquel Brilho': `polished nickel plating: bright cold white-silver tone, highly reflective mirror-polished surface with no patina, very clean and modern appearance, extremely bright specular highlights, cold temperature`,
    'Prata Brilho': `polished silver plating: bright cold white-silver tone, highly reflective mirror-polished surface with no patina, very clean and modern appearance`
  };
  const finish = finishMap[material] || finishMap['Bronze Envelhecido'];

  // ============================================================
  // DESCRIÇÃO DO ESMALTE (COM COR / SEM COR)
  // ============================================================
  const enamelDesc = hasColor
    ? `vibrant hard enamel fills in the recessed areas with flat saturated colors (red, blue, green, black, yellow as appropriate to the design), colors are opaque and glossy contrasting with the metal finish`
    : `no enamel or color fills — pure metallic surface throughout, all depth created by relief and patina contrast only`;

  // ============================================================
  // DESCRIÇÃO DO FORMATO (MOEDA / BREVÊ)
  // ============================================================
  const shapeDesc = isBrève
    ? `custom shape (shield, badge, or as described by the client — could be shield, eagle, star, or any custom silhouette), with possible extended decorative elements beyond the main body outline, thin profile designed to be pinned to a uniform`
    : `perfectly circular coin shape with defined edge rim, thick profile, designed to be held in hand`;

  // ============================================================
  // COMPOSIÇÃO DA IMAGEM (FRENTE E VERSO)
  // ============================================================
  const compositionDesc = isBrève
    ? `single ${tip} centered in frame with generous empty space around it, front face design: ${promptLado1 || 'decorative front face with central emblem'}`
    : `exactly two ${tip}s placed side by side horizontally with a small gap between them, both centered in the frame with generous empty space on all sides: LEFT coin (front face): ${promptLado1 || 'decorative front face with central emblem and text around the border'}. RIGHT coin (back face): ${promptLado2 || 'decorative back face with complementary design'}. Both coins must be the same size`;

  // ============================================================
  // PROMPT FINAL
  // Edite aqui o estilo fotográfico, fundo, iluminação, etc.
  // ============================================================
  const prompt = `A single unified photorealistic image showing two ${tip}s side by side on ONE continuous background — NOT two separate images, NOT split composition, NOT divided frame. The entire image shares one seamless flat dark charcoal background (#3d3d3c). ${compositionDesc}. PLATING: ${finish}. ENAMEL: ${enamelDesc}. SHAPE: ${shapeDesc}. STRICT VISUAL RULES: (1) BACKGROUND: always solid flat dark charcoal #3d3d3c, never black, never gradient; (2) SHAPE: perfectly circular coins, never oval; (3) CAMERA: 100% frontal perpendicular, zero tilt; (4) SPACING: minimum 15% padding on all sides; (5) LIGHTING: dramatic side light from left; (6) RESOLUTION: 8k ultra-sharp macro photography. ONE image, ONE background, TWO coins.`;

  return prompt;
}

module.exports = { gerarPrompt };

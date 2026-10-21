// Motor de respuesta 100% basado en reglas — sin llamadas a ningún modelo de IA,
// sin costo por uso. Igual patrón que el asesor "BuscaIgni" ya existente en
// index.html: detecta palabras clave y arma la respuesta con datos predefinidos.

const { normas, eppInfo, familias, actualizaciones } = require('./knowledgeBase');

function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // quita tildes
}

// Alias de palabras clave -> familia (además del campo "family" que ya
// traiga cada item de EPP_INFO, o lo inferido por knowledgeBase.js)
const ALIAS_FAMILIA = {
  cabeza: ['casco', 'cabeza', 'craneal'],
  visual: ['lente', 'gafa', 'careta', 'visual', 'ocular', 'ojos', 'facial', 'pantalla facial'],
  auditiva: ['tapon', 'orejera', 'auditiv', 'ruido', 'oido'],
  respiratoria: ['respirador', 'mascarilla', 'filtro', 'autorescat', 'respiratori', 'gases toxicos'],
  guantes: ['guante', 'manos', 'mano'],
  calzado: ['botin', 'bota', 'zapato', 'calzado', 'pie'],
  caidas: ['arnes', 'caida', 'altura', 'linea de vida', 'anticaida'],
  ignifugo: ['ignifug', 'arco electrico', 'flash fire', 'fr ', 'llama'],
  piel: ['piel', 'uv', 'solar', 'quimico', 'quimica', 'dermica'],
  soldador: ['soldad', 'soldadura'],
  vial: ['alta visibilidad', 'reflectante', 'chaleco'],
  svial: ['señalizacion', 'senalizacion', 'cono', 'baliza', 'vial'],
  loto: ['loto', 'bloqueo', 'etiquetado', 'candado', 'tagout'],
  gases: ['gas', 'gases', 'detector'],
  alco: ['alcohol', 'alcotest', 'drogas', 'alcoholemia'],
  barreras: ['barrera', 'cerco', 'cinta de seguridad', 'delimitacion'],
  ropa: ['ropa', 'overol', 'traje', 'vestimenta'],
};

// Patrones de código de norma: NCh 461, EN 388, ANSI Z87.1, ISO 20345,
// IEC 60079, NFPA 2112, DS 594, ANSI/ISEA Z89.1, etc.
const PATRON_NORMA = /\b(nch|en|ansi\/isea|ansi\/assp|ansi|iso|iec|nfpa|ds|osha|as\/nzs)\s?\/?\s?(\d[\d./-]*|[a-z]*\d[\d.]*)/gi;

function buscarPorCodigoNorma(textoNorm) {
  // Compara contra las claves del glosario NORMAS (33 códigos). Algunas
  // claves son compuestas (ej. "DS 594 LOTO", "DS 594 UV / NCh 3273"), asi
  // que se acepta coincidencia en ambos sentidos: la pregunta contiene la
  // clave completa, o la clave empieza con lo que escribio la persona.
  const matches = [];
  for (const codigo of Object.keys(normas)) {
    const codigoNorm = normalizar(codigo);
    const primerToken = codigoNorm.split(/[\s/]/)[0];
    if (
      textoNorm.includes(codigoNorm) ||
      (textoNorm.length >= 4 && codigoNorm.startsWith(textoNorm)) ||
      (primerToken.length >= 3 && codigoNorm.includes(textoNorm) && textoNorm.includes(primerToken))
    ) {
      matches.push(codigo);
    }
  }
  // Compara tambien contra los codigos citados en "actualizaciones" (ediciones mas especificas,
  // ej. "EN 397:2025", "ANSI/ISEA Z89.1-2026")
  const actMatches = [];
  for (const a of actualizaciones) {
    const base = normalizar(a.norma).split(/[:\-]/)[0].trim(); // ej "en 397" de "en 397:2025"
    if (base && (textoNorm.includes(base) || (textoNorm.length >= 4 && base.startsWith(textoNorm)))) {
      actMatches.push(a);
    }
  }
  return { matches, actMatches };
}

function buscarPorFamilia(textoNorm) {
  // Para alias de una sola palabra, exige coincidencia de palabra completa
  // (con límites \b) para evitar falsos positivos tipo "gas" dentro de
  // "gasfiter" o "piel" dentro de otra palabra. Los alias de frase (con
  // espacio, ej. "arco electrico") siguen comparándose como substring.
  const encontradas = [];
  for (const [fam, alias] of Object.entries(ALIAS_FAMILIA)) {
    const matchFam = alias.some(a => {
      const aNorm = normalizar(a).trim();
      if (aNorm.includes(' ')) return textoNorm.includes(aNorm);
      const re = new RegExp('\\b' + aNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*');
      return re.test(textoNorm);
    });
    if (matchFam) encontradas.push(fam);
  }
  return [...new Set(encontradas)];
}

const STOPWORDS = new Set([
  'que', 'para', 'como', 'cual', 'cuales', 'donde', 'cuando', 'porque',
  'esta', 'este', 'estos', 'estas', 'sobre', 'entre', 'desde', 'hasta',
  'tiene', 'tienen', 'existe', 'existen', 'hay', 'uso', 'usar', 'debo',
  'puedo', 'necesito', 'quiero', 'sirve', 'aplica', 'aplican', 'vida',
]);

// Compara por PALABRAS completas (no substrings) para evitar falsos
// positivos como "para" calzando dentro de "lámpara", o "vida" dentro
// de "salvavidas".
function tokenizarPalabras(textoNorm) {
  return textoNorm
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 4 && !STOPWORDS.has(t));
}

function buscarPorProducto(textoNorm) {
  const tokens = tokenizarPalabras(textoNorm);
  if (!tokens.length) return null;
  let mejor = null;
  let mejorScore = 0;
  for (const [id, item] of Object.entries(eppInfo)) {
    const nombreTokens = new Set(tokenizarPalabras(normalizar(item.nombre)));
    let score = 0;
    for (const t of tokens) {
      if (nombreTokens.has(t)) score++;
    }
    if (score > mejorScore) {
      mejorScore = score;
      mejor = { id, ...item };
    }
  }
  // Exige al menos 2 palabras completas coincidentes (o 1 si la pregunta
  // sólo trae esa única palabra significativa), para evitar matches débiles.
  const minimo = tokens.length === 1 ? 1 : 2;
  return mejorScore >= minimo ? mejor : null;
}

function itemsDeFamilia(fam) {
  return Object.entries(eppInfo)
    .filter(([id, item]) => (item.family || inferirFamiliaSimple(id, item)) === fam)
    .map(([id, item]) => item);
}

function inferirFamiliaSimple(id, item) {
  const texto = normalizar(id + ' ' + item.nombre);
  for (const [fam, alias] of Object.entries(ALIAS_FAMILIA)) {
    if (alias.some(a => texto.includes(normalizar(a)))) return fam;
  }
  return 'ropa';
}

function actualizacionesDeFamilia(fam) {
  return actualizaciones.filter(a => a.familia === fam);
}

function formatNorma(codigo) {
  const n = normas[codigo];
  if (!n) return '';
  const cats = (n.categorias || []).join(', ');
  let out = `**${codigo} — ${n.titulo}**\n${n.objetivo}\n\n`;
  out += `**Campo de aplicación:** ${n.campo}\n`;
  out += `**Requisitos clave:** ${n.requisitos}\n`;
  if (cats) out += `**Clasificación:** ${cats}\n`;
  return out;
}

function formatActualizacion(a) {
  const estadoLabel = {
    actualizada: '🆕 Actualizada',
    reemplazada: '🆕 Reemplazada',
    en_revision: '⏳ En revisión (sin edición nueva publicada aún)',
    no_verificable: '⚠️ No verificable en fuentes públicas',
    vigente: '✅ Vigente sin cambios',
    vigente_sin_cambios: '✅ Vigente sin cambios',
    con_modificaciones: '🆕 Con modificaciones recientes',
    en_transicion: '🆕 En transición a nueva edición',
    enmendada: '🆕 Enmendada',
  }[a.estado] || a.estado;
  return `**${a.norma}** — ${estadoLabel}\n${a.detalle}`;
}

function respuestaPorFamilia(fam) {
  const label = (familias[fam] && familias[fam].label) || fam;
  const items = itemsDeFamilia(fam);
  const acts = actualizacionesDeFamilia(fam);

  let out = `**Clasificación — ${label}**\n`;
  if (items.length) {
    out += items.map(i => `- ${i.nombre} — Norma: ${i.norma} — ${i.motivo}`).join('\n');
  } else {
    out += '- No hay ítems específicos cargados para esta categoría todavía.';
  }

  if (acts.length) {
    out += '\n\n**Actualizaciones normativas recientes en esta categoría**\n';
    out += acts.map(a => `- ${a.norma} (${a.estado}): ${a.detalle}`).join('\n');
  }
  return out;
}

function respuestaPorProducto(item) {
  let out = `**${item.nombre}**\n- Norma: ${item.norma}\n- Motivo: ${item.motivo}`;
  // Si alguna norma citada en item.norma tiene actualización conocida, la agrega
  const normaNorm = normalizar(item.norma);
  const relacionadas = actualizaciones.filter(a => normaNorm.includes(normalizar(a.norma).split(/[:\-]/)[0].trim()));
  if (relacionadas.length) {
    out += '\n\n**Dato a verificar**\n' + relacionadas.map(formatActualizacion).join('\n');
  }
  return out;
}

const SUGERENCIAS_FALLBACK = `No encontré una coincidencia clara con esa pregunta en el catálogo de BuscaEPP.

Prueba con:
- El nombre de una categoría (ej. "guantes", "calzado", "protección contra caídas").
- El código de una norma (ej. "NCh 461", "EN 388", "ANSI Z87.1").
- El nombre de un producto (ej. "casco dieléctrico", "botín de seguridad").

O elige directamente una opción del panel izquierdo.`;

/**
 * Responde una pregunta en lenguaje natural usando únicamente la base de
 * conocimiento local (normas.json, epp_info.json, familias.json,
 * actualizaciones_2024_2026.json). No hace llamadas externas.
 */
function responder(mensaje) {
  const textoNorm = normalizar(mensaje);

  // 1) ¿Coincide con un código de norma exacto del glosario?
  const { matches: normasCoincidentes, actMatches } = buscarPorCodigoNorma(textoNorm);
  if (normasCoincidentes.length) {
    let out = normasCoincidentes.map(formatNorma).join('\n\n');
    const actsDeEstasNormas = actualizaciones.filter(a =>
      normasCoincidentes.some(c => normalizar(a.norma).startsWith(normalizar(c)))
    );
    if (actsDeEstasNormas.length) {
      out += '\n**Actualización reciente**\n' + actsDeEstasNormas.map(formatActualizacion).join('\n');
    }
    return out.trim();
  }
  if (actMatches.length) {
    return actMatches.map(formatActualizacion).join('\n\n');
  }

  // 2) ¿Coincide con el nombre de un producto específico del catálogo?
  const producto = buscarPorProducto(textoNorm);

  // 3) ¿Coincide con una familia/categoría de EPP?
  const familiasCoincidentes = buscarPorFamilia(textoNorm);

  if (familiasCoincidentes.length && producto) {
    // Si matchea ambos, prioriza el producto específico pero menciona la familia
    return respuestaPorProducto(producto);
  }
  if (producto) {
    return respuestaPorProducto(producto);
  }
  if (familiasCoincidentes.length) {
    return familiasCoincidentes.map(respuestaPorFamilia).join('\n\n---\n\n');
  }

  return SUGERENCIAS_FALLBACK;
}

module.exports = { responder };

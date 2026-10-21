// Motor de respuesta 100% basado en reglas — sin llamadas a ningún modelo de IA,
// sin costo por uso. Igual patrón que el asesor "BuscaIgni" ya existente en
// index.html: detecta palabras clave y arma la respuesta con datos predefinidos.
//
// DISEÑO PARA DOS PERFILES DE USUARIO (ejecutivos GOVAK en terreno):
//  1) PREVENCIONISTA DE RIESGOS (cliente técnico): necesita el detalle normativo
//     exacto — campo de aplicación, requisitos de ensayo, clasificación técnica.
//  2) COMPRADOR / ADQUISICIONES (cliente no técnico, foco en precio): necesita
//     una explicación simple de "qué es, para qué sirve y por qué no es opcional
//     comprar el EPP correcto" — sin tecnicismos, con el argumento legal/costo.
// Por eso cada respuesta normativa trae AMBOS bloques en un solo mensaje: el
// ejecutivo lee lo técnico si el cliente es prevencionista, o lee directo el
// bloque "En simple" si el cliente es comprador — sin tener que cambiar de modo.

const { normas, eppInfo, familias, actualizaciones, pictogramas, certificadores } = require('./knowledgeBase');

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
  // Compara contra las claves exactas del glosario NORMAS (34 códigos, incluye "Ley 16744")
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
  // Compara también contra los códigos citados en "actualizaciones" (ediciones más específicas,
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

// Sinónimos de la "ley madre" — la gente rara vez escribe "Ley 16744" tal cual
const ALIAS_LEY_MADRE = ['ley madre', 'ley 16744', '16744', 'ley de accidentes del trabajo', 'seguro social del trabajo'];

function esConsultaLeyMadre(textoNorm) {
  return ALIAS_LEY_MADRE.some(a => textoNorm.includes(normalizar(a)));
}

// Palabras que disparan la explicación de pictogramas (hoy: guantes EN 388/511/374/407)
const ALIAS_PICTOGRAMA = ['pictograma', 'simbolo', 'icono del guante', 'que significa el numero'];

function esConsultaPictograma(textoNorm) {
  return ALIAS_PICTOGRAMA.some(a => textoNorm.includes(normalizar(a)));
}

// Palabras que disparan la explicación de "quién certifica" un EPP/norma
const ALIAS_CERTIFICACION = ['certifica', 'certificacion', 'certificado', 'quien avala', 'quien acredita'];

function esConsultaCertificacion(textoNorm) {
  return ALIAS_CERTIFICACION.some(a => textoNorm.includes(normalizar(a)));
}

function buscarFamiliaEnTexto(textoNorm) {
  // Reutiliza buscarPorFamilia (definida más abajo) — se declara aquí para orden de lectura,
  // pero en JS las function declarations se "hoistean", así que esto funciona sin problema.
  return buscarPorFamilia(textoNorm);
}

// Determina el certificador/fiscalizador de un código de norma según su prefijo
// (NCh, ANSI, EN, ISO, IEC, NFPA, OSHA, DS, Ley, MOP, AS/NZS). Esto evita tener
// que mantener el dato "a mano" en cada una de las 34 normas: basta una tabla
// por prefijo (certificadores.json) y se resuelve automáticamente.
function certificadorDe(codigoNorma) {
  const codigo = codigoNorma.toUpperCase();
  const prefijos = ['ANSI/ISEA', 'ANSI/ASSP', 'AS/NZS', 'NCh', 'ANSI', 'EN ISO', 'ISO', 'EN', 'IEC', 'NFPA', 'OSHA', 'DS', 'Ley', 'MOP'];
  for (const p of prefijos) {
    if (codigo.startsWith(p.toUpperCase())) {
      const clave = p === 'EN ISO' ? 'EN' : p; // "EN ISO 11612" se trata como norma europea EN
      if (certificadores[clave]) return certificadores[clave];
    }
  }
  // Si el código combina varias normas (ej. "NCh 772/1 / EN ISO 20345"), busca el primer prefijo reconocible
  for (const p of prefijos) {
    if (codigo.includes(p.toUpperCase())) return certificadores[p === 'EN ISO' ? 'EN' : p];
  }
  return null;
}

function formatCertificacion(codigos) {
  const vistos = new Set();
  const lineas = [];
  for (const codigo of codigos) {
    const cert = certificadorDe(codigo);
    if (cert && !vistos.has(cert)) {
      vistos.add(cert);
      lineas.push(`- **${codigo}:** ${cert}`);
    }
  }
  if (!lineas.length) return '';
  return `\n**¿Quién certifica esto?**\n${lineas.join('\n')}\n*(Dato general: ${certificadores._general})*`;
}

// Norma "principal" de referencia por familia — se usa cuando la pregunta
// pide explícitamente la clasificación/tipos/requisitos de una familia
// (ej. "qué tipos de casco hay", "qué requisitos debe tener un calzado de
// seguridad") para anteponer la ficha normativa completa (con su
// clasificación técnica y el resumen simple) antes del listado de productos.
const NORMA_PRINCIPAL_POR_FAMILIA = {
  cabeza: 'NCh 461',
  calzado: 'NCh 772/1',
  guantes: 'NCh 1805',
  auditiva: 'NCh 1358',
  visual: 'NCh 1301',
  respiratoria: 'NCh 2176',
  caidas: 'NCh 2929',
  ignifugo: 'EN ISO 11612 / NFPA 2112',
};
const ALIAS_PIDE_CLASIFICACION = ['tipo', 'tipos', 'clasificacion', 'clasifican', 'categoria', 'categorias', 'requisito', 'requisitos', 'clase', 'clases'];

function pideClasificacionOTipos(textoNorm) {
  return ALIAS_PIDE_CLASIFICACION.some(a => new RegExp('\\b' + a).test(textoNorm));
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
  if (n.resumenSimple) {
    out += `\n💬 **En simple (para el comprador):**\n${n.resumenSimple}\n`;
  }
  out += formatCertificacion([codigo]);
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
  // Códigos de norma citados en item.norma (puede traer varios separados por "/")
  const codigosCitados = item.norma.split('/').map(s => s.trim()).filter(Boolean);
  out += formatCertificacion(codigosCitados);
  return out;
}

function formatPictogramaGuante() {
  const p = pictogramas.guantes;
  if (!p) return '';
  let out = `**Pictogramas del guante de seguridad** (${p.norma})\n${p.resumenSimple}\n\n`;
  out += p.tipos.map(t => `**${t.pictograma}**\n${t.significa}${t.detalle ? '\n' + t.detalle.map(d => `  - ${d}`).join('\n') : ''}\n*En simple:* ${t.simple}`).join('\n\n');
  out += `\n\n📌 ${p.nota_compra}`;
  return out;
}

function respuestaLeyMadre() {
  return formatNorma('Ley 16744');
}

const SUGERENCIAS_FALLBACK = `No encontré una coincidencia clara con esa pregunta en el catálogo de BuscaEPP.

Prueba con:
- El nombre de una categoría (ej. "guantes", "calzado", "protección contra caídas").
- El código de una norma (ej. "NCh 461", "EN 388", "ANSI Z87.1") o "Ley 16744" / "ley madre".
- El nombre de un producto (ej. "casco dieléctrico", "botín de seguridad").
- "pictograma del guante" o "quién certifica" un EPP.

O elige directamente una opción del panel izquierdo.`;

/**
 * Responde una pregunta en lenguaje natural usando únicamente la base de
 * conocimiento local (normas.json, epp_info.json, familias.json,
 * actualizaciones_2024_2026.json, pictogramas.json, certificadores.json).
 * No hace llamadas externas. Cada respuesta normativa incluye un bloque
 * técnico (para el cliente prevencionista) y uno simple + certificación
 * (para el cliente comprador/adquisiciones), en un solo mensaje.
 */
function responder(mensaje) {
  const textoNorm = normalizar(mensaje);

  // 0) ¿Pregunta por la "ley madre" (Ley 16744) con alguno de sus sinónimos
  //    habituales ("ley madre", "16744"), que no calzan con el patrón exacto
  //    de código de norma?
  if (esConsultaLeyMadre(textoNorm)) {
    return respuestaLeyMadre();
  }

  // 0bis) ¿Pregunta por el significado de un pictograma (hoy: guantes)?
  if (esConsultaPictograma(textoNorm)) {
    const fams = buscarFamiliaEnTexto(textoNorm);
    if (!fams.length || fams.includes('guantes')) {
      return formatPictogramaGuante();
    }
    // Pictograma de otra familia: aún no cargado, se informa en vez de dar fallback genérico
    return `Por ahora solo tengo cargado el detalle de pictogramas para **guantes** (EN 388/511/374/407). Para esa familia escribe "pictograma del guante".`;
  }

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

  // 3bis) Si la pregunta además menciona "certifica/certificación" pero no
  // calzó con un código de norma exacto (ej. "¿quién certifica los cascos?"),
  // responde con el certificador de todas las normas citadas en esa familia
  // o producto, en vez de caer directo al fallback.
  if (esConsultaCertificacion(textoNorm) && !normasCoincidentes.length) {
    let codigosRelevantes = [];
    if (producto) codigosRelevantes = producto.norma.split('/').map(s => s.trim());
    else if (familiasCoincidentes.length) {
      familiasCoincidentes.forEach(fam => {
        itemsDeFamilia(fam).forEach(i => codigosRelevantes.push(...i.norma.split('/').map(s => s.trim())));
      });
    }
    if (codigosRelevantes.length) {
      const cert = formatCertificacion([...new Set(codigosRelevantes)]);
      if (cert) return cert.trim();
    }
    // Pregunta genérica ("¿quién certifica los EPP en Chile?") sin EPP específico
    return `**¿Quién certifica los EPP en Chile?**\n${certificadores._general}\n\nEn términos generales:\n- Normas chilenas (NCh): ${certificadores['NCh']}\n- Normas internacionales (ANSI/EN/ISO): certificadas por organismos acreditados del país de origen (ej. SEI/UL en EE.UU., TÜV/SGS/Bureau Veritas en la UE).\n- Decretos/reglamentos (DS 594, Ley 16744): no se "certifican", se fiscalizan — por la Dirección del Trabajo y las Mutualidades/ISL.`;
  }

  if (familiasCoincidentes.length && producto) {
    // Si matchea ambos, prioriza el producto específico pero menciona la familia
    return respuestaPorProducto(producto);
  }
  if (producto) {
    return respuestaPorProducto(producto);
  }
  if (familiasCoincidentes.length) {
    // Si la pregunta pide explícitamente "tipos", "clasificación" o
    // "requisitos" de la familia, antepone la ficha normativa principal
    // (clasificación técnica + resumen simple + certificador) antes del
    // listado de productos — responde directamente "qué tipos de casco hay"
    // o "qué requisitos debe tener un calzado de seguridad".
    if (pideClasificacionOTipos(textoNorm)) {
      const bloques = familiasCoincidentes.map(fam => {
        const normaPrincipal = NORMA_PRINCIPAL_POR_FAMILIA[fam];
        const fichaNorma = normaPrincipal ? formatNorma(normaPrincipal) : '';
        const listado = respuestaPorFamilia(fam);
        return fichaNorma ? `${fichaNorma}\n\n${listado}` : listado;
      });
      return bloques.join('\n\n---\n\n');
    }
    return familiasCoincidentes.map(respuestaPorFamilia).join('\n\n---\n\n');
  }

  return SUGERENCIAS_FALLBACK;
}

module.exports = { responder };

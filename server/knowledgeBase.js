// Carga y serializa la base de conocimiento extraída de BuscaEPP (index.html)
// para inyectarla en el system prompt del agente.

const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, '..', 'knowledge');

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(KB_DIR, file), 'utf8'));
}

const normas = loadJSON('normas.json');           // 34 normas: titulo, objetivo, campo, requisitos, categorias, tags, resumenSimple
const eppInfo = loadJSON('epp_info.json');        // ~72 items de producto: nombre, norma, motivo
const familias = loadJSON('familias.json');       // 17 familias con label e icono
const actualizaciones = loadJSON('actualizaciones_2024_2026.json'); // cambios normativos recientes
const pictogramas = loadJSON('pictogramas.json'); // significado de pictogramas (guantes: EN 388/511/374/407)
const certificadores = loadJSON('certificadores.json'); // quién certifica/fiscaliza cada norma, por prefijo de código
const estudiaConBuscaEpp = loadJSON('estudia_con_buscaepp.json'); // 190 preguntas y respuestas de las guías técnicas "Estudia con BuscaEPP" (buscaepp.cl, Zona VIP)

// Serializa el glosario de normas en un bloque de texto compacto
function serializarNormas() {
  return Object.entries(normas).map(([codigo, n]) => {
    const cats = (n.categorias || []).join(', ');
    return `### ${codigo} — ${n.titulo}\nObjetivo: ${n.objetivo}\nCampo de aplicación: ${n.campo}\nRequisitos clave: ${n.requisitos}\nClasificación/categorías: ${cats}`;
  }).join('\n\n');
}

// Serializa el catálogo de clasificación de productos por familia
function serializarCatalogo() {
  const porFamilia = {};
  for (const [id, item] of Object.entries(eppInfo)) {
    const fam = item.family || inferirFamilia(id, item);
    if (!porFamilia[fam]) porFamilia[fam] = [];
    porFamilia[fam].push(`- ${item.nombre} (${item.icono || ''}) — Norma: ${item.norma} — ${item.motivo}`);
  }
  return Object.entries(porFamilia).map(([fam, items]) => {
    const label = (familias[fam] && familias[fam].label) || fam;
    return `## ${label}\n${items.join('\n')}`;
  }).join('\n\n');
}

// Los items de EPP_INFO no siempre traen "family" explícito; se infiere por palabras clave como respaldo
function inferirFamilia(id, item) {
  const texto = (id + ' ' + item.nombre).toLowerCase();
  if (/casco/.test(texto)) return 'cabeza';
  if (/lente|gafa|careta|visual|pantalla facial/.test(texto)) return 'visual';
  if (/tapon|orejera|auditiv/.test(texto)) return 'auditiva';
  if (/respirador|mascarilla|filtro|autorescat/.test(texto)) return 'respiratoria';
  if (/guante/.test(texto)) return 'guantes';
  if (/bot[ií]n|bota|calzado/.test(texto)) return 'calzado';
  if (/arn[eé]s|ca[ií]da|l[ií]nea de vida/.test(texto)) return 'caidas';
  if (/ignif|arco el[eé]ctrico|fr\b/.test(texto)) return 'ignifugo';
  if (/soldad/.test(texto)) return 'soldador';
  if (/reflectante|alta visibilidad|chaleco/.test(texto)) return 'vial';
  if (/gas|detector/.test(texto)) return 'gases';
  if (/rodillera|delantal|bata|impermeable|protector lumbar|faja/.test(texto)) return 'ropa';
  return 'ropa';
}

function serializarActualizaciones() {
  return actualizaciones.map(a =>
    `- ${a.norma} [${a.familia}] — estado: ${a.estado}. ${a.detalle}`
  ).join('\n');
}

function construirBaseConocimiento() {
  return [
    '# GLOSARIO DE NORMAS (33 normas con objetivo, campo de aplicación, requisitos y clasificación)',
    serializarNormas(),
    '',
    '# CATÁLOGO DE CLASIFICACIÓN DE PRODUCTOS POR FAMILIA (qué tipos existen y qué norma les aplica)',
    serializarCatalogo(),
    '',
    '# ACTUALIZACIONES NORMATIVAS VERIFICADAS (2024-2026) — usar esto como la información más reciente conocida',
    serializarActualizaciones(),
  ].join('\n');
}

module.exports = {
  normas,
  eppInfo,
  familias,
  actualizaciones,
  pictogramas,
  certificadores,
  estudiaConBuscaEpp,
  construirBaseConocimiento,
};

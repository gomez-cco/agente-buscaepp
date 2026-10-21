# EPPI — Asistente interactivo de normas EPP (BuscaEPP)

Réplica del patrón de **ALLEXCEL** (chat + sidebar con temario/categorías),
aplicado al catálogo y normativa de **BuscaEPP.cl**.

**Sin IA, sin costo por uso.** EPPI no llama a ningún modelo ni API externa: responde con
información pre-establecida, igual que el módulo "BuscaIgni" que ya existe en `index.html`
de BuscaEPP. Todas las respuestas se calculan localmente, de forma instantánea y gratuita,
a partir de los archivos JSON de conocimiento.

## Para quién está pensado: los dos perfiles de cliente

EPPI está diseñado para que el ejecutivo GOVAK lo use **en terreno, frente al cliente**, sin
importar qué tipo de cliente tenga enfrente:

1. **Prevencionista de riesgos (cliente técnico):** necesita el detalle normativo exacto —
   campo de aplicación, requisitos de ensayo, clasificación técnica (niveles, clases, tipos).
2. **Comprador / adquisiciones (cliente no técnico, foco en precio):** necesita una explicación
   simple de qué es, para qué sirve y por qué no es opcional comprar el EPP correcto — con el
   argumento legal y de costo (multas, fiscalización, responsabilidad del empleador).

Por eso **cada respuesta normativa trae ambos bloques en un solo mensaje**: el ejecutivo no
tiene que "cambiar de modo" — lee el bloque técnico si corresponde, o va directo al bloque
"💬 En simple (para el comprador)" si el cliente es de adquisiciones. Toda respuesta sobre una
norma también agrega automáticamente **quién la certifica o fiscaliza** (INN y sus organismos
acreditados para normas NCh, SEI/UL para ANSI, organismos notificados de la UE para EN/ISO,
Dirección del Trabajo y Mutualidades para decretos y leyes).

## Qué hace

- El usuario pregunta ("¿qué guantes uso para manipular ácidos?", "¿qué norma aplica a los cascos?",
  "NCh 461", "qué tipos de casco hay", "qué significa el pictograma del guante", "quién certifica
  el calzado de seguridad", "ley 16744" / "ley madre").
- El motor local (`server/matcher.js`) detecta palabras clave, códigos de norma y nombres de
  producto, y arma la respuesta con los datos pre-cargados en `knowledge/`:
  - 34 normas con objetivo, campo de aplicación, requisitos, clasificación y resumen simple
    (`knowledge/normas.json`) — incluye la **Ley 16.744** ("ley madre" de la prevención en Chile).
  - ~72 ítems del catálogo de productos con su norma y motivo (`knowledge/epp_info.json`).
  - 17 familias de EPP (`knowledge/familias.json`).
  - Actualizaciones normativas verificadas 2024–2026 (`knowledge/actualizaciones_2024_2026.json`).
  - Significado de los pictogramas del guante — EN 388/511/374/407 (`knowledge/pictogramas.json`).
  - Quién certifica o fiscaliza cada norma, por prefijo de código (`knowledge/certificadores.json`).
- El sidebar izquierdo muestra:
  - **Cómo elegir tu EPP** — accesos rápidos a preguntas típicas.
  - **Categorías de EPP** — las 17 familias (cascos, visual, guantes, calzado, caídas, etc.), cargadas desde `/api/sidebar`.
  - **Temario normativo** — las 34 normas del glosario (incluye Ley 16.744), cargadas desde el mismo endpoint.
  - Click en cualquier ítem dispara la pregunta correspondiente en el chat.

## Cómo responde (sin IA)

`server/matcher.js` sigue este orden de prioridad para cada pregunta:
0. ¿Pregunta por la "ley madre" / "16744" / "ley 16744"? → devuelve la Ley 16.744 completa (objetivo, obligaciones del empleador, resumen simple y quién la administra/fiscaliza).
0bis. ¿Pregunta por un "pictograma" (hoy: guantes)? → devuelve el significado de cada símbolo (EN 388/511/374/407), técnico + en simple.
1. ¿Menciona un código de norma exacto del glosario (ej. "NCh 461", "EN 388")? → devuelve la ficha completa: técnica + "en simple" + quién certifica.
2. ¿Coincide con el nombre de un producto del catálogo (ej. "casco dieléctrico")? → devuelve norma + motivo + quién certifica esa norma.
3. ¿Coincide con una familia/categoría (ej. "guantes", "calzado", "caídas")? → devuelve la clasificación completa de esa familia con todos sus ítems y norma. Si la pregunta además pide "tipos", "clasificación" o "requisitos" (ej. "qué tipos de casco hay"), antepone la ficha normativa principal de esa familia con su clasificación técnica completa.
3bis. ¿Pregunta "quién certifica" sin dar un código exacto (ej. "¿quién certifica los cascos?")? → resuelve el certificador de todas las normas de esa familia/producto, o da la explicación general si la pregunta es genérica.
4. Si no hay coincidencia clara, sugiere ejemplos de preguntas y las opciones del panel lateral.

Si una norma tiene una actualización 2024-2026 conocida, se agrega automáticamente a la respuesta.
El certificador/fiscalizador de cada norma se resuelve automáticamente por el **prefijo** del
código (NCh, ANSI, EN, ISO, IEC, NFPA, OSHA, DS, Ley, MOP, AS/NZS) contra `knowledge/certificadores.json`
— así una norma nueva que se agregue al glosario ya "hereda" quién la certifica sin tener que
escribirlo a mano.

## Estructura

```
buscaepp-agente/
├── knowledge/            # Base de conocimiento (JSON) extraída de BuscaEPP
│   ├── normas.json              # 34 normas (incluye Ley 16.744)
│   ├── epp_info.json            # ~72 productos del catálogo
│   ├── familias.json            # 17 familias de EPP
│   ├── actualizaciones_2024_2026.json
│   ├── pictogramas.json         # Significado de pictogramas del guante (EN 388/511/374/407)
│   └── certificadores.json      # Quién certifica/fiscaliza cada norma, por prefijo
├── server/
│   ├── server.js         # Express + endpoint /api/ask y /api/sidebar (sin IA)
│   ├── matcher.js         # Motor de reglas: detecta palabras clave y arma la respuesta
│   └── knowledgeBase.js  # Carga los JSON de conocimiento
├── public/                # Frontend estático (sin build step)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/            # Logos de BuscaEPP y GOVAK
├── render.yaml            # Blueprint de despliegue en Render
└── package.json
```

## Correr en local

```bash
npm install
npm start
```

Abre `http://localhost:3000`. No se necesita ninguna API key ni variable de entorno.

## Desplegar en Render

1. Crea un repo nuevo en GitHub (ej. `buscaepp-agente`) y sube esta carpeta completa.
2. En Render: **New → Web Service** → conecta el repo.
3. Render detecta `render.yaml` automáticamente (Blueprint). Si no, configura a mano:
   - Build command: `npm install`
   - Start command: `npm start`
   - Runtime: Node
4. No hace falta configurar ninguna variable de entorno ni clave de API.
5. Deploy. Render te da una URL tipo `https://buscaepp-agente.onrender.com`.

## Actualizar la base de conocimiento

Si BuscaEPP agrega normas o productos nuevos al catálogo de `index.html`, vuelve a exportar
los bloques `const NORMAS = {...}` y `const EPP_INFO = {...}` a `knowledge/normas.json` y
`knowledge/epp_info.json` (o pide que se regeneren), y reinicia el servicio en Render — no
requiere cambios de código. Para que el motor de reglas reconozca nuevas palabras clave de
familia, se agregan a `ALIAS_FAMILIA` en `server/matcher.js`.

## Notas

- No hay memoria de conversación entre preguntas (cada pregunta se responde de forma
  independiente), porque no hay un modelo de lenguaje manteniendo contexto — es consistente
  con que las respuestas sean instantáneas y gratuitas.
- No hay autenticación: es un asistente público, igual que ALLEXCEL.
- El nombre "EPPI" y los colores (ámbar/negro, tomados de `--accent`/`--bg` del tema oscuro de BuscaEPP)
  se pueden cambiar fácilmente en `public/styles.css` e `index.html`.

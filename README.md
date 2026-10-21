# EPPI — Asistente interactivo de normas EPP (BuscaEPP)

Réplica del patrón de **ALLEXCEL** (chat + sidebar con temario/categorías),
aplicado al catálogo y normativa de **BuscaEPP.cl**.

**Sin IA, sin costo por uso.** EPPI no llama a ningún modelo ni API externa: responde con
información pre-establecida, igual que el módulo "BuscaIgni" que ya existe en `index.html`
de BuscaEPP. Todas las respuestas se calculan localmente, de forma instantánea y gratuita,
a partir de los archivos JSON de conocimiento.

## Qué hace

- El usuario pregunta ("¿qué guantes uso para manipular ácidos?", "¿qué norma aplica a los cascos?",
  "NCh 461").
- El motor local (`server/matcher.js`) detecta palabras clave, códigos de norma y nombres de
  producto, y arma la respuesta con los datos pre-cargados en `knowledge/`:
  - 33 normas con objetivo, campo de aplicación, requisitos y clasificación (`knowledge/normas.json`).
  - ~72 ítems del catálogo de productos con su norma y motivo (`knowledge/epp_info.json`).
  - 17 familias de EPP (`knowledge/familias.json`).
  - Actualizaciones normativas verificadas 2024–2026 (`knowledge/actualizaciones_2024_2026.json`).
- El sidebar izquierdo muestra:
  - **Cómo elegir tu EPP** — accesos rápidos a preguntas típicas.
  - **Categorías de EPP** — las 17 familias (cascos, visual, guantes, calzado, caídas, etc.), cargadas desde `/api/sidebar`.
  - **Temario normativo** — las 33 normas del glosario, cargadas desde el mismo endpoint.
  - Click en cualquier ítem dispara la pregunta correspondiente en el chat.

## Cómo responde (sin IA)

`server/matcher.js` sigue este orden de prioridad para cada pregunta:
1. ¿Menciona un código de norma exacto del glosario (ej. "NCh 461", "EN 388")? → devuelve la ficha completa de esa norma.
2. ¿Coincide con el nombre de un producto del catálogo (ej. "casco dieléctrico")? → devuelve norma + motivo de ese producto.
3. ¿Coincide con una familia/categoría (ej. "guantes", "calzado", "caídas")? → devuelve la clasificación completa de esa familia con todos sus ítems y norma.
4. Si no hay coincidencia clara, sugiere ejemplos de preguntas y las opciones del panel lateral.

Si una norma tiene una actualización 2024-2026 conocida, se agrega automáticamente a la respuesta.

## Estructura

```
buscaepp-agente/
├── knowledge/            # Base de conocimiento (JSON) extraída de BuscaEPP
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

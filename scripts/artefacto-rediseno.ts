// =============================================================================
// artefacto-rediseno — la página «Rediseño en curso» que ve Martín
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/artefacto-rediseno.ts <salida.html>
//
// Genera el HTML del artefacto que se publica en claude.ai/code/artifact. La
// gracia: la barra y los íconos NO se escriben a mano acá — salen de
// app/_components/nav.ts y app/_components/icons.tsx. Si la navegación cambia y
// nadie regenera, la página no miente: queda vieja entera, no a medias.
//
// Vive en el repo a propósito. El artefacto se va actualizando a lo largo de
// muchas sesiones, y una sesión nueva no tiene forma de saber qué había en la
// anterior salvo que el generador esté versionado con el resto.
//
// Para publicarlo: correr esto y pasarle el archivo a la herramienta Artifact
// con la MISMA url, así conserva el link.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { FAMILIAS, MAKO_NAV, USER_NAV, type NavItem } from '../app/_components/nav';

const SALIDA = process.argv[2] ?? 'rediseno.html';
const ICONS = readFileSync('app/_components/icons.tsx', 'utf8');

// ── Los íconos, sacados del archivo real ────────────────────────────────────
/** Corta el JSX de una entrada `nombre: (…)` del mapa PATHS, balanceando (). */
function jsxDe(nombre: string): string {
  const marca = `\n  ${nombre}: (`;
  const i = ICONS.indexOf(marca);
  if (i < 0) return '';
  let j = i + marca.length, prof = 1;
  while (prof > 0 && j < ICONS.length) {
    if (ICONS[j] === '(') prof++;
    else if (ICONS[j] === ')') prof--;
    j++;
  }
  return ICONS.slice(i + marca.length, j - 1);
}

/** JSX → SVG: los atributos camelCase del JSX no existen en HTML. */
const aSvg = (jsx: string) => jsx
  .replace(/<>|<\/>/g, '')
  .replace(/strokeWidth=/g, 'stroke-width=')
  .replace(/strokeLinecap=/g, 'stroke-linecap=')
  .replace(/strokeLinejoin=/g, 'stroke-linejoin=')
  .replace(/fillRule=/g, 'fill-rule=')
  .replace(/clipRule=/g, 'clip-rule=')
  .replace(/strokeOpacity=/g, 'stroke-opacity=')
  .replace(/\{'([^']*)'\}/g, '"$1"')
  .trim();

const ico = (nombre: string, size = 19) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${aSvg(jsxDe(nombre))}</svg>`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── La barra, en el orden en que se ve ──────────────────────────────────────
const fila = (it: NavItem, dentro = false) => `
    <div class="tab${dentro ? ' dentro' : ''}">
      ${ico(it.icon)}
      <span class="t">${esc(it.label)}</span>
      <code>${esc(it.href)}</code>
      ${it.comingSoon ? '<span class="pronto">pronto</span>' : ''}
    </div>`;

const barra = FAMILIAS.map((f) => `
  <section class="fam">
    <div class="fam__cab">
      ${ico(f.icon, 17)}
      <span class="fam__n">${esc(f.label)}</span>
      <span class="fam__q">${esc(f.pregunta)}</span>
    </div>
    <div class="caja">
      ${f.bloques.map((b, i) => `<div class="bloque${i ? ' sep' : ''}">${b.map((it) => fila(it)).join('')}</div>`).join('')}
      ${(f.grupos ?? []).map((g) => `
      <div class="bloque sep">
        <div class="grupo">${ico(g.icon)}<span class="t">${esc(g.label)}</span><span class="chev">›</span></div>
        <div class="hijos">${g.items.map((it) => fila(it, true)).join('')}</div>
      </div>`).join('')}
    </div>
  </section>`).join('');

const extras = `
  <section class="fam">
    <div class="fam__cab"><span class="fam__n">Fuera de las familias</span></div>
    <div class="caja">
      <div class="bloque">${MAKO_NAV.map((it) => fila(it)).join('')}</div>
      <div class="bloque sep">${USER_NAV.map((it) => fila(it)).join('')}</div>
    </div>
    <p class="nota">Arriba, la capacidad global de MaKo. Abajo, lo que vive detrás del avatar — más el saldo de IA.</p>
  </section>`;

// ── Bitácora: qué se fue cambiando, en orden ────────────────────────────────
type Entrada = { fecha: string; titulo: string; puntos: string[] };
const BITACORA: Entrada[] = [
  {
    fecha: '6 ago',
    titulo: 'Parte 1 · Los cimientos',
    puntos: [
      'Un solo dorado: había <b>cuatro</b> para la misma marca. Ahora es <code>#F2B01E</code>, el del logo.',
      'El warning dejó de ser un tercer dorado y pasó a naranja: era imposible que «cuidado» no se leyera como «MaKo».',
      'Biblioteca de primitives en <code>app/_ui</code>: botones con sus siete estados, campos, selects, badges.',
      'Los ocho estados de pantalla. Faltaban <b>cuatro enteros</b>: cero apariciones en todo el repositorio.',
      'Una sola confirmación (había dos, y ninguna mandaba) y un solo campo de texto (había tres).',
      'Mobile adentro del sistema: la tipografía y el área táctil suben solas en pantalla chica.',
    ],
  },
  {
    fecha: '6 ago',
    titulo: 'Parte 2 · La navegación por intención',
    puntos: [
      'La barra dejó de ser el inventario de módulos y pasó a agruparse por para qué la abrís.',
      'Se fue el <b>flyout</b> que escondía WhatsApp y Chat Agent detrás de un hover.',
      'PageHeader con una línea de propósito: qué pregunta responde cada pantalla.',
      'Corrección sobre la Parte 1: la escala tipográfica del documento son <b>siete</b> niveles con base 14, no cuatro con base 15.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Las correcciones de la barra',
    puntos: [
      'Se fue <b>Focus</b> (una familia entera para una sola pantalla) y «General» pasó a ser lo primero de Operate.',
      'Se fueron <b>MaKo Doer</b> (era el mismo chat que /mako) y <b>DM Writer</b> (lo hace el Chatbot).',
      'El saldo de IA se mudó al desplegable del perfil: visible, nunca protagonista.',
      'El logo dejó de tener «Marketing OS» debajo y pasó a ser un link a General.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Tres bugs con la misma raíz',
    puntos: [
      'La sección se cerraba sola: la familia desplegada se recalculaba en cada render y se reseteaba al salir el cursor. Ahora es estado y tu elección se queda.',
      'El desplegable salía corrido: se posicionaba midiendo la barra <b>mientras</b> el ancho iba de 68 a 244 px. Ahora se calcula del ancho final.',
      '«Pasan cosas raras»: <code>Familia</code> y <code>GrupoFila</code> estaban declaradas dentro del render, así que React desmontaba la navegación entera en cada cambio de estado.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'El hover que nunca se veía',
    puntos: [
      'La regla <code>.mk-navrow:hover</code> estaba escrita hacía tres commits y no se aplicaba <b>nunca</b>: el componente ponía <code>background: transparent</code> en línea, y un inline le gana a cualquier regla de hoja.',
      'Las secciones sí reaccionaban por casualidad — su hover cambia <code>opacity</code> con <code>!important</code>.',
      'Ahora el color, el fondo y el peso viven en la clase; el estilo en línea solo lleva geometría.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Content Machine y Sales Machine',
    puntos: [
      'Content Machine pasó a ser sección propia: Ideas suelto arriba y tres desplegables por canal, con la marca de cada uno.',
      'Sales Machine reemplaza a Create, en tres bloques que son las tres etapas del embudo: capturar, conversar, cerrar.',
      'Trece rutas nuevas, todas con el nombre igual al path, todas con el chip «pronto»: no hay backend y prometer un canal que no existe es peor que no tenerlo.',
    ],
  },
  {
    fecha: '7 ago',
    titulo: 'Los íconos, y la trampa del blanco',
    puntos: [
      'Diecisiete íconos nuevos, convertidos de archivos de 1500×1500 al set de 24.',
      'Cada uno se escala y se centra por su <b>caja de tinta</b>: si no, dos dibujos con el mismo lienzo pero distinto margen se ven de tamaños distintos en la misma columna.',
      'En estos exports el blanco <b>no es fondo, es el hueco</b>. Repintado con <code>currentColor</code> convertía el círculo en una mancha maciza.',
      'Me equivoqué dos veces razonándolo, así que el conversor ahora se verifica preguntándole al navegador con <code>isPointInFill</code>, que es quien resuelve el fill-rule de verdad.',
    ],
  },
];

const bitacora = BITACORA.map((e, i) => `
  <li class="hito">
    <div class="hito__n">${String(i + 1).padStart(2, '0')}</div>
    <div class="hito__c">
      <div class="hito__t">${e.titulo}<span class="hito__f">${e.fecha}</span></div>
      <ul class="lista">${e.puntos.map((p) => `<li>${p}</li>`).join('')}</ul>
    </div>
  </li>`).join('');

// ── Las nueve partes ────────────────────────────────────────────────────────
const PARTES: [string, string, 'ok' | 'next' | 'wait'][] = [
  ['Los cimientos', 'Un solo dorado · biblioteca de primitives · los 8 estados · bases mobile', 'ok'],
  ['App Shell', 'Navegación por intención · PageHeader · Section', 'ok'],
  ['Gramática de MaKo', 'Los 9 estados de la IA · unificar el Semáforo', 'next'],
  ['Second Brain', 'Selector de contexto · ciclo de aprendizaje', 'wait'],
  ['La pantalla «General»', 'La prioridad de la semana con sus seis campos', 'wait'],
  ['Plantilla Analyst', 'Se diseña una vez, se aplica en Closing y en Ads', 'wait'],
  ['Dashboard y Plan', 'Jerarquía · resultado esperado · un plan por rol', 'wait'],
  ['Ads Manager', 'DataTable y administrador de columnas', 'wait'],
  ['Chats, Onboarding y Configuración', 'Lo que queda', 'wait'],
];
const CHIP = { ok: 'Hecha', next: 'Sigue', wait: 'En cola' };
const partes = PARTES.map(([t, d, e], i) => `
  <li class="${e === 'ok' ? 'hecha' : ''}">
    <span class="n">${String(i + 1).padStart(2, '0')}</span>
    <span class="t">${t}<span>${d}</span></span>
    <span class="chip ${e}">${e !== 'wait' ? '<span class="dot"></span>' : ''}${CHIP[e]}</span>
  </li>`).join('');

const cuentas = {
  familias: FAMILIAS.length,
  destinos: FAMILIAS.reduce((n, f) => n + f.bloques.flat().length + (f.grupos ?? []).reduce((m, g) => m + g.items.length, 0), 0),
  iconos: (ICONS.match(/^ {2}[\w'-]+: \(/gm) ?? []).length,
};

writeFileSync(SALIDA, `<title>MaKo · Rediseño en curso</title>

<style>
  :root {
    --canvas:#F4F6F9; --surface:#FFFFFF; --surface-2:#F5F7FA;
    --border:#EAECF1; --border-strong:#DCE0E7;
    --ink:#12151B; --dim:#5B6472; --faint:#98A0AC;
    --mako:#F2B01E; --mako-ink:#8F6709; --mako-bg:#FDF4DE;
    --primary:#2F6FED; --primary-bg:#EAF1FE;
    --good:#1E9E57; --good-bg:#E7F5EC;
    --warn:#B4530E; --warn-fill:#EE7B1C; --bad:#D0504A;
    --nav:#14161B; --nav-2:#1E212A; --nav-text:#949CAA; --on-nav:#F3F5F8;
    --sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --mono: ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, monospace;
    --r:11px; --r-lg:14px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --canvas:#0D0F13; --surface:#16191F; --surface-2:#1B1F26;
      --border:#252A33; --border-strong:#333A45;
      --ink:#ECEEF2; --dim:#A2AAB6; --faint:#6E7784;
      --mako-ink:#F2B01E; --mako-bg:#2A2210;
      --primary:#6B9BF7; --primary-bg:#16233C;
      --good:#46BE7D; --good-bg:#12291D;
      --warn:#F09045; --bad:#E4776F; --nav:#080A0D; --nav-2:#191D24;
    }
  }
  :root[data-theme="dark"] {
    --canvas:#0D0F13; --surface:#16191F; --surface-2:#1B1F26;
    --border:#252A33; --border-strong:#333A45;
    --ink:#ECEEF2; --dim:#A2AAB6; --faint:#6E7784;
    --mako-ink:#F2B01E; --mako-bg:#2A2210;
    --primary:#6B9BF7; --primary-bg:#16233C;
    --good:#46BE7D; --good-bg:#12291D;
    --warn:#F09045; --bad:#E4776F; --nav:#080A0D; --nav-2:#191D24;
  }
  :root[data-theme="light"] {
    --canvas:#F4F6F9; --surface:#FFFFFF; --surface-2:#F5F7FA;
    --border:#EAECF1; --border-strong:#DCE0E7;
    --ink:#12151B; --dim:#5B6472; --faint:#98A0AC;
    --mako-ink:#8F6709; --mako-bg:#FDF4DE;
    --primary:#2F6FED; --primary-bg:#EAF1FE;
    --good:#1E9E57; --good-bg:#E7F5EC;
    --warn:#B4530E; --bad:#D0504A; --nav:#14161B; --nav-2:#1E212A;
  }

  * { box-sizing:border-box; }
  .pg { font-family:var(--sans); letter-spacing:-.011em; background:var(--canvas); color:var(--ink); padding:40px 24px 72px; }
  .wrap { max-width:980px; margin:0 auto; }
  h1,h2,h3 { margin:0; text-wrap:balance; letter-spacing:-.022em; }
  h1 { font-size:34px; font-weight:700; line-height:1.1; }
  h2 { font-size:21px; font-weight:600; }
  h3 { font-size:15.5px; font-weight:600; }
  p { margin:0; line-height:1.6; }
  code { font-family:var(--mono); font-size:.9em; }
  .eyebrow { font-family:var(--mono); font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--faint); }
  .lead { font-size:15px; color:var(--dim); max-width:64ch; }
  .small { font-size:13px; color:var(--dim); line-height:1.55; }
  .meta { font-size:12px; color:var(--faint); }

  header.top { display:flex; flex-direction:column; gap:14px; padding-bottom:26px; border-bottom:1px solid var(--border); }
  .brandrow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .badge { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; background:var(--mako-bg); color:var(--mako-ink); border:1px solid color-mix(in srgb, var(--mako) 40%, transparent); font-size:12px; font-weight:600; }
  .cifras { display:flex; gap:26px; flex-wrap:wrap; padding-top:6px; }
  .cifra b { display:block; font-size:24px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
  .cifra span { font-size:12px; color:var(--faint); }

  section.bloque-pg { padding-top:44px; }
  .sect-head { display:flex; flex-direction:column; gap:6px; margin-bottom:18px; }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:20px; }
  .grid3 { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); }

  ol.partes { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:var(--r-lg); overflow:hidden; }
  ol.partes li { display:grid; grid-template-columns:34px minmax(0,1fr) auto; gap:14px; align-items:center; padding:13px 16px; background:var(--surface); }
  ol.partes .n { font-family:var(--mono); font-size:13px; color:var(--faint); font-variant-numeric:tabular-nums; }
  ol.partes .t { font-size:14px; font-weight:600; }
  ol.partes .t span { display:block; font-weight:400; font-size:12.5px; color:var(--dim); margin-top:2px; }
  li.hecha { background:var(--good-bg); }
  li.hecha .n { color:var(--good); }
  .chip { display:inline-flex; align-items:center; gap:6px; padding:3px 9px; border-radius:999px; font-size:11.5px; font-weight:600; white-space:nowrap; border:1px solid transparent; }
  .chip.ok { background:var(--good-bg); color:var(--good); border-color:color-mix(in srgb,var(--good) 35%,transparent); }
  .chip.next { background:var(--primary-bg); color:var(--primary); border-color:color-mix(in srgb,var(--primary) 35%,transparent); }
  .chip.wait { background:var(--surface-2); color:var(--faint); border-color:var(--border-strong); }
  .dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex:none; }

  /* La barra: fondo oscuro real, para verla como se ve */
  .barra { background:var(--nav); border-radius:18px; padding:18px 16px; display:flex; flex-direction:column; gap:20px; }
  .fam__cab { display:flex; align-items:center; gap:9px; padding:0 2px 8px; color:var(--on-nav); flex-wrap:wrap; }
  .fam__n { font-family:var(--mono); font-size:12px; letter-spacing:.17em; text-transform:uppercase; font-weight:700; }
  .fam__q { font-size:12px; color:var(--nav-text); letter-spacing:0; }
  .caja { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); border-radius:var(--r-lg); padding:5px; }
  .bloque { display:flex; flex-direction:column; gap:1px; }
  .bloque.sep { margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,.06); }
  .tab, .grupo { display:flex; align-items:center; gap:11px; padding:7px 10px; border-radius:8px; color:var(--nav-text); font-size:13px; }
  .tab .t, .grupo .t { color:var(--on-nav); font-weight:500; flex:none; }
  .tab code { color:var(--nav-text); font-size:11px; opacity:.75; }
  .tab .pronto { margin-left:auto; font-family:var(--mono); font-size:8.5px; letter-spacing:.06em; text-transform:uppercase; border:1px solid currentColor; border-radius:5px; padding:1px 5px; opacity:.5; }
  .grupo .chev { margin-left:auto; opacity:.6; }
  .hijos { margin:2px 0 0 22px; padding-left:12px; border-left:1px solid rgba(255,255,255,.09); display:flex; flex-direction:column; gap:1px; }
  .ic { flex:none; }
  .nota { margin-top:10px; font-size:12px; color:var(--dim); line-height:1.5; }

  /* Bitácora */
  ol.bita { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:0; }
  .hito { display:grid; grid-template-columns:auto minmax(0,1fr); gap:16px; }
  .hito__n { font-family:var(--mono); font-size:11px; color:var(--faint); padding-top:20px; font-variant-numeric:tabular-nums; }
  .hito__c { border-left:1px solid var(--border); padding:16px 0 16px 18px; position:relative; }
  .hito:last-child .hito__c { border-left-color:transparent; }
  .hito__c::before { content:''; position:absolute; left:-4.5px; top:22px; width:8px; height:8px; border-radius:50%; background:var(--mako); }
  .hito__t { font-size:15px; font-weight:600; display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .hito__f { font-family:var(--mono); font-size:10.5px; color:var(--faint); font-weight:400; }

  ul.lista { margin:10px 0 0; padding:0; list-style:none; display:flex; flex-direction:column; gap:8px; }
  ul.lista li { position:relative; padding-left:16px; font-size:13.5px; line-height:1.55; color:var(--dim); }
  ul.lista li::before { content:''; position:absolute; left:1px; top:.62em; width:5px; height:5px; border-radius:50%; background:var(--faint); }
  ul.lista li b { color:var(--ink); font-weight:600; }
  ul.lista li code { color:var(--ink); }

  .sw { border:1px solid var(--border); border-radius:var(--r); overflow:hidden; background:var(--surface); }
  .sw .fill { height:52px; }
  .sw .body { padding:9px 11px; }
  .sw .n { font-size:13px; font-weight:600; }
  .sw .q { font-size:12px; color:var(--dim); margin-top:2px; line-height:1.35; }
  .sw .hex { font-family:var(--mono); font-size:10.5px; color:var(--faint); margin-top:5px; }

  table.escala { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
  table.escala td { padding:9px 0; border-top:1px solid var(--border); vertical-align:baseline; }
  table.escala td.tok { font-family:var(--mono); font-size:11px; color:var(--faint); text-align:right; white-space:nowrap; padding-left:14px; }
  .scroll { overflow-x:auto; }
  .cita { border-left:2px solid var(--mako); padding:2px 0 2px 14px; font-size:14px; color:var(--dim); line-height:1.6; }
  footer { margin-top:48px; padding-top:22px; border-top:1px solid var(--border); }
  a { color:var(--primary); }
  a:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
</style>

<div class="pg"><div class="wrap">

  <header class="top">
    <div class="brandrow">
      <svg width="32" height="32" viewBox="0 0 48 48" role="img" aria-label="MaKo">
        <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#1A1712" stroke="#F2B01E" stroke-opacity=".35"/>
        <g transform="translate(24 24) scale(1.55)"><path d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z" fill="#F2B01E"/></g>
      </svg>
      <span class="eyebrow">MaKo · Rediseño global</span>
      <span class="badge">Fase 1</span>
    </div>
    <h1>Rediseño en curso</h1>
    <p class="lead">
      El registro de lo que se fue cambiando, y cómo quedó la aplicación hasta ahora. La barra y los
      íconos de esta página salen del código real: si algo se ve acá, está en la app.
    </p>
    <p class="cita">
      «El rediseño no debe comenzar corrigiendo pantallas aisladas. Sin un sistema global, cada tab
      volverá a resolver localmente los mismos problemas.»
    </p>
    <div class="cifras">
      <span class="cifra"><b>2 / 9</b><span>partes terminadas</span></span>
      <span class="cifra"><b>${cuentas.familias}</b><span>secciones en la barra</span></span>
      <span class="cifra"><b>${cuentas.destinos}</b><span>destinos</span></span>
      <span class="cifra"><b>${cuentas.iconos}</b><span>íconos en el set</span></span>
    </div>
  </header>

  <section class="bloque-pg">
    <div class="sect-head">
      <h2>Las nueve partes</h2>
      <p class="small">Las 21 tareas del board (#516–#535 y #538), agrupadas por lo que entregan.</p>
    </div>
    <ol class="partes">${partes}</ol>
  </section>

  <section class="bloque-pg">
    <div class="sect-head">
      <span class="eyebrow">Estado actual</span>
      <h2>La barra, tal como quedó</h2>
      <p class="small">
        Cada sección con sus destinos y sus íconos, en el mismo orden en que se ven. Los grupos con
        <span style="opacity:.7">›</span> abren un desplegable al costado.
      </p>
    </div>
    <div class="barra">${barra}${extras}</div>
  </section>

  <section class="bloque-pg">
    <div class="sect-head">
      <h2>Un significado por color</h2>
      <p class="small">Si el mismo color dice cinco cosas, no dice ninguna.</p>
    </div>
    <div class="grid3">
      <div class="sw"><div class="fill" style="background:#F2B01E"></div><div class="body"><div class="n">MaKo</div><div class="q">Marca, y «acá intervino la inteligencia»</div><div class="hex">#F2B01E</div></div></div>
      <div class="sw"><div class="fill" style="background:#2F6FED"></div><div class="body"><div class="n">Acción</div><div class="q">Vos actuás: botones, links, foco</div><div class="hex">#2F6FED</div></div></div>
      <div class="sw"><div class="fill" style="background:#1E9E57"></div><div class="body"><div class="n">Resultado</div><div class="q">Favorable o completado</div><div class="hex">#1E9E57</div></div></div>
      <div class="sw"><div class="fill" style="background:#EE7B1C"></div><div class="body"><div class="n">Cuidado</div><div class="q">Anaranjado a propósito, para no ser dorado</div><div class="hex">#EE7B1C</div></div></div>
      <div class="sw"><div class="fill" style="background:#D0504A"></div><div class="body"><div class="n">Riesgo</div><div class="q">Error o destrucción</div><div class="hex">#D0504A</div></div></div>
      <div class="sw"><div class="fill" style="background:#98A0AC"></div><div class="body"><div class="n">Neutro</div><div class="q">Sin carga semántica</div><div class="hex">#98A0AC</div></div></div>
    </div>
  </section>

  <section class="bloque-pg">
    <div class="sect-head">
      <h2>Siete niveles de texto, y suben solos</h2>
      <p class="small">Ninguna pantalla escribe una media query: los componentes leen la variable.</p>
    </div>
    <div class="card scroll">
      <table class="escala"><tbody>
        <tr><td style="font-size:30px;font-weight:700;line-height:1.1">Título de página</td><td class="tok">--fs-page · 30 → 26</td></tr>
        <tr><td style="font-size:34px;font-weight:700;line-height:1.05">1.284</td><td class="tok">--fs-kpi · 34 → 30</td></tr>
        <tr><td style="font-size:21px;font-weight:600">Título de sección</td><td class="tok">--fs-sect · 21 → 20</td></tr>
        <tr><td style="font-size:15.5px;font-weight:600">Título de tarjeta</td><td class="tok">--fs-card · 15.5 → 16.5</td></tr>
        <tr><td style="font-size:14px">Texto base de la interfaz</td><td class="tok">--fs-md · 14 → 16</td></tr>
        <tr><td style="font-size:13px;color:var(--dim)">Texto secundario y ayudas</td><td class="tok">--fs-sm · 13 → 14.5</td></tr>
        <tr><td style="font-size:12px;color:var(--faint)">Metadata, chips y fechas</td><td class="tok">--fs-meta · 12 → 13</td></tr>
      </tbody></table>
      <p class="meta" style="margin-top:14px;line-height:1.55">
        No hay nivel por debajo de 12 px <b>a propósito</b>: el documento lo reserva para «información
        excepcionalmente secundaria», y hoy hay 2.392 de 3.815 tamaños en línea por debajo de 14.
      </p>
    </div>
  </section>

  <section class="bloque-pg">
    <div class="sect-head">
      <span class="eyebrow">Bitácora</span>
      <h2>Qué se fue cambiando</h2>
      <p class="small">En orden, con el porqué. Los errores también: son los que explican las decisiones.</p>
    </div>
    <ol class="bita">${bitacora}</ol>
  </section>

  <footer>
    <p class="small">
      <b>Dónde mirarlo.</b> El catálogo vivo está en <code>/admin/ui</code>: la biblioteca real
      renderizada, con los estados que en la app son difíciles de provocar. Las reglas escritas viven
      en <code>app/_ui/LEEME.md</code>.
    </p>
    <p class="meta" style="margin-top:12px">
      Esta página se genera con <code>scripts/artefacto-rediseno.ts</code> leyendo <code>nav.ts</code> e
      <code>icons.tsx</code>. Está hecha con los mismos tokens que la aplicación.
    </p>
  </footer>

</div></div>
`, 'utf8');

console.log(`listo → ${SALIDA}  ·  ${cuentas.familias} secciones · ${cuentas.destinos} destinos · ${cuentas.iconos} íconos`);

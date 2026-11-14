// =============================================================================
// La ficha del lead como PANEL a la derecha, no como modal (14/11/2026)
// =============================================================================
// Martín, mirando la grabación del CRM que se armó para la portada de las landings: «Me gustó mucho cómo quedó el detail
// de los leads en el CRM… que ya no se vaya al modal sino que esté así como un desplegable a la derecha. Me gusta que esté
// de esa manera. Entonces apliquémoslo». La pieza es app/crm/lead-view/PanelFicha.tsx; la monta LeadEditModal, que es lo
// que abren el tablero, Chats, WhatsApp, el Dashboard, los desgloses y la confirmación de MaKo.
//
// Lo que se cuida:
//   1. entra como en la grabación (560, alto entero, 520 ms con su curva, filete y sombra a la izquierda) y respeta
//      «reducir movimiento»; en el teléfono es la pantalla entera, con «Volver»;
//   2. NO es un modal: no hay velo, ni scroll bloqueado, ni foco atrapado; el tablero se sigue usando;
//   3. Escape, la cruz y tocar AFUERA la cierran; tocar otra tarjeta (o fila) NO la cierra: cambia la ficha en el MISMO
//      panel, que no vuelve a entrar; lo que se toca en un diálogo de la ficha dibujado por portal cuenta como adentro;
//   4. el Escape es del diálogo de arriba (la pila) y del campo donde estás escribiendo;
//   5. todas las puertas abren el panel, y el link directo (`?abrir=`) sigue.
//
// ⚠️ CORRE EN UN DOM (jsdom, como tests/admin-polar-armazon.test.ts): monta la carcasa con react-dom y la toca. Toca
//    globales (window, document): va en su proceso solo. Y compara sólo datos chicos (un booleano, un texto): un nodo de
//    jsdom en un assert.equal que falla arma la diferencia recorriendo todo el DOM (docs/hallazgos-infra.md, 10/11).
//
// Correr: node --import tsx --test tests/crm-ficha-panel.test.ts
// PROBADO ROMPIÉNDOLO (14/11/2026), cada rotura sola y vuelta atrás:
//   · `cierraAlTocar` sin mirar TOCAR_SIN_CERRAR (otra tarjeta cierra el panel) .................. 1 falla
//   · sin `onPointerDownCapture` en la carcasa (el portal de un diálogo de la ficha la cierra) ..... 1 falla
//   · la ficha sin la `key` del lead en LeadEditModal ............................................ 1 falla
//   · la entrada a 300 ms ......................................................................... 1 falla
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// ─── El DOM, ANTES de cargar react-dom ─────────────────────────────────────────

type Ventana = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, o: { url: string; pretendToBeVisual?: boolean }) => { window: Ventana };
};
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/crm', pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'HTMLInputElement', 'Node', 'Element', 'MouseEvent', 'KeyboardEvent', 'Event', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
g.IS_REACT_ACT_ENVIRONMENT = true;
/** «Reducir movimiento»: con él la salida es instantánea, y el test no espera la animación. */
let reducido = true;
dom.window.matchMedia = ((q: string) => ({ matches: reducido && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as Window['matchMedia'];

const doc = dom.window.document;

async function montar(el: unknown) {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const cont = doc.createElement('div');
  doc.body.appendChild(cont);
  const root = createRoot(cont);
  await React.act(async () => { root.render(el as never); });
  return {
    cont,
    render: (otro: unknown) => React.act(async () => { root.render(otro as never); }),
    desmontar: () => React.act(async () => { root.unmount(); cont.remove(); }),
  };
}

/** Un toque: `pointerdown` que sube (como el de un dedo o un mouse), con el botón principal. */
async function tocar(el: Element) {
  const React = await import('react');
  await React.act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function tecla(key: string, en: EventTarget = doc.body) {
  const React = await import('react');
  await React.act(async () => {
    en.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

/** El panel con un contador de cierres, un lead afuera (la tarjeta del tablero) y el fondo del tablero. */
async function escenario(hijos?: (cerrar: () => void) => unknown) {
  const React = await import('react');
  const { PanelFicha } = await import('../app/crm/lead-view/PanelFicha');
  const tablero = doc.createElement('div');
  tablero.innerHTML = '<div id="fondo"><div data-lead-id="7" id="tarjeta"><span id="adentro-tarjeta">Valeria</span></div>'
    + '<input id="buscar"><button class="ch-tab-mako" id="estrella">MaKo</button></div>';
  doc.body.appendChild(tablero);
  let cierres = 0;
  const panel = (contenido?: (cerrar: () => void) => unknown) => React.createElement(PanelFicha, {
    etiqueta: 'Ficha de Valeria Campos',
    onCerrar: () => { cierres += 1; },
    children: (cerrar: () => void) => (contenido ?? hijos ?? ((c: () => void) => React.createElement('button', { id: 'x', onClick: c }, 'Cerrar'))) (cerrar),
  } as never);
  const m = await montar(panel());
  return {
    ...m, tablero, panel,
    cierres: () => cierres,
    limpiar: async () => { await m.desmontar(); tablero.remove(); },
  };
}

// ─── 1 · Cómo entra, cuánto mide ───────────────────────────────────────────────

test('entra como en la grabación: 560, el alto entero, 520 ms con su curva, filete y sombra a la izquierda', () => {
  const panel = leer('app/crm/lead-view/PanelFicha.tsx');
  const medidas = leer('app/crm/lead-view/ficha-medidas.ts');
  assert.match(medidas, /export const ANCHO_PANEL_FICHA = 560;/);
  assert.match(medidas, /export const ENTRADA_PANEL_FICHA = \{ ms: 520, curva: 'cubic-bezier\(0\.22, 1, 0\.36, 1\)' \} as const;/);
  assert.match(panel, /\.pf\{ position:fixed; top:0; right:0; bottom:0; z-index:80; width:min\(' \+ ANCHO_PANEL_FICHA \+ 'px, 100vw\);/);
  assert.match(panel, /border-left:1px solid var\(--border\); box-shadow:-24px 0 60px -30px rgba\(0,0,0,\.35\);/);
  assert.match(panel, /animation:pf-entra ' \+ ENTRADA_PANEL_FICHA\.ms \+ 'ms ' \+ ENTRADA_PANEL_FICHA\.curva/);
  assert.match(panel, /@keyframes pf-entra\{ from\{ transform:translateX\(105%\); \} to\{ transform:translateX\(0\); \} \}/);
  assert.match(panel, /@media \(prefers-reduced-motion: reduce\)\{ \.pf, \.pf--sale\{ animation:none; \} \}/);
  // En reposo NO queda un transform: sería el bloque contenedor de lo `fixed` de adentro (sin `fill-mode` en la entrada).
  assert.doesNotMatch(sinComentarios(panel), /pf-entra[^;]*\b(both|forwards)\b/);
  assert.doesNotMatch(sinComentarios(panel), /will-change/);
  // El z del pop-up de antes: debajo de la pila de modales (130), como lo esperan el Dashboard y los desgloses.
  assert.match(panel, /z-index:80;/);
});

test('en el teléfono es la pantalla entera, y se vuelve con la flecha de la izquierda', () => {
  const panel = leer('app/crm/lead-view/PanelFicha.tsx');
  const cab = leer('app/crm/lead-view/CabeceraLead.tsx');
  assert.match(leer('app/crm/lead-view/ficha-medidas.ts'), /export const PANEL_FICHA_PANTALLA_ENTERA = 760;/);
  assert.match(panel, /@media \(max-width:' \+ PANEL_FICHA_PANTALLA_ENTERA \+ 'px\)\{ \.pf\{ width:100vw; border-left:0; box-shadow:none; \} \}/);
  assert.match(cab, /<button type="button" className="clp-volver" aria-label="Volver"[^>]*onClick=\{onCerrar\}>/);
  assert.match(cab, /@media \(max-width: 760px\)\{[\s\S]*?\.clp-volver\{ display:grid;[\s\S]*?\.clp-x\{ display:none; \}/);
  assert.match(cab, /\.clp-volver\{ display:none;/, 'en la computadora la flecha no se ve: está la cruz');
});

test('la cabecera del panel: la cara en un círculo, el nombre y «empresa · canal»', async () => {
  const { bajadaDelPanel, TAM_CARA_PANEL } = await import('../app/crm/lead-view/cabecera-panel');
  assert.equal(TAM_CARA_PANEL, 48);
  // El canal es el MISMO rótulo que dice la tarjeta del tablero (app/crm/origen-lead.ts, `canalDeLead`).
  assert.equal(bajadaDelPanel({ id: 3, empresa: 'Mentoría de ventas', origen_lead: 'landing', meta_lead_id: null }), 'Mentoría de ventas · Landing');
  assert.equal(bajadaDelPanel({ id: 3, empresa: null, origen_lead: null, meta_lead_id: 'm1' }), 'Meta · Instant Form');
  assert.equal(bajadaDelPanel({ id: 3, empresa: '  ', origen_lead: null, meta_lead_id: null }), 'Lead #3', 'sin empresa ni canal, el número');
  const cab = leer('app/crm/lead-view/CabeceraLead.tsx');
  assert.match(cab, /<Marca icono=\{icono\} foto=\{foto\} nombre=\{nombre\} tam=\{TAM_CARA_PANEL\}/);
  assert.match(cab, /<span className="clp-bajada"[^>]*>\{bajadaDelPanel\(lead\)\}<\/span>/);
  // Lo que la cabecera grande hacía, en el panel también: el nombre se edita, la cara se cambia, etiquetas, funnel.
  assert.match(cab, /titulo=\{nombreEditable\}/);
  assert.match(cab, /<span className="clp-txt">\s*\{nombreEditable\}/);
  assert.match(cab, /className="clp-cara"[^>]*\n?\s*onClick=\{\(e\) => \{ const a = e\.currentTarget; setAnclaPortada\(null\); setAnclaFoto/);
  assert.match(cab, /\{acciones && <div className="cl-acc clp-acc">\{acciones\}<\/div>\}/);
  // Y la portada, que el panel no dibuja, se sigue eligiendo a pantalla completa: el panel la abre.
  assert.match(cab, /<Link className="clp-icono" href=\{`\/crm\/\$\{lead\.id\}`\}/);
  assert.match(leer('app/crm/LeadSheet.tsx'), /<CabeceraLead\s+lead=\{lead\}\s+fotoEmail=\{fotoEmail\}\s+panel\s+onCerrar=\{onClose\}/);
});

// ─── 2 · No es un modal ────────────────────────────────────────────────────────

test('no es un modal: sin velo, sin scroll bloqueado, sin foco atrapado; se anuncia como diálogo con nombre', async () => {
  const sheet = sinComentarios(leer('app/crm/LeadSheet.tsx'));
  const modal = sinComentarios(leer('app/crm/LeadEditModal.tsx'));
  for (const [src, cual] of [[sheet, 'LeadSheet'], [modal, 'LeadEditModal']] as const) {
    assert.doesNotMatch(src, /data-ficha-overlay/, `${cual}: volvió el velo`);
    assert.doesNotMatch(src, /rgba\(18,21,27,\.52\)|backdropFilter/, `${cual}: volvió el fondo oscuro`);
    assert.doesNotMatch(src, /aria-modal/, `${cual}: un panel que deja usar el tablero no es modal`);
    assert.doesNotMatch(src, /document\.body\.style\.overflow/, `${cual}: el tablero de al lado tiene que seguir scrolleando`);
  }
  const e = await escenario();
  try {
    const aside = e.cont.querySelector('aside');
    assert.ok(aside, 'no hay panel');
    assert.equal(aside!.getAttribute('role'), 'dialog');
    assert.equal(aside!.getAttribute('aria-label'), 'Ficha de Valeria Campos');
    assert.equal(aside!.hasAttribute('aria-modal'), false);
    assert.ok(doc.activeElement === aside, 'el foco entra al panel al abrirse');
    assert.equal(doc.body.style.overflow, '', 'no bloquea el scroll de la página');
  } finally { await e.limpiar(); }
});

// ─── 3 · Qué lo cierra y qué no ────────────────────────────────────────────────

test('la cruz, el Escape y tocar afuera lo cierran', async () => {
  for (const como of ['cruz', 'escape', 'afuera'] as const) {
    const e = await escenario();
    try {
      if (como === 'cruz') (e.cont.querySelector('#x') as HTMLElement).click();
      if (como === 'escape') await tecla('Escape');
      if (como === 'afuera') await tocar(e.tablero.querySelector('#fondo')!);
      assert.equal(e.cierres(), 1, `${como}: no cerró (o cerró dos veces)`);
    } finally { await e.limpiar(); }
  }
});

test('tocar otra tarjeta, MaKo o adentro del panel NO lo cierra', async () => {
  const e = await escenario();
  try {
    await tocar(e.tablero.querySelector('#tarjeta')!);
    await tocar(e.tablero.querySelector('#adentro-tarjeta')!);
    assert.equal(e.cierres(), 0, 'tocar otro lead tiene que cambiar la ficha, no cerrarla');
    await tocar(e.tablero.querySelector('#estrella')!);
    assert.equal(e.cierres(), 0, 'MaKo sabe qué ficha está abierta: escribirle no la cierra');
    await tocar(e.cont.querySelector('#x')!.parentElement!);
    assert.equal(e.cierres(), 0, 'un toque adentro no es afuera');
  } finally { await e.limpiar(); }
});

test('un diálogo de la ficha dibujado por portal cuenta como ADENTRO (el árbol de React, no el DOM)', async () => {
  const React = await import('react');
  const { createPortal } = await import('react-dom');
  const e = await escenario(() => createPortal(React.createElement('button', { id: 'papelera' }, 'Mandar a la papelera'), doc.body));
  try {
    const boton = doc.getElementById('papelera');
    assert.ok(boton && !e.cont.contains(boton), 'el portal tiene que estar afuera del panel en el DOM');
    await tocar(boton!);
    assert.equal(e.cierres(), 0, 'tocar un diálogo de la ficha la cerró');
    await tocar(e.tablero.querySelector('#fondo')!);
    assert.equal(e.cierres(), 1, 'y lo de afuera de verdad sigue cerrando');
  } finally { await e.limpiar(); }
});

test('cambiar lo de adentro (otro lead) no vuelve a montar el panel: no entra otra vez desde afuera', async () => {
  const React = await import('react');
  const e = await escenario();
  try {
    const antes = e.cont.querySelector('aside');
    await e.render(e.panel(() => React.createElement('p', { id: 'otro' }, 'Diego Fuentes')));
    assert.ok(e.cont.querySelector('#otro'), 'no cambió lo de adentro');
    assert.ok(e.cont.querySelector('aside') === antes, 'el panel se volvió a montar');
  } finally { await e.limpiar(); }
  // Y LeadEditModal lo usa así: UNA carcasa para el esqueleto, el error y la ficha, y la ficha con la `key` del lead.
  const modal = sinComentarios(leer('app/crm/LeadEditModal.tsx'));
  assert.equal(modal.split('<PanelFicha ').length - 1, 1);
  assert.match(modal, /\{\(cerrar\) => notFound \? \([\s\S]*?\) : !data \? \([\s\S]*?\) : \([\s\S]*?<LeadSheet key=\{data\.lead\.id\} data=\{data\} onClose=\{cerrar\}/);
  assert.match(modal, /onCerrar=\{data \? close : onClose\}/, 'cerrar la ficha cargada sigue refrescando el tablero');
});

test('el tablero: las tarjetas y las filas son leads (`data-lead-id`), y abrir otra cambia el lead del MISMO panel', () => {
  const tablero = leer('app/crm/CrmBoard.tsx');
  assert.match(tablero, /<TarjetaPersona\s+data-leadcard[\s\S]{0,200}?data-lead-id=\{l\.id\}[\s\S]{0,80}?onClick=\{\(\) => openDetail\(l\)\}/);
  assert.match(tablero, /<div key=\{l\.id\} onClick=\{\(\) => openDetail\(l\)\}\s+data-lead-id=\{l\.id\}/);
  assert.match(tablero, /const openDetail = \(l: CrmLead, foco\?: string\) => \{ setFocoFicha\(foco\); setSelectedId\(l\.id\); \};/);
  assert.match(tablero, /\{selected && \(\s*<LeadEditModal leadId=\{selected\.id\}/);
  assert.match(leer('app/crm/lead-view/PanelFicha.tsx'), /export const TOCAR_SIN_CERRAR = '\[data-lead-id\],/);
});

// ─── 4 · De quién es el Escape ─────────────────────────────────────────────────

test('el Escape es del diálogo de arriba y del campo donde escribes', async () => {
  const React = await import('react');
  const { useCapaModal } = await import('../app/_components/pila-modales');
  function DialogoEncima() { useCapaModal(true, { anidada: true }); return React.createElement('div', null, 'Mover a…'); }
  const e = await escenario(() => React.createElement(DialogoEncima));
  try {
    await tecla('Escape');
    assert.equal(e.cierres(), 0, 'con un diálogo encima, el Escape lo cierra a él, no a la ficha');
  } finally { await e.limpiar(); }

  const f = await escenario();
  try {
    const buscar = f.tablero.querySelector('#buscar') as HTMLInputElement;
    buscar.focus();
    await tecla('Escape', buscar);
    assert.equal(f.cierres(), 0, 'escribiendo en el buscador, el Escape es del buscador');
  } finally { await f.limpiar(); }

  const { escapeDeUnCampo } = await import('../app/crm/lead-view/PanelFicha');
  const caja = doc.createElement('input'); caja.type = 'checkbox';
  assert.equal(escapeDeUnCampo(caja), false, 'una casilla no es un campo de texto');
  assert.equal(escapeDeUnCampo(doc.createElement('textarea')), true);
  assert.equal(escapeDeUnCampo(null), false);
});

test('sin «reducir movimiento» se va con su animación y cierra UNA vez, aunque la animación no termine', async () => {
  reducido = false;
  const e = await escenario();
  try {
    await tecla('Escape');
    const aside = e.cont.querySelector('aside')!;
    assert.match(aside.className, /pf--sale/, 'no arrancó la salida');
    assert.equal(e.cierres(), 0, 'cerró antes de irse');
    await tecla('Escape');
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(e.cierres(), 1, 'tenía que cerrar una vez (jsdom no anima: lo cierra el reloj)');
  } finally { reducido = true; await e.limpiar(); }
});

// ─── 5 · Todas las puertas abren el panel ─────────────────────────────────────

test('todas las puertas montan LeadEditModal (el panel), y el link directo `?abrir=` sigue', () => {
  const puertas = ['app/crm/CrmBoard.tsx', 'app/chats/ChatsApp.tsx', 'app/whatsapp/EmpresaInbox.tsx', 'app/dashboard/Detalle.tsx',
    'app/dashboard/entidades/acciones-fila.tsx', 'app/_components/Desglose.tsx', 'app/_components/MakoConfirmGate.tsx'];
  for (const p of puertas) assert.match(leer(p), /<LeadEditModal leadId=/, `${p} ya no abre la ficha`);
  assert.match(leer('app/crm/LeadEditModal.tsx'), /import \{ PanelFicha \} from '\.\/lead-view\/PanelFicha';/);
  // Nadie más dibuja la ficha del tablero por su cuenta (sería una segunda carcasa, otra vez un modal).
  assert.doesNotMatch(leer('app/crm/CrmBoard.tsx'), /<LeadSheet\b/);
  const tablero = leer('app/crm/CrmBoard.tsx');
  assert.match(tablero, /const abrirDeUrl = useRef\(sp\.get\('abrir'\)\);/);
  assert.match(tablero, /abrirDeUrl\.current = null;\n\s+setSelectedId\(v\);/);
});

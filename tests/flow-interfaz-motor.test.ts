// =============================================================================
// El motor por interfaz: la plata se gasta UNA vez, y lo que vuelve es lo nuevo
// =============================================================================
// `extension/flow-interfaz.js` aprieta «Start generation» en la pestaña de Flow
// del cliente. Ese clic gasta créditos de su cuenta de Google, y nada de lo que
// pase después los devuelve. Este test corre el motor REAL (el archivo de la
// extensión, sin copiar) contra una pestaña de Flow simulada y fija tres cosas:
//
//   1. `salio: true` está en storage ANTES del clic, y se aprieta una sola vez;
//   2. un trabajo que ya salió y perdió su pestaña no se vuelve a apretar;
//   3. lo que se entrega es el video NUEVO, no el último terminado de antes.
//
// Y, del lado del service worker, que un registro sin `salio === false`
// explícito nunca se marca como reintentable.
//
// Probado rompiéndolo (17/10/2026), con el resultado de cada rotura:
//   · mover `guardar(id, { … salio: true … })` debajo de `clic(boton)` →
//     «aprieta Generar una sola vez» falla: salioAlClic = false.
//   · borrar la guarda `if (previo && previo.salio)` de `generar` →
//     «un trabajo que ya salió» falla: 1 clic en Generar (esperado 0).
//   · volver a reconocer el video por `top.el !== ctx.primeroAntes` (sin verlo
//     nacer) → «aprieta Generar…» falla: mediaId = el VIEJO (aaaaaaaa-…).
//   · en background.js, `reintentable: !r.salio` → «un registro sin salio»
//     falla: reintentable = true.
//   · sacar el tope de créditos (`cotizado > tope`) → «si Flow cotiza…» falla:
//     1 clic (esperado 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const MOTOR = readFileSync(join(process.cwd(), 'extension/flow-interfaz.js'), 'utf8');
const WORKER = readFileSync(join(process.cwd(), 'extension/background.js'), 'utf8');

const PROYECTO = '11111111-2222-3333-4444-555555555555';
const VIEJO = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const NUEVO = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CARA = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// ── Un DOM mínimo: sólo lo que el motor consulta ─────────────────────────────

type Attrs = Record<string, string>;

class Nodo {
  tag: string;
  attrs: Attrs;
  hijos: Nodo[] = [];
  padre: Nodo | null = null;
  texto: string;
  alClic: (() => void) | null = null;
  disabled = false;
  scrollTop = 0;
  clientHeight = 100;
  constructor(tag: string, attrs: Attrs = {}, texto = '') {
    this.tag = tag;
    this.attrs = { ...attrs };
    this.texto = texto;
  }
  get tagName() { return this.tag.toUpperCase(); }
  get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); }
  getAttribute(n: string) { return n in this.attrs ? this.attrs[n] : null; }
  setAttribute(n: string, v: string) { this.attrs[n] = String(v); }
  get isConnected(): boolean { return this.padre ? this.padre.isConnected : this.tag === 'body'; }
  agregar(...h: Nodo[]) { for (const x of h) { x.padre = this; this.hijos.push(x); } return this; }
  alPrincipio(x: Nodo) { x.padre = this; this.hijos.unshift(x); return this; }
  quitar() { if (this.padre) this.padre.hijos = this.padre.hijos.filter((h) => h !== this); this.padre = null; }
  get innerText(): string { return [this.texto, ...this.hijos.map((h) => h.innerText)].filter(Boolean).join(' '); }
  get textContent() { return this.innerText; }
  get outerHTML(): string {
    const a = Object.entries(this.attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
    return `<${this.tag}${a}>${this.texto}${this.hijos.map((h) => h.outerHTML).join('')}</${this.tag}>`;
  }
  get innerHTML() { return this.hijos.map((h) => h.outerHTML).join(''); }
  get src() { return this.attrs.src || ''; }
  get currentSrc() { return this.attrs.src || ''; }
  getBoundingClientRect() { return { width: 10, height: 10, left: 0, top: 0 }; }
  dispatchEvent() { return true; }
  /** El clic burbujea: lo atiende el manejador más cercano, como en el navegador. */
  click() { for (let n: Nodo | null = this; n; n = n.padre) if (n.alClic) { n.alClic(); return; } }
  focus() { doc.activeElement = this; }
  scrollIntoView() { /* nada */ }
  descendientes(): Nodo[] { return this.hijos.flatMap((h) => [h, ...h.descendientes()]); }
  querySelectorAll(sel: string) { return this.descendientes().filter((n) => coincide(n, sel)); }
  querySelector(sel: string) { return this.querySelectorAll(sel)[0] || null; }
}

function partirFuera(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let cur = '';
  let prof = 0;
  let comillas = false;
  for (const c of s) {
    if (c === '"') comillas = !comillas;
    if (!comillas && c === '[') prof++;
    if (!comillas && c === ']') prof--;
    if (!comillas && prof === 0 && sep.test(c)) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function compuesto(n: Nodo, s: string): boolean {
  const m = /^([a-zA-Z][\w-]*)?/.exec(s)!;
  if (m[1] && m[1].toLowerCase() !== n.tag) return false;
  let resto = s.slice(m[0].length);
  while (resto) {
    const cl = /^\.([\w-]+)/.exec(resto);
    if (cl) {
      if (!(n.attrs.class || '').split(/\s+/).includes(cl[1])) return false;
      resto = resto.slice(cl[0].length);
      continue;
    }
    const at = /^\[([\w-]+)(?:(\*?=)"([^"]*)")?\]/.exec(resto);
    if (!at) throw new Error(`selector no soportado por el DOM del test: ${s}`);
    const v = n.getAttribute(at[1]);
    if (v == null) return false;
    if (at[2] === '=' && v !== at[3]) return false;
    if (at[2] === '*=' && !v.includes(at[3])) return false;
    resto = resto.slice(at[0].length);
  }
  return true;
}

function coincide(n: Nodo, sel: string): boolean {
  return partirFuera(sel, /,/).some((grupo) => {
    const partes = partirFuera(grupo, /\s/);
    if (!compuesto(n, partes[partes.length - 1])) return false;
    let p = n.padre;
    for (let i = partes.length - 2; i >= 0; i--) {
      while (p && !compuesto(p, partes[i])) p = p.padre;
      if (!p) return false;
      p = p.padre;
    }
    return true;
  });
}

let doc: { activeElement: Nodo | null } & Record<string, unknown>;

// ── Una pestaña de Flow simulada ─────────────────────────────────────────────

type Opciones = { cotiza?: number; previo?: Record<string, unknown> };

function flowFalso(op: Opciones = {}) {
  const body = new Nodo('body');
  const storage: Record<string, unknown> = {};
  if (op.previo) storage['interfaz:7'] = op.previo;
  const registro = { clicsGenerar: 0, salioAlClic: null as unknown, subidas: 0 };
  const location = { pathname: `/project/${PROYECTO}`, origin: 'https://flow.google.com' };
  doc = {
    activeElement: null,
    body,
    documentElement: { lang: 'en' },
    visibilityState: 'hidden',
    querySelectorAll: (s: string) => body.querySelectorAll(s),
    querySelector: (s: string) => body.querySelector(s),
    getElementById: () => null,
    execCommand: (cmd: string, _ui: boolean, val?: string) => {
      const a = doc.activeElement;
      if (!a) return false;
      if (cmd === 'delete') a.texto = '';
      if (cmd === 'insertText') a.texto += String(val);
      return true;
    },
  };

  const boton = (rotulo: string, alClic: () => void, texto = '') => {
    const b = new Nodo('button', { 'aria-label': rotulo }, texto);
    b.alClic = alClic;
    return b;
  };

  // La grilla, con un video VIEJO ya terminado arriba de todo.
  const grilla = new Nodo('div', { class: 'page-container' });
  const baldosaVideo = (id: string, titulo: string) => {
    const t = new Nodo('flow-grid-tile-container', { 'aria-label': titulo });
    t.agregar(new Nodo('flow-video-tile').agregar(new Nodo('img', { alt: 'Generated video thumbnail', src: 'https://flow.google.com/asb/firmada' })));
    t.alClic = () => abrirEdicion(id);
    return t;
  };
  grilla.agregar(baldosaVideo(VIEJO, 'Un video de antes'));

  const compositor = new Nodo('div', { class: 'ProseMirror' });
  const chips = new Nodo('div');

  // La vista de edición: /edit/<id>, con su <video> y el botón de volver.
  function abrirEdicion(id: string) {
    location.pathname = `/project/${PROYECTO}/edit/${id}`;
    const v = new Nodo('video', { src: `https://flow-content.google/video/${id}?Expires=1&Signature=x` });
    const volver = boton('Back button to go to previous page', () => {
      location.pathname = `/project/${PROYECTO}`;
      v.quitar();
      volver.quitar();
    });
    body.agregar(v, volver);
  }

  // Los ajustes: radios agrupados, el modelo y el precio.
  const grupos = [['Image', 'Video'], ['Frames', 'Ingredients'], ['16:9', '9:16'], ['720p', '360p'], ['4s', '6s', '8s', '10s'], ['x1', 'x2']];
  const popover = new Nodo('div');
  for (const g of grupos) {
    for (const nombre of g) {
      const r = new Nodo('button', { role: 'radio', 'aria-label': nombre, 'aria-checked': 'false' });
      r.alClic = () => {
        for (const otro of popover.hijos) if (g.includes(otro.getAttribute('aria-label') || '')) otro.setAttribute('aria-checked', 'false');
        r.setAttribute('aria-checked', 'true');
      };
      popover.agregar(r);
    }
  }
  const modelo = boton('Select model family', () => {
    const menu = new Nodo('div');
    for (const m of ['Omni 1.1 Flash', 'Veo 3.1 - Fast', 'Nano Banana 2.1', 'Nano Banana 2 Lite']) {
      const it = new Nodo('div', { role: 'menuitem' }, m);
      it.alClic = () => { modelo.texto = m; menu.quitar(); };
      menu.agregar(it);
    }
    body.agregar(menu);
  }, 'Veo 3.1 - Fast');
  popover.agregar(modelo, new Nodo('a', {}, `${op.cotiza ?? 12} credits`));

  const ajustes = boton('Settings trigger', () => { if (!popover.padre) body.agregar(popover); });
  const ingredientes = boton('Add ingredients to the prompt box', () => {
    const lista = new Nodo('div', { role: 'listbox', 'aria-label': 'Asset list' });
    const opcion = new Nodo('div', { role: 'option' }).agregar(new Nodo('img', { 'data-media-id': CARA, src: 'x' }));
    opcion.alClic = () => {
      const agregar = boton('Add to prompt', () => {
        lista.quitar();
        agregar.quitar();
        chips.agregar(new Nodo('button', { 'aria-label': 'Ingredient 1' }));
      });
      body.agregar(agregar);
    };
    lista.agregar(opcion);
    body.agregar(new Nodo('div', { role: 'tab', 'aria-label': 'All', 'aria-selected': 'true' }), lista);
  });

  const generar = boton('Start generation', () => {
    registro.clicsGenerar++;
    registro.salioAlClic = (storage['interfaz:7'] as Record<string, unknown> | undefined)?.salio ?? null;
    // ⚠️ Angular rehace los nodos: el video viejo vuelve como OTRO elemento, igual
    // de terminado. Es justo lo que confundía «la de arriba es otra» con «nueva».
    const viejo = grilla.hijos[0];
    viejo.quitar();
    grilla.alPrincipio(baldosaVideo(VIEJO, 'Un video de antes'));
    // La generación nueva aparece un rato después, primero con el prompt de
    // título y sin miniatura, después contando, y al final terminada.
    setTimeout(() => {
      const t = new Nodo('flow-grid-tile-container', { 'aria-label': 'una mujer sonríe a cámara en su auto' });
      const tile = new Nodo('flow-video-tile');
      t.agregar(tile);
      t.alClic = () => abrirEdicion(NUEVO);
      grilla.alPrincipio(t);
      setTimeout(() => { tile.texto = '45%'; }, 30);
      setTimeout(() => {
        tile.texto = '';
        t.setAttribute('aria-label', 'Mujer en auto');
        tile.agregar(new Nodo('img', { alt: 'Generated video thumbnail', src: 'https://flow.google.com/asb/otra' }));
      }, 80);
    }, 40);
  });

  body.agregar(
    boton('Agent', () => {}),
    ajustes, ingredientes, generar, compositor, chips, grilla,
  );

  const oyentes: Array<(m: unknown, s: unknown, r: (x: unknown) => void) => unknown> = [];
  const chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (_m: unknown, cb?: () => void) => { if (cb) setImmediate(cb); },
      onMessage: {
        addListener: (f: (typeof oyentes)[number]) => oyentes.push(f),
        removeListener: () => {},
      },
    },
    storage: {
      local: {
        get: async (k: string) => ({ [k]: storage[k] }),
        set: async (o: Record<string, unknown>) => { Object.assign(storage, o); },
      },
    },
  };
  const fetchFalso = async (url: string, init?: { method?: string }) => {
    if (init?.method === 'PUT') { registro.subidas++; return { ok: true, status: 200 }; }
    return { ok: true, status: 200, blob: async () => new Blob([new Uint8Array(4096)], { type: 'video/mp4' }), url };
  };
  class Ev { type: string; constructor(type: string, o: object = {}) { this.type = type; Object.assign(this, o); } }

  const ctx = vm.createContext({
    document: doc,
    location,
    chrome,
    fetch: fetchFalso,
    FormData,
    File,
    Blob,
    DataTransfer: class { items = { add: () => {} }; files = []; },
    atob,
    PointerEvent: Ev, MouseEvent: Ev, KeyboardEvent: Ev, Event: Ev,
    getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    setTimeout: (f: () => void, ms: number) => setTimeout(f, Math.min(ms, 3)),
    window: { postMessage: () => {} },
    console,
  });
  vm.runInContext(MOTOR, ctx);

  async function correr(pedido: Record<string, unknown>) {
    const resp = await new Promise((r) => oyentes[0]({ tipo: 'INTERFAZ_CORRER', pedido }, null, r));
    const fin = Date.now() + 8000;
    for (;;) {
      const reg = storage['interfaz:7'] as Record<string, unknown> | undefined;
      if (reg && (reg.fase === 'listo' || reg.fase === 'fallo')) return { resp, reg };
      if (Date.now() > fin) throw new Error(`el motor no terminó: ${JSON.stringify(reg)}`);
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  return { correr, registro, storage };
}

const PEDIDO = {
  trabajoId: 7,
  tipo: 'video',
  prompt: 'una mujer sonríe a cámara en su auto',
  referencias: [CARA],
  segundos: 8,
  vertical: true,
  modelo: 'Omni',
  maxCreditos: 15,
  subida: { url: 'https://supa/firmada', publica: 'https://supa/publica/toma.mp4', apikey: 'k', nombre: 'toma.mp4' },
};

test('aprieta Generar una sola vez, con «salió» ya escrito, y entrega el video NUEVO', async () => {
  const f = flowFalso();
  const { resp, reg } = await f.correr(PEDIDO);
  // Viene de otro contexto `vm`: se compara el campo, no el prototipo.
  assert.equal((resp as { aceptado?: boolean }).aceptado, true);
  assert.equal(reg.fase, 'listo', `terminó en ${reg.fase}: ${reg.error}`);
  assert.equal(f.registro.clicsGenerar, 1, 'Generar se apretó más de una vez: cada clic cobra');
  assert.equal(
    f.registro.salioAlClic, true,
    'Al apretar Generar, storage todavía no decía que salió. Si el motor muere justo\n'
    + 'ahí, el trabajo se repite y se cobra dos veces.',
  );
  assert.equal(
    reg.mediaId, NUEVO,
    'Se entregó otro video que el generado. Con los nodos rehechos por Angular, «la de\n'
    + 'arriba es otra» no prueba que sea nueva: hay que verla nacer.',
  );
  assert.equal(reg.url, PEDIDO.subida.publica, 'el archivo no terminó en NUESTRO Storage');
  assert.equal(reg.propio, true);
  assert.equal(f.registro.subidas, 1);
});

test('un trabajo que ya salió y perdió su pestaña NO se vuelve a apretar', async () => {
  const f = flowFalso({ previo: { tipo: 'video', fase: 'generando', salio: true } });
  const { reg } = await f.correr(PEDIDO);
  assert.equal(f.registro.clicsGenerar, 0, 'Se volvió a apretar Generar sobre un trabajo ya pagado');
  assert.equal(reg.fase, 'fallo');
  assert.equal(reg.codigo, 'RECARGADA');
});

test('si Flow cotiza más que el tope, no se aprieta y se dice', async () => {
  const f = flowFalso({ cotiza: 20 });
  const { reg } = await f.correr(PEDIDO);
  assert.equal(f.registro.clicsGenerar, 0, 'Se generó por encima del tope de créditos');
  assert.equal(reg.fase, 'fallo');
  assert.equal(reg.salio, false);
  assert.equal(reg.noReintentar, true, 'Reintentar no baja el precio: quemaría cinco intentos');
  assert.match(String(reg.error), /20 créditos/);
});

/** Una función de background.js, extraída del fuente real y evaluada sola. */
function delWorker(nombre: string): (...a: unknown[]) => unknown {
  const ini = WORKER.indexOf(`function ${nombre}(`);
  assert.ok(ini > 0, `${nombre}() ya no está en extension/background.js`);
  let d = 0;
  let fin = -1;
  for (let i = WORKER.indexOf('{', ini); i < WORKER.length; i++) {
    if (WORKER[i] === '{') d++;
    else if (WORKER[i] === '}') { d--; if (d === 0) { fin = i + 1; break; } }
  }
  // eslint-disable-next-line no-new-func
  return new Function(`${WORKER.slice(ini, fin)}; return ${nombre};`)() as (...a: unknown[]) => unknown;
}

test('un registro sin «salio === false» explícito nunca es reintentable', () => {
  const r = delWorker('resultadoDeRegistro') as (x: Record<string, unknown>) => Record<string, unknown>;
  // Sin el campo: puede ser una versión vieja o un registro cortado. Se trata como pagado.
  assert.equal(r({ id: 1, fase: 'fallo', error: 'x' }).reintentable, false);
  assert.equal(r({ id: 1, fase: 'fallo', salio: true, error: 'x' }).reintentable, false);
  assert.equal(r({ id: 1, fase: 'fallo', salio: false, error: 'x' }).reintentable, true);
  // No gastó, pero repetir no cambia nada (el tope, la foto que no está).
  assert.equal(r({ id: 1, fase: 'fallo', salio: false, noReintentar: true, error: 'x' }).reintentable, false);
  // Lo terminado vuelve con el id ORIGINAL y la forma que lee el servidor.
  assert.deepEqual(
    r({ id: 9, fase: 'listo', tipo: 'video', mediaId: NUEVO, url: 'u', propio: true }),
    { id: 9, ok: true, data: { motor: 'interfaz', mediaId: NUEVO, url: 'u', propio: true } },
  );
  assert.deepEqual(
    r({ id: 9, fase: 'listo', tipo: 'subida', mediaId: CARA }),
    { id: 9, ok: true, data: { motor: 'interfaz', media: { name: CARA } } },
  );
});

test('los trabajos de interfaz no se corren en el bucle del latido', () => {
  // Se anotan y quedan tomados; los corre `avanzarInterfaz`. Si se corrieran acá,
  // el latido quedaría colgado minutos y MaKo daría el navegador por caído.
  const i = WORKER.indexOf('if (esDeInterfaz(t)) {');
  const j = WORKER.indexOf('const r = await ejecutar(t);');
  assert.ok(i > 0 && j > i, 'el bucle ya no desvía los trabajos de interfaz antes de ejecutar()');
  assert.match(WORKER.slice(i, i + 200), /await recibirDeInterfaz\(t\);\s*continue;/);
});

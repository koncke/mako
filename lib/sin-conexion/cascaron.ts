// =============================================================================
// El cascarón de MaKo sin conexión: lo que se ve cuando no hay red o MaKo no responde (navegador, 28/10/2026)
// =============================================================================
// Se arma con esbuild (scripts/sin-conexion/armar.mjs) a public/sin-conexion/app.js; el service worker (public/sw.js) lo
// devuelve en vez de la página cuando el servidor no contesta. Es IGUAL para todos y no trae un dato de nadie: lo de cada
// persona está cifrado en su base (./almacen.ts) y abre sólo con su clave (./local.ts).
//
// T1 (28/10/2026): leer el CRM (el tablero de cada funnel, la ficha con sus notas) y el Plan (Prioridades · Tareas ·
// Proyectos · Recurrentes), con la cinta «Sin conexión · lo que ves es lo de las 10:42».
// T2 (28/10/2026): ESCRIBIR a la cola (lib/sin-conexion/cola.ts): una nota, mover de etapa (sólo a donde mueve el teléfono),
// el nombre, el email o la empresa, mover una tarea de columna y una tarea nueva. Cada cambio se guarda cifrado en esta
// computadora y se dibuja encima de la copia («Se sube al volver»). NADA sale de acá: el cascarón no le habla al servidor.
// Lo sube el panel de la app al volver la conexión, con el OK de la persona (app/_components/SubirCambios.tsx).
// Sin React ni Next: DOM a mano, con `textContent` siempre (nunca `innerHTML` con un dato).
//
// LO DESCIFRADO VIVE SÓLO EN LA PANTALLA (la verificación del Cerebro, 28/10/2026): ninguna variable del módulo guarda la
// llave ni las copias, y nada se escribe en localStorage. Arranca SIEMPRE pidiendo la clave; «Salir», salir de la página
// (`pagehide`), volver del historial (`pageshow` con `persisted`) o `BLOQUEO_INACTIVO_MS` sin tocar nada vuelven a pedirla y
// borran lo dibujado. Así quien llega después a la misma PC no ve lo de la sesión anterior.
// =============================================================================

import { almacenIdb, existeBase, type Almacen } from './almacen';
import { alAzar, llaveDeLaClave, nombreDeBase } from './cifra';
import { abrir, encolar, idDeCambio } from './local';
import { conLoPendiente, TOPE_NOTA_COLA, TOPE_TITULO, type Cambio, type Operacion, type Pendientes } from './cola';
import { BLOQUEO_INACTIVO_MS, deCuando, NECESITA_CONEXION, normalizarEmail, textoDeLaCinta, VUELTAS, type CopiaV1, type MotivoSinConexion } from './reglas';
import type { TableroCrmM, TarjetaCrmM } from '@/app/m/crm/datos';

type Hijo = Node | string | null | undefined | false;

/** Un elemento con sus atributos y sus hijos. Los textos van como nodos de texto: nunca se interpreta HTML. */
function h(tag: string, attrs: Record<string, string | boolean | ((ev: Event) => void) | undefined> = {}, ...hijos: Hijo[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const x of hijos) if (x) el.append(typeof x === 'string' ? document.createTextNode(x) : x);
  return el;
}

/** Por qué se está viendo esto: lo dice el service worker en el `<meta name="mako-motivo">`; abierto a mano, es una prueba. */
function motivo(): MotivoSinConexion | 'probando' {
  const m = document.querySelector('meta[name="mako-motivo"]')?.getAttribute('content');
  if (m === 'sin-red' || m === 'no-responde') return m;
  return navigator.onLine ? 'probando' : 'sin-red';
}

const raiz = () => document.getElementById('mako-sin-conexion') as HTMLElement;
function pintar(...hijos: Hijo[]) {
  const r = raiz();
  r.replaceChildren(...hijos.filter((x): x is Node | string => !!x));
}

// ── Entrar ──────────────────────────────────────────────────────────────────

/** El ÚNICO estado del módulo: el reloj de la inactividad (un número, nunca un dato). */
let relojInactividad: ReturnType<typeof setTimeout> | null = null;

/** Vuelve a pedir la clave y borra lo dibujado (y con eso, las últimas referencias a lo descifrado). */
function bloquear(motivo?: string) {
  if (relojInactividad) { clearTimeout(relojInactividad); relojInactividad = null; }
  pantallaEntrar(motivo);
}

/** Arranca (o reinicia) el reloj: sin tocar nada `BLOQUEO_INACTIVO_MS`, lo abierto se cierra solo. */
function armarReloj() {
  if (relojInactividad) clearTimeout(relojInactividad);
  relojInactividad = setTimeout(() => bloquear('Se cerró por inactividad. Vuelve a entrar con tu clave.'), BLOQUEO_INACTIVO_MS);
}
/** Cada toque o tecla con algo abierto reinicia el reloj; con la pantalla de entrar, no hay reloj. */
const alTocar = () => { if (relojInactividad) armarReloj(); };

function pantallaEntrar(error?: string) {
  if (relojInactividad) { clearTimeout(relojInactividad); relojInactividad = null; }
  const email = h('input', { id: 'sc-email', class: 'campo', type: 'email', autocomplete: 'username', required: true }) as HTMLInputElement;
  const clave = h('input', { id: 'sc-clave', class: 'campo', type: 'password', autocomplete: 'current-password', required: true }) as HTMLInputElement;
  const boton = h('button', { type: 'submit', class: 'boton' }, 'Abrir') as HTMLButtonElement;
  const aviso = h('p', { class: 'error', role: 'alert', hidden: !error }, error ?? '');
  const form = h('form', {
    class: 'entrar',
    onsubmit: (ev: Event) => {
      ev.preventDefault();
      boton.disabled = true;
      boton.textContent = 'Abriendo…';
      void entrar(email.value, clave.value).finally(() => { boton.disabled = false; boton.textContent = 'Abrir'; });
    },
  },
  h('h1', {}, 'MaKo sin conexión'),
  h('p', { class: 'bajada' }, motivo() === 'no-responde'
    ? 'MaKo no responde ahora. Entra con tu email y la clave de esta computadora para ver lo guardado.'
    : 'Entra con tu email y la clave de esta computadora para ver lo guardado.'),
  aviso,
  h('label', { for: 'sc-email', class: 'rotulo' }, 'Tu email'), email,
  h('label', { for: 'sc-clave', class: 'rotulo' }, 'La clave de esta computadora'), clave,
  boton,
  h('p', { class: 'nota' }, 'Se activa con conexión, en Settings › Instalar la app › Sin conexión.'),
  h('button', { type: 'button', class: 'boton-texto', onclick: () => location.reload() }, 'Reintentar con conexión'));
  pintar(form);
  email.focus();
}

/** El mismo mensaje para un email sin nada y para una clave equivocada: otra cuenta no se entera de qué hay guardado. */
const NO_COINCIDE = 'El email o la clave no coinciden con lo guardado en esta computadora.';

/**
 * Lo ABIERTO con la clave: la llave para escribir en la cola, la cola misma y las copias. Pasa de pantalla en pantalla como
 * argumento (y queda en los cierres de lo dibujado): ninguna variable del módulo lo guarda, y `bloquear` lo suelta entero.
 */
type Abierto = { email: string; almacen: Almacen; llave: CryptoKey; cola: Operacion[]; copias: CopiaV1[] };

async function entrar(emailCrudo: string, clave: string) {
  const email = normalizarEmail(emailCrudo);
  const nombre = await nombreDeBase(email);
  // Sin base, la MISMA espera que con una clave equivocada (el PBKDF2 de relleno): contestar al instante decía que ese email
  // no guardó nada en esta PC (verificación de 90d6410eb). El nombre de la base no lleva sal: el cascarón tiene que
  // encontrarla sin red, así que cualquier sal viviría en el mismo perfil que quien mira.
  if (!(await existeBase(nombre))) { await llaveDeLaClave(clave, alAzar(16), VUELTAS).catch(() => undefined); return pantallaEntrar(NO_COINCIDE); }
  const almacen = almacenIdb(nombre);
  const r = await abrir({ email, clave, almacen });
  if (!r.ok) {
    if (r.motivo === 'vencida') return pantallaEntrar('Lo guardado tenía más de 30 días sin conexión y se borró. Vuelve a activarlo con conexión.');
    return pantallaEntrar(NO_COINCIDE);
  }
  if (!r.copias.length) {
    return pantallaEntrar(r.viejas
      ? 'Lo guardado es de una versión anterior. Abre MaKo una vez con conexión para renovarlo.'
      : 'Todavía no hay una copia guardada. Se guarda sola con conexión, cada 10 minutos.');
  }
  const s: Abierto = { email, almacen, llave: r.llave, cola: r.cola, copias: r.copias };
  if (r.copias.length === 1) return pantallaNegocio(s, r.copias[0]);
  pantallaElegir(s);
}

function pantallaElegir(s: Abierto) {
  pintar(h('div', { class: 'entrar' },
    h('h1', {}, '¿Qué negocio?'),
    ...s.copias.map((c) => h('button', { type: 'button', class: 'fila-negocio', onclick: () => pantallaNegocio(s, c) }, c.negocio.nombre))));
}

// ── Escribir ────────────────────────────────────────────────────────────────

/**
 * Suma un cambio a la cola (cifrado, en IndexedDB) y vuelve a dibujar con él encima. Nada sale de esta computadora: lo sube
 * el panel de la app al volver la conexión, con el OK de la persona (app/_components/SubirCambios.tsx).
 */
async function escribir(s: Abierto, base: CopiaV1, cambio: Cambio, despues: () => void) {
  const op: Operacion = { id: idDeCambio(), ws: base.negocio.id, hecha: new Date().toISOString(), cambio };
  const entro = await encolar({ email: s.email, llave: s.llave, almacen: s.almacen, op });
  if (!entro) { avisar('Hay demasiados cambios sin subir. Vuelve a conectarte para subirlos antes de seguir.'); return; }
  s.cola.push(op);
  despues();
}

function avisar(texto: string) {
  const a = h('div', { class: 'aviso-flotante', role: 'alert' }, texto);
  raiz().append(a);
  setTimeout(() => a.remove(), 6000);
}

// ── Adentro ─────────────────────────────────────────────────────────────────

function cinta(copia: CopiaV1, sinSubir: number): HTMLElement {
  const m = motivo();
  // Abierto con conexión desde «Probar» (Settings › Instalar la app): la misma cinta, sin decir que no hay red.
  const texto = m === 'probando'
    ? `Así se ve MaKo sin conexión · lo que ves es ${deCuando(copia.hecha, copia.tz)}`
    : textoDeLaCinta({ motivo: m, hecha: copia.hecha, tz: copia.tz });
  return h('div', { class: 'cinta', role: 'status' },
    h('span', {}, texto),
    sinSubir ? h('span', { class: 'cinta-cuenta' }, `${sinSubir} ${sinSubir === 1 ? 'cambio espera' : 'cambios esperan'} la conexión`) : null,
    h('button', { type: 'button', class: 'cinta-boton', onclick: () => location.reload() }, 'Reintentar'));
}

type Tab = 'crm' | 'plan';
/** Lo que una pantalla recuerda al redibujarse: el funnel, la búsqueda, la vista del Plan y la ficha abierta. */
type Estado = { funnelIdx?: number; filtro?: string; vistaPlan?: VistaPlan; fichaDe?: number };

function pantallaNegocio(s: Abierto, base: CopiaV1, tab: Tab = location.pathname.startsWith('/plan') ? 'plan' : 'crm', e: Estado = {}) {
  const { copia, pendientes } = conLoPendiente(base, s.cola);
  const sinSubir = s.cola.filter((op) => op.ws === base.negocio.id).length;
  const otra = (t: Tab, x: Estado = {}) => pantallaNegocio(s, base, t, x);
  const cuerpo = h('main', { class: 'cuerpo' });
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Secciones' },
    ...(['crm', 'plan'] as const).map((t) => h('button', {
      type: 'button', class: 'tab', 'aria-current': t === tab ? 'page' : undefined,
      onclick: () => otra(t),
    }, t === 'crm' ? 'CRM' : 'Plan')));
  const cabecera = h('header', { class: 'cabecera' },
    h('span', { class: 'marca' }, 'MaKo'),
    s.copias.length > 1
      ? h('button', { type: 'button', class: 'boton-texto', onclick: () => pantallaElegir(s) }, copia.negocio.nombre)
      : h('span', { class: 'negocio' }, copia.negocio.nombre),
    tabs,
    h('span', { class: 'quien' }, copia.persona.nombre),
    h('button', { type: 'button', class: 'boton-texto salir', onclick: () => bloquear() }, 'Salir'));
  const faltan = copia.faltan.length
    ? h('p', { class: 'aviso' }, `No se pudo guardar ${copia.faltan.join(' ni ')} en la última copia.`) : null;
  // Lo que la última renovación no pudo leer y quedó de una copia anterior: con SU hora (no la de la cinta).
  const deAntes = (copia.deAntes ?? []).map((d) => h('p', { class: 'aviso' }, `No se pudo actualizar ${d.que}: lo que ves es ${deCuando(d.hecha, copia.tz)}.`));
  const ctx: Ctx = { s, base, copia, pendientes, e, otra };
  if (tab === 'crm') cuerpo.append(vistaCrm(ctx));
  else cuerpo.append(vistaPlan(ctx));
  armarReloj();
  pintar(cinta(copia, sinSubir), cabecera, faltan, ...deAntes, cuerpo,
    h('p', { class: 'pie' }, `${NECESITA_CONEXION.escribir} WhatsApp, la IA y los cobros necesitan conexión.`));
  if (tab === 'crm' && e.fichaDe != null) {
    const t = copia.crm?.tableros[Math.min(e.funnelIdx ?? 0, (copia.crm?.tableros.length ?? 1) - 1)];
    const c = t?.tarjetas.find((x) => x.id === e.fichaDe);
    if (t && c) ficha(ctx, t, c);
  }
}

/** Lo que cada vista necesita para dibujar y para escribir. */
type Ctx = { s: Abierto; base: CopiaV1; copia: CopiaV1; pendientes: Pendientes; e: Estado; otra: (t: Tab, x?: Estado) => void };

// ── CRM ─────────────────────────────────────────────────────────────────────

function vistaCrm(ctx: Ctx): HTMLElement {
  const { copia, e } = ctx;
  const caja = h('section', { class: 'crm' });
  if (!copia.crm || !copia.crm.tableros.length) {
    caja.append(h('p', { class: 'vacio' }, 'El CRM no quedó guardado en la última copia.'));
    return caja;
  }
  const tableros = copia.crm.tableros;
  const funnelIdx = Math.min(e.funnelIdx ?? 0, tableros.length - 1);
  const t = tableros[funnelIdx];
  const buscador = h('input', { class: 'campo buscar', type: 'search', placeholder: 'Buscar por nombre, email o teléfono', value: e.filtro ?? '' }) as HTMLInputElement;
  buscador.addEventListener('input', () => {
    const cols = caja.querySelector('.columnas');
    if (cols) cols.replaceWith(columnasCrm({ ...ctx, e: { ...e, funnelIdx, filtro: buscador.value } }, t));
  });
  const barra = h('div', { class: 'barra' },
    tableros.length > 1 ? selector(tableros.map((x) => x.funnels.find((f) => f.id === x.funnelId)?.nombre ?? 'CRM'), funnelIdx, (i) => ctx.otra('crm', { funnelIdx: i, filtro: buscador.value })) : null,
    buscador);
  caja.append(barra, columnasCrm({ ...ctx, e: { ...e, funnelIdx } }, t));
  return caja;
}

function selector(opciones: string[], actual: number, al: (i: number) => void): HTMLElement {
  const s = h('select', { class: 'campo selector', 'aria-label': 'Funnel' }, ...opciones.map((o, i) => {
    const op = h('option', { value: String(i) }, o) as HTMLOptionElement;
    op.selected = i === actual;
    return op;
  })) as HTMLSelectElement;
  s.addEventListener('change', () => al(Number(s.value)));
  return s;
}

const coincide = (c: TarjetaCrmM, f: string) => {
  const q = f.trim().toLowerCase();
  if (!q) return true;
  return [c.nombre, c.segunda, c.telefono, c.contacto?.email].some((x) => (x ?? '').toLowerCase().includes(q));
};

function columnasCrm(ctx: Ctx, t: TableroCrmM): HTMLElement {
  const filtro = ctx.e.filtro ?? '';
  return h('div', { class: 'columnas' }, ...t.columnas.map((col) => {
    const tarjetas = t.tarjetas.filter((c) => c.col === col.key && coincide(c, filtro));
    return h('div', { class: 'columna' },
      h('div', { class: 'columna-titulo' }, h('span', {}, col.titulo), h('span', { class: 'cuantos' }, String(filtro ? tarjetas.length : col.cuantos))),
      col.total ? h('div', { class: 'columna-total' }, col.total) : null,
      ...tarjetas.map((c) => h('button', { type: 'button', class: 'tarjeta', onclick: () => ficha(ctx, t, c) },
        h('span', { class: 'tarjeta-nombre' }, c.nombre),
        c.segunda ? h('span', { class: 'tarjeta-segunda' }, c.segunda) : null,
        ctx.pendientes.leads.has(c.id) ? h('span', { class: 'pendiente' }, 'Se sube al volver') : null,
        h('span', { class: 'tarjeta-pie' },
          c.plata ? h('span', {}, c.plata) : null,
          c.senal.texto ? h('span', { class: `senal ${c.senal.tono ?? ''}` }, c.senal.texto) : null))));
  }));
}

function fecha(iso: string | null, tz: string): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    return new Intl.DateTimeFormat('es-AR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);
  } catch { return new Date(t).toLocaleString(); }
}

/** A qué columnas se puede llevar este lead sin conexión: las mismas reglas que el teléfono (`movible` y `sale`). */
function destinosDe(t: TableroCrmM, c: TarjetaCrmM) {
  const actual = t.columnas.find((x) => x.key === c.col);
  if (!actual?.sale) return [];
  return t.columnas.filter((x) => x.key !== c.col && x.movible);
}

function ficha(ctx: Ctx, t: TableroCrmM, c: TarjetaCrmM) {
  const { copia, s, base } = ctx;
  const funnelIdx = Math.max(0, copia.crm?.tableros.indexOf(t) ?? 0);
  const volver = () => ctx.otra('crm', { ...ctx.e, funnelIdx, fichaDe: c.id });
  const etapa = t.columnas.find((x) => x.key === c.col)?.titulo ?? null;
  const k = c.contacto;
  const dato = (rotulo: string, valor: string | null | undefined) => valor ? h('div', { class: 'dato' }, h('dt', {}, rotulo), h('dd', {}, valor)) : null;
  const notas = copia.crm?.notas[String(c.id)] ?? [];
  const cerrar = () => { capa.remove(); document.removeEventListener('keydown', esc); };
  const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', esc);

  // Mover de etapa: sólo a donde el teléfono mueve.
  const destinos = destinosDe(t, c);
  const selEtapa = h('select', { class: 'campo', 'aria-label': 'Mover a' },
    h('option', { value: '' }, 'Mover a…'), ...destinos.map((x) => h('option', { value: x.key }, x.titulo))) as HTMLSelectElement;
  selEtapa.addEventListener('change', () => {
    if (!selEtapa.value) return;
    void escribir(s, base, { tipo: 'etapa', leadId: c.id, funnelId: t.funnelId ?? null, antes: c.col, despues: selEtapa.value }, volver);
  });
  const mover = destinos.length
    ? h('div', { class: 'escribir' }, selEtapa)
    : h('p', { class: 'nota' }, 'Desde esta etapa no se mueve sin conexión (Ganado, un cobro o un paso con datos se hacen con conexión).');

  // Nombre, email y empresa.
  const campos = [
    ['nombre', 'Nombre', c.nombre] as const,
    ['email', 'Email', k?.email ?? ''] as const,
    ['empresa', 'Empresa', k?.empresa ?? ''] as const,
  ];
  const inputs = campos.map(([campo, rotulo, valor]) => ({ campo, valor, el: h('input', { class: 'campo', 'aria-label': rotulo, value: valor, placeholder: rotulo }) as HTMLInputElement }));
  const formContacto = h('form', {
    class: 'escribir', hidden: true,
    onsubmit: (ev: Event) => {
      ev.preventDefault();
      void (async () => {
        for (const i of inputs) {
          const nuevo = i.el.value.trim();
          if (nuevo === (i.valor ?? '').trim() || (i.campo === 'nombre' && !nuevo)) continue;
          const op: Operacion = { id: idDeCambio(), ws: base.negocio.id, hecha: new Date().toISOString(), cambio: { tipo: 'contacto', leadId: c.id, campo: i.campo, antes: i.valor || null, despues: nuevo || null } };
          if (!(await encolar({ email: s.email, llave: s.llave, almacen: s.almacen, op }))) { avisar('Hay demasiados cambios sin subir.'); break; }
          s.cola.push(op);
        }
        volver();
      })();
    },
  }, ...inputs.map((i) => i.el), h('button', { type: 'submit', class: 'boton' }, 'Guardar'));
  const editar = h('button', { type: 'button', class: 'boton-texto', onclick: () => { formContacto.hidden = !formContacto.hidden; } }, 'Editar nombre, email o empresa');

  // Una nota.
  const nota = h('textarea', { class: 'campo area', rows: '3', placeholder: 'Escribe una nota', maxlength: String(TOPE_NOTA_COLA) }) as HTMLTextAreaElement;
  const formNota = h('form', {
    class: 'escribir',
    onsubmit: (ev: Event) => {
      ev.preventDefault();
      const texto = nota.value.trim();
      if (!texto) return;
      void escribir(s, base, { tipo: 'nota', leadId: c.id, texto }, volver);
    },
  }, nota, h('button', { type: 'submit', class: 'boton' }, 'Guardar nota'));

  const capa = h('div', { class: 'capa', onclick: (ev: Event) => { if (ev.target === capa) cerrar(); } },
    h('aside', { class: 'ficha', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.nombre },
      h('div', { class: 'ficha-cabeza' }, h('h2', {}, c.nombre), h('button', { type: 'button', class: 'boton-texto', onclick: cerrar }, 'Cerrar')),
      ctx.pendientes.leads.has(c.id) ? h('p', { class: 'pendiente' }, 'Tiene cambios que se suben cuando vuelva la conexión, con tu OK.') : null,
      h('dl', { class: 'datos' },
        dato('Etapa', etapa),
        dato('Teléfono', c.telefono ? `+${c.telefono}` : null),
        dato('Email', k?.email),
        dato('Instagram', c.soloInstagram ? `@${c.soloInstagram}` : null),
        dato('Empresa', k?.empresa),
        dato('Llegó por', k?.origen),
        dato('Llegó', fecha(k?.creado ?? null, copia.tz)),
        dato('Reunión', fecha(k?.reunion ?? null, copia.tz)),
        dato('Monto', c.plata)),
      mover,
      editar, formContacto,
      h('p', { class: 'nota' }, NECESITA_CONEXION.whatsapp),
      h('h3', {}, 'Notas'),
      formNota,
      notas.length
        ? h('ul', { class: 'notas' }, ...notas.map((n) => h('li', {},
          h('p', {}, n.texto),
          h('span', { class: 'nota' }, `${n.autor} · ${fecha(n.cuando, copia.tz) ?? ''}`),
          n.pendiente ? h('span', { class: 'pendiente' }, 'Se sube al volver') : null)))
        // Con el tope de filas de notas alcanzado, «sin notas» puede ser que las suyas eran viejas: se dice.
        : h('p', { class: 'vacio' }, copia.crm?.notasRecortadas ? 'Sin notas en la copia (guarda las más nuevas del negocio).' : 'Sin notas guardadas.')));
  raiz().append(capa);
  (capa.querySelector('button') as HTMLButtonElement | null)?.focus();
}

// ── Plan ────────────────────────────────────────────────────────────────────

type VistaPlan = 'prioridades' | 'tareas' | 'proyectos' | 'recurrentes';
const VISTAS: Array<[VistaPlan, string]> = [['prioridades', 'Prioridades'], ['tareas', 'Tareas'], ['proyectos', 'Proyectos'], ['recurrentes', 'Recurrentes']];

function vistaPlan(ctx: Ctx): HTMLElement {
  const { copia, s, base, pendientes } = ctx;
  const vista = ctx.e.vistaPlan ?? 'prioridades';
  const caja = h('section', { class: 'plan' });
  const p = copia.plan;
  if (!p) {
    caja.append(h('p', { class: 'vacio' }, 'El Plan no quedó guardado en la última copia.'));
    return caja;
  }
  const seg = h('div', { class: 'segmentado', role: 'tablist' }, ...VISTAS.map(([k, t]) => h('button', {
    type: 'button', role: 'tab', class: 'segmento', 'aria-selected': k === vista ? 'true' : 'false',
    onclick: () => ctx.otra('plan', { vistaPlan: k }),
  }, t)));
  caja.append(seg);
  const proyecto = (x: { proyecto: { nombre: string; emoji: string } | null }) => x.proyecto ? `${x.proyecto.emoji ? x.proyecto.emoji + ' ' : ''}${x.proyecto.nombre}` : null;
  const plazo = (d: string | null, vencida?: boolean) => d ? h('span', { class: vencida ? 'senal rojo' : 'senal' }, `${d.slice(8, 10)}/${d.slice(5, 7)}`) : null;
  const enTareas = () => ctx.otra('plan', { vistaPlan: 'tareas' });
  if (vista === 'prioridades') {
    caja.append(p.prioridades.length
      ? h('ul', { class: 'lista' }, ...p.prioridades.map((t) => h('li', { class: 'fila' },
        h('span', { class: 'fila-titulo' }, t.titulo), h('span', { class: 'fila-segunda' }, proyecto(t) ?? ''), plazo(t.deadline, t.vencida))))
      : h('p', { class: 'vacio' }, 'Sin prioridades en la última copia.'));
  } else if (vista === 'tareas') {
    // Una tarea nueva: al subir queda como BORRADOR para confirmar en el Plan (ninguna alta entra directo).
    const titulo = h('input', { class: 'campo', placeholder: 'Nueva tarea', maxlength: String(TOPE_TITULO), 'aria-label': 'Nueva tarea' }) as HTMLInputElement;
    caja.append(h('form', {
      class: 'escribir en-fila',
      onsubmit: (ev: Event) => {
        ev.preventDefault();
        const t = titulo.value.trim();
        if (t) void escribir(s, base, { tipo: 'tarea-nueva', titulo: t }, enTareas);
      },
    }, titulo, h('button', { type: 'submit', class: 'boton' }, 'Agregar')));
    caja.append(h('div', { class: 'columnas' }, ...p.columnas.map((col) => {
      const ts = p.tareas.filter((t) => t.col === col.key);
      return h('div', { class: 'columna' },
        h('div', { class: 'columna-titulo' }, h('span', {}, col.titulo), h('span', { class: 'cuantos' }, String(col.cuantos))),
        ...ts.map((t) => {
          // Una tarea creada sin conexión todavía no existe en el servidor: no se mueve hasta confirmarla.
          const esBorrador = s.cola.some((op) => op.id === t.id);
          const mover = esBorrador ? null : (() => {
            const sel = h('select', { class: 'campo mini', 'aria-label': `Mover «${t.titulo}»` },
              h('option', { value: '' }, 'Mover a…'), ...p.columnas.filter((x) => x.key !== t.col).map((x) => h('option', { value: x.key }, x.titulo))) as HTMLSelectElement;
            sel.addEventListener('change', () => {
              if (sel.value) void escribir(s, base, { tipo: 'tarea-estado', tareaId: t.id, antes: t.col, despues: sel.value }, enTareas);
            });
            return sel;
          })();
          return h('div', { class: 'tarjeta' },
            h('span', { class: 'tarjeta-nombre' }, t.titulo),
            proyecto(t) ? h('span', { class: 'tarjeta-segunda' }, proyecto(t) as string) : null,
            t.motivo ? h('span', { class: 'tarjeta-segunda' }, t.motivo) : null,
            pendientes.tareas.has(t.id) ? h('span', { class: 'pendiente' }, 'Se sube al volver') : null,
            h('span', { class: 'tarjeta-pie' }, plazo(t.deadline, t.vencida)),
            mover);
        }));
    })));
  } else if (vista === 'proyectos') {
    caja.append(p.proyectos.length
      ? h('ul', { class: 'lista' }, ...p.proyectos.map((x) => h('li', { class: 'fila' },
        h('span', { class: 'fila-titulo' }, `${x.emoji ? x.emoji + ' ' : ''}${x.nombre}`),
        h('span', { class: 'fila-segunda' }, `${x.hechas} de ${x.total} · ${x.pct}%`), plazo(x.deadline))))
      : h('p', { class: 'vacio' }, 'Sin proyectos en la última copia.'));
  } else {
    caja.append(p.recurrentes.length
      ? h('ul', { class: 'lista' }, ...p.recurrentes.map((x) => h('li', { class: 'fila' },
        h('span', { class: 'fila-titulo' }, x.titulo), h('span', { class: 'fila-segunda' }, x.repite ?? 'Se repite'))))
      : h('p', { class: 'vacio' }, 'Sin recurrentes en la última copia.'));
  }
  if (p.recortado) caja.append(h('p', { class: 'nota' }, 'Puede faltar parte del plan.'));
  return caja;
}

// ── Arranque ────────────────────────────────────────────────────────────────

export function arrancar() {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) {
    pintar(h('div', { class: 'entrar' }, h('h1', {}, 'MaKo sin conexión'), h('p', { class: 'bajada' }, 'Este navegador no puede abrir lo guardado.')));
    return;
  }
  document.addEventListener('pointerdown', alTocar, true);
  document.addEventListener('keydown', alTocar, true);
  // Al irse de la página se borra lo dibujado; al volver del historial (la página guardada entera por el navegador) se pide la
  // clave otra vez: nunca se ve lo de la sesión anterior sin ella.
  window.addEventListener('pagehide', () => bloquear());
  window.addEventListener('pageshow', (ev) => { if ((ev as PageTransitionEvent).persisted) bloquear(); });
  pantallaEntrar();
}

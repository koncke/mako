// =============================================================================
// El cascarón de MaKo sin conexión: lo que se ve cuando no hay red o MaKo no responde (navegador, 28/10/2026)
// =============================================================================
// Se arma con esbuild (scripts/sin-conexion/armar.mjs) a public/sin-conexion/app.js; el service worker (public/sw.js) lo
// devuelve en vez de la página cuando el servidor no contesta. Es IGUAL para todos y no trae un dato de nadie: lo de cada
// persona está cifrado en su base (./almacen.ts) y abre sólo con su clave (./local.ts).
//
// T1 (28/10/2026): SÓLO LECTURA del CRM (el tablero de cada funnel, la ficha con sus notas) y del Plan (Prioridades · Tareas ·
// Proyectos · Recurrentes), con la cinta «Sin conexión · lo que ves es lo de las 10:42». Escribir a la cola es T2
// (docs/diseno-mako-desktop-sin-conexion.md).
// Sin React ni Next: DOM a mano, con `textContent` siempre (nunca `innerHTML` con un dato).
//
// LO DESCIFRADO VIVE SÓLO EN LA PANTALLA (la verificación del Cerebro, 28/10/2026): ninguna variable del módulo guarda la
// llave ni las copias, y nada se escribe en localStorage. Arranca SIEMPRE pidiendo la clave; «Salir», salir de la página
// (`pagehide`), volver del historial (`pageshow` con `persisted`) o `BLOQUEO_INACTIVO_MS` sin tocar nada vuelven a pedirla y
// borran lo dibujado. Así quien llega después a la misma PC no ve lo de la sesión anterior.
// =============================================================================

import { almacenIdb, existeBase } from './almacen';
import { nombreDeBase } from './cifra';
import { abrir } from './local';
import { BLOQUEO_INACTIVO_MS, deCuando, NECESITA_CONEXION, normalizarEmail, textoDeLaCinta, type CopiaV1, type MotivoSinConexion } from './reglas';
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

async function entrar(emailCrudo: string, clave: string) {
  const email = normalizarEmail(emailCrudo);
  const nombre = await nombreDeBase(email);
  if (!(await existeBase(nombre))) return pantallaEntrar(NO_COINCIDE);
  const r = await abrir({ email, clave, almacen: almacenIdb(nombre) });
  if (!r.ok) {
    if (r.motivo === 'vencida') return pantallaEntrar('Lo guardado tenía más de 30 días sin conexión y se borró. Vuelve a activarlo con conexión.');
    return pantallaEntrar(NO_COINCIDE);
  }
  if (!r.copias.length) {
    return pantallaEntrar(r.viejas
      ? 'Lo guardado es de una versión anterior. Abre MaKo una vez con conexión para renovarlo.'
      : 'Todavía no hay una copia guardada. Se guarda sola con conexión, cada 10 minutos.');
  }
  if (r.copias.length === 1) return pantallaNegocio(r.copias[0], r.copias);
  pantallaElegir(r.copias);
}

function pantallaElegir(copias: CopiaV1[]) {
  pintar(h('div', { class: 'entrar' },
    h('h1', {}, '¿Qué negocio?'),
    ...copias.map((c) => h('button', { type: 'button', class: 'fila-negocio', onclick: () => pantallaNegocio(c, copias) }, c.negocio.nombre))));
}

// ── Adentro ─────────────────────────────────────────────────────────────────

function cinta(copia: CopiaV1): HTMLElement {
  const m = motivo();
  // Abierto con conexión desde «Probar» (Settings › Instalar la app): la misma cinta, sin decir que no hay red.
  const texto = m === 'probando'
    ? `Así se ve MaKo sin conexión · lo que ves es ${deCuando(copia.hecha, copia.tz)}`
    : textoDeLaCinta({ motivo: m, hecha: copia.hecha, tz: copia.tz });
  return h('div', { class: 'cinta', role: 'status' },
    h('span', {}, texto),
    h('button', { type: 'button', class: 'cinta-boton', onclick: () => location.reload() }, 'Reintentar'));
}

type Tab = 'crm' | 'plan';

function pantallaNegocio(copia: CopiaV1, copias: CopiaV1[], tab: Tab = location.pathname.startsWith('/plan') ? 'plan' : 'crm') {
  const cuerpo = h('main', { class: 'cuerpo' });
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Secciones' },
    ...(['crm', 'plan'] as const).map((t) => h('button', {
      type: 'button', class: 'tab', 'aria-current': t === tab ? 'page' : undefined,
      onclick: () => pantallaNegocio(copia, copias, t),
    }, t === 'crm' ? 'CRM' : 'Plan')));
  const cabecera = h('header', { class: 'cabecera' },
    h('span', { class: 'marca' }, 'MaKo'),
    copias.length > 1
      ? h('button', { type: 'button', class: 'boton-texto', onclick: () => pantallaElegir(copias) }, copia.negocio.nombre)
      : h('span', { class: 'negocio' }, copia.negocio.nombre),
    tabs,
    h('span', { class: 'quien' }, copia.persona.nombre),
    h('button', { type: 'button', class: 'boton-texto salir', onclick: () => bloquear() }, 'Salir'));
  const faltan = copia.faltan.length
    ? h('p', { class: 'aviso' }, `No se pudo guardar ${copia.faltan.join(' ni ')} en la última copia.`) : null;
  if (tab === 'crm') cuerpo.append(vistaCrm(copia));
  else cuerpo.append(vistaPlan(copia));
  armarReloj();
  pintar(cinta(copia), cabecera, faltan, cuerpo,
    h('p', { class: 'pie' }, `${NECESITA_CONEXION.escribir} WhatsApp, la IA y los cobros necesitan conexión.`));
}

// ── CRM ─────────────────────────────────────────────────────────────────────

function vistaCrm(copia: CopiaV1, funnelIdx = 0, filtro = ''): HTMLElement {
  const caja = h('section', { class: 'crm' });
  if (!copia.crm || !copia.crm.tableros.length) {
    caja.append(h('p', { class: 'vacio' }, 'El CRM no quedó guardado en la última copia.'));
    return caja;
  }
  const tableros = copia.crm.tableros;
  const t = tableros[Math.min(funnelIdx, tableros.length - 1)];
  const redibujar = (i: number, f: string) => caja.replaceWith(vistaCrm(copia, i, f));
  const buscador = h('input', { class: 'campo buscar', type: 'search', placeholder: 'Buscar por nombre, email o teléfono', value: filtro }) as HTMLInputElement;
  buscador.addEventListener('input', () => {
    const cols = caja.querySelector('.columnas');
    if (cols) cols.replaceWith(columnasCrm(copia, t, buscador.value));
  });
  const barra = h('div', { class: 'barra' },
    tableros.length > 1 ? selector(tableros.map((x) => x.funnels.find((f) => f.id === x.funnelId)?.nombre ?? 'CRM'), funnelIdx, (i) => redibujar(i, buscador.value)) : null,
    buscador);
  caja.append(barra, columnasCrm(copia, t, filtro));
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

function columnasCrm(copia: CopiaV1, t: TableroCrmM, filtro: string): HTMLElement {
  return h('div', { class: 'columnas' }, ...t.columnas.map((col) => {
    const tarjetas = t.tarjetas.filter((c) => c.col === col.key && coincide(c, filtro));
    return h('div', { class: 'columna' },
      h('div', { class: 'columna-titulo' }, h('span', {}, col.titulo), h('span', { class: 'cuantos' }, String(filtro ? tarjetas.length : col.cuantos))),
      col.total ? h('div', { class: 'columna-total' }, col.total) : null,
      ...tarjetas.map((c) => h('button', { type: 'button', class: 'tarjeta', onclick: () => ficha(copia, t, c) },
        h('span', { class: 'tarjeta-nombre' }, c.nombre),
        c.segunda ? h('span', { class: 'tarjeta-segunda' }, c.segunda) : null,
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

function ficha(copia: CopiaV1, t: TableroCrmM, c: TarjetaCrmM) {
  const etapa = t.columnas.find((x) => x.key === c.col)?.titulo ?? null;
  const k = c.contacto;
  const dato = (rotulo: string, valor: string | null | undefined) => valor ? h('div', { class: 'dato' }, h('dt', {}, rotulo), h('dd', {}, valor)) : null;
  const notas = copia.crm?.notas[String(c.id)] ?? [];
  const cerrar = () => { capa.remove(); document.removeEventListener('keydown', esc); };
  const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', esc);
  const capa = h('div', { class: 'capa', onclick: (ev: Event) => { if (ev.target === capa) cerrar(); } },
    h('aside', { class: 'ficha', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.nombre },
      h('div', { class: 'ficha-cabeza' }, h('h2', {}, c.nombre), h('button', { type: 'button', class: 'boton-texto', onclick: cerrar }, 'Cerrar')),
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
      h('p', { class: 'nota' }, NECESITA_CONEXION.whatsapp),
      h('h3', {}, 'Notas'),
      notas.length
        ? h('ul', { class: 'notas' }, ...notas.map((n) => h('li', {}, h('p', {}, n.texto), h('span', { class: 'nota' }, `${n.autor} · ${fecha(n.cuando, copia.tz) ?? ''}`))))
        : h('p', { class: 'vacio' }, 'Sin notas guardadas.')));
  raiz().append(capa);
  (capa.querySelector('button') as HTMLButtonElement | null)?.focus();
}

// ── Plan ────────────────────────────────────────────────────────────────────

type VistaPlan = 'prioridades' | 'tareas' | 'proyectos' | 'recurrentes';
const VISTAS: Array<[VistaPlan, string]> = [['prioridades', 'Prioridades'], ['tareas', 'Tareas'], ['proyectos', 'Proyectos'], ['recurrentes', 'Recurrentes']];

function vistaPlan(copia: CopiaV1, vista: VistaPlan = 'prioridades'): HTMLElement {
  const caja = h('section', { class: 'plan' });
  const p = copia.plan;
  if (!p) {
    caja.append(h('p', { class: 'vacio' }, 'El Plan no quedó guardado en la última copia.'));
    return caja;
  }
  const seg = h('div', { class: 'segmentado', role: 'tablist' }, ...VISTAS.map(([k, t]) => h('button', {
    type: 'button', role: 'tab', class: 'segmento', 'aria-selected': k === vista ? 'true' : 'false',
    onclick: () => caja.replaceWith(vistaPlan(copia, k)),
  }, t)));
  caja.append(seg);
  const proyecto = (x: { proyecto: { nombre: string; emoji: string } | null }) => x.proyecto ? `${x.proyecto.emoji ? x.proyecto.emoji + ' ' : ''}${x.proyecto.nombre}` : null;
  const plazo = (d: string | null, vencida?: boolean) => d ? h('span', { class: vencida ? 'senal rojo' : 'senal' }, `${d.slice(8, 10)}/${d.slice(5, 7)}`) : null;
  if (vista === 'prioridades') {
    caja.append(p.prioridades.length
      ? h('ul', { class: 'lista' }, ...p.prioridades.map((t) => h('li', { class: 'fila' },
        h('span', { class: 'fila-titulo' }, t.titulo), h('span', { class: 'fila-segunda' }, proyecto(t) ?? ''), plazo(t.deadline, t.vencida))))
      : h('p', { class: 'vacio' }, 'Sin prioridades en la última copia.'));
  } else if (vista === 'tareas') {
    caja.append(h('div', { class: 'columnas' }, ...p.columnas.map((col) => {
      const ts = p.tareas.filter((t) => t.col === col.key);
      return h('div', { class: 'columna' },
        h('div', { class: 'columna-titulo' }, h('span', {}, col.titulo), h('span', { class: 'cuantos' }, String(col.cuantos))),
        ...ts.map((t) => h('div', { class: 'tarjeta' },
          h('span', { class: 'tarjeta-nombre' }, t.titulo),
          proyecto(t) ? h('span', { class: 'tarjeta-segunda' }, proyecto(t) as string) : null,
          t.motivo ? h('span', { class: 'tarjeta-segunda' }, t.motivo) : null,
          h('span', { class: 'tarjeta-pie' }, plazo(t.deadline, t.vencida)))));
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

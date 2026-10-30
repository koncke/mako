// =============================================================================
// cerebro-vivo — lo que el negocio TIENE hoy en el resto de MaKo, como nodos del grafo (17/10/2026)
// =============================================================================
// Punto 13 del feedback de Martín del 17/10 («reconstruir al 100% la lógica de agregar nodos, con todo lo que hay
// hoy: los chats, los gráficos y los datos del negocio, Offer, el funnel, los productos, los leads»). El diseño está
// en docs/diseno-second-brain-grafo.md; acá vive la parte PURA: recibe las lecturas ya hechas (lib/cerebro-grafo.ts
// las pide en su mismo Promise.all) y suma nodos y aristas. Sin `server-only` y sin Supabase: lo prueba
// tests/second-brain-vivo.test.ts con datos armados a mano.
//
// LAS REGLAS DE SIEMPRE DEL GRAFO, que acá también mandan (lib/cerebro-grafo.ts las explica):
//   · un nodo es una cosa que alguien puede señalar y decir «eso es mío»; un atributo es un DATO del nodo;
//   · una fuente entra cuando trae al menos una arista que suma; si no, entra AGREGADA en un nodo;
//   · el VOLUMEN no es un nodo: los leads son UN nodo con sus números, y cuántos hay en cada etapa es un dato de la
//     etapa — nunca un nodo por lead;
//   · el id sale de la clave de la fuente (la huella del layout depende de ids estables).
// Y LAS NUEVAS:
//   · cada nodo trae su `tipo` (el supertag de Tana) y su `nace` (el `created_at` de su fila, el `valid_at` de
//     Graphiti): de ahí salen «Lo último» y el nodo que viaja al entrar;
//   · cada nodo que se edita en OTRA pantalla trae su `href` y su `abrirEn` («Abrir en Offer»): la barra lateral
//     lleva ahí en vez de prometer un «Editar» que no es de acá.
// =============================================================================

import type { AreaId, AristaCerebro, NodoCerebro } from './cerebro-modelo';
import { matchNodo } from './buscar-cerebro';

// ── Las lecturas, ya hechas ──────────────────────────────────────────────────
// Tipos mínimos y propios a propósito: este módulo no puede importar los de lib/ofertas.ts o lib/leads.ts, que
// llevan `server-only`. Lo que entra acá es lo que el grafo USA de cada fila, nada más.

export type OfertaViva = {
  id: number; nombre: string; precio_usd: number | null; modelo?: string | null; precio_nota: string | null;
  promesa: string | null; incluye: string | null; garantia: string | null; para_quien?: string | null;
  bonos?: Array<{ nombre?: string | null }> | null; es_principal: boolean; activa: boolean; origen: string;
  desde_brief?: boolean | null;
};
export type LigaProductoViva = { oferta_id: number; producto_id: number; rol: string };
export type LigaFunnelViva = { funnel_id: number; oferta_id: number; es_principal: boolean };
export type LeadMagnetVivo = { id: number; oferta_id: number | null; nombre: string; tipo: string | null; que_es: string | null; fomo: string | null; enlace: string | null };
export type FunnelVivo = { id: number; nombre: string; canal: string | null; esDefault: boolean };
export type ConteoLeads = {
  total: number;
  nuevos7d: number;
  sinAsignar: number;
  porEtapa: Array<{ key: string; leads: number }>;
  origenes: Array<{ origen: string; leads: number }>;
};
export type ObjetivoVivo = { id: string; titulo: string; metaValor: number; unidad: string; quarter: number | null; anio: number; funnelIds: number[] };
export type KpiVivo = { id: string; nombre: string; objectiveId: string | null; compromiso: number; unidad: string; cadencia: string; funnelIds: number[] };
/** Un cliente: un lead con la venta GANADA en el CRM (lib/clientes-ganados.ts es la definición de «cliente» del producto). */
export type ClienteVivo = { leadId: number; nombre: string; empresa: string | null; fechaCierre: string | null; sinCobro: boolean };
/** Los clientes de hoy: el total EXACTO y los más recientes (el volumen no es un nodo por cliente). */
export type ClientesVivos = { total: number; recientes: ClienteVivo[] };
/** Una reunión de venta que el Closing Analyst ya leyó (`closing_analyses`, mig 0037). */
export type ReunionViva = {
  id: number; leadId: number | null; leadNombre: string | null; titulo: string | null; fecha: string | null; tipo: string | null;
  closer: string | null; score: number | null; outcome: string | null; resumen: string | null; duracionMin: number | null;
};
export type ChatOfferVivo = { id: number; titulo: string; estado: string; updatedAt: string };
export type ChatMakoVivo = {
  id: number | string; titulo: string | null; updatedAt: string;
  /** Sólo las charlas de una TAB (23/10/2026, lib/cerebro-chats-tabs.ts): de qué tab son, con el nombre que les da el Ops Center
   *  («CRM», «Automations», «Web Generator»…), y la entidad de la que hablan si su clave la nombra. Sin `tab`, es un chat de la
   *  estrella de la persona. */
  tab?: string;
  entidad?: { tipo: 'funnel' | 'lead'; id: number } | null;
};
/** `created_at` por tabla y por id (lib/cerebro-grafo.ts → fechasDeAlta). Lo que falta es `null`: nunca se inventa. */
export type FechasDeAlta = Partial<Record<'ofertas' | 'productos' | 'lead_magnets' | 'funnels' | 'objectives' | 'kpis' | 'offer_sesiones', Record<string, string>>>;

export type LecturasVivas = {
  ofertas: OfertaViva[];
  ligasProducto: LigaProductoViva[];
  ligasFunnel: LigaFunnelViva[];
  leadMagnets: LeadMagnetVivo[];
  funnels: FunnelVivo[];
  leads: ConteoLeads | null;
  objetivos: ObjetivoVivo[];
  kpis: KpiVivo[];
  chatsOffer: ChatOfferVivo[];
  /** Lo que MaKo SABE de la venta (18/10/2026): los clientes y las reuniones de venta ya leídas. Sin ellos no hay nodos. */
  clientes?: ClientesVivos | null;
  reuniones?: ReunionViva[];
  /** Los chats con MaKo de QUIEN MIRA. Sólo los pasa la pantalla: son de la persona, no del negocio, así que ni el
   *  ZIP ni la API los reciben (no hay persona). */
  chatsMako?: ChatMakoVivo[];
  fechas: FechasDeAlta;
};

export const LECTURAS_VACIAS: LecturasVivas = {
  ofertas: [], ligasProducto: [], ligasFunnel: [], leadMagnets: [], funnels: [], leads: null,
  objetivos: [], kpis: [], chatsOffer: [], fechas: {},
};

/** Los topes: cuántos de cada fuente entran, para que el mapa siga siendo un mapa (y el paquete de un chat, chico). */
export const TOPES_VIVOS = { chatsOffer: 6, chatsMako: 8, origenes: 3, clientes: 8, reuniones: 6, tabsConChat: 8, entidadesPorTab: 4 } as const;

/** En qué área del mapa cae el chat jefe de cada tab: la de lo que esa tab trabaja. Lo que no está acá, en el Resumen. */
export const AREA_DE_TAB: Readonly<Record<string, AreaId>> = {
  CRM: 'funnel', Ficha: 'funnel', Automations: 'funnel',
  'Web Generator': 'oferta',
  Dashboard: 'norte',
  Ads: 'razones',
  'Image Editor': 'voz', 'Video Editor': 'voz',
};

// ── El armado ────────────────────────────────────────────────────────────────

const limpio = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');
function corto(s: string, max = 30): string {
  const t = limpio(s).replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const c = t.slice(0, max);
  const esp = c.lastIndexOf(' ');
  return `${(esp > max * 0.6 ? c.slice(0, esp) : c).trimEnd()}…`;
}
/** «1.500»: el punto de miles a mano. `toLocaleString('es')` NO agrupa los números de cuatro cifras (la regla del
 *  español, `minimumGroupingDigits: 2`): decía «USD 1500» y «USD 12.000» en la misma pantalla. */
const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const usd = (n: number) => `USD ${miles(n)}`;
const MODELO: Record<string, string> = { unico: 'pago único', pago_unico: 'pago único', suscripcion: 'por mes', cuotas: 'en cuotas' };
/** Los roles de `oferta_productos` (mig 0169: principal · bump · incluido). */
const ROL: Record<string, string> = { principal: 'Lo que vende esta oferta', bump: 'Lo que se suma al pagar esta oferta', incluido: 'Viene incluido en esta oferta' };

type Armado = {
  /** El grafo hasta acá (lo arma lib/cerebro-grafo.ts antes de llamar): se suma ENCIMA, y se cuelga de lo que ya está. */
  nodos: NodoCerebro[];
  aristas: AristaCerebro[];
};

/** Suma lo vivo al grafo, sobre los mismos arreglos. Una arista sólo se tiende si sus DOS puntas existen. */
export function agregarLoVivo(g: Armado, l: LecturasVivas, opciones: { raiz: string; primeraEtapa: string | null; etapasEnMapa: ReadonlySet<string> }): void {
  const ids = new Set(g.nodos.map((n) => n.id));
  const push = (n: NodoCerebro) => { g.nodos.push(n); ids.add(n.id); return n.id; };
  const hay = (id: string) => ids.has(id);
  const unir = (de: string, a: string, motivo: string) => { if (hay(de) && hay(a)) g.aristas.push({ de, a, motivo }); };
  const fecha = (t: keyof FechasDeAlta, id: number | string) => l.fechas[t]?.[String(id)] ?? null;

  // ── Las OFERTAS (la entidad de Offer, mig 0169), con sus productos, sus funnels y su lead magnet ──
  const ofertas = l.ofertas.filter((o) => o.activa);
  const principal = ofertas.find((o) => o.es_principal) ?? ofertas[0] ?? null;
  for (const o of ofertas) {
    const precio = o.precio_usd == null ? limpio(o.precio_nota) : `${usd(o.precio_usd)}${o.modelo && MODELO[o.modelo] ? ` · ${MODELO[o.modelo]}` : ''}`;
    const bonos = (o.bonos ?? []).map((b) => limpio(b?.nombre)).filter(Boolean);
    const id = push({
      id: `oferta:${o.id}`, area: 'oferta', tipo: o.es_principal ? 'Oferta principal' : 'Oferta',
      etiqueta: corto(o.nombre, 32), detalle: limpio(o.promesa),
      datos: [
        { k: 'Precio', v: precio },
        { k: 'Incluye', v: limpio(o.incluye) },
        { k: 'Garantía', v: limpio(o.garantia) },
        { k: 'Para quién', v: limpio(o.para_quien) },
        { k: 'Bonos', v: bonos.join(' · ') },
      ],
      fuente: o.desde_brief ? 'de tu brief, guardada como oferta' : /offer|mako|ia/i.test(o.origen) ? 'la armaste con MaKo en Offer' : 'la cargaste en Offer',
      autoria: /offer|mako|ia/i.test(o.origen) ? 'mako' : 'usuario',
      nace: fecha('ofertas', o.id), href: `/offer?oferta=${o.id}`, abrirEn: 'Offer',
    });
    // La oferta principal y el nombre que dice el brief son la MISMA cosa contada dos veces: se unen, no se funden
    // (el campo trae de qué documento salió, y eso no se pierde).
    if (o === principal && hay('campo:oferta_nombre')) unir('campo:oferta_nombre', id, 'Es el nombre de esta oferta en tu brief');
  }
  for (const lp of l.ligasProducto) {
    if (!hay(`oferta:${lp.oferta_id}`) || !hay(`prod:${lp.producto_id}`)) continue;
    unir(`oferta:${lp.oferta_id}`, `prod:${lp.producto_id}`, ROL[lp.rol] ?? 'Un producto de esta oferta');
  }

  // ── Los LEAD MAGNETS de Offer (mig 0169). Los de El Archivero (`ent:`) siguen: si uno se llama igual, es el mismo y
  //    no entra dos veces. ──
  const nombresEnt = new Set(g.nodos.filter((n) => n.id.startsWith('ent:')).map((n) => n.etiqueta.toLowerCase()));
  for (const m of l.leadMagnets) {
    if (nombresEnt.has(corto(m.nombre, 30).toLowerCase())) continue;
    const id = push({
      id: `lm:${m.id}`, area: 'entregables', tipo: 'Lead magnet', etiqueta: corto(m.nombre, 30), detalle: limpio(m.que_es),
      datos: [{ k: 'Línea para el anuncio', v: limpio(m.fomo) }, { k: 'Tipo', v: limpio(m.tipo) }, { k: 'Enlace', v: limpio(m.enlace) }],
      fuente: 'de tu oferta en Offer', autoria: 'usuario', nace: fecha('lead_magnets', m.id),
      href: m.oferta_id ? `/offer?oferta=${m.oferta_id}` : '/offer', abrirEn: 'Offer',
    });
    const dueña = m.oferta_id && hay(`oferta:${m.oferta_id}`) ? `oferta:${m.oferta_id}` : principal ? `oferta:${principal.id}` : opciones.raiz;
    unir(dueña, id, 'El gancho de esta oferta');
  }

  // ── Los FUNNELS (todos los activos, no sólo el principal) ──
  const funnelDefault = l.funnels.find((f) => f.esDefault) ?? null;
  const nodoFunnel = (fid: number) => (hay(`funnel:${fid}`) ? `funnel:${fid}` : null);
  for (const f of l.funnels) {
    const id = push({
      id: `funnel:${f.id}`, area: 'funnel', tipo: f.esDefault ? 'Funnel principal' : 'Funnel', etiqueta: corto(f.nombre, 30),
      detalle: f.canal ? `Vende por ${f.canal}.` : '',
      datos: f.esDefault && l.leads ? [{ k: 'Leads', v: String(l.leads.total) }, { k: 'Nuevos en 7 días', v: String(l.leads.nuevos7d) }] : [],
      fuente: 'de tu CRM', autoria: 'usuario', nace: fecha('funnels', f.id), href: `/crm?funnel=${f.id}`, abrirEn: 'el CRM',
    });
    // El funnel principal es el que tiene etapas en el mapa: se engancha con la primera.
    if (f.esDefault && opciones.primeraEtapa && opciones.etapasEnMapa.has(opciones.primeraEtapa)) unir(id, opciones.primeraEtapa, 'Su primera etapa');
  }
  for (const lf of l.ligasFunnel) {
    const de = nodoFunnel(lf.funnel_id);
    if (!de || !hay(`oferta:${lf.oferta_id}`)) continue;
    unir(de, `oferta:${lf.oferta_id}`, lf.es_principal ? 'Este funnel vende esta oferta' : 'Este funnel también ofrece esta');
  }

  // A dónde se cuelga lo que es del embudo en general (los leads, los clientes, las reuniones): el funnel principal, y si no
  // hay, su primera etapa, y si no, la raíz.
  const alFunnel = funnelDefault && hay(`funnel:${funnelDefault.id}`) ? `funnel:${funnelDefault.id}`
    : opciones.primeraEtapa && opciones.etapasEnMapa.has(opciones.primeraEtapa) ? opciones.primeraEtapa : opciones.raiz;

  // ── Los LEADS: UN nodo con sus números, y cuántos hay en cada etapa como dato de la etapa ──
  if (l.leads && l.leads.total > 0) {
    const L = l.leads;
    const origenes = L.origenes.slice(0, TOPES_VIVOS.origenes).map((o) => `${o.origen} (${o.leads})`).join(' · ');
    const id = push({
      id: 'leads', area: 'funnel', tipo: 'Leads', etiqueta: `${L.total} ${L.total === 1 ? 'lead' : 'leads'}`,
      detalle: L.nuevos7d ? `${L.nuevos7d} ${L.nuevos7d === 1 ? 'entró' : 'entraron'} en los últimos 7 días.` : 'Ninguno nuevo en los últimos 7 días.',
      datos: [
        { k: 'De dónde vienen', v: origenes },
        { k: 'Sin closer ni setter', v: L.sinAsignar ? String(L.sinAsignar) : '' },
      ],
      fuente: 'contados en tu CRM, hoy', autoria: 'mako', href: '/crm', abrirEn: 'el CRM',
    });
    unir(id, alFunnel, 'Los leads de tu negocio');
    const porEtapa = new Map(L.porEtapa.map((e) => [`etapa:${e.key}`, e.leads]));
    for (const n of g.nodos) {
      const cuantos = porEtapa.get(n.id);
      if (cuantos != null && cuantos > 0) n.datos = [...(n.datos ?? []), { k: 'Leads hoy', v: String(cuantos) }];
    }
  }

  // ── Los CLIENTES (18/10/2026): los leads que compraron. UN nodo con el total exacto y los más recientes colgados de él
  //    (tope `TOPES_VIVOS.clientes`): cuántos hay es un dato del nodo, nunca un nodo por cliente. Sin ventas ganadas, no hay nodo. ──
  const C = l.clientes;
  if (C && C.total > 0) {
    const recientes = C.recientes.slice(0, TOPES_VIVOS.clientes);
    const nombreDe = (c: ClienteVivo) => limpio(c.nombre) || limpio(c.empresa) || 'Cliente sin nombre';
    const hub = push({
      id: 'clientes', area: 'funnel', tipo: 'Clientes', etiqueta: `${C.total} ${C.total === 1 ? 'cliente' : 'clientes'}`,
      detalle: 'Los leads que compraron.',
      datos: [{ k: 'Los últimos', v: recientes.slice(0, 5).map((c) => corto(nombreDe(c), 24)).join(' · ') }],
      fuente: 'contados en tu CRM, hoy', autoria: 'mako', href: '/classroom/clients', abrirEn: 'Clients',
    });
    unir(hub, hay('leads') ? 'leads' : alFunnel, 'Salieron de tus leads');
    for (const c of recientes) {
      const id = push({
        id: `cliente:${c.leadId}`, area: 'funnel', tipo: 'Cliente', etiqueta: corto(nombreDe(c), 30),
        detalle: limpio(c.empresa) ? `De ${limpio(c.empresa)}.` : 'Compró.',
        datos: [{ k: 'Venta', v: c.sinCobro ? 'Becado, sin cobro' : '' }],
        // La FICHA es /crm/<id> (app/crm/[id], la ruta de todo el CRM). Con el id como parámetro de /crm abría la lista: /crm no lo lee
        // (20/10/2026, lo encontró el chat de CRM; tests/second-brain-links.test.ts mira cada link contra su destino).
        fuente: 'la venta ganada en tu CRM', autoria: 'usuario', nace: c.fechaCierre, href: `/crm/${c.leadId}`, abrirEn: 'su ficha',
      });
      unir(id, hub, 'Compró: es uno de tus clientes');
    }
  }

  // ── Las REUNIONES DE VENTA que el Closing Analyst ya leyó (18/10/2026): las más recientes. Cada una se cuelga del cliente
  //    si el lead terminó comprando; si no, de los leads. ──
  for (const r of (l.reuniones ?? []).slice(0, TOPES_VIVOS.reuniones)) {
    const quien = limpio(r.leadNombre) || limpio(r.titulo) || 'Reunión de venta';
    const id = push({
      id: `reunion:${r.id}`, area: 'funnel', tipo: r.tipo ? `Reunión ${r.tipo}` : 'Reunión de venta', etiqueta: corto(quien, 30),
      detalle: corto(limpio(r.resumen), 260),
      datos: [
        { k: 'Closer', v: limpio(r.closer) },
        { k: 'Resultado', v: limpio(r.outcome) },
        { k: 'Puntaje', v: r.score == null || !Number.isFinite(r.score) ? '' : `${String(Math.round(r.score * 10) / 10).replace('.', ',')} de 10` },
        { k: 'Duración', v: r.duracionMin ? `${r.duracionMin} min` : '' },
      ],
      fuente: 'MaKo analizó la grabación (Closing Analyst)', autoria: 'mako', nace: r.fecha, href: '/dashboard?hoja=closing', abrirEn: 'el Dashboard',
    });
    if (r.leadId != null && hay(`cliente:${r.leadId}`)) unir(id, `cliente:${r.leadId}`, 'La reunión de venta de este cliente');
    else unir(id, hay('leads') ? 'leads' : alFunnel, 'Una reunión de venta de tu CRM');
  }

  // ── Los OBJETIVOS y los KPIs del negocio (los números de /general): lo que el negocio se propuso medir ──
  for (const o of l.objetivos) {
    const id = push({
      id: `okr:${o.id}`, area: 'norte', tipo: 'Objetivo', etiqueta: corto(o.titulo, 32),
      detalle: `Meta: ${o.unidad === 'usd' ? usd(o.metaValor) : miles(o.metaValor)}${o.quarter ? ` en el Q${o.quarter} ${o.anio}` : ` en ${o.anio}`}.`,
      fuente: 'lo pusiste en General', autoria: 'usuario', nace: fecha('objectives', o.id), href: '/general', abrirEn: 'General',
    });
    const funnels = o.funnelIds.map(nodoFunnel).filter((x): x is string => !!x);
    for (const f of funnels) unir(id, f, 'Este objetivo cuenta lo de este funnel');
    if (!funnels.length) unir(id, hay('objetivo') ? 'objetivo' : hay('fase') ? 'fase' : opciones.raiz, 'Un objetivo del negocio entero');
  }
  for (const k of l.kpis) {
    const id = push({
      id: `kpi:${k.id}`, area: 'norte', tipo: 'KPI', etiqueta: corto(k.nombre, 30),
      detalle: `Compromiso: ${k.unidad === 'usd' ? usd(k.compromiso) : miles(k.compromiso)} por ${k.cadencia === 'diaria' ? 'día' : 'semana'}.`,
      fuente: 'lo pusiste en General', autoria: 'usuario', nace: fecha('kpis', k.id), href: '/general', abrirEn: 'General',
    });
    let colgado = false;
    if (k.objectiveId && hay(`okr:${k.objectiveId}`)) { unir(id, `okr:${k.objectiveId}`, 'Mide este objetivo'); colgado = true; }
    for (const f of k.funnelIds.map(nodoFunnel).filter((x): x is string => !!x)) { unir(id, f, 'Cuenta lo de este funnel'); colgado = true; }
    if (!colgado) unir(id, hay('fase') ? 'fase' : opciones.raiz, 'Un número que el negocio mira');
  }

  // ── Los CHATS DE OFFER: donde se armó la oferta. Los más recientes, colgados de la oferta principal ──
  for (const c of l.chatsOffer.slice(0, TOPES_VIVOS.chatsOffer)) {
    if (!principal) break;   // sin oferta no hay de qué colgarlos, y un chat suelto no es una cosa del negocio
    const id = push({
      id: `offerchat:${c.id}`, area: 'oferta', tipo: 'Chat de Offer', etiqueta: corto(c.titulo, 30),
      detalle: c.estado === 'concluida' || c.estado === 'cerrada' ? 'Una conversación con MaKo que terminó en una oferta.' : 'Una conversación con MaKo sobre tu oferta.',
      fuente: 'tu conversación en Offer', autoria: 'mako', nace: fecha('offer_sesiones', c.id) ?? c.updatedAt, href: '/offer', abrirEn: 'Offer',
    });
    unir(id, `oferta:${principal.id}`, 'Aquí se habló de esta oferta');
  }

  // ── Los CHATS CON MAKO de quien mira: cada uno se cuelga de lo que NOMBRA su título; los que no nombran nada van
  //    juntos en un nodo (la regla: sin arista que sume, agregado). ──
  const chats = (l.chatsMako ?? []).filter((c) => !c.tab).slice(0, TOPES_VIVOS.chatsMako);
  if (chats.length) {
    const candidatos = g.nodos.filter((n) => esDatoNombrable(n));
    const sueltos: ChatMakoVivo[] = [];
    for (const c of chats) {
      const titulo = limpio(c.titulo);
      const nombra = titulo ? candidatosNombrados(titulo, candidatos).slice(0, 2) : [];
      if (!nombra.length) { sueltos.push(c); continue; }
      const id = push({
        id: `chat:${c.id}`, area: 'panorama', tipo: 'Chat con MaKo', etiqueta: corto(titulo, 30),
        detalle: 'Una conversación tuya con MaKo.', fuente: 'tu chat con MaKo', autoria: 'usuario', nace: c.updatedAt,
        href: `/second-brain?chat=${c.id}`, abrirEn: 'el chat',
      });
      for (const n of nombra) unir(id, n.id, 'Hablaste de esto en este chat');
    }
    if (sueltos.length) {
      const id = push({
        id: 'chats', area: 'panorama', tipo: 'Chats con MaKo', etiqueta: `Tus chats (${sueltos.length})`,
        detalle: sueltos.map((c) => limpio(c.titulo) || 'Sin título').slice(0, 8).join(' · '),
        fuente: 'tus chats con MaKo', autoria: 'usuario', nace: sueltos[0]?.updatedAt ?? null,
      });
      unir(id, opciones.raiz, 'Tus conversaciones con MaKo');
    }
  }

  // ── Los CHATS DE LAS TABS de quien mira (23/10/2026; Martín, 17/10: «todo siempre guardarse en chats en el Ops Center e ir
  //    guardándose en el grafo del Second Brain»). Un nodo por chat JEFE —la tab, como los agrupa el Ops Center—, nunca uno por
  //    charla: Automations sola tiene cientos, y el volumen no es un nodo. Se cuelga de cada entidad de sus charlas que esté en el
  //    mapa (el funnel de las del CRM, el cliente o los leads de una ficha); sin ninguna, de la raíz. ──
  const porTab = new Map<string, ChatMakoVivo[]>();
  for (const c of l.chatsMako ?? []) if (c.tab) porTab.set(c.tab, [...(porTab.get(c.tab) ?? []), c]);
  const recientes = (cs: ChatMakoVivo[]) => [...cs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const tabs = [...porTab].map(([tab, cs]) => ({ tab, cs: recientes(cs) }))
    .sort((a, b) => b.cs[0].updatedAt.localeCompare(a.cs[0].updatedAt))
    .slice(0, TOPES_VIVOS.tabsConChat);
  for (const { tab, cs } of tabs) {
    const id = push({
      id: `tabchat:${idDeTab(tab)}`, area: AREA_DE_TAB[tab] ?? 'panorama', tipo: 'Chats con MaKo', etiqueta: corto(`MaKo en ${tab}`, 30),
      detalle: cs.slice(0, 6).map((c) => limpio(c.titulo) || 'Sin título').join(' · '),
      datos: [{ k: 'Charlas', v: String(cs.length) }],
      fuente: 'tus charlas con MaKo, en el Ops Center', autoria: 'usuario', nace: cs[0].updatedAt, href: '/second-brain', abrirEn: 'el Ops Center',
    });
    const colgadas = new Set<string>();
    for (const c of cs) {
      if (colgadas.size >= TOPES_VIVOS.entidadesPorTab) break;
      const e = c.entidad;
      const destino = e?.tipo === 'funnel' ? `funnel:${e.id}` : e?.tipo === 'lead' ? (hay(`cliente:${e.id}`) ? `cliente:${e.id}` : 'leads') : null;
      if (!destino || colgadas.has(destino) || !hay(destino)) continue;
      colgadas.add(destino);
      unir(id, destino, e?.tipo === 'funnel' ? 'Le hablaste a MaKo de este CRM' : 'Le hablaste a MaKo de este lead');
    }
    if (!colgadas.size) unir(id, opciones.raiz, `Tus charlas con MaKo en ${tab}`);
  }
}

/** El id de un chat jefe en el mapa: la tab sin tildes ni espacios («Web Generator» → `web-generator`). Estable: la huella del
 *  layout depende de ids que no cambien. */
function idDeTab(tab: string): string {
  return tab.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tab';
}

/** Un nodo que un título puede NOMBRAR: un dato con nombre propio (no la estructura, no lo que falta, no un nombre
 *  genérico de tres letras que matchea cualquier cosa). */
function esDatoNombrable(n: NodoCerebro): boolean {
  if (n.autoria === 'pendiente' || n.id === 'raiz' || /^(area|n1|falta|chat|chats|leads|clientes|cliente|reunion):?/.test(n.id)) return false;
  return limpio(n.etiqueta).replace(/[^\p{L}\p{N}]/gu, '').length >= 4;
}

/**
 * D1 · EL OBJETIVO EN NÚMEROS (lib/cerebro-grafo.ts), con los settings `objetivo_cierres` y `objetivo_cash_usd` TAL COMO SE
 * GUARDAN: strings ('12', '30000'), del onboarding (SETTINGS_WIZARD) y de `setObjetivoAction`. Sin cierres, ningún nodo: lo
 * que falta se dice en la raíz. Es plata del negocio: un closer no lo ve (`sinLaPlata`, lib/cerebro-union.ts).
 */
export function nodoDelObjetivo(objCierres: unknown, objCash: unknown): NodoCerebro | null {
  const nCierres = Number(objCierres);
  const nCash = Number(objCash);
  if (!Number.isFinite(nCierres) || nCierres <= 0) return null;
  return {
    id: 'objetivo',
    area: 'norte',
    etiqueta: `${nCierres} ${nCierres === 1 ? 'cierre' : 'cierres'} en 90 días`,
    detalle: Number.isFinite(nCash) && nCash > 0 ? `Y USD ${nCash.toLocaleString('es')} de facturación.` : '',
    fuente: 'lo pusiste como objetivo',
    autoria: 'usuario',
  };
}

/** Los nodos cuyo NOMBRE aparece entero en el título (la búsqueda del grafo al revés: el título es el pajar). */
function candidatosNombrados(titulo: string, nodos: NodoCerebro[]): NodoCerebro[] {
  const pajar = { id: '_', area: 'panorama' as AreaId, etiqueta: titulo, detalle: '', fuente: '', autoria: 'usuario' as const };
  return nodos.filter((n) => matchNodo(pajar, n.etiqueta.replace(/[…()]/g, ' '), ['nombre']));
}

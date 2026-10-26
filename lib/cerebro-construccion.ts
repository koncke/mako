// =============================================================================
// cerebro-construccion — la CONSTRUCCIÓN DE MAKO como grafo, para el super admin (17/10/2026)
// =============================================================================
// Punto 13 del feedback de Martín del 17/10: «Para el SUPER ADMIN suma además la CONSTRUCCIÓN DE MAKO: las áreas, los
// chats, las bitácoras, los hitos». Es el segundo grafo del Second Brain: el MISMO componente (app/second-brain/
// Grafo.tsx), con su propia taxonomía (las familias de /admin/dev como áreas). Reemplaza a la vista de áreas de
// /admin/dev (`MapaAreas.tsx`, que era la barra con las 122 áreas y sus trampas, sin un solo vínculo entre ellas).
//
// PURO: recibe las áreas con su bitácora ya leídas (lib/cerebro-construccion-datos.ts las junta del registro de
// app/admin/dev) y devuelve el grafo. Lo prueba tests/second-brain-construccion.test.ts sin base.
//
// QUÉ ES UN NODO ACÁ (la regla del grafo: una cosa que se puede señalar):
//   · un ÁREA de MaKo con bitácora (`dev:<slug>`): su estado, sus partes (hechas, siguen, en cola) y su trampa;
//   · un HITO (`hito:<slug>:<n>`): los últimos de cada área, con su fecha, su chat y su «Revisar»;
//   · un CHAT JEFE (`jefe:<clave>`): los que anotaron dos hitos o más en los últimos 14 días (la ventana del Centro).
// QUÉ ES UNA ARISTA, y cada una se explica en una frase:
//   · hito → su área y → el chat que lo anotó · jefe → cada área donde anotó (con cuántos hitos) · área ↔ área cuando
//     COMPARTEN CÓDIGO (dos o más archivos de su `vive`, sin contar los que están en todas: lib/workspace.ts no dice nada).
// ⚠️ LOS HITOS NO SE CUELGAN DEL RACIMO DE SU FAMILIA, y es medido (17/10/2026, con el registro real: 56 áreas): con los
//    hitos adentro, el nodo de «Operate» juntaba medio mapa y el hub daba 14,8× contra el 4,5× de scripts/medir-grafo.mjs.
//    Un hito ya tiene dónde estar: su área y su chat. El racimo es de las áreas y los jefes.
// NO ENTRA: un nodo por commit o por mensaje (300 hojas vuelven el mapa un diente de león), ni el texto de los
// hallazgos (vive en docs/ y se lee ahí).
// =============================================================================

import { layoutCerebro } from './cerebro-layout';
import { PUENTE_ISLA_OBRA, puentesARaiz } from './cerebro-union';
import { instanteHito, type HitoP } from './progreso-reglas';
import { claveDeNombre } from './centro-chats';
import type { AristaCerebro, Cerebro, NodoCerebro, Taxonomia } from './cerebro-modelo';

/** Un área de /admin/dev con lo que el grafo usa de ella y de su registro. */
export type AreaDeObra = {
  slug: string;
  titulo: string;
  familia: string;
  estado: string;
  alcance: string;
  nota?: string;
  /** La página de MaKo donde se ve el área (`verEnApp` de areas.ts). Desde el 25/10/2026 es adonde lleva su nodo: la página
   *  de su bitácora (/admin/dev/<área>) se fue con Dev. Sin página, el nodo no abre nada. */
  verEnApp?: string;
  vive: readonly string[];
  partes: readonly { titulo: string; detalle: string; estado: 'hecha' | 'sigue' | 'cola' }[];
  bitacora: readonly HitoP[];
};

/** Las familias de /admin/dev (FAMILIAS de app/admin/dev/areas.ts) como áreas del grafo, en tres carpetas. Los
 *  colores son los `--grafo-*` de siempre (medidos contra el lienzo oscuro); el dorado queda para «MaKo intervino». */
export const TAXONOMIA_CONSTRUCCION: Taxonomia = {
  carpetas: [
    { id: 'producto', nombre: 'Producto', que: 'Lo que usa el cliente: operar, analizar, vender y crear.' },
    { id: 'inteligencia', nombre: 'Inteligencia', que: 'MaKo: el chat, lo que hace solo y su API.' },
    { id: 'base', nombre: 'Base', que: 'El negocio de MaKo, la plataforma y la infraestructura.' },
  ],
  areas: [
    { id: 'operate', padre: 'producto', nombre: 'Operate', color: 'var(--grafo-norte)', que: 'El día a día del negocio.' },
    { id: 'analyze', padre: 'producto', nombre: 'Analyze', color: 'var(--grafo-documentos)', que: 'Lo que se mide y se analiza.' },
    { id: 'sales-machine', padre: 'producto', nombre: 'Sales Machine', color: 'var(--grafo-oferta)', que: 'Lo que vende.' },
    { id: 'content-machine', padre: 'producto', nombre: 'Content Machine', color: 'var(--grafo-razones)', que: 'Lo que crea contenido.' },
    { id: 'mako', padre: 'inteligencia', nombre: 'MaKo', color: 'var(--grafo-panorama)', que: 'La inteligencia del producto.' },
    { id: 'business', padre: 'base', nombre: 'Business', color: 'var(--grafo-productos)', que: 'Cobros, planes y clientes.' },
    { id: 'platform', padre: 'base', nombre: 'Platform', color: 'var(--grafo-cliente)', que: 'Cuentas, accesos y seguridad.' },
    { id: 'infra', padre: 'base', nombre: 'Infra', color: 'var(--grafo-avatares)', que: 'Lo que sostiene todo.' },
  ],
};

/** Los topes: cuántos hitos por área, cuántos en total, y la ventana de los chats jefe. */
export const TOPES_CONSTRUCCION = { hitosPorArea: 2, hitos: 70, diasJefes: 14, hitosJefe: 2, vecinosPorArea: 2, archivoComun: 6 } as const;

const ESTADO: Record<string, string> = { listo: 'Lista', parcial: 'A medias', 'por-construir': 'Por construir' };
const TIPO_HITO: Record<string, string> = { prompt: 'Pedido de Martín', implementacion: 'Hito', investigacion: 'Investigación', correccion: 'Corrección', cosecha: 'Cosecha' };

const familiaId = (f: string) => f.trim().toLowerCase().replace(/\s+/g, '-');
const sinMarcas = (s: string) => s.replace(/\*\*|`|⚠️/g, '').replace(/\s+/g, ' ').trim();
function corto(s: string, max = 34): string {
  const t = sinMarcas(s);
  if (t.length <= max) return t;
  const c = t.slice(0, max);
  const esp = c.lastIndexOf(' ');
  return `${(esp > max * 0.6 ? c.slice(0, esp) : c).trimEnd()}…`;
}

/** «17 oct» + «05:20» → «2026-10-17T05:20:00-03:00»: la hora de Argentina que anota la bitácora, con su desfase, así la
 *  fecha corta del grafo (que sale del TEXTO) dice el mismo día que la bitácora. El año, el de `instanteHito`. */
export function isoDeHito(fecha: string, hora: string, ahora: number): string | null {
  const t = instanteHito(fecha, hora, ahora);
  return t == null ? null : isoAr(t);
}

/** Un instante, escrito en la hora de Argentina con su desfase (la de las bitácoras). */
function isoAr(t: number): string {
  const d = new Date(t - 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00-03:00`;
}

export function armarConstruccion(areas: readonly AreaDeObra[], ahora: number): Cerebro<string> {
  const nodos: NodoCerebro<string>[] = [];
  const aristas: AristaCerebro[] = [];
  const ids = new Set<string>();
  const push = (n: NodoCerebro<string>) => { nodos.push(n); ids.add(n.id); return n.id; };
  const unir = (de: string, a: string, motivo: string) => { if (ids.has(de) && ids.has(a) && de !== a) aristas.push({ de, a, motivo }); };
  const areaDeFamilia = (f: string) => {
    const id = familiaId(f);
    return TAXONOMIA_CONSTRUCCION.areas.some((a) => a.id === id) ? id : 'platform';
  };

  push({
    id: 'raiz', area: 'mako', tipo: 'El producto', etiqueta: 'MaKo',
    detalle: `Cómo se está construyendo MaKo: ${areas.length} áreas con bitácora.`, fuente: 'las bitácoras de /admin/dev', autoria: 'mako',
  });

  // ── LAS ÁREAS ──
  for (const a of areas) {
    const hechas = a.partes.filter((p) => p.estado === 'hecha').length;
    const siguen = a.partes.filter((p) => p.estado === 'sigue');
    const cola = a.partes.filter((p) => p.estado === 'cola');
    const ultimo = a.bitacora[a.bitacora.length - 1];
    const primero = a.bitacora[0];
    push({
      id: `dev:${a.slug}`, area: areaDeFamilia(a.familia), tipo: 'Área de MaKo', etiqueta: corto(a.titulo, 30),
      detalle: corto(a.alcance, 280),
      datos: [
        { k: 'Estado', v: ESTADO[a.estado] ?? a.estado },
        { k: 'Partes', v: a.partes.length ? `${hechas} hechas · ${siguen.length} siguen · ${cola.length} en cola` : '' },
        { k: 'Lo que sigue', v: siguen.map((p) => p.titulo).join(' · ') },
        { k: 'Último hito', v: ultimo ? `${ultimo.fecha} · ${sinMarcas(ultimo.titulo)}` : '' },
      ],
      cuerpo: [a.nota && `La trampa: ${sinMarcas(a.nota)}`, cola.length && `En cola: ${cola.map((p) => p.titulo).join(' · ')}`].filter(Boolean).join('\n\n') || undefined,
      fuente: `su bitácora: ${a.bitacora.length} ${a.bitacora.length === 1 ? 'hito' : 'hitos'}`, autoria: 'mako',
      nace: primero ? isoDeHito(primero.fecha, primero.hora, ahora) : null,
      href: a.verEnApp, abrirEn: a.verEnApp ? 'su tab' : undefined,
    });
  }

  // ── LOS HITOS: los últimos de cada área, y de todos ésos los más recientes ──
  const candidatos = areas.flatMap((a) => a.bitacora
    .map((h, i) => ({ a, h, i, t: instanteHito(h.fecha, h.hora, ahora) ?? 0 }))
    .slice(-TOPES_CONSTRUCCION.hitosPorArea));
  for (const { a, h, i } of candidatos.sort((x, y) => y.t - x.t).slice(0, TOPES_CONSTRUCCION.hitos)) {
    const id = push({
      id: `hito:${a.slug}:${i}`, area: areaDeFamilia(a.familia), tipo: TIPO_HITO[h.tipo] ?? 'Hito', etiqueta: corto(h.titulo, 34),
      detalle: sinMarcas(h.puntos[0] ?? ''),
      datos: [
        { k: 'Cuándo', v: `${h.fecha} · ${h.hora}` },
        { k: 'Chat', v: h.chat && h.chat !== '—' ? h.chat : '' },
        { k: 'Cuenta', v: h.cuenta },
        { k: 'Commits', v: h.commits?.length ? String(h.commits.length) : '' },
      ],
      cuerpo: h.puntos.length > 1 ? h.puntos.map(sinMarcas).join('\n\n') : undefined,
      fuente: `la bitácora de ${a.titulo}`, autoria: h.actor === 'martin' ? 'usuario' : 'mako',
      nace: isoDeHito(h.fecha, h.hora, ahora),
      href: h.revisar || a.verEnApp, abrirEn: h.revisar ? 'MaKo' : a.verEnApp ? 'su tab' : undefined,
    });
    unir(id, `dev:${a.slug}`, 'Un hito de esta área');
  }

  // ── LOS CHATS JEFE: los que anotaron en la ventana, colgados de cada área donde anotaron ──
  const desde = ahora - TOPES_CONSTRUCCION.diasJefes * 86_400_000;
  const jefes = new Map<string, { titulo: string; sesion: string | null; cuentas: Set<string>; porArea: Map<string, number>; ultimo: number; familia: Map<string, number> }>();
  for (const a of areas) {
    for (const h of a.bitacora) {
      const t = instanteHito(h.fecha, h.hora, ahora);
      if (t == null || t < desde || !h.chat || h.chat === '—') continue;
      const clave = claveDeNombre(h.chat);
      const j = jefes.get(clave) ?? { titulo: h.chat, sesion: null, cuentas: new Set<string>(), porArea: new Map<string, number>(), ultimo: 0, familia: new Map<string, number>() };
      if (t >= j.ultimo) { j.ultimo = t; j.sesion = h.sesion ?? j.sesion; }
      if (h.cuenta) j.cuentas.add(h.cuenta);
      j.porArea.set(a.slug, (j.porArea.get(a.slug) ?? 0) + 1);
      const f = areaDeFamilia(a.familia);
      j.familia.set(f, (j.familia.get(f) ?? 0) + 1);
      jefes.set(clave, j);
    }
  }
  for (const [clave, j] of jefes) {
    if ([...j.porArea.values()].reduce((x, y) => x + y, 0) < TOPES_CONSTRUCCION.hitosJefe) continue;
    const total = [...j.porArea.values()].reduce((x, y) => x + y, 0);
    const id = push({
      id: `jefe:${clave.slice('nombre:'.length)}`, area: [...j.familia].sort((x, y) => y[1] - x[1])[0][0], tipo: 'Chat jefe',
      etiqueta: corto(j.titulo, 30),
      detalle: `${total} ${total === 1 ? 'hito' : 'hitos'} en ${j.porArea.size} ${j.porArea.size === 1 ? 'área' : 'áreas'} en los últimos ${TOPES_CONSTRUCCION.diasJefes} días.`,
      datos: [{ k: 'Cuentas', v: [...j.cuentas].sort().join(' · ') }],
      fuente: 'lo que anotó en las bitácoras', autoria: 'mako',
      nace: j.ultimo ? isoAr(j.ultimo) : null,
      href: `/admin/operaciones?centro=${encodeURIComponent(j.sesion ?? clave)}`, abrirEn: 'el Ops Center',
    });
    for (const [slug, n] of j.porArea) unir(id, `dev:${slug}`, `Este chat trabaja en esta área: ${n} ${n === 1 ? 'hito' : 'hitos'}`);
  }

  // Cada hito, con el chat que lo anotó (si ese chat es un nodo): así un hito no es una hoja, y se lee quién lo hizo.
  for (const n of nodos.filter((x) => x.id.startsWith('hito:'))) {
    const chat = (n.datos ?? []).find((d) => d.k === 'Chat')?.v;
    if (chat) unir(n.id, `jefe:${claveDeNombre(chat).slice('nombre:'.length)}`, 'Lo anotó este chat');
  }

  // ── ÁREA ↔ ÁREA: comparten código (las aristas laterales que sacan al mapa de la forma de estrella) ──
  const enCuantas = new Map<string, number>();
  for (const a of areas) for (const f of new Set(a.vive)) enCuantas.set(f, (enCuantas.get(f) ?? 0) + 1);
  const propios = new Map(areas.map((a) => [a.slug, new Set(a.vive.filter((f) => (enCuantas.get(f) ?? 0) <= TOPES_CONSTRUCCION.archivoComun))]));
  const pares = new Map<string, string[]>();
  for (let i = 0; i < areas.length; i++) {
    for (let k = i + 1; k < areas.length; k++) {
      const x = propios.get(areas[i].slug)!;
      const comunes = [...propios.get(areas[k].slug)!].filter((f) => x.has(f));
      if (comunes.length >= 2) pares.set(`${areas[i].slug}|${areas[k].slug}`, comunes);
    }
  }
  const usados = new Map<string, number>();
  for (const [par, comunes] of [...pares].sort((x, y) => y[1].length - x[1].length)) {
    const [s1, s2] = par.split('|');
    if ((usados.get(s1) ?? 0) >= TOPES_CONSTRUCCION.vecinosPorArea || (usados.get(s2) ?? 0) >= TOPES_CONSTRUCCION.vecinosPorArea) continue;
    usados.set(s1, (usados.get(s1) ?? 0) + 1);
    usados.set(s2, (usados.get(s2) ?? 0) + 1);
    unir(`dev:${s1}`, `dev:${s2}`, `Comparten ${comunes.length} archivos (${comunes[0]})`);
  }

  // ── LA ESTRUCTURA: el área de cada familia (con dos miembros o más) y la carpeta de cada una (con dos áreas o más) ──
  const tax = TAXONOMIA_CONSTRUCCION;
  const miembros = new Map<string, string[]>();
  // Sólo las ÁREAS: un jefe ya cuelga de las áreas donde anotó, y sumarlo al racimo llevaba el hub de 4,3× a 6,5×.
  for (const n of nodos) if (n.id.startsWith('dev:')) miembros.set(n.area, [...(miembros.get(n.area) ?? []), n.id]);
  const conHub = new Set<string>();
  for (const a of tax.areas) {
    const m = miembros.get(a.id) ?? [];
    if (m.length < 2) continue;
    push({ id: `area:${a.id}`, area: a.id, etiqueta: a.nombre, detalle: a.que, fuente: `${m.length} cosas de la construcción`, autoria: 'mako' });
    for (const x of m) unir(x, `area:${a.id}`, `Esto es parte de ${a.nombre}`);
    conHub.add(a.id);
  }
  for (const c of tax.carpetas) {
    const hijas = tax.areas.filter((a) => a.padre === c.id && conHub.has(a.id));
    if (!hijas.length) continue;
    push({ id: `n1:${c.id}`, area: hijas[0].id, etiqueta: c.nombre, detalle: c.que, fuente: `${hijas.length} ${hijas.length === 1 ? 'familia' : 'familias'}`, autoria: 'mako' });
    for (const h of hijas) unir(`area:${h.id}`, `n1:${c.id}`, `${h.nombre} es parte de ${c.nombre}`);
    unir('raiz', `n1:${c.id}`, `MaKo se construye en ${c.nombre}`);
  }

  const reales = nodos.filter((n) => !/^(raiz|area:|n1:)/.test(n.id));
  // UN cerebro, nunca dos (Martín, 20/10/2026): un área sin hitos que comparta archivos, o una carpeta con una sola
  // familia, quedaba suelta. Todo lo suelto cuelga de la raíz, antes del layout.
  aristas.push(...puentesARaiz(nodos, aristas, 'raiz', PUENTE_ISLA_OBRA));
  const { posiciones, encuadre } = layoutCerebro(nodos, aristas);
  return {
    negocio: 'Construcción de MaKo',
    nodos, aristas, posiciones, encuadre,
    cuenta: { total: reales.length, mako: reales.filter((n) => n.autoria === 'mako').length, usuario: reales.filter((n) => n.autoria === 'usuario').length, pendientes: 0 },
    vacias: [],
    taxonomia: tax,
  };
}

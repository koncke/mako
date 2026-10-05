// =============================================================================
// landing-pulso-server — la lectura: lo que el Pixel midio, por pagina
// =============================================================================
// El contrato (tipos, topes, y las funciones puras que agrupan los clics y leen la
// profundidad) vive en lib/landing-pulso.ts, sin `server-only`, para que tenga
// test. Aca esta lo unico que no se puede testear sin una base: el barrido.
//
// LAS TRES REGLAS QUE ESTE ARCHIVO NO NEGOCIA estan escritas en el modulo puro y
// se cumplen aca: una falla NO se convierte en cero (`fallas`), la profundidad se
// mide sobre las personas con scroll medido, y un evento sin `landing_url` no se
// reparte entre las paginas.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getSettingEstricto } from './settings';
import { leerPorPaginas } from './supabase-paginado';
import { esClicDelConstructor } from './clic-ruido';
import { normalizarUrl, esPreviewDeEditor, parsearPaginas, parsearOcultas, PAGINAS_KEY, OCULTAS_KEY } from './landing-paginas';
import { snippetDesactualizado, novedadesDesde, SNIPPET_VERSION } from './landing-token';
import {
  ordenarClics, profundidadDe, clavePorClic, PULSO_DIAS,
  type PulsoDatos, type PulsoPagina, type FallaPulso, type AcumClic,
} from './landing-pulso';

// ─────────────────────────────────────────────────────────────────────────────
// La lectura
// ─────────────────────────────────────────────────────────────────────────────

/** Normaliza sin tirar: una URL guardada rota no puede voltear la pantalla. */
function norm(u: string | null | undefined): string | null {
  if (!u) return null;
  try { return normalizarUrl(u); } catch { return null; }
}

type Acum = {
  visitas: number;
  visitantes: Set<string>;
  primera: string | null;
  ultima: string | null;
  /** visitor_id → hasta dónde bajó (el máximo de sus eventos de scroll). */
  scroll: Map<string, number>;
  clics: Map<string, AcumClic>;
  clicsDelConstructor: number;
};

function vacio(): Acum {
  return { visitas: 0, visitantes: new Set(), primera: null, ultima: null, scroll: new Map(), clics: new Map(), clicsDelConstructor: 0 };
}

/**
 * Todo lo que el Pixel midió, por página, en la ventana.
 *
 * ⚠️ UNA PASADA POR TABLA Y TODAS LAS PÁGINAS A LA VEZ, no una lectura por
 * página: `landing_visits` no se puede filtrar por URL en la base (el beacon
 * guarda la URL con sus utm, así que la comparación es normalizada y en memoria),
 * y leerla una vez por página multiplicaría el barrido por el selector.
 *
 * ⚠️ Y SE PAGINA. PostgREST corta en 1000 filas SIN avisar: `vsl_events` pasa las
 * 75.000 en un workspace, así que un `.select()` suelto acá devolvería la lista
 * de clics de las primeras mil filas y la pantalla la mostraría como si fuera
 * todo. El bucle vive en lib/supabase-paginado.ts; se barre por `id` (la PK),
 * que es el único orden que garantiza páginas coherentes.
 */
export async function getPulso(dias = PULSO_DIAS): Promise<PulsoDatos> {
  const db = await getTenantDb();
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const fallas: FallaPulso[] = [];
  const porPagina = new Map<string, Acum>();
  let eventosSinPagina = 0;

  const de = (url: string): Acum => {
    let a = porPagina.get(url);
    if (!a) { a = vacio(); porPagina.set(url, a); }
    return a;
  };

  // ── Las páginas que la persona GUARDÓ ──────────────────────────────────────
  // Entran a la lista aunque no hayan recibido un solo evento: ésa es justo la
  // página sobre la que hay algo que decir («el Pixel no reportó nada acá»). Y se
  // leen con la versión ESTRICTA: con `getSetting`, un 5xx de Supabase se lee
  // como «no tiene páginas guardadas» y la pantalla se queda muda sin decir que
  // no pudo leer — el error que esta pantalla entera existe para no cometer.
  let guardadas: string[] = [];
  let ocultas: string[] = [];
  try {
    const [p, o] = await Promise.all([getSettingEstricto(PAGINAS_KEY), getSettingEstricto(OCULTAS_KEY)]);
    guardadas = parsearPaginas(p);
    ocultas = parsearOcultas(o);
  } catch (err) {
    fallas.push({ bloque: 'paginas', mensaje: err instanceof Error ? err.message : String(err) });
  }
  for (const u of guardadas) de(u);

  // ── Visitas ────────────────────────────────────────────────────────────────
  type Visita = { visitor_id: string | null; landing_url: string | null; created_at: string };
  try {
    await leerPorPaginas<Visita>(db, 'landing_visits', 'id, visitor_id, landing_url, created_at', (filas) => {
      for (const v of filas) {
        const u = norm(v.landing_url);
        // Sin URL no se puede atribuir. Se cuenta aparte en vez de repartirla.
        if (!u) { eventosSinPagina++; continue; }
        // El preview del EDITOR no es una página del negocio: es el iframe donde
        // se la está construyendo, y su tráfico son recargas de quien la edita.
        // Mezclarlo hundiría la profundidad de la landing de verdad. Ver
        // `esPreviewDeEditor` en lib/landing-paginas.ts.
        if (esPreviewDeEditor(v.landing_url ?? '')) continue;
        const a = de(u);
        a.visitas++;
        if (v.visitor_id) a.visitantes.add(v.visitor_id);
        if (v.created_at) {
          if (!a.primera || v.created_at < a.primera) a.primera = v.created_at;
          if (!a.ultima || v.created_at > a.ultima) a.ultima = v.created_at;
        }
      }
    }, { orden: 'id', filtros: (q) => q.gte('created_at', desde) });
  } catch (err) {
    fallas.push({ bloque: 'visitas', mensaje: err instanceof Error ? err.message : String(err) });
  }

  // ── Scroll ─────────────────────────────────────────────────────────────────
  // Dos consultas separadas y no un `.in('tipo_evento', [...])` a propósito: el
  // índice de los clics es PARCIAL (`idx_vsl_events_click`, mig 0133, sobre
  // `where tipo_evento = 'click'`) y un `IN` no lo usa. El scroll se apoya en
  // `idx_vsl_events_ws_created` (mig 0121).
  type FilaScroll = { visitor_id: string | null; landing_url: string | null; porcentaje: number | null };
  try {
    await leerPorPaginas<FilaScroll>(db, 'vsl_events', 'id, visitor_id, landing_url, porcentaje', (filas) => {
      for (const e of filas) {
        const u = norm(e.landing_url);
        if (!u) { eventosSinPagina++; continue; }
        if (esPreviewDeEditor(e.landing_url ?? '')) continue;
        // Un scroll sin visitante o sin porcentaje no se puede contar como
        // persona ni ubicar en un hito: saltearlo es decir la verdad.
        if (!e.visitor_id || typeof e.porcentaje !== 'number' || !Number.isFinite(e.porcentaje)) continue;
        const a = de(u);
        // SE GUARDA EL MÁXIMO POR PERSONA. El snippet manda un evento por hito
        // cruzado Y uno exacto al irse, así que contar eventos daría más gente
        // en el 25% que la que entró.
        const previo = a.scroll.get(e.visitor_id);
        if (previo === undefined || e.porcentaje > previo) a.scroll.set(e.visitor_id, e.porcentaje);
      }
    }, { orden: 'id', eq: { tipo_evento: 'scroll' }, filtros: (q) => q.gte('created_at', desde) });
  } catch (err) {
    fallas.push({ bloque: 'scroll', mensaje: err instanceof Error ? err.message : String(err) });
  }

  // ── Clics ──────────────────────────────────────────────────────────────────
  type FilaClic = { visitor_id: string | null; landing_url: string | null; detalle: string | null };
  try {
    await leerPorPaginas<FilaClic>(db, 'vsl_events', 'id, visitor_id, landing_url, detalle', (filas) => {
      for (const e of filas) {
        const u = norm(e.landing_url);
        if (!u) { eventosSinPagina++; continue; }
        if (esPreviewDeEditor(e.landing_url ?? '')) continue;
        const a = de(u);
        // El sello del constructor («Edit with Lovable» y compañía) no es un clic
        // de la persona sobre el contenido del negocio: en el ws de prueba eran
        // 208 de 441. Se descarta al LEER —el evento queda en la base— y se dice
        // cuántos fueron, para que la lista no parezca incompleta por magia.
        if (esClicDelConstructor(e.detalle)) { a.clicsDelConstructor++; continue; }
        const { clave, texto } = clavePorClic(e.detalle);
        let c = a.clics.get(clave);
        if (!c) { c = { clics: 0, personas: new Set(), textos: new Map() }; a.clics.set(clave, c); }
        c.clics++;
        if (e.visitor_id) c.personas.add(e.visitor_id);
        if (texto) c.textos.set(texto, (c.textos.get(texto) ?? 0) + 1);
      }
    }, { orden: 'id', eq: { tipo_evento: 'click' }, filtros: (q) => q.gte('created_at', desde) });
  } catch (err) {
    fallas.push({ bloque: 'clics', mensaje: err instanceof Error ? err.message : String(err) });
  }

  // ── Versión del Pixel ──────────────────────────────────────────────────────
  // Sin esto, una página con el Pixel v14 muestra la profundidad vacía y no hay
  // forma de saber que la causa es el código viejo: el scroll llegó en el v19.
  let pixel: PulsoDatos['pixel'] = null;
  try {
    const { viejo, instalada } = await snippetDesactualizado();
    // `novedadesDesde` ya tiene escrito qué se pierde cada versión: un aviso que
    // solo dice «actualiza» es una tarea sin motivo, y nadie la hace.
    pixel = { instalada, actual: SNIPPET_VERSION, viejo, novedades: viejo ? novedadesDesde(instalada) : null };
  } catch (err) {
    fallas.push({ bloque: 'pixel', mensaje: err instanceof Error ? err.message : String(err) });
  }

  const paginas: PulsoPagina[] = [...porPagina.entries()]
    // Lo que la persona escondió de su lista no vuelve por la ventana de atrás.
    .filter(([url]) => !ocultas.includes(url))
    .map(([url, a]) => {
      const { filas, restantes } = ordenarClics(a.clics);
      return {
        url,
        visitas: a.visitas,
        visitantes: a.visitantes.size,
        primera: a.primera,
        ultima: a.ultima,
        profundidad: profundidadDe(a.scroll.values()),
        clics: filas,
        clicsRestantes: restantes,
        clicsDelConstructor: a.clicsDelConstructor,
        guardada: guardadas.includes(url),
      };
    })
    // Por visitas, y el desempate es la URL: un orden inestable hace que el
    // selector cambie de opción sola entre dos refrescos.
    .sort((x, y) => y.visitas - x.visitas || y.visitantes - x.visitantes || (x.url < y.url ? -1 : 1));

  return { dias, paginas, eventosSinPagina, pixel, fallas };
}

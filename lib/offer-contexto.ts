// =============================================================================
// offer-contexto — lo que la tab Offer YA SABE del negocio y no vuelve a preguntar
// =============================================================================
// UN lector para las tres llamadas de la tab (turno, diagnóstico, propuesta), para el alta de una
// conversación y para la semilla de la bienvenida. Si cada llamada armara su propio contexto, el turno
// preguntaría algo que el diagnóstico sí sabía (AGENTS.md «Una cosa, un lugar»).
//
// De dónde sale cada cosa (todas por su lector de siempre, ninguna con un `.from` propio):
//   · perfil del negocio (onboarding)            → perfilNegocioTexto()      lib/onboarding.ts
//   · lo que MaKo entendió de sus documentos      → getPanorama()             lib/archivero.ts
//   · la oferta principal (los 5 campos)          → ofertaPrincipal(answers)  lib/ofertas.ts
//   · las ofertas (todas; activas al prompt)      → listarOfertas()           lib/ofertas.ts
//   · los productos activos                       → listProductos(true)       lib/productos.ts
//   · la fase y el cuello de botella              → getDiagnosticoFase()      lib/fase-store.ts
//   · el embudo de los últimos 90 días (opcional) → analisisNegocio()         lib/analisis-negocio.ts
//   v2 (pedido de Martín del 11/10: «aprovechá El archivero, Avatares, Razones»):
//   · los funnels del CRM y su canal              → leerFunnels()             lib/funnels.ts
//   · las ofertas de cada funnel                  → ofertasDeFunnels()        lib/ofertas.ts (funnel_ofertas)
//   · los productos de cada oferta                → productosDeOfertas()      lib/ofertas.ts (oferta_productos)
//   · los avatares                                → getAvatares()             lib/avatares.ts
//   · las razones de compra                       → getRazones()              lib/razones.ts
//
// ⚠️ TODO ES OPCIONAL Y CADA FUENTE DEGRADA SOLA (`.catch` → vacío). Un negocio recién dado de alta no
//    tiene embudo ni diagnóstico de fase, y eso no puede tirar la conversación. Lo que sí queda es el
//    log: una lectura que falla siempre se ve igual que un negocio sin ese dato. Lo que DECIDE algo (que
//    el funnel exista al crear una conversación) no se valida acá: la ruta lo lee estricto.
// ⚠️ `oferta_ticket` (el precio del brief) es TEXTO libre: viaja tal cual, nunca por parseFloat
//    (AGENTS.md y lib/oferta-modelo.ts: «Entre USD 5.000 y USD 10.000» daría 5000).
// ⚠️ El embudo es LENTO (lee meses de métricas y de leads): sólo lo pide el diagnóstico, que es el
//    único que lo usa («la oferta es lo último que se corrige», regla 7 del marco).
// ⚠️ «Funnel» = una fila de `funnels` (lo que el CRM dibuja en su desplegable), NO un producto: un mismo
//    funnel tiene varias ofertas (`funnel_ofertas`), y los productos van ADENTRO de una oferta
//    (`oferta_productos`). Corregido por el orquestador el 11/10/2026 ~15:20, medido por el chat del CRM.
// =============================================================================

import 'server-only';
import { perfilNegocioTexto, getAnswers } from './onboarding';
import { getPanorama } from './archivero';
import { ofertaPrincipal, listarOfertas, ofertasDeFunnels, productosDeOfertas } from './ofertas';
import { listProductos } from './productos';
import { leerFunnels } from './funnels';
import { getAvatares, avataresTexto } from './avatares';
import { getRazones } from './razones';
import { getDiagnosticoFase } from './fase-store';
import { CANALES, esCanal, faseContextoTexto, type CanalId, type Diagnostico } from './fase-diagnostico';
import { analisisNegocio } from './analisis-negocio';
import { analisisAMarkdown } from './analisis-modelo';
import { estadoDiagnostico, faseVigenteDe, recortar, semillaDePiezas, semillaDeProducto, type MensajeGuardado, type TasasEmbudo } from './offer-reglas';
import type { PiezasSabidas } from './offer-marco';
import { resolverOfertaPrincipal, type Oferta } from './oferta-modelo';
import type { Producto } from './productos';

/** Lo que entra del contexto en un pedido. El resto del presupuesto es para documentos y conversación. */
export const TOPE_CONTEXTO = 12_000;
/** El embudo, aparte (sólo en el diagnóstico). */
export const TOPE_EMBUDO = 4_000;

export type FocoNegocio = { productosActivos: number; ofertasActivas: number; bandaFacturacion: number | null };

export type FunnelDeLaSesion = { id: number; nombre: string; canal: CanalId | null; esDefault: boolean };

export type ContextoOffer = {
  /** El texto acotado que lee el modelo (sin el embudo). '' si el negocio todavía no cargó nada. */
  texto: string;
  /** El embudo de los últimos 90 días en markdown, o '' (si no se pidió o no hay datos). */
  embudo: string;
  /**
   * Las tasas del mismo embudo, como NÚMEROS, para los avisos de dónde se cortan las ventas y de cuándo
   * subir el precio (lib/offer-reglas.ts → `alertasEmbudo`, `alertasPrecio`). null si no se pidió o falló.
   */
  tasasEmbudo: TasasEmbudo | null;
  /** Lo que ya se sabe de cada pieza, sacado de la oferta PRINCIPAL que el negocio cargó (la v1). */
  semilla: PiezasSabidas;
  /**
   * v2: con lo que nace una conversación atada a un funnel. Modo 'analizar' → la oferta que se analiza
   * (no la principal); modo 'crear' → el producto que vende el funnel; sin funnel → `semilla`.
   */
  semillaSesion: PiezasSabidas;
  /** Lo que mira la alerta de foco (lib/offer-reglas.ts → alertaFoco). */
  foco: FocoNegocio;
  /** v2: el funnel de la conversación, si se pidió y se pudo leer. */
  funnel: FunnelDeLaSesion | null;
  /** v2: la oferta que se analiza, si se pidió y existe en el negocio. */
  ofertaBase: Oferta | null;
  /** v2: el diagnóstico de fase GUARDADO en el negocio (getDiagnosticoFase). Con él, el chat no pregunta nada. */
  faseGuardada: Diagnostico | null;
  /** v2: el diagnóstico que el dueño contestó en ESTA conversación (si están todas las respuestas), o null. */
  faseSesion: Diagnostico | null;
  /**
   * v2: EL diagnóstico de fase de esta conversación, con UNA sola prioridad para todo lo que lo usa (el texto
   * que leen los modelos, la banda de la alerta de foco y el que se congela en la conclusión para el PDF):
   * el guardado en el negocio, si no el contestado acá. Con dos prioridades, el PDF decía una fase y la tesis
   * de la misma conclusión se escribía con otra (revisión adversarial del 11/10/2026).
   */
  faseVigente: Diagnostico | null;
  /** v2: dónde cierra la venta (adapta la pregunta de volumen): el canal del funnel, si no el del funnel por defecto. */
  canal: CanalId | null;
};

const logFallo = (que: string) => (e: unknown): null => {
  console.warn(`[offer:contexto] no pude leer ${que}: ${e instanceof Error ? e.message : String(e)}`);
  return null;
};

/** La fecha de hace N días, YYYY-MM-DD. El borde se corre un día según la zona: para 90 días no importa. */
const haceDias = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function ofertaTexto(o: Oferta): string {
  const partes = [
    o.promesa && `promesa: ${o.promesa}`,
    o.precio_nota && `precio: ${o.precio_nota}`,
    o.incluye && `incluye: ${o.incluye}`,
    o.garantia && `garantía: ${o.garantia}`,
    o.para_quien && `para quién: ${o.para_quien}`,
    o.objeciones && `objeciones: ${o.objeciones}`,
    o.prueba && `prueba: ${o.prueba}`,
    o.bonos.length ? `bonos: ${o.bonos.map((b) => b.nombre).join(' · ')}` : '',
  ].filter(Boolean);
  return `- ${o.nombre}${o.es_principal ? ' (la principal del negocio)' : ''}${partes.length ? ` — ${partes.join(' · ')}` : ''}`;
}

function productoTexto(p: Producto): string {
  // monto_usd SÍ es numérico (columna numeric del catálogo de productos), no texto libre.
  const precio = p.monto_usd != null ? ` — ${p.monto_usd} USD${p.tipo === 'suscripcion' ? ' al mes' : ''}` : '';
  return `- ${p.nombre}${precio}${p.promesa ? ` · ${p.promesa}` : ''}`;
}

const canalLabel = (c: CanalId | null): string => (c ? CANALES.find((x) => x.id === c)?.label ?? c : '');

/**
 * El contexto del negocio para la tab Offer.
 *
 * `conEmbudo` agrega el embudo de los últimos 90 días (lento: sólo el diagnóstico). `funnelId` y
 * `ofertaBaseId` (v2) suman el funnel de la conversación, sus ofertas y lo que vende, y la oferta que se
 * analiza. `mensajes` son los de la conversación: de ahí sale el diagnóstico de fase que el dueño contestó
 * en ella (`estadoDiagnostico`, con el canal de acá). Cuál vale lo decide `faseVigente`, UNA vez: el
 * guardado, si no el de la conversación. El guardado gana porque es igual o más nuevo: el chat sólo
 * pregunta si el negocio no tenía uno, y si después el dueño rehace el del onboarding, ése es el de hoy.
 * Corre dentro del workspace del que llama: todas las lecturas pasan por `getTenantDb` / settings.
 */
export async function contextoOffer(opts: {
  conEmbudo?: boolean; funnelId?: number | null; ofertaBaseId?: number | null;
  mensajes?: Array<Pick<MensajeGuardado, 'de' | 'pregunta' | 'respuesta' | 'opciones'>>;
} = {}): Promise<ContextoOffer> {
  const conFunnel = opts.funnelId != null;
  const [perfil, panorama, answers, ofertas, productos, fase, analisis, funnels, ligasFunnel, ligasProducto, avatares, razones] = await Promise.all([
    perfilNegocioTexto().catch(logFallo('el perfil del negocio')),
    getPanorama().catch(logFallo('el panorama del Archivero')),
    getAnswers().catch(logFallo('las respuestas del onboarding')),
    listarOfertas().catch(logFallo('las ofertas')),
    listProductos(true).catch(logFallo('los productos activos')),
    getDiagnosticoFase().catch(logFallo('el diagnóstico de fase')),
    opts.conEmbudo
      ? analisisNegocio({ desde: haceDias(89), hasta: null }).catch(logFallo('el embudo de los últimos 90 días'))
      : Promise.resolve(null),
    leerFunnels().catch(logFallo('los funnels')),
    conFunnel ? ofertasDeFunnels().catch(logFallo('las ofertas de cada funnel')) : Promise.resolve(null),
    conFunnel ? productosDeOfertas().catch(logFallo('los productos de cada oferta')) : Promise.resolve(null),
    getAvatares().catch(logFallo('los avatares')),
    getRazones().catch(logFallo('las razones de compra')),
  ]);
  const principal = await ofertaPrincipal(answers ?? {}).catch(logFallo('la oferta principal'));
  let embudoMd: string | null = null;
  try { embudoMd = analisis ? analisisAMarkdown(analisis) : null; } catch (e) { logFallo('el embudo en texto')(e); }
  const tasasEmbudo: TasasEmbudo | null = analisis
    ? {
      show: analisis.tasas.show_rate, cierreCalificados: analisis.tasas.tasa_cierre_sobre_calificados,
      cierreAsistencias: analisis.tasas.tasa_cierre_sobre_asistencias, asistieron: analisis.calificacion.asistieron ?? 0,
    }
    : null;

  const todasOfertas = ofertas ?? [];
  const listaOfertas = todasOfertas.filter((o) => o.activa);
  const listaProductos = productos ?? [];
  const filaPrincipal = principal?.oferta ?? listaOfertas.find((o) => o.es_principal) ?? null;
  const semilla = semillaDePiezas({ campos: principal?.campos ?? null, oferta: filaPrincipal });

  // ── v2: el funnel de la conversación, sus ofertas, lo que vende y la oferta que se analiza ──
  const filaFunnel = conFunnel ? (funnels ?? []).find((f) => f.id === opts.funnelId) ?? null : null;
  const funnelDef = (funnels ?? []).find((f) => f.esDefault) ?? null;
  const canalFunnel = filaFunnel?.canal;
  const canalDef = funnelDef?.canal;
  const canalDelFunnel: CanalId | null = esCanal(canalFunnel) ? canalFunnel : null;
  const canal: CanalId | null = canalDelFunnel ?? (esCanal(canalDef) ? canalDef : null);
  const funnel: FunnelDeLaSesion | null = filaFunnel
    ? { id: filaFunnel.id, nombre: (filaFunnel.producto ?? '').trim() || filaFunnel.nombre, canal: canalDelFunnel, esDefault: filaFunnel.esDefault }
    : null;
  const ligasDelFunnel = filaFunnel ? (ligasFunnel ?? []).filter((l) => l.funnel_id === filaFunnel.id) : [];
  const ofertasDelFunnel = ligasDelFunnel
    .slice().sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || a.orden - b.orden)
    .map((l) => todasOfertas.find((o) => o.id === l.oferta_id && o.activa))
    .filter((o): o is Oferta => !!o);
  const idsOfertasFunnel = new Set(ofertasDelFunnel.map((o) => o.id));
  const productosDelFunnel = listaProductos.filter((p) => (ligasProducto ?? []).some((l) => idsOfertasFunnel.has(l.oferta_id) && l.producto_id === p.id));
  // El producto que «vende el funnel»: el de su oferta principal, si no el primero ligado.
  const principalDelFunnel = ligasDelFunnel.find((l) => l.es_principal)?.oferta_id ?? null;
  const productoPrincipal = (principalDelFunnel != null
    ? listaProductos.find((p) => (ligasProducto ?? []).some((l) => l.oferta_id === principalDelFunnel && l.producto_id === p.id))
    : undefined) ?? productosDelFunnel[0] ?? null;
  const ofertaBase = opts.ofertaBaseId != null ? todasOfertas.find((o) => o.id === opts.ofertaBaseId) ?? null : null;

  const semillaSesion = ofertaBase
    ? semillaDePiezas({ campos: resolverOfertaPrincipal(ofertaBase, answers ?? {}).campos, oferta: ofertaBase })
    : conFunnel ? semillaDeProducto(productoPrincipal) : semilla;

  // ── El texto ──
  const faseSesion = opts.mensajes ? estadoDiagnostico(opts.mensajes, { canal, yaGuardado: false }).diag : null;
  const faseVigente = faseVigenteDe({ faseGuardada: fase ?? null, faseSesion });
  const bloques: string[] = [];
  if (perfil?.trim()) bloques.push(`PERFIL DEL NEGOCIO (onboarding):\n${recortar(perfil.trim(), 3_500)}`);
  if (panorama?.trim()) bloques.push(`LO QUE MaKo ENTENDIÓ DE SUS DOCUMENTOS (El Archivero):\n${recortar(panorama.trim(), 3_500)}`);
  if (funnel) {
    const lineas = [`«${funnel.nombre}»${funnel.canal ? ` — cierra la venta por: ${canalLabel(funnel.canal)}` : ''}`];
    if (ofertasDelFunnel.length) lineas.push(`Sus ofertas:\n${ofertasDelFunnel.map(ofertaTexto).join('\n')}`);
    if (productosDelFunnel.length) lineas.push(`Lo que vende (productos):\n${productosDelFunnel.map(productoTexto).join('\n')}`);
    bloques.push(`EL FUNNEL DE ESTA CONVERSACIÓN:\n${recortar(lineas.join('\n'), 2_000)}`);
  }
  if (ofertaBase) bloques.push(`LA OFERTA QUE SE ESTÁ ANALIZANDO (no la reemplaces: se mejora y se guarda como otra):\n${recortar(ofertaTexto(ofertaBase), 1_200)}`);
  if (listaOfertas.length) bloques.push(`TODAS LAS OFERTAS ACTIVAS DEL NEGOCIO (${listaOfertas.length}):\n${recortar(listaOfertas.map(ofertaTexto).join('\n'), 1_500)}`);
  if (listaProductos.length) bloques.push(`PRODUCTOS ACTIVOS (${listaProductos.length}):\n${recortar(listaProductos.map(productoTexto).join('\n'), 1_000)}`);
  const avs = avatares ?? [];
  if (avs.length) bloques.push(`AVATARES DEL NEGOCIO (a quién le vende, ya definidos en MaKo):\n${recortar(avataresTexto(avs), 1_500)}`);
  const rz = razones ?? [];
  if (rz.length) {
    const nombreAvatar = new Map(avs.map((a) => [a.id, a.nombre] as const));
    const porAvatar = new Map<string, string[]>();
    for (const r of rz) {
      const quien = nombreAvatar.get(r.avatarId) ?? 'Sin avatar';
      porAvatar.set(quien, [...(porAvatar.get(quien) ?? []), r.descripcion ? `${r.nombre} (${r.descripcion})` : r.nombre]);
    }
    bloques.push(`RAZONES DE COMPRA (por qué le compran, por avatar):\n${recortar([...porAvatar].map(([a, xs]) => `- ${a}: ${xs.join(' · ')}`).join('\n'), 1_200)}`);
  }
  const faseTxt = faseVigente ? faseContextoTexto(faseVigente) : '';
  if (faseTxt.trim()) bloques.push(`FASE DEL NEGOCIO (para tu criterio; NO se le dice en el chat):\n${recortar(faseTxt.trim(), 1_200)}`);

  // La banda de facturación es la respuesta 0 del diagnóstico de fase (0 = $0-3.000, 1 = $3.000-10.000).
  const banda = faseVigente && Array.isArray(faseVigente.respuestas) && Number.isInteger(faseVigente.respuestas[0]) ? faseVigente.respuestas[0] : null;

  return {
    texto: recortar(bloques.join('\n\n'), TOPE_CONTEXTO),
    embudo: embudoMd?.trim() ? recortar(embudoMd.trim(), TOPE_EMBUDO) : '',
    tasasEmbudo,
    semilla,
    semillaSesion,
    foco: { productosActivos: listaProductos.length, ofertasActivas: listaOfertas.length, bandaFacturacion: banda },
    funnel,
    ofertaBase,
    faseGuardada: fase ?? null,
    faseSesion,
    faseVigente,
    canal,
  };
}

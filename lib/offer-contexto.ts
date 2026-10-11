// =============================================================================
// offer-contexto — lo que la tab Offer YA SABE del negocio y no vuelve a preguntar
// =============================================================================
// UN lector para las tres llamadas de la tab (turno, diagnóstico, propuesta) y para la semilla de la
// pantalla de bienvenida. Si cada llamada armara su propio contexto, el turno preguntaría algo que el
// diagnóstico sí sabía (AGENTS.md «Una cosa, un lugar»).
//
// De dónde sale cada cosa (todas por su lector de siempre, ninguna con un `.from` propio):
//   · perfil del negocio (onboarding)            → perfilNegocioTexto()      lib/onboarding.ts
//   · lo que MaKo entendió de sus documentos      → getPanorama()             lib/archivero.ts
//   · la oferta principal (los 5 campos)          → ofertaPrincipal(answers)  lib/ofertas.ts
//   · las ofertas activas                         → listarOfertas(true)       lib/ofertas.ts
//   · los productos activos                       → listProductos(true)       lib/productos.ts
//   · la fase y el cuello de botella              → getDiagnosticoFase()      lib/fase-store.ts
//   · el embudo de los últimos 90 días (opcional) → analisisNegocio()         lib/analisis-negocio.ts
//
// ⚠️ TODO ES OPCIONAL Y CADA FUENTE DEGRADA SOLA (`.catch` → vacío). Un negocio recién dado de alta no
//    tiene embudo ni diagnóstico de fase, y eso no puede tirar la conversación. Lo que sí queda es el
//    log: una lectura que falla siempre se ve igual que un negocio sin ese dato.
// ⚠️ `oferta_ticket` (el precio del brief) es TEXTO libre: viaja tal cual, nunca por parseFloat
//    (AGENTS.md y lib/oferta-modelo.ts: «Entre USD 5.000 y USD 10.000» daría 5000).
// ⚠️ El embudo es LENTO (lee meses de métricas y de leads): sólo lo pide el diagnóstico, que es el
//    único que lo usa («la oferta es lo último que se corrige», regla 7 del marco).
// =============================================================================

import 'server-only';
import { perfilNegocioTexto, getAnswers } from './onboarding';
import { getPanorama } from './archivero';
import { ofertaPrincipal, listarOfertas } from './ofertas';
import { listProductos } from './productos';
import { getDiagnosticoFase } from './fase-store';
import { faseContextoTexto } from './fase-diagnostico';
import { analisisNegocio } from './analisis-negocio';
import { analisisAMarkdown } from './analisis-modelo';
import { recortar, semillaDePiezas } from './offer-reglas';
import type { PiezasSabidas } from './offer-marco';
import type { Oferta } from './oferta-modelo';
import type { Producto } from './productos';

/** Lo que entra del contexto en un pedido. El resto del presupuesto es para documentos y conversación. */
export const TOPE_CONTEXTO = 12_000;
/** El embudo, aparte (sólo en el diagnóstico). */
export const TOPE_EMBUDO = 4_000;

export type FocoNegocio = { productosActivos: number; ofertasActivas: number; bandaFacturacion: number | null };

export type ContextoOffer = {
  /** El texto acotado que lee el modelo (sin el embudo). '' si el negocio todavía no cargó nada. */
  texto: string;
  /** El embudo de los últimos 90 días en markdown, o '' (si no se pidió o no hay datos). */
  embudo: string;
  /** Lo que ya se sabe de cada pieza, sacado de la oferta que el negocio cargó. */
  semilla: PiezasSabidas;
  /** Lo que mira la alerta de foco (lib/offer-reglas.ts → alertaFoco). */
  foco: FocoNegocio;
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
    o.prueba && `prueba: ${o.prueba}`,
    o.bonos.length ? `bonos: ${o.bonos.map((b) => b.nombre).join(' · ')}` : '',
  ].filter(Boolean);
  return `- ${o.nombre}${o.es_principal ? ' (la principal)' : ''}${partes.length ? ` — ${partes.join(' · ')}` : ''}`;
}

function productoTexto(p: Producto): string {
  // monto_usd SÍ es numérico (columna numeric del catálogo de productos), no texto libre.
  const precio = p.monto_usd != null ? ` — ${p.monto_usd} USD${p.tipo === 'suscripcion' ? ' al mes' : ''}` : '';
  return `- ${p.nombre}${precio}${p.promesa ? ` · ${p.promesa}` : ''}`;
}

/**
 * El contexto del negocio para la tab Offer.
 *
 * `conEmbudo` agrega el embudo de los últimos 90 días (lento: sólo el diagnóstico). Corre dentro del
 * workspace del que llama: todas las lecturas pasan por `getTenantDb` / settings scopeados.
 */
export async function contextoOffer(opts: { conEmbudo?: boolean } = {}): Promise<ContextoOffer> {
  const [perfil, panorama, answers, ofertas, productos, fase, embudoMd] = await Promise.all([
    perfilNegocioTexto().catch(logFallo('el perfil del negocio')),
    getPanorama().catch(logFallo('el panorama del Archivero')),
    getAnswers().catch(logFallo('las respuestas del onboarding')),
    listarOfertas(true).catch(logFallo('las ofertas activas')),
    listProductos(true).catch(logFallo('los productos activos')),
    getDiagnosticoFase().catch(logFallo('el diagnóstico de fase')),
    opts.conEmbudo
      ? analisisNegocio({ desde: haceDias(89), hasta: null }).then(analisisAMarkdown).catch(logFallo('el embudo de los últimos 90 días'))
      : Promise.resolve(null),
  ]);
  const principal = await ofertaPrincipal(answers ?? {}).catch(logFallo('la oferta principal'));

  const listaOfertas = ofertas ?? [];
  const listaProductos = productos ?? [];
  const filaPrincipal = principal?.oferta ?? listaOfertas.find((o) => o.es_principal) ?? null;
  const semilla = semillaDePiezas({ campos: principal?.campos ?? null, oferta: filaPrincipal });

  const bloques: string[] = [];
  if (perfil?.trim()) bloques.push(`PERFIL DEL NEGOCIO (onboarding):\n${recortar(perfil.trim(), 4_000)}`);
  if (panorama?.trim()) bloques.push(`LO QUE MaKo ENTENDIÓ DE SUS DOCUMENTOS (El Archivero):\n${recortar(panorama.trim(), 4_000)}`);
  if (listaOfertas.length) bloques.push(`OFERTAS ACTIVAS (${listaOfertas.length}):\n${recortar(listaOfertas.map(ofertaTexto).join('\n'), 2_000)}`);
  if (listaProductos.length) bloques.push(`PRODUCTOS ACTIVOS (${listaProductos.length}):\n${recortar(listaProductos.map(productoTexto).join('\n'), 1_500)}`);
  const faseTxt = fase ? faseContextoTexto(fase) : '';
  if (faseTxt.trim()) bloques.push(`FASE DEL NEGOCIO:\n${recortar(faseTxt.trim(), 1_200)}`);

  // La banda de facturación es la respuesta 0 del diagnóstico de fase (0 = $0-3.000, 1 = $3.000-10.000).
  const banda = fase && Array.isArray(fase.respuestas) && Number.isInteger(fase.respuestas[0]) ? fase.respuestas[0] : null;

  return {
    texto: recortar(bloques.join('\n\n'), TOPE_CONTEXTO),
    embudo: embudoMd?.trim() ? recortar(embudoMd.trim(), TOPE_EMBUDO) : '',
    semilla,
    foco: { productosActivos: listaProductos.length, ofertasActivas: listaOfertas.length, bandaFacturacion: banda },
  };
}

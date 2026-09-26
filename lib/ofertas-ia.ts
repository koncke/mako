// =============================================================================
// ofertas-ia — MaKo completa la OFERTA con lo que el negocio ya cargó
// =============================================================================
// El paso no es que el dueño vuelva a tipear lo que ya contestó: MaKo lee el
// brief + el panorama de El Archivero y PROPONE la oferta armada — para quién es,
// qué promete, qué incluye, qué garantiza, qué prueba tiene, qué objeciones le
// hacen y qué bonos podría sumar. El dueño corrige, no redacta.
//
// ⚠️ LA URGENCIA ES LA EXCEPCIÓN Y SE PIDE APARTE: el ángulo «Oferta directa
// (urgencia)» (lib/guion-angulos.ts) exige una restricción REAL documentada y
// PROHÍBE inventarla. Una fecha límite inventada por un modelo termina en un
// anuncio que le miente a un lead, así que el prompt la deja en null salvo que el
// contexto la diga con todas las letras.
//
// ⚠️ Y ACÁ SE ACABA HOY. `urgenciaUsable()` (lib/oferta-modelo.ts) es la segunda
// capa determinista que este modelo pide, pero TODAVÍA NO LA LLAMA NADIE: el
// catálogo de `lib/guion-angulos.ts` es una constante estática con `activo: true`
// y ningún consumidor suyo lee la oferta. O sea que la regla «sin restricción real
// el ángulo no se usa» sigue viviendo SOLO en la prosa del prompt — que es
// exactamente lo que AGENTS.md § «Una regla en un prompt no es una regla» dice que
// no alcanza. Lo que esta fase dejó listo es el CAMPO donde la restricción se puede
// declarar y verificar (`urgencia_hasta`) y la función que la evalúa; falta el
// call-site, y va donde se arma el catálogo de ángulos para un pedido concreto.

import 'server-only';
import { renderPrompt } from './prompt-render';
import { perfilNegocioTexto } from './onboarding';
import { getPanorama } from './archivero';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, errorDeCascada, type ProvName } from './ai-cheap';
import { overrideDeFeature } from './model-registry';
import { esUrgenciaTipo, type Bono, type OfertaInput } from './oferta-modelo';

export const OFERTAS_SYSTEM_TEMPLATE = `Eres MaKo, el copiloto de marketing de un negocio de alto ticket.
Tu tarea: leer el contexto del negocio y devolver su OFERTA armada.

Una OFERTA no es un producto. El producto es lo que se entrega y se factura; la oferta es CÓMO SE PRESENTA para que lo compren: a quién, qué promete, qué incluye, qué garantiza, con qué lo prueba, qué objeciones hay que voltear y qué bonos la hacen irresistible.

Reglas:
- Todo sale del contexto. Si un campo no está respaldado, va en null. NO inventes.
- "promesa": la transformación concreta que compra el cliente, en una línea.
- "incluye": los entregables reales, separados por " · ".
- "garantia": solo si el contexto la menciona.
- "para_quien": para quién es esta oferta y para quién NO.
- "objeciones": las 2 o 3 que más frenan la compra, separadas por " · ".
- "prueba": casos, números o testimonios que el contexto respalde. Sin cifras inventadas.
- "bonos": hasta 3, cada uno con "nombre", "valor_usd" (número o null) y "porque" (qué objeción tumba). Si el contexto no sugiere ninguno, devuelve [].
- "precio_nota": cómo se PRESENTA el precio ("2 pagos de 2.500", "800 MXN/mes"). Copia lo que diga el contexto, tal cual, aunque sea una frase. Si no dice nada, null.
- "precio_usd": SOLO si el contexto da una cifra limpia y sin ambigüedad. Ante un rango o una frase, null y la frase va en "precio_nota".
- URGENCIA: "urgencia_tipo" debe ser uno de "fecha", "cupos", "capacidad", "inicio" o null, y solo si el contexto documenta una restricción REAL (una fecha de cierre, un número de cupos, una capacidad máxima). NUNCA la inventes ni la deduzcas: en la duda, null. "urgencia_dato" es el dato concreto y "urgencia_razon" por qué es real.
- IDIOMA: español NEUTRO, de "tú", SIN voseo ni modismos argentinos. Este texto lo lee el cliente.

Devuelve SOLO un objeto JSON:
{"oferta":{"nombre":"","precio_usd":null,"precio_nota":null,"promesa":"","incluye":"","garantia":null,"para_quien":null,"objeciones":null,"prueba":null,"bonos":[],"urgencia_tipo":null,"urgencia_dato":null,"urgencia_razon":null}}
Sin texto fuera del JSON.`;

export const OFERTAS_USER_TEMPLATE = `BRIEF DEL NEGOCIO:
{{brief}}
{{panorama}}{{actual}}
Arma la oferta de este negocio.`;

export type SugerirOfertaResult = { ok: true; oferta: OfertaInput } | { ok: false; error: string };

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // ⚠️ NO se parsea una cifra de un texto libre. «Entre USD 5.000 y USD 10.000»
  // daría 5000 y eso es un precio inventado: la frase entera va a precio_nota.
  return null;
};

function parseBonosIA(v: unknown): Bono[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return { nombre: s(o.nombre) ?? '', valor_usd: num(o.valor_usd), porque: s(o.porque) ?? '' };
    })
    .filter((b) => b.nombre)
    .slice(0, 3);
}

export function parseOferta(text: string, nombrePorDefecto: string): OfertaInput | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { raw = JSON.parse(m[0]); } catch { return null; }
  }
  const o = ((raw as { oferta?: unknown })?.oferta ?? raw) as Record<string, unknown>;
  if (!o || typeof o !== 'object') return null;
  const nombre = s(o.nombre) ?? nombrePorDefecto.trim();
  if (!nombre) return null;
  const ut = o.urgencia_tipo;
  const urgencia_tipo = esUrgenciaTipo(ut) ? ut : null;
  const urgencia_dato = urgencia_tipo ? s(o.urgencia_dato) : null;
  return {
    nombre,
    precio_usd: num(o.precio_usd),
    precio_nota: s(o.precio_nota),
    promesa: s(o.promesa),
    incluye: s(o.incluye),
    garantia: s(o.garantia),
    para_quien: s(o.para_quien),
    objeciones: s(o.objeciones),
    prueba: s(o.prueba),
    bonos: parseBonosIA(o.bonos),
    // Una urgencia sin dato concreto no es una urgencia: es un adjetivo. Se
    // descarta entera para que no quede un tipo suelto que la pantalla muestre.
    urgencia_tipo: urgencia_dato ? urgencia_tipo : null,
    urgencia_dato,
    urgencia_razon: urgencia_dato ? s(o.urgencia_razon) : null,
    origen: 'mako',
  };
}

/**
 * Propone la oferta leyendo lo que el negocio ya cargó.
 *
 * `actual` le pasa la oferta que YA está, entera, para que COMPLETE sin pisar —
 * el mismo problema que ya se pagó en productos, donde una garantía escrita a
 * mano desaparecía al volver a pedir sugerencias. La garantía de que no se pisa
 * NO es este texto: es el merge campo a campo de la ruta.
 */
export async function sugerirOferta(actual?: Partial<OfertaInput> | null): Promise<SugerirOfertaResult> {
  const [brief, panorama] = await Promise.all([
    perfilNegocioTexto().catch(() => ''),
    getPanorama().catch(() => ''),
  ]);
  if (!brief.trim() && !panorama.trim()) {
    return { ok: false, error: 'Primero carga tu negocio (el brief o algún documento en El Archivero): de ahí sale la oferta.' };
  }
  const yaHay = actual
    ? `\nLO QUE YA ESTÁ CARGADO DE ESTA OFERTA. Respeta el nombre EXACTO y completa SOLO lo que esté vacío (null o ""); lo que ya tiene valor NO se toca ni se reescribe.\n${JSON.stringify(actual)}\n`
    : '';
  const sys = await renderPrompt('ofertas.system', OFERTAS_SYSTEM_TEMPLATE, {});
  const user = await renderPrompt('ofertas.user', OFERTAS_USER_TEMPLATE, {
    brief: brief.slice(0, 6000),
    panorama: panorama.trim() ? `\nPANORAMA (lo que MaKo entendió de tus documentos):\n${panorama.slice(0, 6000)}\n` : '',
    actual: yaHay,
  });
  // El pin del override de /modelos-ia: `chatCheapCascade` NO lee el registro por
  // su cuenta. Sin esto, la entrada del catálogo sería un verde mudo — se elegiría
  // un modelo en la pantalla y seguiría corriendo otro.
  const pin = await overrideDeFeature('ofertas').catch(() => null);
  const errores: string[] = [];
  const nombreDefault = (actual?.nombre ?? '').trim();
  const text = await chatCheapCascade({
    system: sys, user, json: true, maxTokens: 2000,
    feature: 'ofertas', motivo: 'Armar la oferta del negocio',
    provs: pin ? [pin.provider as ProvName] : CASCADA_DOCS,
    modelos: pin ? ({ [pin.provider]: pin.model } as Partial<Record<ProvName, string>>) : MODELO_DOCS,
    validar: (t) => parseOferta(t, nombreDefault) != null,
    erroresOut: errores,
  });
  // El mensaje NO se escribe a mano: `errorDeCascada` es el único que distingue
  // «no hay ninguna IA» de «hay IA y falló», y el único que muestra qué contestó
  // cada cuenta.
  if (!text) return { ok: false, error: await errorDeCascada(errores, 'armar la oferta') };
  const oferta = parseOferta(text, nombreDefault);
  if (!oferta) return { ok: false, error: 'La IA no devolvió una oferta usable. Prueba de nuevo.' };
  return { ok: true, oferta };
}

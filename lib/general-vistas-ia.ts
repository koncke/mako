// =============================================================================
// general-vistas-ia — «¿Qué vas a crear hoy?» en /general: MaKo elige bloques del catálogo
// =============================================================================
// Martín (13/10/2026): «Copia lo que ya tenemos en muchos lugares con "TEMPLATES" y la opción de IA de "¿Qué vas a
// crear hoy?"». La caja es la de siempre (app/landing-generator/CajaPedido.tsx); acá vive lo que se le pide al modelo.
//
// Lo que no se ve en la firma:
//   · NUNCA POR CLAUDE NI POR NADA QUE COBRE. La cascada gratis (`PROVS_CREAR_IA`), con el pin gratis de /modelos-ia
//     primero, y la RED DE PLATAFORMA al final (lib/graficos-ia-red.ts): «siempre tiene que probar con otros
//     proveedores» (Martín, 11/10/2026). La feature (`general-vista-ia`) no tiene fila en CLAUDE_PERMITIDO.
//   · LO QUE LA IA VE Y DEVUELVE ES LO QUE LA PANTALLA OFRECE. El catálogo del prompt sale de `catalogoParaIA` (los
//     mismos bloques que lista «Personalizar», y los funnels y ofertas del negocio por id), y la salida pasa por
//     `deIAVista`: lo que no existe se saca con un aviso, nunca se reemplaza por «lo más parecido».
//   · EL PROMPT ES CHICO A PROPÓSITO (ocho bloques y los nombres del negocio): entra en el tope de entrada de Groq,
//     que suele ser el único que contesta cuando Gemini se satura.
//   · NO ESCRIBE NADA. Devuelve la vista; la crea la pantalla con el mismo guardado que una plantilla. Cancelar sale
//     gratis.

import 'server-only';
import { chatCheapCascade, MODELO_DOCS, provsDe, tokensAprox, techoDeEntrada, type ProvName } from './ai-cheap';
import { overrideDeFeature } from './model-registry';
import { parseJsonObject } from './json-del-modelo';
import { PROVS_CREAR_IA, PROVS_GRATIS_PIN, MODELOS_CREAR_IA, salidaParaIA, falloDeIA, type FalloIA } from './flujo-ia';
import { porLaRedDePlataforma } from './graficos-ia-red';
import { catalogoParaIA, deIAVista, type CatalogoIAVista, type ResultadoIAVista } from './general-vistas-modelo';

export const FEATURE_VISTA_IA = 'general-vista-ia';
/** El tope del pedido escrito (el de la caja de «¿Qué vas a crear hoy?» es más largo: acá alcanza con una frase). */
export const TOPE_PEDIDO_VISTA = 1_500;
/** Lo que tiene la cascada para contestar (la ruta corta a los 60 s). */
const PLAZO_MS = 50_000;
const MIN_PARA_OTRO_MS = 12_000;
const TIMEOUT_INTENTO_MS = 30_000;

const SYSTEM = `Eres MaKo. Armas una VISTA de la pantalla General de un negocio: eliges qué bloques ve la persona, en qué orden, y si la vista mira sólo algunos funnels u ofertas.

Reglas:
- Sólo puedes usar los ids de BLOQUES, FUNNELS y OFERTAS que te paso. Nunca inventes uno.
- "bloques": de 1 a 8 ids, en el orden en que la persona los quiere ver (lo más importante primero).
- "funnels" y "ofertas": ids numéricos, SÓLO si la persona nombra un funnel, una oferta o un producto. Si no nombra ninguno, déjalos vacíos (la vista mira todo el negocio).
- "nombre": 1 a 4 palabras, en español neutro, que digan para qué es la vista.
- "emoji": un solo emoji.

Devuelve SOLO un JSON: {"nombre": string, "emoji": string, "bloques": string[], "funnels": number[], "ofertas": number[]}`;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function userDe(pedido: string, cat: CatalogoIAVista): string {
  return `${catalogoParaIA(cat)}\n\nLO QUE PIDE LA PERSONA:\n${pedido.slice(0, TOPE_PEDIDO_VISTA)}`;
}

/** La vista que pide `pedido`, o el motivo honesto por el que no salió. */
export async function generarVistaIA(pedido: string, cat: CatalogoIAVista, inicio = Date.now()): Promise<ResultadoIAVista | FalloIA> {
  const user = userDe(pedido, cat);
  const pin = await overrideDeFeature(FEATURE_VISTA_IA).catch(() => null);
  const pinGratis = pin != null && PROVS_GRATIS_PIN.includes(pin.provider as ProvName) ? pin : null;
  const provs: ProvName[] = pinGratis
    ? [pinGratis.provider as ProvName, ...PROVS_CREAR_IA.filter((x) => x !== pinGratis.provider)]
    : [...PROVS_CREAR_IA];
  const modelos: Partial<Record<ProvName, string>> = { ...MODELO_DOCS, ...MODELOS_CREAR_IA, ...(pinGratis ? { [pinGratis.provider]: pinGratis.model } : {}) };
  const hastaMs = inicio + PLAZO_MS;
  const quedan = () => hastaMs - Date.now();
  const errores: string[] = [];
  const maxTokens = salidaParaIA(tokensAprox(SYSTEM) + tokensAprox(user), techoDeEntrada('groq'));

  // Una caja: lo que asigna el `validar` (un closure) no lo ve el análisis de flujo de TypeScript.
  const out: { bueno: ResultadoIAVista | null; ultimo: string[] | null; crudo: boolean } = { bueno: null, ultimo: null, crudo: false };
  const validar = (t: string): boolean => {
    let obj: Record<string, unknown>;
    try { obj = parseJsonObject(t); } catch { out.crudo = true; return false; }
    const r = deIAVista(obj, cat);
    if (r.errores.length) { out.ultimo = r.errores; return false; }
    out.bueno = r;
    return true;
  };

  await chatCheapCascade({
    system: SYSTEM, user, json: true, maxTokens, temperature: 0.2,
    feature: FEATURE_VISTA_IA, motivo: 'Armar una vista de General con IA',
    provs, modelos, timeoutMs: TIMEOUT_INTENTO_MS, hastaMs, erroresOut: errores, validar,
  }).catch((e) => { errores.push(msg(e)); return ''; });
  if (out.bueno) return out.bueno;

  // Lo leído tenía errores: un reintento diciéndole cuáles.
  if (out.ultimo && quedan() > MIN_PARA_OTRO_MS) {
    const corregir = `${user}\n\nTU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS. Corrígelos y devuelve el JSON completo:\n${out.ultimo.map((e) => `- ${e}`).join('\n')}`;
    await chatCheapCascade({
      system: SYSTEM, user: corregir, json: true, maxTokens, temperature: 0.2,
      feature: FEATURE_VISTA_IA, motivo: 'Corregir una vista de General con IA',
      provs, modelos, timeoutMs: TIMEOUT_INTENTO_MS, hastaMs, erroresOut: errores, validar,
    }).catch((e) => { errores.push(msg(e)); return ''; });
    if (out.bueno) return out.bueno;
  }

  // La red de plataforma: las keys del negocio no armaron nada usable (o no tiene). Sus errores van al log.
  if (quedan() > MIN_PARA_OTRO_MS) {
    await porLaRedDePlataforma({
      system: SYSTEM, user, maxTokens, feature: FEATURE_VISTA_IA, motivo: 'Armar una vista de General con IA', hastaMs, validar,
    });
    if (out.bueno) return out.bueno;
  }

  if (out.ultimo) {
    console.error('[general/ia] la salida no pasó la revisión:', out.ultimo.join(' | '));
    return { error: 'MaKo no pudo armar esa vista. Prueba con otras palabras o elige una plantilla.' };
  }
  if (out.crudo) return { error: 'MaKo armó la vista pero se cortó al leerla. Prueba de nuevo.' };
  console.error('[general/ia] ningún proveedor armó la vista:', errores.join(' | '));
  const hayIA = (await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0);
  return falloDeIA(errores, hayIA);
}

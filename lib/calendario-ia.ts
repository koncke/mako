// =============================================================================
// calendario-ia — «¿Qué vas a crear hoy?» en el Calendario: MaKo PROPONE eventos para la semana
// =============================================================================
// Martín: «que tenga IA que te ayude o "templates"». La caja es la de siempre (app/landing-generator/CajaPedido.tsx).
//
// Lo que no se ve en la firma:
//   · LA AGENDA NO PASA POR LA IA (decisión de Martín del 07/10/2026, AGENTS.md → `datosDeGoogle`). El modelo ve el
//     PEDIDO y las FECHAS de la semana, nada más: ni un evento de Google, ni una reunión del CRM, ni lo que ya está
//     agendado. Si alguien pide «acomódalo donde tenga libre», MaKo no lo sabe y lo dice el prompt.
//   · MaKo PROPONE, LA PERSONA CONFIRMA. Esto devuelve entradas; la pantalla las muestra editables y recién al
//     «Agregar» se escriben (`crearEventos`, origen 'ia').
//   · GRATIS SIEMPRE: la cascada gratis con el pin gratis primero y la red de plataforma al final (el molde de
//     lib/graficos-ia-generar.ts). La feature (`calendario-ia`) no está en CLAUDE_PERMITIDO.
//   · Lo que vuelve se revalida contra el modelo (`deIACalendario`): un día fuera de la semana, una hora rota o un
//     tipo inventado se SACAN con un aviso; nunca se corrige adivinando.

import 'server-only';
import { chatCheapCascade, MODELO_DOCS, provsDe, tokensAprox, techoDeEntrada, type ProvName } from './ai-cheap';
import { overrideDeFeature } from './model-registry';
import { parseJsonObject } from './json-del-modelo';
import { PROVS_CREAR_IA, PROVS_GRATIS_PIN, MODELOS_CREAR_IA, salidaParaIA, falloDeIA, type FalloIA } from './flujo-ia';
import { porLaRedDePlataforma } from './graficos-ia-red';
import { deIACalendario, DIAS_CORTOS, FORMATOS_PUBLICACION, TIPOS_EVENTO, type EntradaEvento } from './calendario-modelo';

export const FEATURE_CALENDARIO_IA = 'calendario-ia';
export const TOPE_PEDIDO_CALENDARIO = 1_500;
const PLAZO_MS = 50_000;
const MIN_PARA_OTRO_MS = 12_000;
const TIMEOUT_INTENTO_MS = 30_000;

const SYSTEM = `Eres MaKo. Armas eventos para el Calendario de un negocio a partir de lo que pide la persona: publicaciones (Stories, Reels, anuncios, emails), bloques de trabajo (escribir guiones, grabar, revisar) y llamadas.

Reglas:
- Cada evento tiene "fecha": SIEMPRE una de las fechas de la semana que te paso, tal cual (YYYY-MM-DD).
- "tipo": uno de ${TIPOS_EVENTO.join(', ')}. Si es "publicacion", "formato": uno de ${FORMATOS_PUBLICACION.join(', ')}.
- "hora": "HH:MM" en 24 horas, o null si es de todo el día. "duracionMin": minutos (sólo para bloques y llamadas), o null.
- "titulo": corto (2 a 8 palabras), en español neutro, que diga qué hay que hacer.
- No conoces la agenda de la persona: no digas que un horario está libre. Usa horarios razonables de trabajo.
- Entre 1 y 20 eventos.

Devuelve SOLO un JSON: {"eventos": [{"titulo": string, "tipo": string, "formato": string|null, "fecha": string, "hora": string|null, "duracionMin": number|null}]}`;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function userDe(pedido: string, dias: readonly string[], hoy: string): string {
  const semana = dias.map((d, i) => `- ${DIAS_CORTOS[i] ?? ''} ${d}`).join('\n');
  return `HOY: ${hoy}\n\nLA SEMANA:\n${semana}\n\nLO QUE PIDE LA PERSONA:\n${pedido.slice(0, TOPE_PEDIDO_CALENDARIO)}`;
}

export type ResultadoIACalendario = { entradas: EntradaEvento[]; avisos: string[] };

/** Los eventos que propone MaKo para la semana `dias` (lunes a domingo), o el motivo honesto. */
export async function proponerEventosIA(pedido: string, dias: readonly string[], hoy: string, tz: string, inicio = Date.now()): Promise<ResultadoIACalendario | FalloIA> {
  const user = userDe(pedido, dias, hoy);
  const pin = await overrideDeFeature(FEATURE_CALENDARIO_IA).catch(() => null);
  const pinGratis = pin != null && PROVS_GRATIS_PIN.includes(pin.provider as ProvName) ? pin : null;
  const provs: ProvName[] = pinGratis
    ? [pinGratis.provider as ProvName, ...PROVS_CREAR_IA.filter((x) => x !== pinGratis.provider)]
    : [...PROVS_CREAR_IA];
  const modelos: Partial<Record<ProvName, string>> = { ...MODELO_DOCS, ...MODELOS_CREAR_IA, ...(pinGratis ? { [pinGratis.provider]: pinGratis.model } : {}) };
  const hastaMs = inicio + PLAZO_MS;
  const quedan = () => hastaMs - Date.now();
  const errores: string[] = [];
  const maxTokens = salidaParaIA(tokensAprox(SYSTEM) + tokensAprox(user), techoDeEntrada('groq'));

  const out: { bueno: ResultadoIACalendario | null; ultimo: string[] | null; crudo: boolean } = { bueno: null, ultimo: null, crudo: false };
  const validar = (t: string): boolean => {
    let obj: Record<string, unknown>;
    try { obj = parseJsonObject(t); } catch { out.crudo = true; return false; }
    const r = deIACalendario(obj, dias, tz);
    if (r.errores.length) { out.ultimo = r.errores; return false; }
    out.bueno = { entradas: r.entradas, avisos: r.avisos };
    return true;
  };

  await chatCheapCascade({
    system: SYSTEM, user, json: true, maxTokens, temperature: 0.3,
    feature: FEATURE_CALENDARIO_IA, motivo: 'Proponer eventos del Calendario con IA',
    provs, modelos, timeoutMs: TIMEOUT_INTENTO_MS, hastaMs, erroresOut: errores, validar,
  }).catch((e) => { errores.push(msg(e)); return ''; });
  if (out.bueno) return out.bueno;

  if (out.ultimo && quedan() > MIN_PARA_OTRO_MS) {
    const corregir = `${user}\n\nTU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS. Corrígelos y devuelve el JSON completo:\n${out.ultimo.map((e) => `- ${e}`).join('\n')}`;
    await chatCheapCascade({
      system: SYSTEM, user: corregir, json: true, maxTokens, temperature: 0.3,
      feature: FEATURE_CALENDARIO_IA, motivo: 'Corregir eventos del Calendario con IA',
      provs, modelos, timeoutMs: TIMEOUT_INTENTO_MS, hastaMs, erroresOut: errores, validar,
    }).catch((e) => { errores.push(msg(e)); return ''; });
    if (out.bueno) return out.bueno;
  }

  if (quedan() > MIN_PARA_OTRO_MS) {
    await porLaRedDePlataforma({ system: SYSTEM, user, maxTokens, feature: FEATURE_CALENDARIO_IA, motivo: 'Proponer eventos del Calendario con IA', hastaMs, validar });
    if (out.bueno) return out.bueno;
  }

  if (out.ultimo) {
    console.error('[calendario/ia] la salida no pasó la revisión:', out.ultimo.join(' | '));
    return { error: 'MaKo no pudo armar eso. Prueba con otras palabras o elige una plantilla.' };
  }
  if (out.crudo) return { error: 'MaKo lo armó pero se cortó al leerlo. Prueba de nuevo.' };
  console.error('[calendario/ia] ningún proveedor contestó:', errores.join(' | '));
  const hayIA = (await Promise.all(provs.map((x) => provsDe(x).catch(() => [])))).some((l) => l.length > 0);
  return falloDeIA(errores, hayIA);
}

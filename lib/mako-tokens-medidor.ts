// =============================================================================
// mako-tokens-medidor — EL ÚNICO lugar por donde pasa todo gasto de IA de MaKo (15/11/2026)
// =============================================================================
// Martín, 15/11/2026, textual: «por supuesto que tienes que implementar el tema de MaKo Tokens dentro de la aplicación del
// gasto con inteligencia artificial. Sería bueno de que para eso justamente vinculemos todas las cosas que utilicen
// inteligencia artificial y que todo utilice MaKo Tokens. Es como lo mismo que tenemos en generación de video o generación
// de imágenes. Le damos la opción de conectar su flow, sí, pero en general al principio generan con MaKo Tokens. Lo mismo
// con la generación de transcripciones, la generación de análisis de la competencia, que eso también gasta dinero. O sea,
// todo debería consumir MaKo Tokens».
//
// ─────────────────────────────────────────────────────────────────────────────
// ESTO DA VUELTA LA DECISIÓN DEL 22/10/2026, Y LA VIEJA QUEDA ESCRITA
// ─────────────────────────────────────────────────────────────────────────────
// El 22/10/2026 Martín decidió «cada negocio paga su IA»: los guiones, los copys, las transcripciones, las respuestas del
// setter y los análisis de ofertas salían por la clave del NEGOCIO (su Claude, su OpenAI, su Gemini o una PC suya), y la
// calculadora de /planes lo decía con todas las letras — tres de sus cinco filas decían «No gasta: usa tu IA».
//
// **Desde el 15/11/2026 la regla es la inversa: por defecto TODO gasta MaKo Tokens, y conectar su propia clave (o su Google
// Flow) es una OPCIÓN que el negocio elige, no el camino por defecto.** Lo que NO cambió: el día que el negocio conecta su
// clave, su gasto deja de descontar MaKo Tokens.
//
// ⚠️ LA DECISIÓN VIEJA NO SE BORRA PORQUE SU PORQUÉ SIGUE GOBERNANDO MEDIO ARCHIVO: `lib/ia-del-negocio.ts` y
// `lib/solo-su-ia.ts` existen por D6b —«un negocio con su Claude o su GPT corre su Ops Center con su cuenta, y Gemini no
// participa»—, que es una regla de PRIVACIDAD, no de plata: los datos de los clientes de un negocio no van a una IA gratis
// que entrena con ellos. Eso queda tal cual. Lo que se dio vuelta es quién paga cuando el negocio NO conectó nada: antes,
// nadie (la llamada fallaba o la pagaba MaKo sin medir); ahora, su cupo de MaKo Tokens.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ DÓNDE SE ENGANCHA, Y POR QUÉ NO EN LAS ~30 RUTAS
// ─────────────────────────────────────────────────────────────────────────────
// Lo obvio es envolver `conSuIADelNegocio` (lib/ia-del-negocio.ts), que es lo que llaman las ~30 rutas que gastan IA. **Y
// está mal por dos razones que se miden mirando una ruta cualquiera:**
//
//   1. `conSuIADelNegocio` envuelve el HANDLER ENTERO, no la llamada al modelo. En app/api/onboarding/avatares/route.ts el
//      mismo callback atiende `siguiente`, `describir-archivo`, `afinar` y `guardar`: cobrarle al wrapper le cobra a
//      `guardar`, que no llama a ninguna IA, y le cobra UNA VEZ a `afinar`, que llama varias.
//   2. Esos archivos son 39 (medido el 15/11/2026: `grep -rln conSuIADelNegocio app/ lib/`), pero los caminos que gastan
//      IA son muchos más: 18 crons, 6 webhooks, WhatsApp, Automations, los Analyst, la API de MaKo. Enganchar en los 39
//      deja afuera justo a los que gastan sin que nadie apriete nada — que según docs/costos-ia-y-planes.md son los más
//      caros que hay (el webhook de Fathom proyecta US$52/mes para UN cliente, «más que el plan Pro entero»).
//
// Y al revés: enganchado en la capa de IA, **los 39 quedan cubiertos igual, sin tocar ninguno**. Medido: 11 llaman
// derecho a una de las diez entradas, 25 llegan por un helper de `lib/` y 3 a dos saltos (`landing-analyst-auto` →
// `landing-analyst` → `chatClaude`; `spy-oferta-servidor` → `offer-ia`; `pendientes/acciones` → la API de MaKo).
//
// **El embudo de verdad ya existe y es otro: LA PUERTA de la capa de IA.** Cada función pública de `lib/ai-cheap.ts`,
// `lib/anthropic.ts` y `lib/video-desarmar-gemini.ts` que llama a un modelo arranca con las dos mismas líneas:
//
//     await exigirPermisoIa();                                            // el permiso de la persona (Apple 5.1.2(i))
//     if (pasaPorLaPuerta(opts.feature)) return conD6bDelPedido(...);     // D6b decidido para este pedido
//
// El medidor es la TERCERA línea, con el mismo truco de re-entrada: `if (!medidorAbierto()) return conMedidorDeMt(feature,
// () => estaMismaFuncion(opts))`. Así no hay que re-indentar el cuerpo de once funciones —cada merge chocaría con todo— y
// se gana el `try/finally` que hace falta para liquidar. Es la misma razón por la que existe `entrarSoloSuIA`.
//
// ⚠️ Y VA DESPUÉS DE LA LÍNEA DE D6b, NO ANTES: el medidor necesita saber si la IA la paga el negocio con SU clave, y eso
// es justo lo que decide esa línea. Puesto antes, cobraría MaKo Tokens a quien está pagando su propia IA.
//
// ⚠️ LOS CAMINOS QUE **NO** PASAN POR ACÁ (la regla de AGENTS.md: ponerlo en el choke point no cierra el trabajo, hay que
// enumerar lo que queda afuera). Medido con `grep` el 15/11/2026, están en docs/hallazgos-mako-tokens.md:
//   · `lib/embeddings.ts` — corre en CADA búsqueda del RAG, no llama a `recordUsage` y no pasa por la capa de IA.
//   · `lib/transcribe-plataforma.ts` — el audio de las clases de los cursos, con `envCred` (la clave del dueño).
//   · los MEDIOS (video, imagen, locución). Tienen precio fijo por unidad y se cobran con `cobrarMediosMt`, que es
//     explícito y no liquida nada. ⚠️ Hoy NINGUNO lo paga MaKo, así que no hay dónde engancharlo todavía: el video y
//     las imágenes salen por el Google Flow DEL CLIENTE, la locución por su ElevenLabs (`credDelCliente`), y ApiMart
//     —que sí la paga MaKo— tiene su `generarVideo` escrito y sin que nadie lo llame. El día que se enganche
//     `generarVideo`, el cobro va ahí y en el mismo commit.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ EL GASTO DE TEXTO NO SE SABE ANTES. RESERVAR Y LIQUIDAR.
// ─────────────────────────────────────────────────────────────────────────────
// Un segundo de video cuesta US$0,0384 y eso se sabe antes de generarlo. Una llamada de texto cuesta lo que salga de sus
// tokens, y eso se sabe DESPUÉS. Las tres salidas posibles, y por qué se eligió la tercera:
//
//   (a) **Cobrar un estimado fijo y no corregir.** Simple, y miente siempre: la distribución de salida es asimétrica
//       (media 1,9× a 3× la mediana), así que se cobra de más al 70 % y de menos a la cola — que es la que duele.
//   (b) **No cobrar antes, cobrar el real después.** Deja de cumplirse la propiedad: con saldo cero se puede disparar una
//       tanda entera y pagarla toda después. Es exactamente lo que el medidor existe para impedir.
//   (c) **RESERVAR el estimado antes y LIQUIDAR el real después.** ← ésta.
//
// Reservar = descontar de verdad, con el `update` atómico de la 0416. Si no alcanza, la llamada no arranca. Cuando el
// modelo contesta, `recordUsage` ya calcula el costo real de esa llamada (lib/anthropic-usage.ts, y es el único lugar del
// repo que lo hace): se le avisa al medidor, y al cerrar se devuelve lo que sobró o se cobra lo que faltó.
//
// Tres propiedades que caen solas de este diseño, y son el motivo de elegirlo:
//   · **Una llamada que FALLA no se cobra.** Nadie reportó costo, así que la reserva entera se devuelve en el `finally`.
//     (Los MEDIOS sí se cobran por intento, y a propósito: ahí el proveedor cobra el intento fallido.)
//   · **El estimado no tiene que ser exacto.** Decide si la llamada arranca; lo que se cobra es el real. Un `estimado`
//       flojo en la tabla de costos no le cuesta plata a nadie.
//   · **Una operación que hace cinco llamadas a un modelo paga las cinco**, cada una con su costo real, porque el medidor
//     se abre por llamada pública y acumula lo que reportan todas las de adentro.
//
// ⚠️ Y UNA QUE HAY QUE SABER: `recordUsage` se llama a veces SIN `await` (7 call-sites de la IA barata lo hacen a
// propósito: en serverless la instancia se congela con el INSERT en vuelo). El aviso al medidor es SINCRÓNICO y está
// ANTES del primer `await` de `recordUsage`, así que llega igual — la parte sincrónica de una función async corre al
// invocarla, aunque nadie la espere. Si se moviera después del `insert`, la liquidación cerraría con cero y se cobraría
// siempre el estimado.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ EL BLOQUEANTE #1 DEL MEDIDOR NO ERA UN BLOQUEANTE
// ─────────────────────────────────────────────────────────────────────────────
// docs/costos-ia-y-planes.md lo pone primero: «Hoy es imposible saber cuánto gastó cada cliente en Claude. `wsDeProveedor()`
// escribe todas las filas de Anthropic en el workspace 1. Es el bloqueante #1 del medidor». Es cierto para el INFORME de
// gasto y falso para el medidor: el MT se le descuenta al workspace EN CURSO (`getWorkspaceActual`), que es el que pidió la
// llamada, y eso no depende de en qué fila de `anthropic_usage` termine anotada. El medidor no esperó a que se arregle.
// =============================================================================

import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mtDeUsd } from './mako-tokens-reglas';
import { costoDeFeature, esAutomatica, mtReservaDeFeature } from './mako-tokens-costos';
import { gastarMt, liquidarMt, type Tomado } from './mako-tokens-caja';
import { soloSuIA } from './solo-su-ia';

/** Lo que se le dice a la persona cuando se quedó sin saldo, con las DOS salidas que tiene. */
export const SIN_SALDO_QUE_HACER =
  'Puedes sumar más MaKo Tokens, o conectar tu propia IA en Integraciones y que tu gasto deje de descontar del cupo.';

/**
 * La llamada no arrancó porque no hay saldo.
 *
 * ⚠️ EL MENSAJE ES EL QUE VE LA PERSONA, y dice de quién es el problema y qué hacer — la regla de lib/fallo-ia-texto.ts
 * (Martín, 25/08/2026: «Si la culpa es DEL CLIENTE… Tiene que decir "Te quedaste sin Tokens, cargá tus otras key aquí" y
 * enviar el link»). Nunca «falló la transcripción»: eso le echa la culpa a MaKo por algo que no es suyo y, peor, no dice
 * qué hacer.
 *
 * Se tira ANTES de llamar a cualquier proveedor, así que no hay errores de proveedor que la cascada pueda clasificar mal
 * como «se cayó tu IA» (lib/fallo-ia-texto.ts, `causaDelFallo`): el camino no llega hasta ahí.
 */
export class SinSaldoDeMakoTokens extends Error {
  readonly cuesta: number;
  readonly saldo: number;
  readonly falta: number;
  constructor(cuesta: number, saldo: number, falta: number) {
    super(
      falta > 0
        ? `Te quedaste sin MaKo Tokens: esto cuesta ${cuesta} y tienes ${saldo}. ${SIN_SALDO_QUE_HACER}`
        : `No pude leer tu saldo de MaKo Tokens. Vuelve a intentarlo en un momento.`,
    );
    this.name = 'SinSaldoDeMakoTokens';
    this.cuesta = cuesta;
    this.saldo = saldo;
    this.falta = falta;
  }
}

/**
 * ¿Este error es del medidor —«no hay saldo»— y no de un proveedor?
 *
 * ⚠️ LA CASCADA DE IA TIENE QUE RE-TIRARLO, NO PROBAR EL SIGUIENTE PROVEEDOR. Ningún otro proveedor arregla una falta
 * de saldo: la caja es del NEGOCIO, no de la clave. Y mientras la cascada lo trataba como «este candidato falló», el
 * error terminaba en la lista de fallas del cliente y la app le leía al dueño «tu negocio todavía no conectó su IA.
 * Conecta tu GPT», que es falso dos veces —desde el 15/11/2026 todo lo paga MaKo Tokens— y lo manda a configurar algo
 * que no le falta. Medido en producción el 16/11/2026: ticket #103, grupo de WhatsApp del ws 23.
 *
 * Mi propio comentario en `SinSaldoDeMakoTokens` decía que esto no podía pasar porque la excepción se tira «antes de
 * llamar a cualquier proveedor». Era falso: el enganche está ADENTRO de las funciones que la cascada llama, así que la
 * excepción cae justo en su `catch` por candidato.
 */
export const esSinSaldoDeMt = (e: unknown): boolean => e instanceof SinSaldoDeMakoTokens || e instanceof SalteadoSinSaldo;

/** Lo que se saltea un camino AUTOMÁTICO cuando el negocio no tiene saldo: no es un error de nadie, es un «no esta vuelta». */
export class SalteadoSinSaldo extends Error {
  constructor(readonly feature: string, readonly cuesta: number) {
    super(`Salteado: el negocio no tiene MaKo Tokens para «${feature}» (cuesta ${cuesta}).`);
    this.name = 'SalteadoSinSaldo';
  }
}

type Cuenta = {
  readonly ws: number;
  readonly feature: string;
  /** Lo que se reservó al abrir. */
  readonly reservado: number;
  /** De qué balde salió esa reserva, para devolver a los mismos. */
  readonly tomado: Tomado;
  /** El costo REAL en dólares que fueron reportando las llamadas de adentro. Se convierte a MT UNA vez, al cerrar. */
  gastadoUsd: number;
  /** Cuántas llamadas reportaron costo. 0 al cerrar = la llamada falló y la reserva se devuelve entera. */
  reportes: number;
};

const almacen = new AsyncLocalStorage<Cuenta>();

/**
 * ¿Ya hay un medidor abierto para lo que corre? Las llamadas de adentro se suman al mismo, no abren otro.
 *
 * ⚠️ ESTO ES LO QUE CORTA LA RE-ENTRADA, Y ES EL BUG QUE ESTE REPO YA PAGÓ UNA VEZ. El enganche en la capa de IA es
 * `if (!medidorAbierto()) return conMedidorDeMt(feature, () => estaMismaFuncion(opts))`, o sea que la función se llama a
 * sí misma. Si `conMedidorDeMt` devolviera `fn()` sin abrir el almacén —el caso de «este pedido no descuenta nada»—, la
 * re-entrada volvería a ver `medidorAbierto() === false` y se llamaría otra vez, para siempre.
 *
 * Es EXACTAMENTE lo que le pasó a la puerta de D6b (revisión adversarial de IA6, 22/10/2026): «sin workspace devolvía
 * `fn()` SIN guardar la decisión, y `fn` es la misma función pública, que volvía a entrar a la puerta: un bucle de
 * microtareas que CONGELABA el proceso entero». Acá volvió a pasar el 15/11/2026 al copiar la FORMA del enganche sin
 * copiar su invariante, y se vio como un test que no terminaba (240 s de timeout, sin un solo error). Por eso
 * `conMedidorDeMt` abre el almacén SIEMPRE, también cuando decide no cobrar.
 */
export const medidorAbierto = (): boolean => almacen.getStore() !== undefined;

/** El almacén abierto para un pedido que NO descuenta (su IA, la plataforma, sin workspace). Corta la re-entrada igual. */
const SIN_COBRO = (feature: string): Cuenta => ({ ws: 0, feature, reservado: 0, tomado: { cupo: 0, comprado: 0 }, gastadoUsd: 0, reportes: 0 });

/**
 * El costo REAL de una llamada que acaba de terminar. Lo avisa `recordUsage` / `recordSttUsage` (lib/anthropic-usage.ts),
 * que es el único lugar del repo que sabe cuánto costó de verdad.
 *
 * ⚠️ SINCRÓNICA Y SIN `await` A PROPÓSITO: quien la llama a veces no espera a `recordUsage`. Ver la cabecera.
 */
export function reportarCostoReal(costoUsd: number): void {
  const c = Number(costoUsd);
  if (!Number.isFinite(c) || c < 0) return;
  const cta = almacen.getStore();
  if (!cta) return;
  cta.gastadoUsd += c;
  cta.reportes += 1;
}

/**
 * ¿Este pedido descuenta MaKo Tokens? Devuelve el workspace que paga, o null si no descuenta.
 *
 * Las tres exenciones, y las tres por una razón de fondo:
 *   · **El negocio corre con SU IA** (`soloSuIA()`): su clave la paga él. Es la OPCIÓN que Martín dejó abierta el 15/11
 *     («Le damos la opción de conectar su flow, sí»). ⚠️ Y es segura por construcción: con «sólo su IA» prendido, la
 *     cascada NO le da ninguna clave de la plataforma (lib/ai-cheap.ts, `proveedorPermitido`), así que no hay forma de que
 *     MaKo pague esa llamada. La exención no es una promesa, es una consecuencia.
 *   · **La plataforma misma** (`wsSuperAdmin`): lo interno de MaKo no se cobra a nadie.
 *   · **Sin workspace**: un cron antes de elegir a quién atiende, un script. No hay negocio al que cobrarle.
 *
 * ⚠️ `OWNER_WS` (el ws1) NO ES LA PLATAFORMA, es un cliente (Mauricio). Se le cobra como a cualquiera. Es la regla de
 * AGENTS.md, y confundirlos acá le regalaría la IA a un cliente que paga.
 */
async function wsQuePaga(): Promise<number | null> {
  if (soloSuIA()) return null;
  try {
    const { getWorkspaceActual, wsSuperAdmin } = await import('./workspace');
    const ws = await getWorkspaceActual().catch(() => null);
    if (ws == null) return null;
    const plataforma = await wsSuperAdmin().catch(() => null);
    if (plataforma != null && ws === plataforma) return null;
    return ws;
  } catch {
    // ⚠️ Sin poder saber de quién es el pedido no se puede cobrar, y cobrarle al que no es sería peor. Queda sin medir y
    // en el log: es la única rama que no protege la caja, y se abre sólo si falla la resolución del workspace, que es la
    // misma que decide todo lo demás del pedido.
    console.warn('[mako-tokens] no pude saber qué negocio paga esta llamada: va sin medir');
    return null;
  }
}

/**
 * ¿Esta feature es una de las tres que MaKo le paga a un negocio en su onboarding? (`CREDITO_HABILITADO_PARA`,
 * lib/veto-claude.ts). Import dinámico porque `veto-claude` arrastra la capa de IA y este módulo lo importa `ai-cheap`.
 * Sin poder leerlo, NO es del crédito: la exención no se concede a ciegas.
 */
async function esDelCreditoDelOnboarding(feature: string): Promise<boolean> {
  try {
    const { CREDITO_HABILITADO_PARA } = await import('./veto-claude');
    return CREDITO_HABILITADO_PARA.some((h) => h.feature === feature);
  } catch {
    return false;
  }
}

/** El cupo de cada negocio, con memoria corta: el medidor lo pide en CADA llamada y es una lectura a la base. */
const MEMORIA_MS = 60_000;
const g = globalThis as unknown as { __cupoPorNegocio?: Map<number, { hasta: number; cupo: number | null }> };
const memoria = (g.__cupoPorNegocio ??= new Map());

/** Para los tests: olvidar los cupos leídos. */
export const olvidarCupos = (): void => memoria.clear();

async function cupoConMemoria(ws: number): Promise<number | null> {
  const m = memoria.get(ws);
  if (m && m.hasta > Date.now()) return m.cupo;
  const { cupoDelWorkspace } = await import('./mako-tokens-caja');
  try {
    const cupo = await cupoDelWorkspace(ws);
    memoria.set(ws, { hasta: Date.now() + MEMORIA_MS, cupo });
    return cupo;
  } catch (e) {
    // Un «no pude leer la capa» NO se recuerda: un bache de la base dejaría al negocio sin cupo un minuto entero. Y
    // devuelve null, que es lo que no acredita nada: falla cerrado.
    console.warn(`[mako-tokens] ws=${ws}: no pude leer su plan: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * LA PUERTA DEL MEDIDOR. Corre `fn` con el costo de esa feature ya descontado, y liquida la diferencia al terminar.
 *
 * · Si no hay saldo y la persona lo disparó → tira `SinSaldoDeMakoTokens` con el texto que ella lee.
 * · Si no hay saldo y es un camino AUTOMÁTICO → tira `SalteadoSinSaldo`, que quien llama trata como «no esta vuelta» y no
 *   le muestra a nadie (ver `fallaBlanda`, lib/mako-tokens-costos.ts).
 * · Si ya hay un medidor abierto → `fn()` directo: la llamada de adentro se suma a la cuenta de afuera.
 */
export async function conMedidorDeMt<T>(feature: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  if (medidorAbierto()) return fn();
  const f = (feature ?? '').trim() || '(sin feature)';
  const ws = await wsQuePaga();
  // ⚠️ `almacen.run`, NO `fn()` a secas: el enganche vuelve a entrar a la misma función y sin almacén abierto se llamaría
  // para siempre. Ver el aviso de `medidorAbierto`.
  if (ws == null) return almacen.run(SIN_COBRO(f), fn);

  const reserva = mtReservaDeFeature(feature);

  // Cuesta cero (una feature que hoy rutea a un free tier): no se toca la caja y corre igual. El `gastarMt` de la 0416
  // también lo deja pasar, pero evitarle el viaje a la base es gratis y el camino es caliente.
  if (reserva <= 0) return correrYLiquidar(ws, f, 0, { cupo: 0, comprado: 0 }, fn);

  const cupo = await cupoConMemoria(ws);

  // ⚠️ EL REGALO DEL ONBOARDING NO SE COBRA DOS VECES, Y SIN ESTO EL ALTA DE UN CLIENTE NUEVO SE ROMPE.
  //
  // Un negocio que todavía no paga un plan no tiene cupo (`cupoDeCapa` devuelve null para cualquier capa que no sea
  // `completo` o `agencia`). Pero MaKo SÍ le paga la IA de tres cosas, y es una decisión de Martín: el crédito de Claude
  // del onboarding, habilitado en positivo para `El Archivero`, `onboarding-extract` y `offer`, y sólo mientras el
  // onboarding está en curso (`CREDITO_HABILITADO_PARA`, lib/veto-claude.ts — «Por ahora solo en onboarding»).
  //
  // Sin esta rama, el primer ingreso de cada cliente nuevo se queda sin leer sus documentos ni armar su oferta, con un
  // «te quedaste sin MaKo Tokens» antes de haber usado nada. Es el peor rojo posible del producto, y es el único lugar
  // donde conviene fallar ABIERTO: ese gasto **ya tiene su propio techo**, y más angosto que un cupo —tres features, sólo
  // durante el onboarding, con una clave que no sirve para nada más y con fecha de vencimiento.
  //
  // El corte es `cupo == null`, no la feature sola: un negocio que YA paga un plan tiene cupo y sus tres features se
  // cobran como todo el resto. Así la excepción se cierra sola el día que el negocio se vuelve cliente.
  if (cupo == null && (await esDelCreditoDelOnboarding(f))) return almacen.run(SIN_COBRO(f), fn);

  const r = await gastarMt(ws, reserva, { feature: f, costoUsd: costoDeFeature(feature).costoUsd, cupo });
  // ⚠️ LA CAJA QUE NO ESTÁ INSTALADA NO FRENA NADA, y es el bug que rompió un cliente el 16/11/2026 (ticket #103):
  // la 0416 no estaba aplicada, la RPC no existía, el medidor falló CERRADO —como está escrito que haga— y el grupo
  // de WhatsApp del negocio se quedó mudo. Una caja que no existe no tiene nada que proteger.
  // `almacen.run` y NO `fn()`: el enganche es por RE-ENTRADA, y devolver `fn()` sin abrir el almacén es el bucle
  // infinito que este repo ya pagó dos veces (ver `medidorAbierto`).
  if (!r.ok && r.sinCaja) return almacen.run(SIN_COBRO(f), fn);
  if (!r.ok) {
    if (esAutomatica(feature)) throw new SalteadoSinSaldo(f, r.cuesta);
    throw new SinSaldoDeMakoTokens(r.cuesta, r.saldo?.total ?? 0, r.saldo == null ? 0 : r.falta);
  }
  return correrYLiquidar(ws, f, reserva, r.tomado, fn);
}

async function correrYLiquidar<T>(ws: number, feature: string, reservado: number, tomado: Tomado, fn: () => Promise<T>): Promise<T> {
  const cta: Cuenta = { ws, feature, reservado, tomado, gastadoUsd: 0, reportes: 0 };
  try {
    return await almacen.run(cta, fn);
  } finally {
    // ⚠️ EN EL `finally`, Y ESO ES LO QUE HACE QUE UNA LLAMADA FALLIDA NO SE COBRE: si el modelo no contestó, nadie
    // reportó costo, `gastadoUsd` es 0 y la reserva entera vuelve. Sin esto, cada error de proveedor le costaría al
    // cliente el estimado de una llamada que nunca ocurrió.
    const real = mtDeUsd(cta.gastadoUsd);
    const diff = reservado - real;
    if (diff !== 0) {
      await liquidarMt(ws, diff, tomado, {
        feature,
        costoUsd: cta.gastadoUsd > 0 ? cta.gastadoUsd : null,
        referencia: cta.reportes === 0 ? 'no corrio' : null,
      });
    }
  }
}

/**
 * Cobra MEDIOS: video, imagen, locución. Acá el costo se sabe ANTES, así que se cobra exacto y no hay nada que liquidar.
 *
 * ⚠️ ES EXPLÍCITA, no una puerta: los medios no pasan por la capa de IA de texto (van a ApiMart, a Flow, a fal), y cada
 * generador sabe cuántos segundos o cuántas imágenes va a pedir. El MT lo calcula `mtDeVideo` / `mtDeImagenes`
 * (lib/mako-tokens-reglas.ts).
 *
 * ⚠️ Y SE COBRA POR INTENTO: si los fallidos no descontaran, cada pieza terminada costaría ~3× y la diferencia la pone la
 * agencia (regla de la tarifa, 09/08/2026). Por eso no se devuelve nada cuando la generación falla — es lo contrario que
 * el texto, y la diferencia es que acá el proveedor cobra el intento.
 *
 * Devuelve `null` si se cobró (o si no correspondía cobrar), o el motivo para la persona si no alcanzó.
 */
export async function cobrarMediosMt(
  mt: number,
  o: { feature: string; referencia?: string | null; costoUsd?: number | null },
): Promise<string | null> {
  const ws = await wsQuePaga();
  if (ws == null) return null;
  const cuesta = Math.max(0, Math.ceil(Number(mt) || 0));
  if (cuesta <= 0) return null;
  const r = await gastarMt(ws, cuesta, { feature: o.feature, costoUsd: o.costoUsd ?? null, referencia: o.referencia ?? null, cupo: await cupoConMemoria(ws) });
  if (r.ok) return null;
  // La caja sin instalar no cobra el medio, pero tampoco lo frena (ticket #103).
  if (r.sinCaja) return null;
  return r.saldo == null
    ? 'No pude leer tu saldo de MaKo Tokens. Vuelve a intentarlo en un momento.'
    : `Te quedaste sin MaKo Tokens: esto cuesta ${r.cuesta} y tienes ${r.saldo.total}. ${SIN_SALDO_QUE_HACER}`;
}

/**
 * Devuelve MT de un medio que el proveedor NO cobró (rechazó el pedido antes de generar: un 400, una clave vencida).
 *
 * ⚠️ NO es para una generación que salió mal: ésa se cobra igual (ver arriba). Es para cuando el proveedor no llegó a
 * generar nada, que es la única vez que devolver no le regala la pieza al cliente.
 */
export async function devolverMediosMt(mt: number, o: { feature: string; referencia?: string | null }): Promise<void> {
  const ws = await wsQuePaga();
  if (ws == null) return;
  const d = Math.max(0, Math.ceil(Number(mt) || 0));
  if (d <= 0) return;
  // Sin saber de qué balde salió (fue otra llamada), se devuelve al cupo: es lo que se vence, así que devolverle eso al
  // cliente es lo conservador para MaKo y lo correcto para el mes en curso.
  await liquidarMt(ws, d, { cupo: d, comprado: 0 }, { feature: o.feature, referencia: o.referencia ?? 'el proveedor no generó nada' });
}

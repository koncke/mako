// =============================================================================
// flujo-ia-intencion — «Discutir» o «Editar» en el chat de MaKo de una automatización (puro)
// =============================================================================
// La llamada con Mauricio del 22/10/2026 (02:05-02:10). Le pegaron los mensajes de la campaña y MaKo:
//   1. contestó que «habría que editarlos o añadir nuevas tarjetas» en vez de hacerlo (la ruta lo tomó por pregunta);
//   2. a «hazlo como te lo indiqué» contestó «indícame qué cambios…»: el prompt de editar NO veía la charla, sólo el
//      último mensaje, y «como te lo indiqué» no se podía resolver;
//   3. al tercer intento armó dos de los cuatro mensajes y metió una variable que no existe.
// Martín (02:09): «lo que puedo agregar en el chat para que sea similar a Lovable: un botón de discutir y otro de
// editar. En uno puedes discutir, que te dé sugerencias; en otro, que haga todo lo pedido» — Mauricio: «que obedezca».
//
// Lo que decide este módulo, y la ruta (app/api/chat-agent/secuencias/ia) aplica:
//   · DISCUTIR: siempre el prompt de explicar (sólo puede devolver `{"respuesta"}`): sugiere, no toca el lienzo.
//   · EDITAR: nunca el de explicar, aunque suene a pregunta; y si el modelo contesta en vez de cambiar, es un ERROR que
//     se le devuelve para que lo corrija (el reintento de `generar`). Con las reglas de obedecer al pie de la letra.
//   · SIN ELEGIR (la API de MaKo, un cliente viejo): lo de antes (`esConsulta`).
//   · En los TRES, lo último de la charla viaja al modelo (`bloqueDeLaCharla`): sin eso, «como te dije» no existe.
// =============================================================================

export type IntencionChat = 'discutir' | 'editar';

/** Lo que llega del cliente: sólo esas dos palabras valen; lo demás es «sin elegir». */
export function intencionDe(raw: unknown): IntencionChat | null {
  return raw === 'discutir' || raw === 'editar' ? raw : null;
}

/** Las reglas de EDITAR (van en el `user`: un system guardado en /configuraciones no conoce bloques nuevos). */
export const REGLAS_EDITAR = [
  'MODO EDITAR — OBEDECE AL PIE DE LA LETRA:',
  '- Haz EXACTAMENTE lo que pide el dueño: ni más ni menos. No agregues tarjetas, casos, condiciones, etiquetas ni variables que no pidió.',
  '- Los textos que el dueño pega o pone entre comillas van TAL CUAL en las tarjetas, con sus palabras, signos y emojis. Una lista de mensajes es una tarjeta por mensaje, en ese orden.',
  '- «{Nombre}», «{nombre}» o «[Nombre]» es {{nombre}}. Cualquier otro dato entre llaves que no esté en la lista de datos NO se inventa: devuelve una "pregunta" diciendo qué va ahí.',
  '- Si pegó textos o te pide un cambio, cambia el flujo (o pregunta lo que falta con "pregunta"). Contesta con "respuesta" SÓLO si es una pregunta sobre el flujo, si lo que pide se configura fuera de las tarjetas (di dónde) o si no se puede hacer (di por qué, en una frase).',
  '- Las 20 horas entre dos WhatsApp (regla 3) son para lo que armas tú: no agregues esperas que no pidió. Si pide otra espera, pon la que pide y di en "resumen" que la línea retiene el segundo mensaje hasta que pasen las horas de «Misma persona» (Configuraciones › Anti-ban).',
  '- «Avísame», «avísame por WhatsApp» o «que me llegue a mí» es la "accion" "avisar_al_equipo" (le llega al grupo de MaKo del negocio), nunca un mensaje al lead.',
  '- «Agrega», «suma» o «añade» (aunque diga «edítalos y agrégalos») es SUMAR: los textos nuevos van en "agregar", como tarjetas nuevas después del último mensaje, y los mensajes que ya están NO se cambian.',
  '- «Que sea sólo X», «sólo quiero X» o «saca Y» es QUITAR lo que sobra: cada tarjeta que no es X (o que es Y) va en "quitar", con su id; X se queda. Un seguimiento («si no responde») va después del último mensaje, detrás de "contesto" con "no": true.',
].join('\n');

/**
 * LO QUE NO SE ARMA CON TARJETAS (22/10/2026, la prueba de los chats del Cerebro: goteo-entre-leads, cincuenta-por-dia,
 * no-sabado-domingo y cinco-min-entre-mensajes, 3 de 3). El prompt no conocía Configuraciones: inventaba lugares («la
 * configuración del envío de la campaña»), decía que no se podía o metía esperas en el flujo. Va en editar Y en explicar.
 */
export const LO_QUE_NO_ES_TARJETA = [
  'LO QUE NO SE ARMA CON TARJETAS: el horario, el goteo y los topes se configuran en «Configuraciones», en el «⋯» de esta automatización, que tiene SÓLO dos pestañas: Horario y Anti-ban. Si el dueño pide ESO, no armes tarjetas: dile dónde está, en una frase. Lo que no está aquí ni en las tarjetas (llamar por teléfono, un SMS) no se puede: dilo, sin inventar un lugar.',
  '- Los días y las horas en que sale (por ejemplo, ni sábado ni domingo): Configuraciones › Horario.',
  '- Que no salgan todos juntos (uno cada N minutos) y cuántos como mucho por día en ESTA automatización: Configuraciones › Anti-ban, «Goteo» y «Por día».',
  '- Cuántos por día y por hora salen de la línea, sumando todas las automatizaciones: Configuraciones › Anti-ban, abajo (los de la línea).',
  '- Las horas mínimas entre dos WhatsApp a la misma persona (de 3 a 72; 20 de fábrica; se puede apagar): Configuraciones › Anti-ban, «Misma persona».',
  '- Deshacer el último cambio: el botón ↶ arriba del lienzo.',
].join('\n');

/** Las reglas de DISCUTIR (el prompt de explicar ya sólo puede devolver "respuesta"). */
export const REGLAS_DISCUTIR = [
  'MODO DISCUTIR — NO CAMBIES NADA:',
  '- El dueño quiere pensar contigo: contesta, sugiere qué cambiarías y por qué, y si pegó textos, comenta cómo quedarían en el flujo.',
  '- Si quiere que lo hagas, dile que toque «Editar» y lo pida.',
].join('\n');

/** El error que se le devuelve al modelo si en EDITAR contestó sin cambiar nada (lo corrige el reintento). */
export const ERROR_EDITAR_SIN_CAMBIOS = 'En modo EDITAR no se contesta con "respuesta": haz el cambio que pidió el dueño, tal cual, o devuelve una "pregunta" con lo que falta.';

/**
 * Las pestañas de Configuraciones de una automatización (app/automations/ConfiguracionesBoton.tsx, `PESTANAS_CONFIGURACIONES`).
 * «Límites» se llama «Anti-ban» desde el 22/10/2026 (Martín): nombrar «Límites» ya es un lugar que no existe.
 */
const LUGARES_REALES = ['Horario', 'Anti-ban'];

/**
 * ¿VALE UNA «RESPUESTA» EN EDITAR? null = vale; si no, el error para el reintento. (22/10/2026, las corridas del arnés del
 * Cerebro.) Editar arranca prendido y en 4de3fe769 rechazaba TODA respuesta: «que no salgan todos juntos» (que se configura en
 * Configuraciones) o «cambiá el mensaje» (que pide aclarar) terminaban en «MaKo armó el flujo pero quedó mal: No cambió nada».
 * Lo que Editar tiene que impedir es lo de la llamada: contestar «indícame qué cambios…» a un pedido con los textos PEGADOS (o
 * con los textos en la charla), o a una orden. Y NO vale un lugar que no existe: con el bloque de Configuraciones el modelo
 * contestó «Configuraciones › Acciones» a «que lo llame por teléfono». Vale si no trae textos pegados y: nombra un lugar real
 * (o el ↶), dice que no se puede, pregunta para aclarar (si los textos no están ya en la charla) o el pedido era una pregunta.
 */
export function errorDeRespuestaEnEditar(pedido: string, respuesta: string, o: { esPregunta: boolean; charlaConTextos: boolean }): string | null {
  if (traeTextosPegados(pedido)) return ERROR_EDITAR_SIN_CAMBIOS;
  // Con el guion: «Anti-ban» (sin él, leía «Anti» y lo daba por inventado).
  const lugares = [...respuesta.matchAll(/Configuraciones\s*›\s*([\p{L}-]+)/gu)].map((m) => m[1]);
  const falso = lugares.find((l) => !LUGARES_REALES.includes(l));
  if (falso) return `«Configuraciones › ${falso}» no existe: Configuraciones tiene sólo Horario y Anti-ban. Si lo que pide no se puede hacer, dilo en una frase; si se puede con tarjetas, cambia el flujo.`;
  if (lugares.length || respuesta.includes('↶')) return null;
  const delega = /p[ií]d[eé]melo|hazlo t[uú]|desde el lienzo|ag[ré]galo t[uú]|habr[íi]a que|tendr[íi]as que/i.test(respuesta);
  if (/\bno (se puede|puedo|existe|está|hay)\b/i.test(respuesta) && !delega) return null;
  if (respuesta.includes('?') && !o.charlaConTextos && !delega) return null;
  return o.esPregunta && !delega ? null : ERROR_EDITAR_SIN_CAMBIOS;
}

/** ¿La charla reciente trae textos pegados del dueño? (con ellos, preguntar «¿qué cambios?» es no haber leído). */
export function charlaConTextos(historial: readonly MensajeCharla[] | null | undefined): boolean {
  return (historial ?? []).filter((m) => m.de === 'yo').slice(-3).some((m) => traeTextosPegados(String(m.texto ?? '')));
}

/** ¿Es una pregunta directa («¿Qué hace?», «¿A cuántos les llega?»), sin textos pegados? En Editar va al prompt de explicar. */
export function esPreguntaDirecta(pedido: string): boolean {
  const t = String(pedido ?? '').trim();
  return !traeTextosPegados(t) && (t.startsWith('¿') || /\?\s*$/.test(t));
}

/**
 * AL CREAR CON TEXTOS PEGADOS (22/10/2026, la prueba de los chats del Cerebro: mau-pega-secuencia y emojis-saltos). Crear no tiene
 * «Discutir / Editar», y es lo que hace Mauricio: lienzo vacío, la secuencia pegada con «(esperar 1 día)» entre los mensajes.
 * Las esperas pedidas no quedaban y la regla 3 metía 20 h donde nadie las pidió. Va en el `user` de crear sólo si pegó textos.
 */
export const REGLAS_PEGADO = [
  'LOS TEXTOS PEGADOS VAN TAL CUAL:',
  '- Cada mensaje que el dueño pegó o puso entre comillas es UNA tarjeta, con sus palabras, signos, emojis y saltos de línea, en ese orden. «{Nombre}» es {{nombre}}.',
  '- Lo que escribió ENTRE dos mensajes («(esperar 1 día)», «al día siguiente», «2 días después») es un "esperar" con esas horas. Si entre dos mensajes no dice nada, no pongas un "esperar": la regla 3 es para lo que armas tú.',
  '- No agregues tarjetas, condiciones, audios ni variables que no pegó.',
].join('\n');

/** ¿El dueño pegó textos para el flujo? Varios renglones con texto, o un texto largo entre comillas. */
export function traeTextosPegados(pedido: string): boolean {
  const renglones = String(pedido ?? '').split('\n').filter((l) => l.trim().length > 0);
  return renglones.length >= 2 || /[«"“][^«»"“”]{20,}[»"”]/.test(String(pedido ?? ''));
}

/** Lo mínimo para que un texto entre comillas cuente como un MENSAJE pedido (y no el nombre de una etiqueta o una etapa). */
export const LARGO_TEXTO_PEDIDO = 20;

/** Un texto para comparar: sin tildes, sin mayúsculas, sin links, con las variables iguales y sólo sus palabras. */
function palabrasDe(t: string): string[] {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/https?:\/\/\S+|\b[\w-]+\.(?:com|net|org|io|app|co|mx|ar|es)(?:\/\S*)?/g, ' ')
    .replace(/\{\{?\s*[a-z_]+\s*\}?\}/g, ' ')
    .split(/[^a-z0-9ñ]+/).filter((w) => w.length > 1);
}

/**
 * EL CONTROL DE LO PEDIDO (22/10/2026, Martín: «revisa lo que le pedí vs lo que creó, creó a la mitad las cosas que le
 * pedí»; el Cerebro: «que nunca diga "Listo" si falta algo»). Los textos que el dueño puso entre comillas (los mensajes
 * que pegó) que NO quedaron en ningún mensaje del flujo. Cuenta como puesto si al menos el 80% de sus palabras está en un
 * mismo mensaje (los links y las variables no cuentan: MaKo los pone aparte). Sin textos entre comillas, nada. Pura.
 */
export function faltantesDelPedido(pedido: string, textosDelFlujo: readonly string[]): string[] {
  // ⚠️ SIN LO QUE PIDIÓ SACAR (23/10/2026): «sacá "…"» también va entre comillas, y el control le pedía al modelo volver a
  // ponerlo. Eso lo mira `sobrantesDelPedido`.
  return citasDelPedido(pedido).filter((c) => !c.sacar && !estaEnElFlujo(c.texto, textosDelFlujo)).map((c) => recorte(c.texto))
    .filter((t, i, xs) => xs.indexOf(t) === i);
}

/** «Sacá», «quitá», «eliminá», «borrá» y sus formas (no «borrador»). Límites por Unicode, no `\b` (AGENTS.md). */
const RE_SACAR = /(?<!\p{L})(?:sac|quit|elimin|borr(?!ador))\p{L}*/iu;

/** Los textos entre comillas del pedido (≥ `LARGO_TEXTO_PEDIDO`), y si el dueño pidió SACARLOS: un verbo de sacar antes, en la misma frase. */
function citasDelPedido(pedido: string): Array<{ texto: string; sacar: boolean }> {
  const s = String(pedido ?? '');
  return [...s.matchAll(/[«"“]([^«»"“”\n]{1,600})[»"”]/g)].map((m) => {
    const frase = s.slice(Math.max(0, (m.index ?? 0) - 100), m.index ?? 0).split(/[.\n!?;]/).pop() ?? '';
    return { texto: m[1].trim(), sacar: RE_SACAR.test(frase) };
  }).filter((c) => c.texto.length >= LARGO_TEXTO_PEDIDO);
}

/** ¿Está en algún mensaje? Al menos el 80% de sus palabras en UN mismo mensaje (links y variables no cuentan). */
function estaEnElFlujo(texto: string, textosDelFlujo: readonly string[]): boolean {
  const ws = palabrasDe(texto);
  if (!ws.length) return true;
  return textosDelFlujo.some((t) => { const f = new Set(palabrasDe(t)); return ws.filter((w) => f.has(w)).length >= Math.ceil(ws.length * 0.8); });
}
const recorte = (t: string): string => (t.length > 80 ? `${t.slice(0, 79).trimEnd()}…` : t);

/**
 * LO QUE PIDIÓ SACAR Y SIGUE (23/10/2026, #289 en el ws1, por el Cerebro: «"sacá Y" BORRA lo que sobra»). Los textos entre
 * comillas que el dueño pidió sacar («sacá el mensaje "…"») y siguen en algún mensaje del flujo. Pura.
 */
export function sobrantesDelPedido(pedido: string, textosDelFlujo: readonly string[]): string[] {
  return citasDelPedido(pedido).filter((c) => c.sacar && estaEnElFlujo(c.texto, textosDelFlujo)).map((c) => recorte(c.texto))
    .filter((t, i, xs) => xs.indexOf(t) === i);
}

/**
 * ¿PIDE QUE QUEDE SÓLO ESO? (23/10/2026, #289: «En realidad solo quiero que la automatización sea de "Apertura"…»: MaKo
 * agregó el seguimiento y dejó los mensajes de después.) Sólo las formas que restringen el FLUJO: «sólo quiero que la
 * automatización/el flujo sea…», «que sea/quede sólo…», «dejá sólo…», «nada más que…». NO «sólo cambia el segundo» (eso
 * restringe el cambio, no el flujo) ni «sólo explícamelo».
 */
const RE_SOLO_ESO = /(?<!\p{L})(?:s[oó]lo|solamente|[uú]nicamente)\s+quiero\s+que\s+(?:la\s+automatizaci[oó]n|el\s+flujo|la\s+secuencia|esta|sea|quede|tenga)(?!\p{L})|(?<!\p{L})que\s+(?:sea|quede|tenga)\s+(?:s[oó]lo|solamente|[uú]nicamente)(?!\p{L})|(?<!\p{L})d[eé]j[aá](?:le|la|lo)?\s+(?:s[oó]lo|solamente|[uú]nicamente)(?!\p{L})/iu;
export function pideQueQuedeSolo(pedido: string): boolean {
  return RE_SOLO_ESO.test(String(pedido ?? ''));
}

/** El error para el reintento: lo que pidió sacar y sigue, y/o que pidió que quede sólo eso y no quitó nada. */
export function errorDeSobrantes(sobran: readonly string[], soloSinQuitar: boolean): string {
  const partes: string[] = [];
  if (sobran.length) partes.push(`El dueño pidió SACAR ${sobran.map((t) => `«${t}»`).join(', ')} y sigue en el flujo: va en "quitar", con su id.`);
  if (soloSinQuitar) partes.push('El dueño pidió que el flujo quede SÓLO con lo que dice y no quitaste nada: cada tarjeta del flujo actual que no sea eso va en "quitar", con su id. Si de verdad va todo, devuélvelo igual y dilo en "resumen".');
  return partes.join(' ');
}

/** Lo que va en ROJO si después del reintento sigue sobrando. */
export const NO_HECHO_SOLO_ESO = 'Pediste que quede sólo eso y no saqué ninguno de los mensajes que ya estaban. Si sobra alguno, dime cuál.';
export const noHechoSobrante = (t: string): string => `Pediste sacarlo y sigue en el lienzo: «${t}»`;

/** El error que se le devuelve al modelo para el reintento (`generar`): qué de lo pegado no quedó, y cómo se pone una rama. */
export function errorDeFaltantes(faltan: readonly string[]): string {
  return `Faltó en el flujo lo que pegó el dueño: ${faltan.map((t) => `«${t}»`).join(', ')}. Agrégalo con sus palabras, en su lugar. Lo que pasa según lo que conteste el lead va en un CASO de "si_responde" ("agregar" con "despues_de": "si_responde" y "caso": {"titulo", "cuando"}), con su mensaje.`;
}

/** Un mensaje del chat como lo lee este módulo (`MensajeChatMako`, lib/automatizacion-chat.ts). */
type MensajeCharla = { de: string; texto?: string | null };

/** Cuántos mensajes de la charla viajan, y cuánto de cada uno. */
export const MENSAJES_DE_LA_CHARLA = 6;
const TOPE_MENSAJE = 900;

/**
 * LO ÚLTIMO DE LA CHARLA, para que el modelo entienda «como te lo indiqué», «hazlo», «eso no»: los últimos
 * `MENSAJES_DE_LA_CHARLA` con quién los dijo. null si no hay nada que decir.
 */
export function bloqueDeLaCharla(historial: readonly MensajeCharla[] | null | undefined): string | null {
  const lineas = (historial ?? [])
    .filter((m) => (m.de === 'yo' || m.de === 'mako') && typeof m.texto === 'string' && m.texto.trim())
    .slice(-MENSAJES_DE_LA_CHARLA)
    .map((m) => `- ${m.de === 'yo' ? 'El dueño' : 'MaKo'}: ${m.texto!.trim().replace(/\s+/g, ' ').slice(0, TOPE_MENSAJE)}`);
  return lineas.length ? `LO ÚLTIMO DE ESTA CHARLA (para entender «como te dije», «hazlo», «eso no»):\n${lineas.join('\n')}` : null;
}

/** Lo que se le suma al `user` de editar o de explicar según la intención, y la charla. */
export function extrasDelUser(intencion: IntencionChat | null, historial: readonly MensajeCharla[] | null | undefined): string[] {
  const charla = bloqueDeLaCharla(historial);
  return [
    ...(charla ? [charla] : []),
    LO_QUE_NO_ES_TARJETA,
    ...(intencion === 'editar' ? [REGLAS_EDITAR] : intencion === 'discutir' ? [REGLAS_DISCUTIR] : []),
  ];
}

/**
 * ¿Va al prompt de explicar (sólo contesta)? Discutir siempre; sin elegir, lo que diga `esConsulta`; y EDITAR, sólo una
 * pregunta DIRECTA (`esPreguntaDirecta`, 22/10/2026: «¿A cuántos les va a llegar?» en el prompt de editar se contestó con
 * «Se configura en Configuraciones › Límites», que hoy es «Anti-ban»). `esConsulta` no sirve en Editar: lee el «?» de los textos pegados y «que no
 * le mande nada» como «no cambies nada» (la [B] de la prueba de los chats).
 */
export function vaAExplicar(intencion: IntencionChat | null, conRespuestas: boolean, esConsulta: boolean, preguntaDirecta = false): boolean {
  if (conRespuestas) return false;
  if (intencion === 'discutir') return true;
  if (intencion === 'editar') return preguntaDirecta;
  return esConsulta;
}

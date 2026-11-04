// =============================================================================
// ritmo-al-activar — cuánto va a salir y a qué ritmo, dicho ANTES de prender una automatización (puro)
// =============================================================================
// Martín, 25/10/2026: «lo que me preocupa es que alguien este creando una automatizacion y como está muy escondido el "goteo"
// se manden muchos mensajes de una... Tal vez al activar la automatización podriamos darle una advertencia.»
//
// ⚠️ UN HECHO, NO UN «OJO QUE PUEDE SALIR MUCHO»: las personas salen de a cuántos alcanza el barrido (`ritmoAlActivar`,
// lib/nutricion.ts, la misma puerta que el motor) y el ritmo, de lo que el motor mira de verdad:
//   · WhatsApp sin goteo NO son «200 de una»: los frena el tope de la línea, por hora de reloj y por día (lib/limites-envio.ts),
//     y sale la tanda entera de cada hora junta. Por eso se dice ese número y no «de una».
//   · Email: sólo su tope por día. Instagram y Messenger, sin goteo, no tienen tope propio: ésos sí salen todos juntos.
// El tiempo es un PISO («al menos»): el horario del negocio y las otras automatizaciones que usan la misma línea sólo lo alargan.
// Con una persona no hay ritmo que decir. Sin mensajes, no sale nada.
// ⚠️ UNA QUE DISPARA POR SU EVENTO (un DM, un comentario) TAMBIÉN AVISA SI NO TIENE GOTEO (el Cerebro, 30/10/2026): al activar no hay
// a quién contar, pero el aviso no está para decir a cuántos: está para que no te enteres del goteo después, y justo Instagram es
// donde salen todos juntos. Sin número, con la frase.
// ⚠️ UN AVISO QUE MIENTE ES PEOR QUE NINGUNO: si el primer mensaje lo escribe la IA y no sale solo (`saleSolo`), queda para aprobar:
// decir «sale» haría decidir sobre algo falso. Desde el 23/10 eso es sólo lo que escribe la IA: un mensaje fijo siempre sale.
// ⚠️ Y NO SÓLO EL PRIMERO (`porAprobarDelFlujo`, 30/10/2026): se miraba el primer mensaje, y uno de IA más adentro quedaba esperando sin
// que nadie lo dijera: el negocio creía que MaKo había escrito. Se cuenta TODO el flujo con la regla de `dejaBorradores`, y se dice cuántos.
// ⚠️ Y LOS BORRADORES VIEJOS QUE LA VAN A FRENAR (`BorradoresViejos`, el Cerebro, 30/10/2026, con Leila): un borrador pendiente de CUALQUIER
// automatización frena todo el WhatsApp de ese lead (`tieneBorradorNutriPendiente`, no sólo la IA). Sus 27 borradores del 20/10, de dos automatizaciones
// pausadas, iban a frenar a 27 personas de otra al prenderla, sin que nadie lo dijera. Va en este mismo aviso: un solo lugar con toda la verdad.
// ⚠️ Y LAS QUE YA ESTÁN PRENDIDAS TAMBIÉN (`avisoDeUnaPrendida`, el Cerebro, 30/10/2026): medido ese día, las 7 activas de Instagram no
// tenían goteo, y un aviso que sale sólo al activar no las alcanza. El valor está en que el dueño lo sepa, no en el momento de prender:
// se dice en su pantalla y en su tarjeta, y NO se les pone goteo: eso cambiaría cómo le llegan los mensajes a los leads de un cliente.
// =============================================================================
import { canalDelGoteo, diaDelTurno, type ArranqueGoteo, type CanalDelGoteo, type Goteo } from './goteo';
import { esHiloDelCarril, indiceEntrada } from './nutricion-grafo-motor';
import { TRIGGERS_DEL_EMISOR, TRIGGER_SOLO_GRUPO, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO } from './disparadores';
import { textoDeHorario } from './config-automatizacion';
import type { HorarioEnvio } from './horario-envio';
import { claseDe, idDe, indicePorId, puertosDe, type PasoGrafo } from './flujo-grafo';
import { subarbolRespuesta } from './flujo-conversacion';
import { proveedorDelPaso } from './nutricion-canal';
import { esPasoAccion } from './nutricion-paso-accion';
import { mensajesDelFlujo, mensajesQueQuedan } from './mensajes-por-aprobar';

/**
 * Lo que dice la pantalla antes de prender. `poner`: el botón para ponerle lo que le falta; `rotulo`: lo mismo, en dos palabras, para
 * una tarjeta. Los arma el server: esta pieza trae el motor, y la pantalla no la importa como valor.
 */
export type AvisoDeRitmo = {
  texto: string; sinGoteo: boolean; sinHorario: boolean; poner: string | null; rotulo: string | null;
  /**
   * Hay borradores viejos que se pueden descartar: la frase, pegada a su botón, y CUÁLES son: no se descarta lo que no se dijo. Va aparte de `texto`
   * (la tabla de AGENTS.md: la consecuencia, pegada al botón). Donde no hay botón, las dos juntas: `textoEnteroDelAviso`.
   */
  viejos: { frase: string; boton: string; ids: number[] } | null;
};
/**
 * EL HORARIO DE FÁBRICA, para las que nacen de ahora en más (el Cerebro, 30/10/2026: «un negocio nuevo que manda a las 3 de la mañana es
 * un problema que le creamos nosotros»). ⚠️ LAS QUE YA EXISTÍAN NO SE TOCAN: cambiar cuándo le llegan los mensajes a los leads de un cliente
 * sin que lo pida no se hace. El corte es por fecha de creación.
 * ⚠️ SE DECIDE AL PRENDERLA POR PRIMERA VEZ, NO AL CREARLA: una vacía nace sin saber qué la dispara, y LO QUE CONTESTA A ALGO QUE ACABA DE
 * HACER LA PERSONA NO ESPERA A LAS 9: un DM o un comentario de las 22:00 que no contesta se lee como «no anda». Si tiene un horario propio
 * (también uno apagado a propósito) o el negocio tiene el suyo, manda ése.
 */
export const DESDE_HORARIO_DE_FABRICA = Date.parse('2026-10-31T03:00:00Z');
const CONTESTAN_AL_MOMENTO: ReadonlySet<string> = new Set([TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO]);
export function naceConHorario(o: { creadaAt: string | null | undefined; triggers: readonly string[]; horarioPropio: unknown; delNegocio: unknown }): boolean {
  const creada = o.creadaAt ? Date.parse(o.creadaAt) : NaN;
  if (!Number.isFinite(creada) || creada < DESDE_HORARIO_DE_FABRICA) return false;
  if (o.horarioPropio !== undefined || o.delNegocio != null) return false;
  if (!o.triggers.length) return false;
  return !o.triggers.some((t) => CONTESTAN_AL_MOMENTO.has(t) || TRIGGERS_DEL_EMISOR.has(t) || t === TRIGGER_SOLO_GRUPO);
}

/** Lo que se muestra de una ya prendida. `poner`: el botón que lleva a Configuraciones. */
export type AvisoDeUnaPrendida = { texto: string; rotulo: string; poner: string | null };

/**
 * Los topes de la línea que mira el motor (`LimitesEnvio`). null = no se pudieron leer. `email.rampa` (4/11/2026): la rampa del
 * dominio desde HOY (`dia` = el tope de hoy, `sube` = cuánto sube cada día que llega), si todavía no llegó al tope de la línea.
 */
export type TopesDeLinea = { wa: { dia: number; hora: number }; email: { dia: number; rampa?: ArranqueGoteo } };

const NOMBRE_CANAL: Readonly<Record<CanalDelGoteo, string>> = { whatsapp: 'WhatsApp', email: 'email', instagram: 'Instagram', messenger: 'Messenger' };

/**
 * El canal del primer mensaje que le sale a quien entra: el más cercano a la entrada, por TODAS las salidas (⚠️ `siguienteDe` de una
 * condición es null: un flujo que arranca con una se cortaba acá). Si no se llega a ninguno, el primero que haya. null = no tiene mensajes.
 */
export function primerMensaje(pasos: readonly PasoGrafo[]): PasoGrafo | null {
  const esMensaje = (p: PasoGrafo) => claseDe(p) === 'mensaje' && !esPasoAccion(p);
  const vistos = new Set<number>();
  const cola = [indiceEntrada(pasos)];
  while (cola.length) {
    const k = cola.shift()!;
    if (k < 0 || vistos.has(k)) continue;
    vistos.add(k);
    if (esMensaje(pasos[k])) return pasos[k];
    for (const s of puertosDe(pasos, k)) cola.push(indicePorId(pasos, s.destino));
  }
  return pasos.find(esMensaje) ?? null;
}

/**
 * Lo que queda para aprobar de TODO el flujo: cuántos, de cuántos, y si el primero es uno de ellos. `mezcla`: con ramas, en unas el primero queda y en
 * otras sale: ni «el primero» ni «más adelante» son ciertos.
 */
export type PorAprobar = { cuantos: number; mensajes: number; elPrimero: boolean; mezcla?: boolean };

/** Los primeros mensajes de CADA camino desde la entrada: con una condición o una prueba A/B arriba, hay más de uno. */
function primerosMensajes(pasos: readonly PasoGrafo[]): PasoGrafo[] {
  const esMensaje = (p: PasoGrafo) => claseDe(p) === 'mensaje' && !esPasoAccion(p);
  const vistos = new Set<number>();
  const cola = [indiceEntrada(pasos)];
  const out: PasoGrafo[] = [];
  while (cola.length) {
    const k = cola.shift()!;
    if (k < 0 || vistos.has(k)) continue;
    vistos.add(k);
    if (esMensaje(pasos[k])) { out.push(pasos[k]); continue; }
    for (const s of puertosDe(pasos, k)) cola.push(indicePorId(pasos, s.destino));
  }
  return out;
}

/**
 * `mensajesQueQuedan`, la regla de `dejaBorradores` sobre el flujo entero. null = no queda ninguno. ⚠️ Antes de esto, la pregunta era
 * «¿el primero?» y contaba Instagram y Messenger, que no tienen bandeja y salen igual: el aviso decía «queda en Borradores» y salía.
 */
export function porAprobarDelFlujo(pasos: readonly PasoGrafo[], envioAutomatico: boolean): PorAprobar | null {
  const quedan = mensajesQueQuedan(pasos, envioAutomatico);
  if (!quedan.length) return null;
  const primeros = primerosMensajes(pasos);
  const queda = primeros.filter((p) => quedan.includes(p)).length;
  const elPrimero = primeros.length > 0 && queda === primeros.length;
  return { cuantos: quedan.length, mensajes: mensajesDelFlujo(pasos).length, elPrimero, ...(queda > 0 && !elPrimero ? { mezcla: true } : {}) };
}

/**
 * La frase, con los números. «Hasta»: con ramas, nadie pasa por todos, y a quien ya pagó le sale directo. `personas`: las que pueden llegar a esos
 * mensajes, las que entran y las que ya estaban adentro (una pausada que se prende también les escribe). Menos de dos: se dice sin total.
 */
function fraseDeAprobar(p: PorAprobar, personas: number | null): string {
  const uno = p.cuantos === 1;
  const quien = p.elPrimero && uno ? 'El primer mensaje de WhatsApp'
    : p.cuantos === p.mensajes ? (uno ? 'Su mensaje' : `Sus ${p.cuantos} mensajes`)
    : `${p.elPrimero || p.mezcla ? '' : 'Más adelante, '}${p.cuantos} de sus ${p.mensajes} mensajes${p.elPrimero ? ', empezando por el primero,' : ''}`;
  const total = personas != null && personas >= 2 ? personas * p.cuantos : null;
  const queda = total ? `quedan hasta ${total} en Borradores para que los apruebes` : uno ? 'queda en Borradores para que lo apruebes' : 'quedan en Borradores para que los apruebes';
  return `${quien} ${uno ? 'no sale solo' : 'no salen solos'}: ${queda} (a quien ya pagó le ${uno ? 'sale' : 'salen'} directo).`;
}

/** Su canal, como lo cuenta el goteo. null = no tiene mensajes. */
export function canalDelPrimerMensaje(pasos: readonly PasoGrafo[]): CanalDelGoteo | null {
  const p = primerMensaje(pasos);
  return p ? canalDelGoteo(typeof p.canal === 'string' ? p.canal : null) : null;
}

/**
 * Desde cuántos días un borrador es VIEJO: 3, para que uno del viernes a la noche no lo sea el lunes a la mañana. Lo más nuevo es la bandeja de todos
 * los días: frena igual y se dice, pero no se ofrece descartarlo desde otra automatización: se llevaría algo que alguien está por aprobar.
 */
export const BORRADOR_VIEJO_DIAS = 3;

/**
 * ¿Esta automatización se puede frenar por un borrador pendiente de su lead? Con la regla del motor (`procesarEnvios`): esperan los mensajes de WhatsApp
 * no oficial y las tarjetas de acción, de cualquier tipo, no sólo los de IA. NO esperan los del carril (los «N antes de la reunión») ni los de «Si responde»,
 * ni el oficial, el email o Instagram. ⚠️ Con hilos, la acción espera sólo a SU mensaje anterior (`tieneBorradorPendienteDePaso`): acá se cuenta como que
 * espera, porque el mensaje de WhatsApp de ese flujo espera igual.
 */
export function seFrenaPorBorradores(pasos: readonly PasoGrafo[]): boolean {
  return pasos.some((_, i) => esperaBorrador(pasos, i));
}

function esperaBorrador(pasos: readonly PasoGrafo[], i: number): boolean {
  const p = pasos[i];
  if (subarbolRespuesta(pasos).has(idDe(p, i)) || esHiloDelCarril(pasos, i)) return false;
  const c = claseDe(p);
  return c === 'accion' || (c === 'mensaje' && p.canal === 'whatsapp' && proveedorDelPaso(p) === 'no_oficial');
}

/**
 * ¿A quien está parado en ese paso le queda algo por delante que se frena? ⚠️ NO ALCANZA CON QUE LO TENGA EL FLUJO (revisión del 31/10/2026): al que ya está en el
 * último email de un flujo que empezó por WhatsApp, un borrador no lo frena, y descartarlo tiraba un mensaje sin soltar a nadie.
 */
export function seFrenaDesde(pasos: readonly PasoGrafo[], desde: number): boolean {
  const vistos = new Set<number>();
  const cola = [desde];
  while (cola.length) {
    const k = cola.shift()!;
    if (k < 0 || vistos.has(k)) continue;
    vistos.add(k);
    if (esperaBorrador(pasos, k)) return true;
    for (const s of puertosDe(pasos, k)) cola.push(indicePorId(pasos, s.destino));
  }
  return false;
}

/**
 * ¿Quien entra se frena ANTES de que le salga algo, por todos los caminos? Sólo a ésos se los saca de «Entran». ⚠️ Un flujo que arranca por email o Instagram le
 * manda el primero igual, con o sin borrador: sacarlos decía «Entran 50» con 200 emails saliendo, y con los 200 callaba el goteo (revisión del 31/10/2026).
 */
export function seFrenaAlEntrar(pasos: readonly PasoGrafo[]): boolean {
  const vistos = new Set<number>();
  const cola = [indiceEntrada(pasos)];
  let alguno = false;
  while (cola.length) {
    const k = cola.shift()!;
    if (k < 0 || vistos.has(k)) continue;
    vistos.add(k);
    if (esperaBorrador(pasos, k)) { alguno = true; continue; }
    if (claseDe(pasos[k]) === 'mensaje' && !esPasoAccion(pasos[k])) return false;
    for (const s of puertosDe(pasos, k)) cola.push(indicePorId(pasos, s.destino));
  }
  return alguno;
}

export type FilaBorrador = { id: number; lead_id: number | null; secuencia_id: number | null; created_at: string };

/**
 * QUÉ BORRADORES SE OFRECE DESCARTAR Y A QUIÉNES FRENAN, de los pendientes de automatización del negocio. El motor mira CUALQUIER borrador del lead, de
 * cualquier automatización y de cualquier fecha, y a quien ya pagó no lo frena.
 *   · ⚠️ NUNCA LOS DE OTRA AUTOMATIZACIÓN PRENDIDA: al crear el borrador la inscripción ya avanzó, y lo que la tiene quieta es ese borrador. Descartarlo desde
 *     acá le manda el mensaje siguiente al lead, sin haber recibido el anterior, por una automatización que nadie está mirando (`procesarEnvios`, «LO RETENIDO
 *     NO SE SALTEA»; lo encontró la revisión del 30/10/2026).
 *   · ⚠️ NI EL DE ALGUIEN A QUIEN OTRO BORRADOR LO SIGUE FRENANDO (revisión del 31/10/2026): descartarlo no lo suelta, y el mensaje se pierde igual. La frase decía
 *     «sigue con el próximo». Se ofrece cuando se resuelva el otro.
 *   · `liberados`: los que quedan libres si se descartan. `siguenFrenados`: los que tienen además uno reciente o de una prendida.
 */
export function clasificarBorradores(o: {
  filas: readonly FilaBorrador[]; secuenciaId: number; corte: number; seFrena: boolean; adentro: ReadonlySet<number>; pagaron: ReadonlySet<number>; activas: ReadonlySet<number>;
}): { descartables: FilaBorrador[]; liberados: number[]; siguenFrenados: number[] } {
  const frenados = new Set<number>();
  if (o.seFrena) for (const f of o.filas) if (f.lead_id != null && o.adentro.has(Number(f.lead_id)) && !o.pagaron.has(Number(f.lead_id))) frenados.add(Number(f.lead_id));
  const ofrecible = (f: FilaBorrador) => {
    if (Date.parse(f.created_at) >= o.corte) return false;
    if (Number(f.secuencia_id) === o.secuenciaId) return true;
    return f.lead_id != null && frenados.has(Number(f.lead_id)) && !o.activas.has(Number(f.secuencia_id));
  };
  const queda = new Set(o.filas.filter((f) => !ofrecible(f) && f.lead_id != null).map((f) => Number(f.lead_id)));
  const descartables = o.filas.filter((f) => ofrecible(f) && !(f.lead_id != null && queda.has(Number(f.lead_id))));
  return { descartables, liberados: [...frenados].filter((id) => !queda.has(id)), siguenFrenados: [...frenados].filter((id) => queda.has(id)) };
}

/** Los borradores viejos que se ofrece descartar. */
export type BorradoresViejos = { ids: number[]; personas: number; fechas: string; dias: string; deDonde: string };

/**
 * El resumen de lo leído. `fechas` y los días, en la zona del negocio y de calendario: el número tiene que coincidir con la fecha que se dice al lado.
 * `otras`: los nombres de las OTRAS automatizaciones de donde vienen. null = no hay ninguno.
 */
export function resumirViejos(o: { ids: readonly number[]; fechas: readonly string[]; propios: number; otras: readonly string[]; personas: number; zona: string; ahora: number }): BorradoresViejos | null {
  if (!o.fechas.length) return null;
  const ordenadas = [...o.fechas].sort((a, b) => Date.parse(a) - Date.parse(b));
  const dia = (iso: string) => new Intl.DateTimeFormat('es', { timeZone: o.zona, day: '2-digit', month: '2-digit' }).format(new Date(iso));
  const enDias = (ms: number) => { const [a, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: o.zona }).format(new Date(ms)).split('-').map(Number); return Date.UTC(a, m - 1, d) / 86_400_000; };
  const [d1, d2] = [dia(ordenadas[0]), dia(ordenadas[ordenadas.length - 1])];
  const minimo = enDias(o.ahora) - enDias(Date.parse(ordenadas[ordenadas.length - 1]));
  const cuantas = o.otras.length + (o.propios > 0 ? 1 : 0);
  return {
    ids: [...o.ids], personas: o.personas,
    fechas: d1 === d2 ? `del ${d1}` : `del ${d1} al ${d2}`,
    dias: d1 === d2 ? `de hace ${minimo} días` : `de hace ${minimo} días o más`,
    deDonde: cuantas > 1 ? `de ${cuantas} automatizaciones` : o.propios > 0 ? 'de esta automatización' : o.otras[0] ? `de «${o.otras[0]}»` : 'de otra automatización',
  };
}

/** ⚠️ DESCARTAR TIENE UNA CONSECUENCIA Y SE DICE: ese mensaje no sale nunca, y el flujo sigue con el próximo (`procesarEnvios`, «LO RETENIDO NO SE SALTEA»). */
function fraseDeViejos(v: BorradoresViejos): string {
  const uno = v.ids.length === 1;
  const lo = uno ? 'lo' : 'los';
  const qué = `${uno ? '1 borrador viejo' : `${v.ids.length} borradores viejos`}, ${v.fechas}, ${v.deDonde},`;
  const hace = v.personas > 0 ? `${uno ? 'frena' : 'frenan'} a ${v.personas === 1 ? '1 persona' : `${v.personas} personas`}` : `${uno ? 'espera' : 'esperan'} aprobación`;
  return `${qué} ${hace}. Si ${lo} descartas, ${uno ? 'ese mensaje no sale' : 'esos mensajes no salen'} y sigue${uno ? '' : 'n'} con el próximo. Si ${lo} apruebas, sale${uno ? '' : 'n'} ${v.dias}.`;
}

/** Los que siguen parados por un borrador que no se ofrece descartar. */
function fraseDeFrenados(n: number, hayViejos: boolean): string {
  if (n === 1) return `${hayViejos ? 'Otra persona está parada' : '1 persona está parada'} por un borrador reciente o de otra automatización prendida: se resuelve en Chats › Borradores.`;
  return `${hayViejos ? `Otras ${n} personas están paradas` : `${n} personas están paradas`} por borradores recientes o de otra automatización prendida: se resuelven en Chats › Borradores.`;
}

/** El aviso entero, donde no hay un botón al lado de los borradores (MaKo lo dice en el chat). */
export function textoEnteroDelAviso(a: AvisoDeRitmo): string {
  return [a.texto, a.viejos?.frase].filter(Boolean).join(' ');
}

/**
 * ⚠️ LOS QUE YA ESTABAN ADENTRO TAMBIÉN SALEN (revisión del 31/10/2026, el miedo de Martín de arriba): al prender una pausada, lo vencido sale ya
 * (`setSecuenciaActiva`), con el goteo si lo tiene. Antes contaba sólo a los que entran: 27 adentro y nadie nuevo callaba el goteo, y «Descartar» los soltaba.
 */
function fraseDeAdentro(k: number, minutos: number | null): string {
  if (k < 2) return '';
  return `${k} personas que ya estaban adentro tienen su próximo mensaje vencido: salen al prenderla, ${minutos == null ? 'sin goteo' : `uno cada ${minutos} min`}.`;
}

/**
 * Lo que tarda en salir el ÚLTIMO de `n`, en palabras. ⚠️ ES UN PISO, y por eso redondea para abajo: 200 a 40 por día son 5 tandas, y
 * la quinta arranca a los 4 días, no a los 5. El tope de la línea es por hora de RELOJ: no separa, corta la tanda. Con goteo manda
 * lo que dure más: sus minutos, o las horas enteras que hacen falta. null = salen todos en la misma tanda.
 */
function tardaAlMenos(n: number, minutos: number | null, lineaHora: number, porDia: number, arranque?: ArranqueGoteo): string | null {
  // Con arranque, los primeros días son más cortos: «200 a 40 por día» ya no son 4 días.
  const turno = Number.isFinite(porDia) ? diaDelTurno(n - 1, { dia: porDia, arranque }) : null;
  const dias = turno?.dia ?? 0;
  const resto = turno ? turno.enElDia + 1 : n;
  const porTandas = Number.isFinite(lineaHora) ? Math.ceil(resto / lineaHora) - 1 : 0;
  const enElDia = Math.max(minutos ? ((resto - 1) * minutos) / 60 : 0, porTandas);
  const horas = dias * 24 + enElDia;
  if (horas <= 0) return null;
  if (horas >= 24) { const d = Math.floor(horas / 24); return d === 1 ? '1 día' : `${d} días`; }
  if (horas < 1) return `${Math.ceil(horas * 60)} min`;
  const h = Math.floor(horas);
  return h === 1 ? '1 hora' : `${h} horas`;
}

/**
 * LO QUE SE DICE AL ACTIVAR. null = no hay nada que decir: menos de dos personas, o no se pudo contar y tiene goteo.
 * `personas` null = no se pudo contar: sin goteo se dice igual, porque es justo el caso que asusta.
 */
export function avisoDeRitmo(o: DatosDelRitmo): AvisoDeRitmo | null {
  // Sin mensajes (sólo acciones) no hay ritmo ni horario que decir, pero una acción también espera a un borrador pendiente.
  if (!o.canal && !o.viejos && !o.siguenFrenados) return null;
  // ⚠️ EL HORARIO TAMBIÉN, el mismo defecto que el goteo (Leila, llamada del 30/10: no sabía dónde se configuraba, y salió hasta las
  // 23:01; Martín: «ella no sabia donde se configuraba el horario de oficina»). Sin horario nada la cierra (`cerradasAhora`). Lo que queda
  // para aprobar no sale de noche: ahí no se dice. `undefined` = no se pudo leer: no se afirma nada.
  const aprobar = o.porAprobar?.elPrimero === true;
  // Lo que queda para aprobar no sale de noche, pero sólo si queda TODO: el resto sale solo, a cualquier hora (la queja de Leila).
  const todosParaAprobar = aprobar && o.porAprobar?.cuantos === o.porAprobar?.mensajes;
  const sinHorario = !!o.canal && o.horario === null && !todosParaAprobar;
  const base = textoDelRitmo(o);
  const minutos = o.goteo?.minutos ?? null;
  const salen = o.canal && !todosParaAprobar ? o.adentroVencidos ?? 0 : 0;
  const alDescartar = o.canal && !todosParaAprobar ? o.adentroLiberables ?? 0 : 0;
  const deAdentro = fraseDeAdentro(salen, minutos);
  // Los que suelta el botón de al lado: lo dice antes de apretarlo. Si ya se dijo de los otros, al descartar se vuelve a contar.
  const deSoltar = minutos == null && !deAdentro && salen + alDescartar >= 2 ? `Si descartas los borradores viejos, a ${salen + alDescartar} personas les sale su próximo mensaje al prenderla, sin goteo.` : '';
  const adentroSinGoteo = minutos == null && salen + alDescartar >= 2;
  const deArranque = o.canal === 'whatsapp' && o.goteo?.arranque && o.goteo.dia != null && (base || deAdentro) ? `Arranca con ${o.goteo.arranque.dia} por día y sube ${o.goteo.arranque.sube} por día.`
    // La rampa del dominio (4/11/2026): sólo si la línea de email es la que frena (`rampaQueFrena`).
    : o.canal === 'email' && rampaQueFrena(o) && (base || deAdentro) ? `Tu dominio arranca hoy con ${o.topes!.email.rampa!.dia} emails y sube ${o.topes!.email.rampa!.sube} cada día que llega, hasta ${o.topes!.email.dia}.` : '';
  // ⚠️ LO QUE QUEDA PARA APROBAR SE DICE SIEMPRE: una que dispara por evento, o sin nadie todavía, también deja al negocio creyendo que MaKo escribió.
  // Si el primero es uno de ellos, ya va adentro de `base` (cuando hay a quién contar).
  const deAprobar = o.porAprobar && !(aprobar && base) ? fraseDeAprobar(o.porAprobar, alcance(o)) : '';
  const deFrenados = o.siguenFrenados ? fraseDeFrenados(o.siguenFrenados, !!o.viejos) : '';
  // Sólo le falta el horario y no hay a quién contar: una por evento, o no se pudo contar.
  if (!base && !deAdentro && !deSoltar && !deAprobar && !deFrenados && !o.viejos && !(sinHorario && (o.porEvento || o.personas == null))) return null;
  const a = base ?? { texto: '', sinGoteo: false };
  const sinGoteo = a.sinGoteo || adentroSinGoteo;
  const delHorario = sinHorario ? `${sinGoteo ? 'Tampoco tiene horario' : 'No tiene horario'}: sale también de noche.`
    : o.horario && !todosParaAprobar && (base || deAdentro) ? `Sale ${textoDeHorario(o.horario).replace(' · ', ', ')}.` : '';
  return {
    texto: [a.texto, deArranque, deAdentro, deSoltar, delHorario, deAprobar, deFrenados].filter(Boolean).join(' '), sinGoteo, sinHorario,
    viejos: o.viejos ? { frase: fraseDeViejos(o.viejos), boton: o.viejos.ids.length === 1 ? 'Descartar el borrador' : `Descartar los ${o.viejos.ids.length}`, ids: o.viejos.ids } : null,
    poner: sinGoteo && sinHorario ? 'Poner goteo y horario' : sinGoteo ? 'Poner goteo' : sinHorario ? 'Poner horario' : null,
    rotulo: sinGoteo && sinHorario ? 'Sin goteo ni horario' : sinGoteo ? 'Sin goteo' : sinHorario ? 'Sin horario' : null,
  };
}

type DatosDelRitmo = {
  personas: number | null; canal: CanalDelGoteo | null; goteo: Goteo | null | undefined; topes: TopesDeLinea | null;
  /** Dispara por un evento: al activar no hay a quién contar. */
  porEvento?: boolean;
  /** Los mensajes del flujo que no salen solos (`porAprobarDelFlujo`): quedan para aprobar, salvo a quien ya pagó. */
  porAprobar?: PorAprobar | null;
  /** Las que ya están adentro, o entran y están frenadas: no se dicen en «Entran», pero también llegan a lo que queda para aprobar. */
  adentro?: number;
  /** Los que ya estaban adentro, con su próximo mensaje vencido y sin un borrador que los frene: salen al prenderla. */
  adentroVencidos?: number;
  /** Los que ya estaban adentro, con su próximo mensaje vencido, a los que suelta descartar los viejos. */
  adentroLiberables?: number;
  /** Los borradores viejos que se ofrece descartar (`resumirViejos`). */
  viejos?: BorradoresViejos | null;
  /** Cuántas personas siguen paradas por un borrador que no se ofrece descartar (`clasificarBorradores`). */
  siguenFrenados?: number;
  /** El que vale para ella (`horarioDeLaAutomatizacion`). null = no tiene; ausente = no se pudo leer. */
  horario?: HorarioEnvio | null;
  /** Cuántos emails tiene el flujo (4/11/2026): con dos o más, se dice la campaña entera (`fraseDeCampana`). */
  emailsDelFlujo?: number;
};

/**
 * LA CAMPAÑA DE EMAIL ENTERA (4/11/2026, Martín, sobre la de Mauricio: «a 100 por día, 14 emails a 1.128 personas son
 * 15.792 envíos, y el segundo email le llega a cada uno ~11 días después del primero, no a las 24 h: que se diga claro al
 * activar»). El motor manda primero lo que venció antes, así que el email siguiente de cada persona espera a que salga la
 * tanda entera: la distancia entre dos emails de una persona es lo que tarda en salirle uno a todas. Es un piso, como el resto.
 */
function fraseDeCampana(n: number, emails: number, porDia: number, rampa: ArranqueGoteo | undefined): string {
  if (n < 2 || emails < 2 || !Number.isFinite(porDia)) return '';
  const total = n * emails;
  const todo = tardaAlMenos(total, null, Infinity, porDia, rampa);
  const entre = tardaAlMenos(n + 1, null, Infinity, porDia, rampa);
  const miles = (x: number) => x.toLocaleString('es-MX');
  const partes = [`Son hasta ${miles(total)} emails (${miles(n)} personas × ${emails}).`];
  if (todo) partes.push(`A ese ritmo, la campaña entera tarda al menos ${todo}.`);
  // Si no salen todos en el mismo día, el siguiente de cada uno espera a que salga la tanda entera.
  if (entre) partes.push(`Cada persona recibe el email siguiente al menos ${entre} después del anterior, aunque la espera del flujo sea menor.`);
  return partes.join(' ');
}

/** A cuántas personas pueden llegarles los mensajes del flujo. null = no se pudo contar y no hay nadie adentro. */
function alcance(o: DatosDelRitmo): number | null {
  return o.personas == null && !o.adentro ? null : (o.personas ?? 0) + (o.adentro ?? 0);
}

/** ¿La rampa del dominio frena a esta? Por email, con la rampa por delante y sin un goteo propio más bajo que la línea. */
function rampaQueFrena(o: DatosDelRitmo): boolean {
  const r = o.topes?.email.rampa;
  if (o.canal !== 'email' || !r || r.dia >= (o.topes?.email.dia ?? 0)) return false;
  return o.goteo?.dia == null || o.goteo.dia >= (o.topes?.email.dia ?? Infinity);
}

function textoDelRitmo(o: DatosDelRitmo): { texto: string; sinGoteo: boolean } | null {
  if (!o.canal) return null;
  const minutos = o.goteo?.minutos ?? null;
  const sinGoteo = minutos == null;
  const canal = NOMBRE_CANAL[o.canal];
  const aprobar = o.porAprobar?.elPrimero === true;
  if (o.personas == null) return sinGoteo && !aprobar ? { texto: `No pude contar a cuántas personas les llega, y no tiene goteo: los mensajes de ${canal} salen juntos.`, sinGoteo } : null;
  const n = o.personas;

  const lineaHora = o.canal === 'whatsapp' ? o.topes?.wa.hora ?? Infinity : Infinity;
  const lineaDia = o.canal === 'whatsapp' ? o.topes?.wa.dia ?? Infinity : o.canal === 'email' ? o.topes?.email.dia ?? Infinity : Infinity;
  const porDia = Math.min(o.goteo?.dia ?? Infinity, lineaDia);
  const deQuien = o.goteo?.dia != null && porDia === o.goteo.dia ? '' : ' (el tope de tu línea)';
  if (n < 2) {
    // Lo que queda para aprobar no se va de golpe: ahí no hay nada que advertir.
    if (!o.porEvento || !sinGoteo || aprobar) return null;
    const topesEvento = [Number.isFinite(lineaHora) ? `${lineaHora} por hora` : null, Number.isFinite(porDia) ? `${porDia} por día` : null].filter((x): x is string => x != null);
    return {
      texto: `No tiene goteo: cuando muchos la disparen, los mensajes de ${canal} salen ${topesEvento.length ? `juntos, hasta ${topesEvento.join(' y ')}${deQuien}` : 'todos juntos'}.`,
      sinGoteo,
    };
  }
  if (aprobar) {
    const ritmo = sinGoteo ? 'No tiene goteo.' : `Queda uno cada ${minutos} min.`;
    return { texto: `Entran ${n} personas. ${fraseDeAprobar(o.porAprobar!, alcance(o))} ${ritmo}`, sinGoteo };
  }
  // La rampa: la del goteo por WhatsApp; la del dominio por email, si la línea es la que frena.
  const rampa = o.goteo?.dia != null && o.canal === 'whatsapp' ? o.goteo.arranque : rampaQueFrena(o) ? o.topes?.email.rampa : undefined;
  const tarda = tardaAlMenos(n, minutos, lineaHora, porDia, rampa);
  // El tope de HOY por email, con la rampa del dominio (por WhatsApp se sigue diciendo el del goteo, como antes).
  const topeHoy = o.canal === 'email' && rampa ? Math.min(rampa.dia, porDia) : porDia;
  const campana = o.canal === 'email' && !minutos ? fraseDeCampana(n, o.emailsDelFlujo ?? 0, porDia, rampa) : '';
  const fin = `${tarda ? ` Tarda al menos ${tarda}.` : ''}${campana ? ` ${campana}` : ''}`;

  // Sólo los topes que frenan a ESTOS: un «hasta 40 por día» a 5 personas no dice nada.
  const topes = [
    n > lineaHora && (minutos == null || 60 / minutos > lineaHora) ? `${lineaHora} por hora` : null,
    // Con la rampa del dominio, lo que frena HOY es su tope de hoy (`rampa.dia`), no el de la línea.
    n > topeHoy ? `${topeHoy} por día` : null,
  ].filter((x): x is string => x != null);
  const hasta = topes.length ? `hasta ${topes.join(' y ')}` : '';

  if (!sinGoteo) {
    return { texto: `Entran ${n} personas. El primer mensaje sale por ${canal}: uno cada ${minutos} min${hasta ? `, ${hasta}` : ''}.${fin}`, sinGoteo };
  }
  if (!tarda) return { texto: `Entran ${n} personas y no tiene goteo: los ${n} mensajes de ${canal} salen todos juntos.${campana ? ` ${campana}` : ''}`, sinGoteo };
  return { texto: `Entran ${n} personas y no tiene goteo: los mensajes de ${canal} salen juntos, ${hasta}${deQuien}.${fin}`, sinGoteo };
}

/**
 * LO QUE SE DICE DE UNA YA PRENDIDA, en su pantalla y en su tarjeta: lo mismo que al activarla, sin número (no hay un momento en que
 * entren todos). null = tiene goteo y horario, no tiene mensajes, queda para aprobar, o le escribe al equipo y no a leads (el emisor, el grupo).
 */
export function avisoDeUnaPrendida(o: { pasos: readonly PasoGrafo[]; triggers: readonly string[]; envioAutomatico: boolean; goteo: Goteo | null | undefined; topes: TopesDeLinea | null; horario?: HorarioEnvio | null }): AvisoDeUnaPrendida | null {
  if (!o.triggers.length || o.triggers.every((t) => TRIGGERS_DEL_EMISOR.has(t) || t === TRIGGER_SOLO_GRUPO)) return null;
  // Sólo contesta (sus mensajes son los de «Si responde»): no hay un envío en masa que advertir.
  if (!mensajesDelFlujo(o.pasos).length) return null;
  const a = avisoDeRitmo({
    personas: 0, canal: canalDelPrimerMensaje(o.pasos), goteo: o.goteo, topes: o.topes, porEvento: true,
    porAprobar: porAprobarDelFlujo(o.pasos, o.envioAutomatico), horario: o.horario,
  });
  return a?.rotulo ? { texto: a.texto, rotulo: a.rotulo, poner: a.poner } : null;
}

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
// ⚠️ Y LAS QUE YA ESTÁN PRENDIDAS TAMBIÉN (`avisoDeUnaPrendida`, el Cerebro, 30/10/2026): medido ese día, las 7 activas de Instagram no
// tenían goteo, y un aviso que sale sólo al activar no las alcanza. El valor está en que el dueño lo sepa, no en el momento de prender:
// se dice en su pantalla y en su tarjeta, y NO se les pone goteo: eso cambiaría cómo le llegan los mensajes a los leads de un cliente.
// =============================================================================
import { canalDelGoteo, type CanalDelGoteo, type Goteo } from './goteo';
import { indiceEntrada, saleSolo } from './nutricion-grafo-motor';
import { TRIGGERS_DEL_EMISOR, TRIGGER_SOLO_GRUPO, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO } from './disparadores';
import { textoDeHorario } from './config-automatizacion';
import type { HorarioEnvio } from './horario-envio';
import { claseDe, indicePorId, puertosDe, type PasoGrafo } from './flujo-grafo';
import { esPasoAccion } from './nutricion-paso-accion';

/**
 * Lo que dice la pantalla antes de prender. `poner`: el botón para ponerle lo que le falta; `rotulo`: lo mismo, en dos palabras, para
 * una tarjeta. Los arma el server: esta pieza trae el motor, y la pantalla no la importa como valor.
 */
export type AvisoDeRitmo = { texto: string; sinGoteo: boolean; sinHorario: boolean; poner: string | null; rotulo: string | null };
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

/** Lo que se muestra de una ya prendida. */
export type AvisoDeUnaPrendida = { texto: string; rotulo: string };

/** Los topes de la línea que mira el motor (`LimitesEnvio`). null = no se pudieron leer. */
export type TopesDeLinea = { wa: { dia: number; hora: number }; email: { dia: number } };

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

/** ¿Su primer mensaje queda para aprobar? (`saleSolo`, la regla del motor; un email no pasa por ahí). */
export function primeroQuedaParaAprobar(pasos: readonly PasoGrafo[], envioAutomatico: boolean): boolean {
  const p = primerMensaje(pasos);
  return !!p && canalDelPrimerMensaje(pasos) !== 'email' && !saleSolo(p, envioAutomatico);
}

/** Su canal, como lo cuenta el goteo. null = no tiene mensajes. */
export function canalDelPrimerMensaje(pasos: readonly PasoGrafo[]): CanalDelGoteo | null {
  const p = primerMensaje(pasos);
  return p ? canalDelGoteo(typeof p.canal === 'string' ? p.canal : null) : null;
}

/**
 * Lo que tarda en salir el ÚLTIMO de `n`, en palabras. ⚠️ ES UN PISO, y por eso redondea para abajo: 200 a 40 por día son 5 tandas, y
 * la quinta arranca a los 4 días, no a los 5. El tope de la línea es por hora de RELOJ: no separa, corta la tanda. Con goteo manda
 * lo que dure más: sus minutos, o las horas enteras que hacen falta. null = salen todos en la misma tanda.
 */
function tardaAlMenos(n: number, minutos: number | null, lineaHora: number, porDia: number): string | null {
  const dias = Number.isFinite(porDia) ? Math.ceil(n / porDia) - 1 : 0;
  const resto = n - dias * (Number.isFinite(porDia) ? porDia : 0);
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
  if (!o.canal) return null;
  // ⚠️ EL HORARIO TAMBIÉN, el mismo defecto que el goteo (Leila, llamada del 30/10: no sabía dónde se configuraba, y salió hasta las
  // 23:01; Martín: «ella no sabia donde se configuraba el horario de oficina»). Sin horario nada la cierra (`cerradasAhora`). Lo que queda
  // para aprobar no sale de noche: ahí no se dice. `undefined` = no se pudo leer: no se afirma nada.
  const aprobar = o.quedaParaAprobar === true;
  const sinHorario = o.horario === null && !aprobar;
  const base = textoDelRitmo(o);
  // Sólo le falta el horario y no hay a quién contar: una por evento, o no se pudo contar.
  if (!base && !(sinHorario && (o.porEvento || o.personas == null))) return null;
  const a = base ?? { texto: '', sinGoteo: false };
  const delHorario = sinHorario ? `${a.sinGoteo ? 'Tampoco tiene horario' : 'No tiene horario'}: sale también de noche.`
    : o.horario && !aprobar ? `Sale ${textoDeHorario(o.horario).replace(' · ', ', ')}.` : '';
  return {
    texto: [a.texto, delHorario].filter(Boolean).join(' '), sinGoteo: a.sinGoteo, sinHorario,
    poner: a.sinGoteo && sinHorario ? 'Poner goteo y horario' : a.sinGoteo ? 'Poner goteo' : sinHorario ? 'Poner horario' : null,
    rotulo: a.sinGoteo && sinHorario ? 'Sin goteo ni horario' : a.sinGoteo ? 'Sin goteo' : sinHorario ? 'Sin horario' : null,
  };
}

type DatosDelRitmo = {
  personas: number | null; canal: CanalDelGoteo | null; goteo: Goteo | null | undefined; topes: TopesDeLinea | null;
  /** Dispara por un evento: al activar no hay a quién contar. */
  porEvento?: boolean;
  /** El primer mensaje no sale solo (`saleSolo`): queda para aprobar, salvo a quien ya pagó. */
  quedaParaAprobar?: boolean;
  /** El que vale para ella (`horarioDeLaAutomatizacion`). null = no tiene; ausente = no se pudo leer. */
  horario?: HorarioEnvio | null;
};

function textoDelRitmo(o: DatosDelRitmo): { texto: string; sinGoteo: boolean } | null {
  if (!o.canal) return null;
  const minutos = o.goteo?.minutos ?? null;
  const sinGoteo = minutos == null;
  const canal = NOMBRE_CANAL[o.canal];
  const aprobar = o.quedaParaAprobar === true;
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
    return { texto: `Entran ${n} personas. El primer mensaje de ${canal} no sale solo: queda en Borradores para que lo apruebes (a quien ya pagó le sale directo). ${ritmo}`, sinGoteo };
  }
  const tarda = tardaAlMenos(n, minutos, lineaHora, porDia);
  const fin = tarda ? ` Tarda al menos ${tarda}.` : '';

  // Sólo los topes que frenan a ESTOS: un «hasta 40 por día» a 5 personas no dice nada.
  const topes = [
    n > lineaHora && (minutos == null || 60 / minutos > lineaHora) ? `${lineaHora} por hora` : null,
    n > porDia ? `${porDia} por día` : null,
  ].filter((x): x is string => x != null);
  const hasta = topes.length ? `hasta ${topes.join(' y ')}` : '';

  if (!sinGoteo) {
    return { texto: `Entran ${n} personas. El primer mensaje sale por ${canal}: uno cada ${minutos} min${hasta ? `, ${hasta}` : ''}.${fin}`, sinGoteo };
  }
  if (!tarda) return { texto: `Entran ${n} personas y no tiene goteo: los ${n} mensajes de ${canal} salen todos juntos.`, sinGoteo };
  return { texto: `Entran ${n} personas y no tiene goteo: los mensajes de ${canal} salen juntos, ${hasta}${deQuien}.${fin}`, sinGoteo };
}

/**
 * LO QUE SE DICE DE UNA YA PRENDIDA, en su pantalla y en su tarjeta: lo mismo que al activarla, sin número (no hay un momento en que
 * entren todos). null = tiene goteo y horario, no tiene mensajes, queda para aprobar, o le escribe al equipo y no a leads (el emisor, el grupo).
 */
export function avisoDeUnaPrendida(o: { pasos: readonly PasoGrafo[]; triggers: readonly string[]; envioAutomatico: boolean; goteo: Goteo | null | undefined; topes: TopesDeLinea | null; horario?: HorarioEnvio | null }): AvisoDeUnaPrendida | null {
  if (!o.triggers.length || o.triggers.every((t) => TRIGGERS_DEL_EMISOR.has(t) || t === TRIGGER_SOLO_GRUPO)) return null;
  const a = avisoDeRitmo({
    personas: 0, canal: canalDelPrimerMensaje(o.pasos), goteo: o.goteo, topes: o.topes, porEvento: true,
    quedaParaAprobar: primeroQuedaParaAprobar(o.pasos, o.envioAutomatico), horario: o.horario,
  });
  return a?.rotulo ? { texto: a.texto, rotulo: a.rotulo } : null;
}

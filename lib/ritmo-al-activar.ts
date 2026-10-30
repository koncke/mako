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
// Con una persona no hay ritmo que decir. Sin mensajes, no sale nada. Una que dispara sólo por su evento no tiene a quién
// contar al activar: `personas` 0, y no se avisa.
// =============================================================================
import { canalDelGoteo, type CanalDelGoteo, type Goteo } from './goteo';
import { indiceEntrada } from './nutricion-grafo-motor';
import { claseDe, indicePorId, puertosDe, type PasoGrafo } from './flujo-grafo';
import { esPasoAccion } from './nutricion-paso-accion';

/** Lo que dice la pantalla antes de prender: el texto y si le falta el goteo (ahí ofrece ponerlo). */
export type AvisoDeRitmo = { texto: string; sinGoteo: boolean };

/** Los topes de la línea que mira el motor (`LimitesEnvio`). null = no se pudieron leer. */
export type TopesDeLinea = { wa: { dia: number; hora: number }; email: { dia: number } };

const NOMBRE_CANAL: Readonly<Record<CanalDelGoteo, string>> = { whatsapp: 'WhatsApp', email: 'email', instagram: 'Instagram', messenger: 'Messenger' };

/**
 * El canal del primer mensaje que le sale a quien entra: el más cercano a la entrada, por TODAS las salidas (⚠️ `siguienteDe` de una
 * condición es null: un flujo que arranca con una se cortaba acá). Si no se llega a ninguno, el primero que haya. null = no tiene mensajes.
 */
export function canalDelPrimerMensaje(pasos: readonly PasoGrafo[]): CanalDelGoteo | null {
  const esMensaje = (p: PasoGrafo) => claseDe(p) === 'mensaje' && !esPasoAccion(p);
  const canalDe = (p: PasoGrafo) => canalDelGoteo(typeof p.canal === 'string' ? p.canal : null);
  const vistos = new Set<number>();
  const cola = [indiceEntrada(pasos)];
  while (cola.length) {
    const k = cola.shift()!;
    if (k < 0 || vistos.has(k)) continue;
    vistos.add(k);
    if (esMensaje(pasos[k])) return canalDe(pasos[k]);
    for (const s of puertosDe(pasos, k)) cola.push(indicePorId(pasos, s.destino));
  }
  const primero = pasos.find(esMensaje);
  return primero ? canalDe(primero) : null;
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
export function avisoDeRitmo(o: { personas: number | null; canal: CanalDelGoteo | null; goteo: Goteo | null | undefined; topes: TopesDeLinea | null }): AvisoDeRitmo | null {
  if (!o.canal) return null;
  const minutos = o.goteo?.minutos ?? null;
  const sinGoteo = minutos == null;
  const canal = NOMBRE_CANAL[o.canal];
  if (o.personas == null) return sinGoteo ? { texto: `No pude contar a cuántas personas les llega, y no tiene goteo: los mensajes de ${canal} salen juntos.`, sinGoteo } : null;
  const n = o.personas;
  if (n < 2) return null;

  const lineaHora = o.canal === 'whatsapp' ? o.topes?.wa.hora ?? Infinity : Infinity;
  const lineaDia = o.canal === 'whatsapp' ? o.topes?.wa.dia ?? Infinity : o.canal === 'email' ? o.topes?.email.dia ?? Infinity : Infinity;
  const porDia = Math.min(o.goteo?.dia ?? Infinity, lineaDia);
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
  const deQuien = o.goteo?.dia != null && porDia === o.goteo.dia ? '' : ' (el tope de tu línea)';
  return { texto: `Entran ${n} personas y no tiene goteo: los mensajes de ${canal} salen juntos, ${hasta}${deQuien}.${fin}`, sinGoteo };
}

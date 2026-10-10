// =============================================================================
// recordatorio-grafo — el recordatorio de la reunión, dibujado con el constructor de una automatización
// =============================================================================
// Puro y sin 'server-only': lo dibuja app/automations/RecordatorioFlujo.tsx y lo EJECUTA
// tests/recordatorio-lienzo.test.ts.
//
// Martín abrió /automations el 10/10/2026, con la sexta tanda en producción, y mandó la captura del
// recordatorio con una línea: «siguen habiendo cosas de versiones anteriores que estan mal..». El
// recordatorio armaba sus nodos A MANO (`poner({ … })`): las esperas como tarjetas DELAY —la sexta
// tanda pidió «Que Delay no sea una tarjeta, que la flecha no se corte, que sea algo en medio de la
// flecha, más sutil»—, el CRON como un renglón suelto, sin su cajita ni su «Entonces», y cada tarjeta
// creciendo con su texto. Ningún arreglo del lienzo de una automatización le llegaba, porque no
// pasaba por su constructor.
//
// ⚠️ AHORA EL RECORDATORIO SON PASOS DEL MODELO DEL FLUJO (lib/flujo-grafo.ts) Y LOS DIBUJA
// `grafoDeSecuencia`, el mismo de una automatización: la espera «antes de la reunión» va EN la flecha,
// el CRON es la tarjeta de ManyChat con su cajita, cada mensaje tiene alto fijo (el texto largo termina
// en «…») y su «Entonces». Lo que mejore ese constructor le llega solo. Encima, lo PROPIO del
// recordatorio son tres cosas y nada más:
//   · la pastilla dice «24 h antes», no «1 día antes de la reunión»: entre «Agendó una reunión» y el
//     mensaje se lee igual, y entra en la flecha;
//   · cada flecha mide lo que pide su pastilla (`AIRE_PILDORA`): el árbol separa las columnas 92 px,
//     pensados para «1 h», y una pastilla más larga quedaba encima de las dos tarjetas;
//   · el último mensaje no tiene «Siguiente paso»: el emisor manda tres toques y ahí termina, y un
//     círculo que invita a agregar algo que no se puede agregar es un control roto.
//
// ⚠️ ESTO SÓLO DIBUJA. Lo sigue mandando su emisor (`mandarRecordatoriosAlLead`,
// lib/reunion-recordatorio.ts) con sus toques fijos (`TOQUES`); estos pasos no se guardan en ningún lado.
// =============================================================================

import { grafoDeSecuencia, ID_ENTRADA, AIRE_PILDORA, type PasoParaGrafo, type DisparadorTarjeta } from './flujo-conversacion';
import { anchoPildoraFlecha, posicionDePildora, encerrar, ALTO_PUERTO, type GrafoFlujo, type NodoFlujo, type AristaFlujo } from './lienzo-grafo';
import { TOQUES, TEXTO_DEFAULT, problemaDelTexto, variablesDesconocidas, type Toque } from './recordatorio-lead';

/** Lo que dispara el recordatorio: la agenda (los webhooks de Calendly y Cal.com). Es UN CRON y fijo. */
export const DISPARADOR_RECORDATORIO = 'Agendó una reunión';
/**
 * La cajita de la tarjeta CRON (`CuerpoCron`, app/automations/FlujoLienzo.tsx). Sin «＋ Nuevo CRON»: el
 * emisor sólo sabe disparar por la agenda, y un botón que agrega un CRON que nadie corre no hace nada.
 */
export const DISPARADORES_RECORDATORIO: readonly DisparadorTarjeta[] = [{ id: '', texto: DISPARADOR_RECORDATORIO, icono: '📅' }];

/** Lo que dice la pastilla de cada espera: cuánto antes de la reunión sale el toque al que llega. */
export const ANTES: Record<Toque, string> = { 1440: '24 h antes', 60: '1 h antes', 15: '15 min antes' };

/**
 * El aire a cada lado de una pastilla, entre ella y la tarjeta: el círculo de la salida asoma 8 px del
 * borde y la pastilla no puede pisarlo.
 */
// El aire de la pastilla vive en el constructor del árbol desde que éste ensancha sus columnas (10/10/2026).
export { AIRE_PILDORA };

/** Lo que dice la tarjeta de un toque cuyo texto usa un dato que el emisor no conoce. */
export const AVISO_DATO_DESCONOCIDO = 'Un dato que no existe';

export const idToque = (min: Toque): string => `toque-${min}`;
export const idEspera = (min: Toque): string => `espera-${min}`;

/** El toque de una tarjeta (`toque-60`) o de una espera (`espera-60`), o null. */
export function toqueDeId(id: string | null | undefined): Toque | null {
  const m = /^(?:toque|espera)-(\d+)$/.exec(id ?? '');
  const min = m ? Number(m[1]) : NaN;
  return (TOQUES as readonly number[]).includes(min) ? (min as Toque) : null;
}

/** ¿Es la tarjeta de un MENSAJE (no la de su espera)? Sólo los mensajes se abren. */
export const esTarjetaDeToque = (id: string | null | undefined): boolean => /^toque-\d+$/.test(id ?? '') && toqueDeId(id) != null;

/**
 * El texto que SALE: el escrito, o el de fábrica si quedó vacío. Es lo que hace la ruta al publicar
 * (un texto vacío vuelve al de fábrica), así que la tarjeta dibuja lo que de verdad le va a llegar.
 */
export function textoQueSale(textos: Partial<Record<Toque, string>>, min: Toque): string {
  const t = textos[min] ?? '';
  return t.trim() ? t : TEXTO_DEFAULT[min];
}

/**
 * EL RECORDATORIO COMO PASOS DEL FLUJO: espera «antes de la reunión» → mensaje, tres veces, en el orden
 * de `TOQUES`. Sin nodo de inicio: la raíz es la primera espera, y el CRON es la tarjeta de entrada.
 */
export function pasosDelRecordatorio(textos: Partial<Record<Toque, string>>): PasoParaGrafo[] {
  const out: PasoParaGrafo[] = [];
  TOQUES.forEach((min, i) => {
    const sig = TOQUES[i + 1];
    out.push({ id: idEspera(min), nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: min }, siguiente: idToque(min) });
    out.push({
      id: idToque(min), canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', cuerpo: textoQueSale(textos, min),
      siguiente: sig != null ? idEspera(sig) : null,
    });
  });
  return out;
}

/** Una salida sin el `paralelo`: el recordatorio no abre flechas en paralelo (el emisor manda una fila). */
function sinParalelo(n: NodoFlujo): NodoFlujo {
  if (!n.puertos) return n;
  return { ...n, puertos: n.puertos.map((p) => { const q = { ...p }; delete q.paralelo; return q; }) };
}

/** El grafo del recordatorio, listo para el lienzo (ver la cabecera). */
export function grafoRecordatorio(textos: Partial<Record<Toque, string>>): GrafoFlujo {
  const base = grafoDeSecuencia(pasosDelRecordatorio(textos), {
    disparador: DISPARADOR_RECORDATORIO, disparadores: DISPARADORES_RECORDATORIO, nuevoDisparador: false,
  });

  // 1. La pastilla de cada flecha dice cuánto antes sale el toque al que llega.
  const aristas: AristaFlujo[] = base.aristas.map((a) => {
    const min = toqueDeId(a.hasta);
    return a.esperas?.length && min != null ? { ...a, esperas: a.esperas.map((e) => ({ ...e, texto: ANTES[min] })) } : a;
  });

  // 2. Las tarjetas, en su fila: cada flecha tan larga como pide su pastilla. El corrimiento se ACUMULA
  //    (lo que se ensancha una flecha corre todo lo que viene después), y el hueco que ya había cuenta.
  const tarjetas = base.nodos.filter((n) => !n.enFlecha).sort((a, b) => a.x - b.x);
  const ultimo = idToque(TOQUES[TOQUES.length - 1]);
  let corrido = 0;
  const nodos: NodoFlujo[] = tarjetas.map((n, i) => {
    if (i > 0) {
      const antes = tarjetas[i - 1];
      const pastilla = aristas.find((a) => a.hasta === n.id)?.esperas?.[0];
      const pide = pastilla ? anchoPildoraFlecha(pastilla.texto) + 2 * AIRE_PILDORA : 0;
      corrido += Math.max(0, pide - (n.x - (antes.x + antes.ancho)));
    }
    let out = sinParalelo({ ...n, x: n.x + corrido });
    // 3. El último toque termina la fila: sin la salida al pie y sin su renglón (`ALTO_PUERTO`).
    if (n.id === ultimo) {
      const { salidaAlPie, ...resto } = out;
      void salidaAlPie;
      out = { ...resto, puertos: [], alto: n.alto - ALTO_PUERTO };
    }
    const min = toqueDeId(n.id);
    if (min != null && n.id !== ID_ENTRADA && !out.advertencia && variablesDesconocidas(textoQueSale(textos, min)).length) {
      out = { ...out, advertencia: AVISO_DATO_DESCONOCIDO };
    }
    return out;
  });

  // 4. Las esperas de las flechas, en el lugar NUEVO de su pastilla (se seleccionan por ahí).
  const g0 = { nodos, aristas };
  const pildoras: NodoFlujo[] = base.nodos.filter((n) => n.enFlecha).flatMap((n) => {
    const r = posicionDePildora(g0, n.id);
    const min = toqueDeId(n.id);
    return r ? [{ ...n, ...r, ...(min != null ? { detalle: ANTES[min] } : {}) }] : [];
  });
  return { nodos: [...nodos, ...pildoras], aristas, ...encerrar(nodos) };
}

/**
 * LO QUE FRENA «PUBLICAR» ANTES DE MANDARLO: el primer toque cuyo texto la ruta rechazaría (la MISMA
 * pregunta, `problemaDelTexto`), para abrir su tarjeta con el motivo. Como una automatización, que abre
 * la tarjeta culpable (`frenoDelFlujo`): un error que sólo nombra el problema obliga a buscar dónde está.
 */
export function frenoDelRecordatorio(textos: Partial<Record<Toque, string>>): { error: string; toque: Toque } | null {
  for (const min of TOQUES) {
    const error = problemaDelTexto(textos[min] ?? '');
    if (error) return { error, toque: min };
  }
  return null;
}

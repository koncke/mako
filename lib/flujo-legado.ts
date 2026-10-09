// =============================================================================
// flujo-legado — de una secuencia de ANTES a un flujo de tarjetas, sin cambiar qué le llega a quién
// =============================================================================
// Hasta el 08/10/2026 una secuencia era una LISTA y casi todo su comportamiento vivía en
// lugares que no eran tarjetas (lo que Martín no entendía de la pantalla):
//
//   · la espera era un campo de cada mensaje (`delay_horas`), dibujada sobre la flecha y
//     sin forma de quitarla (punto 7);
//   · «Solo a leads recientes» y «Sale sola» vivían en la tarjeta del CRON (punto 6);
//   · `requiere` (ya_contactado / primer_contacto / respondio / sin_respuesta) era una
//     condición escondida en el paso;
//   · «Termina si agenda» (`estrategia.desenlace`) era una interrupción GLOBAL que un cron
//     evaluaba cada hora (punto 11);
//   · los casos del modo asistido y el hand-off vivían en `estrategia.escenarios` y se
//     editaban en un formulario arriba de la pantalla (punto 1).
//
// `legadoAGrafo` lo pasa TODO a tarjetas explícitas (esperar, condición, «Si responde»,
// «Ir a», acción) y devuelve qué hay que limpiar de la estrategia para que el motor viejo
// no lo vuelva a hacer por su lado. Lo usan el lienzo (al abrir una secuencia de antes) y
// scripts/migrar-secuencias-a-grafo.mts (las 6 vigentes, una sola vez).
//
// Lo que NO es 1:1 queda en `notas`, para decirlo y no esconderlo.
// =============================================================================

import {
  type PasoGrafo, type RamaCondicion, type CasoRespuesta, type DestinoIrA,
  claseDe, idDe, normalizar, nuevoId, nodoPorId, indicePorId, hiloDe, raizSalida, fijarRaiz, padresDe,
  conectarPuerto, validarGrafo, HILO_RESPUESTA,
} from './flujo-grafo';

export type EstrategiaLegada = {
  modo?: 'asistido' | 'automatico' | string | null;
  objetivo?: string | null;
  escenarios?: Array<{ titulo: string; cuando: string; comoResponder?: string; contestaSolo?: boolean }> | null;
  desenlace?: {
    logrado?: 'respondio' | 'agendo' | 'pago' | 'ninguno' | string;
    logradoEtapa?: string | null;
    logradoSecuencia?: string | null;
    falloHoras?: number;
    falloEtapa?: string | null;
    falloSecuencia?: string | null;
  } | null;
  envio_automatico?: boolean | null;
  antiguedad_max_horas?: number | null;
} | null;

/** Lo que hay que cambiar en la estrategia para que el motor viejo no repita lo que ahora hacen las tarjetas. */
export type LimpiezaEstrategia = {
  antiguedad_max_horas: null;
  /**
   * Sin cadena: la etapa, el «sigue con» y el fallo por silencio ya son tarjetas. `logrado` se
   * CONSERVA (ver `limpiezaPara`).
   */
  desenlace: { logrado: 'respondio' | 'agendo' | 'pago' | 'ninguno'; logradoEtapa: null; logradoSecuencia: null; falloHoras: 0; falloEtapa: null; falloSecuencia: null };
  escenarios: [];
  /** 'automatico' = una respuesta sólo pausa: lo demás lo hace la tarjeta «Si responde». */
  modo: 'automatico';
};

/**
 * La limpieza de UNA estrategia.
 *
 * ⚠️ `logrado` NO SE PISA CON 'ninguno' (revisión adversarial del 08/10/2026, dos hallazgos
 * confirmados). Parecía inerte y no lo era:
 *   · con `logrado: 'respondio'`, `evaluarDesenlaces` cierra como lograda la inscripción del
 *     lead que contestó. Sin eso queda en 'respondio' para siempre, `inscripcionReusable` no la
 *     reusa, y cuando el lead REAGENDA no le sale la post-agenda de la reunión nueva (decisión del
 *     06/10: «también con reunión nueva»), y encima lo deja dentro de la familia;
 *   · el redactor de «MaKo contesta» (`responderSimulador`) le dice al modelo cuándo se cumplió
 *     el objetivo con ese mismo campo: con 'ninguno' le decía «esta secuencia no cierra sola», y
 *     al mismo lead, para el mismo caso, le escribía otra cosa que antes de convertir.
 * Lo que sí se apaga es lo que ahora hacen las tarjetas: mover de etapa, «sigue con» y el fallo
 * por silencio. Y con `agendo`/`pago` en un flujo de tarjetas el motor NO interrumpe (lo hacen las
 * condiciones): `evaluarDesenlaces` lo saltea (lib/nutricion-desenlace.ts).
 */
export function limpiezaPara(est: EstrategiaLegada): LimpiezaEstrategia {
  const l = est?.desenlace?.logrado;
  const logrado = l === 'respondio' || l === 'agendo' || l === 'pago' ? l : 'ninguno';
  return {
    antiguedad_max_horas: null,
    desenlace: { logrado, logradoEtapa: null, logradoSecuencia: null, falloHoras: 0, falloEtapa: null, falloSecuencia: null },
    escenarios: [],
    modo: 'automatico',
  };
}

/** La limpieza de una estrategia sin desenlace. Para una de verdad, `limpiezaPara(est)` o `r.limpieza`. */
export const LIMPIEZA: LimpiezaEstrategia = limpiezaPara(null);

/** La operación del registro de la API que avisa al equipo (lib/api-mako/areas/chatbot.def.ts). */
export const OP_AVISAR = 'avisar_al_equipo';
/**
 * La que mueve de etapa en la casa (lib/api-mako/areas/crm.def.ts). Desde un flujo corre sin
 * pedir el «sí» (decisión A del 08/10). Hasta la revisión decía 'mover_lead_etapa', que NO
 * EXISTE: una secuencia convertida con «Termina si… → etapa» no se podía publicar.
 */
export const OP_MOVER_ETAPA = 'proponer_cambio_etapa';

export type ResultadoLegado<P> = {
  pasos: P[];
  limpieza: LimpiezaEstrategia;
  /** Lo que no se pasó 1:1, en una línea cada cosa. */
  notas: string[];
  /** true si había algo que convertir. false = ya era un flujo explícito (se devuelve normalizado). */
  convertida: boolean;
};

type Opciones = {
  /** CLAVE de otra secuencia → su id (para «Sigue con»). null = no existe. */
  idDeClave?: (clave: string) => number | null;
  rnd?: () => number;
};

/**
 * ¿Ya es un flujo de tarjetas? Tiene una tarjeta de control, o algún `siguiente` que no es el
 * elemento siguiente del array (una rama). Una secuencia de antes que pasó por
 * `setSecuenciaPasos` también tiene ids (`o<i>`) y `siguiente` explícito, pero LINEAL: ésa sigue
 * siendo una lista y se puede convertir.
 *
 * ⚠️ UN FLUJO NO SE VUELVE A CONVERTIR. `legadoAGrafo` arma la salida recorriendo el ARRAY en
 * fila: sobre un flujo con ramas las aplasta en una sola fila. Lo encontraron el lienzo y
 * «Probar»: un flujo con un `delay_horas` que volvió a poner la API, o con la estrategia todavía
 * sin limpiar, se habría convertido de nuevo y salía con dos «Si responde».
 */
export function esFlujoExplicito(pasos: readonly PasoGrafo[]): boolean {
  return pasos.some((p, i) => {
    const c = claseDe(p);
    if (c === 'esperar' || c === 'condicion' || c === 'respuesta' || c === 'ir_a') return true;
    // Segunda tanda (08/10/2026): el inicio (el CRON con flechas en paralelo) y cualquier flecha en
    // paralelo. Convertirlos de nuevo los aplastaba en UNA fila: el hilo de email del ejemplo de
    // Martín («de un mismo cron... una secuencia para WhatsApp y otra de email») desaparecía.
    if (c === 'inicio' || (Array.isArray(p.paralelos) && p.paralelos.length > 0)) return true;
    if (p.siguiente === undefined) return false;
    const lineal = pasos[i + 1] ? idDe(pasos[i + 1], i + 1) : null;
    return (p.siguiente ?? null) !== lineal;
  });
}

/**
 * ¿Se pueden guardar `nuevos` encima de `guardados`? false = no: lo guardado es un flujo de
 * tarjetas y lo nuevo es una lista sin un solo id, o sea un escritor que no sabe de ramas y
 * aplanaría las condiciones, las esperas y «Si responde» (ver setSecuenciaPasos).
 */
export function puedePisarFlujo(guardados: readonly PasoGrafo[], nuevos: readonly PasoGrafo[]): boolean {
  if (!esFlujoExplicito(guardados)) return true;
  return nuevos.some((p) => typeof p?.id === 'string' && p.id.length > 0);
}

/**
 * Re-grabar un audio del onboarding sobre una secuencia que YA es un flujo de tarjetas: se le
 * cambia el audio a la tarjeta que lo tenía y nada más. `lista` es lo que arma el onboarding
 * (lib/secuencias-audios.ts): su paso k es el `o<k>` del flujo, el id que la conversión
 * conserva. Sólo se toca un mensaje de audio; si la tarjeta ya no existe o ya no es un audio,
 * se deja como está (el dueño la cambió a propósito en el lienzo).
 */
export function audiosDeLaListaEnElFlujo<P extends PasoGrafo>(flujo: readonly P[], lista: readonly PasoGrafo[]): P[] {
  const nuevoAudio = new Map<string, number>();
  lista.forEach((p, k) => { if (p?.tipo === 'audio' && Number(p.audio_id) > 0) nuevoAudio.set(`o${k}`, Number(p.audio_id)); });
  return flujo.map((p, i) => {
    const audio = nuevoAudio.get(idDe(p, i));
    return audio != null && claseDe(p) === 'mensaje' && p.tipo === 'audio' ? { ...p, audio_id: audio } : p;
  });
}

/** ¿Tiene algo de lo de antes que haya que pasar a tarjetas? Un flujo explícito, nunca. */
export function tieneLegado(pasos: readonly PasoGrafo[], est: EstrategiaLegada): boolean {
  if (esFlujoExplicito(pasos)) return false;
  if (pasos.some((p) => claseDe(p) === 'mensaje' || claseDe(p) === 'accion' ? (Number(p.delay_horas) > 0 || p.ancla === 'reunion' || !!p.requiere) : false)) return true;
  if (!est) return false;
  if (est.antiguedad_max_horas != null) return true;
  const d = est.desenlace;
  if (d && ((d.logrado && d.logrado !== 'ninguno') || Number(d.falloHoras) > 0)) return true;
  if (est.modo !== 'automatico') return true;     // asistido (también el default de parseEstrategia)
  return false;
}

/**
 * Convierte. Los pasos vienen ORDENADOS como los manda el motor (por `orden`). Los ids de los
 * mensajes y acciones de antes se CONSERVAN (`idDe` = `o<índice>` si no tenían), así una
 * inscripción parada en uno sigue parada en el mismo.
 */
export function legadoAGrafo<P extends PasoGrafo>(pasosIn: readonly P[], est: EstrategiaLegada, op: Opciones = {}): ResultadoLegado<P> {
  const notas: string[] = [];
  if (!tieneLegado(pasosIn, est)) return { pasos: normalizar(pasosIn), limpieza: limpiezaPara(est), notas, convertida: false };

  const rnd = op.rnd ?? Math.random;
  const viejos = normalizar(pasosIn);   // ids estables de lo que ya había
  const todos: P[] = [];                // lo que se va armando (para que nuevoId no choque)
  const nid = () => nuevoId([...viejos, ...todos], rnd);
  const base = (p: P | undefined): P => ({ ...(p ?? ({} as P)) });

  // Un nodo de control con los campos de relleno que `setSecuenciaPasos` exige a todo paso.
  const control = (extra: Partial<PasoGrafo>): P => ({
    canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, ...extra,
  } as unknown as P);
  const esperar = (minutos: number, modo: 'tiempo' | 'antes_reunion'): P =>
    control({ id: nid(), nodo: 'esperar', espera: { modo, minutos } });
  const accion = (operacion: string, params: Record<string, unknown>): P =>
    control({ id: nid(), accion: { operacion, params } });
  const irA = (destino: { secuencia_id: number } | { nodo: string }): P =>
    control({ id: nid(), nodo: 'ir_a', destino });

  const autoSec = est?.envio_automatico === true;
  const d = est?.desenlace ?? null;
  const logrado = d?.logrado && d.logrado !== 'ninguno' ? d.logrado : null;
  const falloHoras = Math.max(0, Number(d?.falloHoras) || 0);
  const asistido = !!est && est.modo !== 'automatico';

  // ── Cadenas que se reusan ──────────────────────────────────────────────────────
  // Una «cadena» es un array de nodos simples ya enlazados entre sí; se devuelve su
  // primer id. Las de logrado/fallo se COPIAN cada vez que se cuelgan (árbol: un padre).
  const pegar = (cadena: P[]): string | null => {
    for (let k = 0; k < cadena.length; k++) {
      const n = cadena[k];
      if (claseDe(n) !== 'ir_a' && n.siguiente === undefined) n.siguiente = cadena[k + 1]?.id ?? null;
    }
    todos.push(...cadena);
    return cadena[0]?.id ?? null;
  };
  const cadenaDe = (etapa: string | null | undefined, clave: string | null | undefined, cuando: 'logrado' | 'fallo'): P[] => {
    const c: P[] = [];
    if (etapa) c.push(accion(OP_MOVER_ETAPA, { leadId: 'evento', etapa }));
    if (clave) {
      const id = op.idDeClave?.(clave) ?? null;
      if (id != null) c.push(irA({ secuencia_id: id }));
      else notas.push(`«Sigue con» (${cuando}) apuntaba a «${clave}», que ya no existe: no se pasó`);
    }
    return c;
  };
  const cadenaLogrado = () => cadenaDe(d?.logradoEtapa, d?.logradoSecuencia, 'logrado');

  // ── La salida: los pasos de mensaje/acción, con sus esperas y sus condiciones ──────
  const salida = viejos.filter((p) => p.requiere !== 'respondio');
  const aRespuesta = viejos.filter((p) => p.requiere === 'respondio');

  // Construye la salida de atrás hacia adelante: `resto` es el id de lo que sigue.
  // Devuelve el id del primer nodo de la salida.
  const tramo = (desde: number, resto: string | null): string | null => {
    if (desde >= salida.length) return resto;
    const p = salida[desde];
    const req = p.requiere;
    // El par de APERTURA de la post-agenda (ya_contactado + primer_contacto): sale exactamente
    // uno. Una condición con dos ramas, y el que no es el último se junta con un «Ir a».
    if (req === 'ya_contactado' || req === 'primer_contacto') {
      const q = salida[desde + 1];
      const par = !!q && ((req === 'ya_contactado' && q.requiere === 'primer_contacto') || (req === 'primer_contacto' && q.requiere === 'ya_contactado'));
      const despues = tramo(desde + (par ? 2 : 1), resto);
      // Lo que sigue tiene UN padre: una rama cuelga directo y la otra salta con «Ir a».
      const salto = (): string | null => (despues ? pegar([irA({ nodo: despues })]) : null);
      let rama: RamaCondicion;
      let siNo: string | null;
      if (par) {
        const ya = req === 'ya_contactado' ? p : q;
        const primera = req === 'ya_contactado' ? q : p;
        rama = { id: nid(), modo: 'todas', filas: [{ campo: 'ya_contactado' }], siguiente: mensajeConEspera(ya, despues) };
        siNo = mensajeConEspera(primera, salto());
      } else {
        // Un paso suelto de apertura: sale si se cumple; si no, se sigue de largo.
        rama = { id: nid(), modo: 'todas', filas: [{ campo: 'ya_contactado', ...(req === 'primer_contacto' ? { no: true } : {}) }], siguiente: mensajeConEspera(p, despues) };
        siNo = salto();
      }
      const cond: P = control({ id: nid(), nodo: 'condicion', ramas: [rama], si_no: siNo });
      todos.push(cond);
      return cond.id!;
    }
    if (req === 'sin_respuesta') {
      // Mientras la salida corre el lead NO respondió: una respuesta la pausa
      // (`pausarPorRespuesta`). La condición se cumplía siempre que el paso llegaba a salir.
      notas.push(`«si no contestó» del paso ${p.orden ?? desde + 1} ya no hace falta: si contesta, la salida se pausa`);
    }
    return mensajeConEspera(p, tramo(desde + 1, resto));
  };

  // Un paso de antes con su espera delante (y, si hay «logrado» global, su chequeo).
  const mensajeConEspera = (p: P, resto: string | null): string | null => {
    const nodo = base(p);
    const horas = Math.max(0, Number(p.delay_horas) || 0);
    const anclado = p.ancla === 'reunion';
    nodo.delay_horas = 0;
    delete nodo.ancla;
    delete nodo.requiere;
    if (claseDe(nodo) === 'mensaje') nodo.revisar = !autoSec;
    nodo.siguiente = resto;
    todos.push(nodo);
    let primero: string = nodo.id!;
    // «Termina si agenda/paga» se evaluaba ANTES de cada envío (el cron corre los desenlaces
    // antes de mandar): una condición delante de cada mensaje.
    if ((logrado === 'agendo' || logrado === 'pago') && claseDe(nodo) === 'mensaje') {
      const exito = pegar(cadenaLogrado());
      const cond = control({
        id: nid(), nodo: 'condicion',
        ramas: [{ id: nid(), modo: 'todas', filas: [{ campo: logrado }], siguiente: exito } as RamaCondicion],
        si_no: primero,
      });
      todos.push(cond);
      primero = cond.id!;
    }
    if (horas > 0 || anclado) {
      const e = esperar(Math.round(horas * 60), anclado ? 'antes_reunion' : 'tiempo');
      e.siguiente = primero;
      todos.push(e);
      primero = e.id!;
    }
    return primero;
  };

  // ── Lo que pasaba al terminar: el fallo por silencio ──────────────────────────────
  let fin: string | null = null;
  if (falloHoras > 0) {
    const falla: P[] = [...cadenaDe(d?.falloEtapa, d?.falloSecuencia, 'fallo')];
    // El aviso «no contestó» al dueño sólo salía con el objetivo «preparar».
    if (est?.objetivo === 'preparar') falla.unshift(accion(OP_AVISAR, { leadId: 'evento', titulo: 'no confirmó la reunión', mensaje: 'Agendó y no confirmó. Conviene que le marques tú.' }));
    let tras: string | null = pegar(falla);
    if (logrado === 'agendo' || logrado === 'pago') {
      // Mientras corre el reloj del fallo, agendar/pagar sigue siendo el logro.
      const cond = control({
        id: nid(), nodo: 'condicion',
        ramas: [{ id: nid(), modo: 'todas', filas: [{ campo: logrado }], siguiente: pegar(cadenaLogrado()) } as RamaCondicion],
        si_no: tras,
      });
      todos.push(cond);
      tras = cond.id!;
    }
    const e = esperar(Math.round(falloHoras * 60), 'tiempo');
    e.siguiente = tras;
    todos.push(e);
    fin = e.id!;
  }

  let raiz = tramo(0, fin);

  // ── «Solo a leads recientes» → la primera tarjeta, una condición ──────────────────
  const antig = est?.antiguedad_max_horas;
  if (antig != null && Number(antig) > 0) {
    const cond = control({
      id: nid(), nodo: 'condicion',
      ramas: [{ id: nid(), modo: 'todas', filas: [{ campo: 'antiguedad', valor: Number(antig) }], siguiente: raiz } as RamaCondicion],
      si_no: null,
    });
    todos.push(cond);
    raiz = cond.id!;
  }

  // ── «Si responde»: los casos del modo asistido, el hand-off, y lo que esperaba respuesta ──
  const enRespuesta = asistido || logrado === 'respondio' || aRespuesta.length > 0;
  if (enRespuesta) {
    // Lo que se hacía al lograrlo con una respuesta (mover de etapa, «sigue con») corre en
    // CADA salida de «Si responde»: antes el cron lo hacía con cualquier respuesta.
    const trasResponder = (): string | null => (logrado === 'respondio' ? pegar(cadenaLogrado()) : null);
    const casos: CasoRespuesta[] = [];
    if (asistido) {
      for (const e of est?.escenarios ?? []) {
        const contesta = control({
          id: nid(), tipo: 'ia', canal: 'whatsapp', proveedor: 'no_oficial',
          cuerpo: e.comoResponder ?? '', revisar: e.contestaSolo !== true,
        });
        contesta.siguiente = trasResponder();
        todos.push(contesta);
        casos.push({ id: nid(), titulo: e.titulo, cuando: e.cuando, siguiente: contesta.id! });
      }
    }
    // «Otra cosa»: el hand-off de antes (MaKo se calla y te avisa) y, después, los pasos
    // que esperaban CUALQUIER respuesta (el lead magnet), en el momento.
    const otra: P[] = [];
    if (asistido) otra.push(accion(OP_AVISAR, { leadId: 'evento', mensaje: 'Te escribió algo que no sé contestar' }));
    for (const p of aRespuesta) {
      const n = base(p);
      if (Number(p.delay_horas) > 0 || p.ancla) notas.push(`el paso ${p.orden ?? '?'} (si contesta) tenía una espera: ahora sale en el momento`);
      n.delay_horas = 0; delete n.ancla; delete n.requiere; n.siguiente = undefined;
      if (claseDe(n) === 'mensaje') n.revisar = !autoSec;
      otra.push(n);
    }
    let siNo = pegar(otra);
    const tras = trasResponder();
    if (tras) {
      // la cadena de logrado va al final de «otra cosa» (o es toda la rama, si no había nada)
      if (siNo) otra[otra.length - 1].siguiente = tras;
      else siNo = tras;
    }
    if (asistido && !(est?.escenarios ?? []).length) notas.push('no tenía casos: toda respuesta va a «Otra cosa» (te avisa), como antes');
    todos.push(control({ id: nid(), nodo: 'respuesta', casos, si_no: siNo }));
  }

  // ── Armar: la raíz de la salida PRIMERO (así `raizSalida` la encuentra), después el resto en
  //    el orden de los pasos de antes y lo nuevo al final. El array es el orden de lectura.
  const porId = new Map(todos.map((n) => [n.id!, n]));
  const orden: P[] = [];
  const puesto = new Set<string>();
  const poner = (id: string | null | undefined) => { if (id && !puesto.has(id) && porId.has(id)) { puesto.add(id); orden.push(porId.get(id)!); } };
  poner(raiz);
  // recorrido en profundidad desde la raíz: cada nodo antes que sus hijos
  const visitar = (id: string | null | undefined) => {
    if (!id) return;
    const n = porId.get(id);
    if (!n) return;
    poner(id);
    const hijos: Array<string | null | undefined> = [];
    if (claseDe(n) === 'condicion') { for (const r of n.ramas ?? []) hijos.push(r.siguiente); hijos.push(n.si_no); }
    else if (claseDe(n) === 'respuesta') { for (const c of n.casos ?? []) hijos.push(c.siguiente); hijos.push(n.si_no); }
    else if (claseDe(n) !== 'ir_a') hijos.push(n.siguiente);
    for (const h of hijos) if (h && !puesto.has(h)) visitar(h);
  };
  visitar(raiz);
  const resp = todos.find((n) => claseDe(n) === 'respuesta');
  if (resp) visitar(resp.id);
  for (const n of todos) poner(n.id);   // nada debería quedar afuera; por las dudas

  if (est?.envio_automatico === true) notas.push('«Sale sola» pasó a cada mensaje');
  return { pasos: normalizar(orden), limpieza: limpiezaPara(est), notas, convertida: true };
}

// ── SEXTA TANDA: «IR A» DESAPARECE ─────────────────────────────────────────────────────────────
// Pedido literal (punto 12 de «General»): «"Go to" desaparece directamente... Porque justamente
// existen las etiquetas y/o los cambios de etapa en el CRM con una acción... Y si eso pasa, y tengo
// otra automatización que el CRON inicia con esa etiqueta o etapa del kanban, ya solo se dispara, no
// necesito "Go to"». Medido en producción el 09/10/2026 (scripts/quitar-ir-a.mts --simular): tres «Ir
// a» en las vigentes —dos de #198 a #212 y uno de #221 que junta dos ramas— y ninguna inscripción
// parada en uno.
//
//   · Un «Ir a» a una tarjeta de ESTA automatización pasa a ser una FLECHA directa a esa tarjeta (que
//     desde la sexta tanda puede tener varios padres). Lo que corre es lo mismo: el motor seguía el
//     salto en la misma resolución, y ahora sigue la flecha.
//   · Un «Ir a» a OTRA automatización se SACA: la otra arranca por su propio CRON. La salida que lo
//     apuntaba queda vacía (el lead termina ahí ESTA automatización). Si la otra no tiene un CRON que
//     agarre a ese lead, es un riesgo y lo lista el script.
//   · Un «Ir a» desde «Si responde» a la salida NO se convierte: retoma la salida en UN camino y
//     descarta los congelados, y una flecha haría otra cosa (correr esas tarjetas en el momento de la
//     respuesta). Queda, con su nota, y el motor lo sigue corriendo. No hay ninguno en producción.

export type CambioIrA = {
  /** El «Ir a» que se tocó. */
  id: string;
  destino: DestinoIrA | null;
  /** 'flecha': ahora es una flecha · 'quitado': se sacó · 'queda': no se convirtió (ver la nota). */
  como: 'flecha' | 'quitado' | 'queda';
  nota: string;
};

export type ResultadoSinIrA<P> = {
  pasos: P[];
  cambios: CambioIrA[];
  /** Una línea por cosa que no es 1:1, como las de `legadoAGrafo`. */
  notas: string[];
  /** true si cambió algo. */
  convertida: boolean;
  /**
   * Los errores de PUBLICAR que la conversión trajo y no estaban antes (vacío = lo convertido se puede
   * publicar si lo de antes se podía). El script no escribe una que traiga alguno.
   */
  erroresNuevos: string[];
};

/**
 * Saca los «Ir a» de un flujo (ver arriba). Pura: la usan el lienzo al abrir (`abrirFlujo`) y
 * scripts/quitar-ir-a.mts. `nombreDeSecuencia` sólo sirve para las notas.
 */
export function quitarIrA<P extends PasoGrafo>(
  pasosIn: readonly P[], op: { nombreDeSecuencia?: (id: number) => string | null; solo?: string } = {},
): ResultadoSinIrA<P> {
  const base = normalizar(pasosIn);
  // `solo`: el de UNA tarjeta (el botón de su editor); sin él, todos.
  const saltos = base.filter((p) => claseDe(p) === 'ir_a' && (op.solo == null || p.id === op.solo));
  if (!saltos.length) return { pasos: base, cambios: [], notas: [], convertida: false, erroresNuevos: [] };
  const hilo = hiloDe(base);
  const raiz = raizSalida(base);
  // Una flecha que vuelve a la primera tarjeta («volver al principio») la deja apuntada: con la raíz
  // fijada en el CRON (`fijarRaiz`) no hay duda de por dónde entra.
  let out: P[] = saltos.some((p) => p.destino && 'nodo' in p.destino && p.destino.nodo === raiz) ? fijarRaiz(base) : [...base];
  const cambios: CambioIrA[] = [];
  const notas: string[] = [];
  const quitar = new Set<string>();
  // Un «Ir a» que salta a otro «Ir a» (escrito a mano: el lienzo nunca lo ofreció) se sigue hasta el
  // final, o la flecha quedaría apuntando a un salto que también se saca.
  const final = (d: DestinoIrA | null): DestinoIrA | null => {
    let cur = d;
    for (let k = 0; cur && 'nodo' in cur && k <= base.length; k++) {
      const q = nodoPorId(base, cur.nodo);
      if (!q || claseDe(q) !== 'ir_a') return cur;
      cur = q.destino ?? null;
    }
    return cur && 'nodo' in cur && claseDe(nodoPorId(base, cur.nodo) ?? {}) === 'ir_a' ? null : cur;
  };
  for (const j of saltos) {
    const id = j.id!;
    const d = final(j.destino ?? null);
    const padres = padresDe(out, id);
    if (d && 'nodo' in d) {
      const enRespuesta = hilo.get(id) === HILO_RESPUESTA;
      if (enRespuesta && hilo.get(d.nodo) !== HILO_RESPUESTA) {
        cambios.push({ id, destino: d, como: 'queda', nota: 'desde «Si responde» retoma la salida: no es una flecha' });
        notas.push('un «Ir a» de «Si responde» retoma la salida y se dejó como estaba');
        continue;
      }
      if (indicePorId(out, d.nodo) < 0) {
        for (const pa of padres) out = conectarPuerto(out, pa.id, pa.puerto, null);
        quitar.add(id);
        cambios.push({ id, destino: d, como: 'quitado', nota: 'apuntaba a una tarjeta que ya no existe' });
        continue;
      }
      for (const pa of padres) out = conectarPuerto(out, pa.id, pa.puerto, d.nodo);
      quitar.add(id);
      cambios.push({ id, destino: d, como: 'flecha', nota: padres.length ? 'ahora es una flecha' : 'no lo apuntaba nadie: se sacó' });
      continue;
    }
    for (const pa of padres) out = conectarPuerto(out, pa.id, pa.puerto, null);
    quitar.add(id);
    if (d && 'secuencia_id' in d) {
      const nom = op.nombreDeSecuencia?.(Number(d.secuencia_id)) ?? `#${d.secuencia_id}`;
      cambios.push({ id, destino: d, como: 'quitado', nota: `«${nom}» arranca por su propio CRON` });
      notas.push(`«Sigue en «${nom}»» se sacó: esa automatización arranca por su propio CRON`);
    } else {
      cambios.push({ id, destino: null, como: 'quitado', nota: 'no decía a dónde' });
    }
  }
  out = normalizar(out.filter((p) => !quitar.has(p.id!)));
  const antes = new Set(validarGrafo(base));
  const erroresNuevos = validarGrafo(out).filter((e) => !antes.has(e));
  return { pasos: out, cambios, notas: [...new Set(notas)], convertida: quitar.size > 0, erroresNuevos };
}

/**
 * LO QUE EL LIENZO MUESTRA AL ABRIR una automatización: una lista de antes, convertida a tarjetas
 * (`legadoAGrafo`); un flujo, tal cual; y en los dos casos SIN «Ir a» (`quitarIrA`). Publicar guarda
 * eso. `limpiarEstrategia`: sólo si se convirtió una lista de antes (lo que el motor viejo hacía por
 * su lado ahora lo hacen las tarjetas); sacar un «Ir a» no toca la estrategia.
 */
export function abrirFlujo<P extends PasoGrafo>(
  pasosIn: readonly P[], est: EstrategiaLegada, op: Opciones & { nombreDeSecuencia?: (id: number) => string | null } = {},
): { pasos: P[]; notas: string[]; convertida: boolean; limpiarEstrategia: boolean } {
  const r = legadoAGrafo(pasosIn, est, op);
  const s = quitarIrA(r.pasos, op);
  // Se muestra lo de antes (con sus «Ir a», que el motor sigue corriendo) SÓLO si lo de antes se podía
  // publicar y la conversión no: así nunca se rompe una automatización que corre. Una que ya no se
  // podía publicar se abre convertida igual —GO TO no se dibuja más— y Publicar dice lo que falta.
  // (Medido sobre la forma de las tres de producción: ninguna cae acá; es la red, no el camino.)
  const sePodia = s.erroresNuevos.length > 0 && validarGrafo(r.pasos).length === 0;
  const sinSaltos = sePodia ? null : s;
  return {
    pasos: sinSaltos ? sinSaltos.pasos : r.pasos,
    notas: [...r.notas, ...(sinSaltos ? sinSaltos.notas : [])],
    convertida: r.convertida || !!sinSaltos?.convertida,
    limpiarEstrategia: r.convertida,
  };
}

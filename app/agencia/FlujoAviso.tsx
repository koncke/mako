'use client';

// =============================================================================
// FlujoAviso — lo que MaKo te dice A VOS, dibujado como flujo y editable ahí
// =============================================================================
// El pedido apuntando a Configuraciones › Notificaciones: «una pantalla tipo
// flujo, y ahí se edita todo». Y la segunda tanda, punto por punto: el lienzo
// ocupa todo el recuadro, las tarjetas se arrastran, se pueden agregar pasos, el
// disparador ofrece los eventos que existen, y el nodo «te llega» se va porque
// «es un paso que no hace nada».
//
// ── UN SOLO DUEÑO DEL FLUJO ────────────────────────────────────────────────
// Este componente lee y escribe el `Flujo` del mensaje —disparador, `insistir` y
// los pasos— y es el único que lo hace. Antes el paso `insistir` lo escribía
// `Recordatorios` por su cuenta: con el lienzo tocando también el disparador,
// eso eran dos dueños del MISMO objeto y `setFlujo` reemplaza el flujo entero, así
// que el segundo en guardar se llevaba puesto lo del primero. Aquel componente se
// absorbió acá con todo lo suyo (las dos opciones, los números, el techo dicho y
// el aviso de WhatsApp apagado).
//
// ── QUÉ CORRE DE VERDAD, Y QUÉ LO DICE ─────────────────────────────────────
// El aviso sale por su camino de siempre (su call site o su cron). Lo que este
// flujo agrega lo ejecuta `dispararEvento` (lib/flujos.ts), y SÓLO cuando pasa uno
// de los cinco eventos cableados. O sea:
//   · el `insistir` corre por los DOS caminos (el choke point de avisos lo lee);
//   · un paso de acción o un mensaje al lead corren sólo por el del EVENTO.
// Por eso un paso agregado sin evento elegido se dibuja con su advertencia en vez
// de en silencio: un paso que no corre y no lo dice es el control que se dibuja y
// no hace nada.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lienzo, TarjetaNodo, inpLienzo, rotuloLienzo } from '@/app/_components/Lienzo';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { Dropdown } from '../components/Dropdown';
import { EditorMensajeGrupo } from '@/app/chatbot/EditorMensajeWhatsApp';
import { grafoDeAviso, podarPosiciones, esInsistir, pasosDibujados, insertarPasoTras, quitarPasoDibujado, type AvisoParaGrafo, type Posiciones } from '@/lib/flujo-aviso';
import { sanearCron, type CronAviso } from '@/lib/cron-aviso';
import { EditorCron, SelectorDisparo, useModoDisparo, CRON_DEFAULT, type ModoDisparo } from '@/app/_components/EditorCron';
import { variablesOfrecidas } from '@/lib/variables-aviso';
import { guardarCanalDeMensaje } from '@/lib/mensaje-canales';
import {
  EVENTOS, EVENTOS_SIN_EMISOR, INSISTIR_MAX_VECES, INSISTIR_MIN_MINUTOS, sanearInsistir,
  type Flujo, type Paso, type PasoAccion,
  operacionDelPaso, pasoDeAccion, rotuloOperacion, SIN_ACCION,
  ACUSES, UNIDADES_RECORDATORIO, cadaDeMin, aMinutos, type UnidadRecordatorio,
} from '@/lib/flujos-tipos';
import { EditorAccionMako, useTitulosAcciones, type ValorAccion } from '@/app/_components/EditorAccionMako';
// Las condiciones que el motor SABE evaluar, y sus rótulos: el editor del CONDITION ofrece ésas y
// ninguna otra (tests/flujo-condicional.test.ts cruza las dos listas).
import { CONDICIONES_FLUJO, ROTULO_CONDICION } from '@/lib/flujo-pasos';
import type { NodoFlujo } from '@/lib/lienzo-grafo';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

const SANS = "'Geist', sans-serif";

const btnFantasma = {
  padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: SANS,
} as const;

const btnQuitarPaso = {
  marginTop: 12, background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12,
  fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: SANS,
} as const;

// La tarjeta del lienzo dice QUÉ acción corre el paso: el título sale de `useTitulosAcciones`
// (la misma lectura y la misma caché que el desplegable del editor). Mientras no llega, o si
// falla, la tarjeta dice el id legible: nunca queda en blanco.

/**
 * Lo que el panel de un «⚡ Acción» tiene escrito y todavía no guardó (el respiro de 700 ms),
 * para que el tablero lo TOME antes de cambiar el flujo por otro camino. Sin esto, el guardado
 * diferido salía DESPUÉS, armado sobre el flujo de antes: un deshacer quedaba pisado, y un paso
 * insertado antes corría los índices y lo escrito para una acción caía en la de al lado.
 */
type PanelPendiente = { tomar: () => { original: Paso; nuevo: Paso } | null };

const FLUJO_VACIO: Flujo = { version: 1, activo: true, disparador: { tipo: 'manual' }, pasos: [] };

/** El ícono de cada evento que dispara un mensaje (general 10: un ícono en cada opción de un desplegable). */
const ICONO_EVENTO: Record<(typeof EVENTOS)[number]['key'], NombreIconoMenu> = {
  'lead.agendo': 'calendario',
  'lead.cancelo': 'cerrar',
  'reunion.ocurrio': 'check',
  'lead.form_meta': 'nota',
  'lead.wa_entrante': 'whatsapp',
};

/** Lo que una pasada de deshacer restaura: el tablero entero, no un campo. */
type FotoTablero = { flujo: Flujo | null; pos: Posiciones };

/** Lo que se agenda al elegir TIEMPO: todos los días a las 9 de la mañana. Es el
 *  caso que más se pidió y el que no necesita ningún campo más. */

export function FlujoAviso({
  id, disparador, frecuenciaMin, texto, canales, posiciones, endpoint, editable, textoEditable, guardando,
  asunto, onAsunto, onAsuntoGuardar, tituloMensaje, aporta = [],
  onTexto, onCambio, probando, prueba, onProbar, chrome, pie, insetIzq,
}: {
  id: string;
  /**
   * Lo que tapa una pieza apoyada sobre el borde izquierdo: la lista de /chatbot, que desde la
   * quinta tanda (punto 5) muestra este lienzo para los Mensajes de MaKo. Va tal cual al
   * `insetIzq` del lienzo. Ausente = 0 (la tab de /mensajes, sin nada encima).
   */
  insetIzq?: number;
  disparador: string;
  frecuenciaMin: number;
  texto: string;
  canales: { wa: boolean; email: boolean };
  /** El asunto del email (vacío = se usa el título). Vive en el nodo EMAIL. */
  asunto?: string;
  /** Cómo se llama el mensaje. Es el asunto por default, así que la tarjeta lo dibuja. */
  tituloMensaje?: string;
  /** Qué entidades trae el disparador de este mensaje. Sale del catálogo (`aporta`). */
  aporta?: ReadonlyArray<'lead' | 'cuota'>;
  onAsunto?: (v: string) => void;
  onAsuntoGuardar?: () => void;
  posiciones: Posiciones;
  endpoint: string;
  /** Los avisos que redacta MaKo no dejan editar su TEXTO: son hechos exactos. */
  editable: boolean;
  /**
   * ¿Se puede escribir el MENSAJE? Ausente = lo mismo que `editable`. Es otra pregunta (sexta tanda,
   * 09/10/2026): en un aviso del cliente cuyo texto arma el código (`textoDelCodigo`) el flujo sigue
   * siendo suyo —el ＋, el CRON por evento, los pasos— y lo que no se ofrece es escribir un mensaje
   * que nunca se manda así. Con un solo booleano, apagar el texto apagaba también el ＋.
   */
  textoEditable?: boolean;
  guardando: boolean;
  onTexto: (v: string) => void;
  onCambio?: () => void;
  probando: boolean;
  prueba: string | null;
  onProbar: (contexto?: string) => void;
  /** El título, el interruptor y la salida: flotan SOBRE el lienzo. */
  chrome?: React.ReactNode;
  /** Lo que va abajo a la derecha del lienzo. Hoy es «Publicar», y lo pone el
   *  detalle porque es él el que sabe qué está sin publicar. */
  pie?: React.ReactNode;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const panelPendiente = useRef<PanelPendiente | null>(null);
  const [flujo, setFlujo] = useState<Flujo | null>(null);
  /** El agendado por TIEMPO vive en su TABLA, no en el store del mensaje: el store
   *  se hereda del dueño y lo reescribe el navegador entero (ver la mig 0183). */
  const [cron, setCron] = useState<CronAviso | null>(null);
  const [tz, setTz] = useState<string | null>(null);
  /** Las palabras que cortan los recordatorios. Son del NEGOCIO, no del mensaje: el
   *  webhook que las compara recibe un mensaje del grupo y no sabe a cuál de los
   *  avisos le está contestando. La pantalla lo dice donde se editan. */
  const [acusesTxt, setAcusesTxt] = useState('');
  const [pos, setPos] = useState<Posiciones>(posiciones);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const api = useCallback(async (body: unknown) => {
    try {
      const r = await (await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })).json();
      if (!r?.ok) setErr(r?.error || 'No se pudo guardar');
      return r;
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar'); return { ok: false }; }
  }, [endpoint]);

  useEffect(() => {
    let vivo = true;
    void api({ action: 'flujo-get', id }).then((r) => { if (vivo) setFlujo((r?.flujo as Flujo | null) ?? null); });
    void api({ action: 'acuses-get', id }).then((r) => {
      if (vivo) setAcusesTxt(((r?.acuses as string[] | undefined) ?? ACUSES).join(', '));
    });
    void api({ action: 'cron-get', id }).then((r) => {
      if (!vivo) return;
      const p = r?.programado as { cron?: unknown; tz?: string } | null | undefined;
      setCron(sanearCron(p?.cron ?? null));
      setTz(p?.tz ?? null);
    });
    return () => { vivo = false; };
  }, [api, id]);

  /** Agenda o desagenda. El saneo y la zona los resuelve el server, que es el único
   *  que puede: `tzDeWorkspace` sale a la red y no vive en el navegador. */
  /** Se escribe al SOLTAR el campo, no en cada tecla: son palabras separadas por
   *  coma y guardar a mitad de una deja «ok, gr» en la lista del negocio. */
  async function guardarAcuses(v: string, soloPintar = false) {
    setAcusesTxt(v);
    if (soloPintar) return;
    const r = await api({ action: 'acuses-set', id, acuses: v });
    // Se repinta con lo que el server SANEÓ: si alguien escribió una palabra de 40
    // caracteres, el campo tiene que mostrar que no entró — no dejarla escrita.
    if (r?.ok) setAcusesTxt(((r.acuses as string[] | undefined) ?? ACUSES).join(', '));
  }

  async function guardarCron(c: CronAviso | null): Promise<boolean> {
    // ⚠️ SE REVIERTE SI FALLA, y esta regla viene heredada del control que esta
    // sección reemplazó (`Disparador.tsx`, que hacía `setMin(previo)`): sin ella el
    // desplegable queda diciendo un horario que no se guardó, y no hay forma de
    // saberlo mirando la pantalla. Es lo único que ese componente tenía de propio y
    // que no era el campo que se sacó.
    const previo = cron;
    setBusy(true); setErr(null);
    setCron(c);   // optimista: el desplegable tiene que responder en el frame
    const r = await api({ action: 'cron-set', id, cron: c });
    const p = r?.programado as { cron?: unknown; tz?: string } | null | undefined;
    if (r?.ok) { setCron(sanearCron(p?.cron ?? null)); setTz(p?.tz ?? null); }
    else setCron(previo);
    setBusy(false);
    return !!r?.ok;
  }

  /**
   * ⚠️ EL CHOKE POINT DEL TABLERO, Y POR ESO ES DONDE SE APILA EL DESHACER.
   *
   * Pedido el 04/10/2026: «agrega los botones de deshacer y rehacer, y que funcione el
   * ctrl z / y». Todas las mutaciones del flujo pasan por acá —prender y apagar el
   * recordatorio, cambiar su cadencia, insertar un paso, quitarlo, cambiar su acción—,
   * así que apilar en este lugar le da deshacer a las seis y al paso que se agregue
   * mañana. Puesto en cada handler cubriría sólo los que existen hoy, que es la regla
   * de la casa sobre lo que vale para TODOS los cambios.
   *
   * ⚠️ Y DESHACER ESCRIBE EN EL SERVER, no sólo en la pantalla: este cambio YA se
   * guardó, así que revertir sólo el estado de React es mentir hasta el próximo F5.
   * Por eso `aplicarFoto` vuelve a llamar a este mismo camino con el valor anterior.
   */
  async function guardarFlujo(f: Flujo | null, opts: { apilar?: boolean } = {}) {
    if (opts.apilar !== false) apilar({ flujo, pos });
    setBusy(true); setErr(null);
    const r = await api({ action: 'flujo-set', id, flujo: f });
    if (r?.ok) setFlujo((r.flujo as Flujo | null) ?? null);
    setBusy(false);
  }

  /**
   * Restaura una foto del tablero y DEVUELVE la que estaba, que es lo que la pila de
   * rehacer necesita. Las posiciones se escriben acá mismo y no por el debounce de
   * `mover`: un deshacer tiene que quedar guardado aunque la persona cierre enseguida.
   */
  const aplicarFoto = (foto: FotoTablero): FotoTablero => {
    const antes: FotoTablero = { flujo, pos };
    // Lo que el panel no alcanzó a guardar se DESCARTA: deshacer es volver atrás, y un guardado
    // diferido que sale después del deshacer lo revierte.
    panelPendiente.current?.tomar();
    setSel(null);
    setPos(foto.pos);
    void api({ action: 'posiciones', id, posiciones: foto.pos });
    void guardarFlujo(foto.flujo, { apilar: false });
    return antes;
  };

  const { apilar, deshacer, rehacer, puedeDeshacer, puedeRehacer } = usePilaDeshacer<FotoTablero>(
    aplicarFoto,
    // `activa` cuelga de `editable`: en un aviso que redacta MaKo no hay nada que
    // deshacer, y un atajo que no hace nada es peor que ninguno.
    { activa: editable },
  );

  const insistir = (flujo?.pasos ?? []).find(esInsistir) ?? null;
  const pasosExtra = pasosDibujados(flujo?.pasos ?? []);
  // El catálogo se pide sólo si alguna tarjeta tiene una acción que nombrar.
  const titulos = useTitulosAcciones(pasosExtra.some((p) => p.tipo === 'accion' && operacionDelPaso(p) !== null));
  /** Lo que dice la tarjeta de un paso «⚡ Acción»: el título de la acción, o que falta elegirla. */
  const detalleDe = (n: NodoFlujo): string | undefined => {
    if (n.tipo !== 'accion') return n.detalle;
    const p = pasosExtra[n.orden ?? -1];
    const op = p?.tipo === 'accion' ? operacionDelPaso(p) : null;
    return op ? (titulos?.get(op) ?? rotuloOperacion(op)) : SIN_ACCION;
  };

  const aviso: AvisoParaGrafo = {
    // El id: con él el grafo sabe si el código corre los pasos de este aviso (la cobranza) y no los
    // dibuja como rotos por «no tener un evento» (`correSuFlujo`, lib/avisos-catalogo.ts).
    id,
    disparador, frecuenciaMin, texto, canales, posiciones: pos, cron, tz,
    // El asunto va al grafo para que la tarjeta EMAIL lo muestre: una tarjeta que no
    // dice qué asunto sale es una tarjeta que hay que abrir para saber qué hace.
    asunto, titulo: tituloMensaje,
    insistir: insistir ? { cadaMin: insistir.cadaMin, veces: insistir.veces } : null,
    evento: flujo?.disparador ?? null,
    pasos: pasosExtra,
  };
  const grafo = grafoDeAviso(aviso);

  // ⚠️ EL GUARDADO DE LA POSICIÓN ES OPTIMISTA Y SE DEBE. Arrastrar tiene que
  // responder en el frame; esperar el POST deja la tarjeta volviendo a su lugar
  // cada vez. Si falla, se dice — no se revierte: revertir una posición a mitad de
  // una sesión de acomodar es más desconcertante que un cartel.
  const guardarPos = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * ⚠️ EL ARRASTRE APILA UNA VEZ POR GESTO, NO POR PÍXEL. `mover` se llama decenas de
   * veces por segundo: apilar en cada una haría que Ctrl+Z devolviera la tarjeta un
   * píxel y hubiera que apretarlo cuarenta veces para volver donde uno estaba. El
   * gesto se reconoce por el hueco: si pasaron más de 450 ms desde el último `mover`,
   * esto es el PRIMER movimiento de un arrastre nuevo. Es el mismo umbral del debounce
   * que ya guarda la posición, así que no hay un segundo número que mantener.
   */
  const ultimoMover = useRef(0);
  function mover(nodoId: string, x: number, y: number) {
    const ahora = performance.now();
    if (ahora - ultimoMover.current > 450) apilar({ flujo, pos });
    ultimoMover.current = ahora;
    const sig = podarPosiciones({ ...pos, [nodoId]: { x, y } }, grafo.nodos.map((n) => n.id));
    setPos(sig);
    if (guardarPos.current) clearTimeout(guardarPos.current);
    guardarPos.current = setTimeout(() => { void api({ action: 'posiciones', id, posiciones: sig }); }, 450);
  }

  /**
   * AGREGAR UN PASO DESPUÉS DE ESTA TARJETA.
   *
   * El único tipo que queda es la ACCIÓN: «eliminar "mensaje al lead", ya que no
   * estamos configurando el chatbot». Con un solo tipo el ＋ no abre ningún menú —
   * un desplegable de una opción es una pregunta que ya está contestada.
   *
   * Dónde entra sale del id del nodo: los pasos del grafo son `paso-<i>`, así que
   * el ＋ de `paso-2` inserta en la posición 3 y el de cualquier nodo del tronco
   * (entrada, mensaje, recordatorio) inserta al principio. Eso es lo que hace que
   * el botón diga DÓNDE va a caer el paso, que es lo que un botón suelto en una
   * esquina no puede decir.
   */
  /**
   * ⚠️ EL ＋ PREGUNTA QUE CREAR, Y DOS DE LAS TRES OPCIONES NO SON UN PASO.
   *
   * Pedido el 04/10/2026: «si le doy al botón de +, antes de crear una tarjeta
   * debería salir un desplegable que me pregunte qué quiero crear… otro "WhatsApp" o
   * un "Email" o una "Acción" que es lo que sale por defecto ahora».
   *
   * WhatsApp y Email NO son pasos: las tarjetas de canal se DERIVAN de
   * `canales:{wa,email}`, dos booleanos del mensaje, y en el motor `CanalPaso` sólo
   * tiene `aviso_dueno | wa_lead` — no hay ninguna rama que mande mail. Elegirlos
   * PRENDE el canal, que es lo que hace aparecer su tarjeta. Es la decisión de
   * siempre: por dónde sale un mensaje es un campo, no un nodo.
   *
   * ⚠️ Y ESTO ARREGLA ALGO QUE ROMPÍ YO. El único control vivo que escribía
   * `canales.email` vivía en `BandejaEmail`, que dejé de montar el 04/10. Medido
   * después: CERO de los 65 mensajes tenía el canal de mail prendido en los cuatro
   * workspaces que tocaron el store, así que la tarjeta EMAIL no se dibujaba para
   * nadie y no quedaba forma de prenderla. El comentario que dejé en
   * `NotificacionesPanel` afirmaba que «el canal se prende ahora en el tablero»:
   * esto es lo que lo vuelve cierto.
   *
   * ⚠️ Y VA POR `guardarCanalDeMensaje`, NO ESCRIBIENDO `canales` DERECHO. Los tres
   * reportes tienen su canal en OTRA tienda (`notification_prefs`) y ese módulo es el
   * que sabe cuál mirar: escribir el store a mano los dejaría con el tablero diciendo
   * una cosa y el correo saliendo igual.
   *
   * El «Condicional» que también se pidió NO está en el menú, a propósito: el motor
   * no puede ejecutarlo hoy —`ejecutarPasos` es un `for` sincrónico adentro del
   * webhook, sin fila, sin estado y sin reanudación, tanto que el paso `esperar` que
   * ya existe hace `break`— y la regla de la casa es que sólo se dibuja la rama que
   * el motor EJECUTA. Un botón que no hace nada se lee como que la app está rota.
   */
  async function agregarTras(nodoId: string, que: string) {
    // Lo escrito en el panel abierto se TOMA y entra en el mismo guardado, y el panel se cierra:
    // el paso nuevo corre los índices, y con el panel abierto lo de una acción caía en otra.
    const pend = que === 'wa' || que === 'email' ? null : panelPendiente.current?.tomar() ?? null;
    if (que !== 'wa' && que !== 'email') setSel(null);
    if (que === 'wa' || que === 'email') {
      if (!id) return;
      setBusy(true); setErr(null);
      const r = await guardarCanalDeMensaje(id, que, true, endpoint);
      if (!r.ok) setErr(r.error ?? 'No pude prender el canal');
      setBusy(false);
      onCambio?.();
      return;
    }
    const sinPend = flujo ?? FLUJO_VACIO;
    const base = pend ? { ...sinPend, pasos: sinPend.pasos.map((p) => (p === pend.original ? pend.nuevo : p)) } : sinPend;
    /**
     * ⚠️ LOS TRES SON PASOS DE VERDAD Y EL MOTOR LOS CORRE. El `esperar` existía en el
     * tipo desde el día uno y hacía `break`: con `flujo_corridas` (mig 0186) el motor
     * se duerme y un cron lo despierta, y recién por eso estas dos tarjetas se pueden
     * ofrecer. La regla de la casa es que sólo se dibuja la rama que el motor EJECUTA,
     * y `tests/flujo-condicional.test.ts` falla si alguna se separa de la otra.
     *
     * Y el condicional nace en `contestaron`, que es la única señal que este motor
     * puede ver: el acuse en el grupo de MaKo, el mismo que corta las insistencias.
     *
     * ⚠️ LA ACCIÓN NACE SIN ACCIÓN, a propósito. Corre sola (decisión de Martín,
     * 08/10/2026), así que un default elegido acá sería algo que el flujo hace sin que
     * nadie lo haya elegido. Hasta ese día nacía en `crear_tarea`, que no corría nunca.
     * Sin operación el motor no la corre y la tarjeta dice «Elige una acción».
     */
    const nuevo: Paso =
      que === 'delay' ? { tipo: 'esperar', horas: 24 }
      : que === 'condicional' ? { tipo: 'condicional', condicion: 'contestaron' }
      : { tipo: 'accion' };
    void guardarFlujo({ ...base, activo: true, pasos: insertarPasoTras(base.pasos, nodoId, nuevo) });
  }

  return (
    <>
      <Lienzo
        grafo={grafo} seleccion={sel} onSeleccion={setSel} onMover={mover}
        onAgregarTras={editable ? ((nodoId, que) => void agregarTras(nodoId, que)) : undefined}
        /**
         * ⚠️ EL CANAL YA PRENDIDO NO SE OFRECE. Es la misma decisión del selector de
         * datos: lo que no se puede elegir no se dibuja en gris, no se dibuja. Un canal
         * prendido no es una opción — su tarjeta ya está en el lienzo.
         *
         * Y la lista va PLANA, con emoji y título: son cuatro opciones.
         */
        // ⚠️ CON ÍCONOS DEL SET, NO EMOJIS (sexta tanda, general 10: «pon íconos en todos los
        // desplegables, en todas las opciones»): el campo `icono` del Dropdown acepta un nombre de
        // app/_ui/iconos-menu.tsx. Y el WhatsApp de este mensaje es el de MaKo al grupo (MaKo en
        // WhatsApp 3): se llama como su tarjeta.
        opcionesAgregar={[
          ...(canales.wa ? [] : [{ value: 'wa', label: 'MaKo en WhatsApp', icono: 'mako' as const }]),
          ...(canales.email ? [] : [{ value: 'email', label: 'Email', icono: 'email' as const }]),
          { value: 'delay', label: 'Delay', icono: 'reloj' as const },
          { value: 'condicional', label: 'Condicional', icono: 'condicion' as const },
          { value: 'accion', label: 'Acción', icono: 'accion' as const },
        ]}
        // Sólo donde el paso va a caer de verdad: `insertarPasoTras` cuelga del
        // MENSAJE todo lo que no sea un `paso-N`, así que el ＋ de la tarjeta del
        // CRON señalaba un lugar y el paso aparecía en otro.
        puedeAgregarTras={(idNodo) => idNodo === 'mensaje' || /^paso-\d+$/.test(idNodo)}
        agregarOcupado={busy}
        panelAncho={460}
        chrome={chrome}
        herramientas={editable ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BotonPila titulo="Deshacer (Ctrl+Z)" onClick={deshacer} activo={puedeDeshacer}>↶</BotonPila>
            <BotonPila titulo="Rehacer (Ctrl+Y)" onClick={rehacer} activo={puedeRehacer}>↷</BotonPila>
          </div>
        ) : undefined}
        sinMarco alto="100%" insetIzq={insetIzq}
        renderNodo={(n, activo) => (
          <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={Boolean(n.advertencia)}>
            {/* ⚠️ LA TARJETA DE MaKo EN WHATSAPP (MaKo en WhatsApp 3): el mensaje como le llega al
                grupo, con la MISMA burbuja que el lienzo del Chatbot y que su editor (`BurbujaHilo`,
                firmada por MaKo, a la izquierda como la ve el equipo). El id es `mensaje` aunque el
                tipo sea `mako` (lib/flujo-aviso.ts): las posiciones y el ＋ se buscan por id. */}
            {n.id === 'mensaje'
              ? <BurbujaHilo compacta saliente={false} autor="MaKo" contenido={{ texto }}
                  vacio={<span style={{ color: 'var(--faint)', fontSize: 12.5 }}>Sin escribir</span>} />
              : <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{detalleDe(n)}</div>}
          </TarjetaNodo>
        )}
        renderEditor={(n) => (
          <EditorDelAviso
            nodo={n} id={id} disparador={disparador} frecuenciaMin={frecuenciaMin}
            texto={texto} endpoint={endpoint} editable={editable} textoEditable={textoEditable ?? editable} guardando={guardando || busy}
            asunto={asunto} onAsunto={onAsunto} onAsuntoGuardar={onAsuntoGuardar}
            aporta={aporta}
            canales={canales} flujo={flujo} insistir={insistir} cron={cron} tz={tz} onCron={guardarCron}
            acusesTxt={acusesTxt} onAcuses={guardarAcuses}
            onTexto={onTexto} onCambio={onCambio} onFlujo={guardarFlujo} panelPendiente={panelPendiente}
            onQuitarPaso={(i) => {
              const base = flujo ?? FLUJO_VACIO;
              void guardarFlujo({ ...base, pasos: quitarPasoDibujado(base.pasos, i) });
              setSel(null);
            }}
            probando={probando} prueba={prueba} onProbar={onProbar}
          />
        )}
        accion={pie}
      />
      {err && (
        <div style={{ flex: 'none', marginTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>{err}</div>
      )}
    </>
  );
}

// ── El editor de cada nodo ──────────────────────────────────────────────────

function EditorDelAviso({
  nodo, id, disparador, frecuenciaMin, texto, endpoint, editable, textoEditable, guardando, canales,
  asunto, onAsunto, onAsuntoGuardar, aporta,
  flujo, insistir, cron, tz, onCron, acusesTxt, onAcuses, onTexto, onCambio, onFlujo, onQuitarPaso, probando, prueba, onProbar,
  panelPendiente,
}: {
  nodo: NodoFlujo; id: string; disparador: string; frecuenciaMin: number; texto: string;
  endpoint: string; editable: boolean; textoEditable: boolean; guardando: boolean; canales: { wa: boolean; email: boolean };
  asunto?: string; onAsunto?: (v: string) => void; onAsuntoGuardar?: () => void;
  aporta: ReadonlyArray<'lead' | 'cuota'>;
  flujo: Flujo | null;
  insistir: Extract<Paso, { tipo: 'insistir' }> | null;
  cron: CronAviso | null;
  tz: string | null;
  onCron: (c: CronAviso | null) => Promise<boolean> | void;
  acusesTxt: string;
  onAcuses: (v: string, soloPintar?: boolean) => void;
  onTexto: (v: string) => void;
  onCambio?: () => void;
  onFlujo: (f: Flujo | null) => void;
  onQuitarPaso: (i: number) => void;
  probando: boolean; prueba: string | null; onProbar: (contexto?: string) => void;
  panelPendiente: React.MutableRefObject<PanelPendiente | null>;
}) {
  const base = flujo ?? FLUJO_VACIO;

  if (nodo.tipo === 'entrada') {
    return (
      <SeccionCron
        base={base} cron={cron} tz={tz}
        guardando={guardando} onFlujo={onFlujo} onCron={onCron}
      />
    );
  }
  /**
   * EL NODO DEL EMAIL. Hasta el 04/10/2026 caía en el `return` del final y mostraba el
   * `detalle`, que para esta tarjeta es la cadena vacía: tocarla abría un panel EN
   * BLANCO. Pedido así: «me faltan las plantillas de los email, que ahora como es todo
   * un mismo editor falta eso».
   *
   * ⚠️ EL CUERPO ES UNO, Y SE DICE. El mensaje tiene UN `texto` para los dos canales, y
   * lo único que es propio del correo es el ASUNTO —en WhatsApp no hay asunto, y en una
   * bandeja el título interno («Lead sin confirmar») se lee como un log—. Dibujar acá un
   * segundo editor de cuerpo sería prometer dos textos: serían dos borradores y dos
   * «sin publicar», y eso se decide cuando alguien lo pida. Mientras tanto el panel lo
   * DICE en una línea, que es más honesto que un campo que pisa el otro.
   */
  if (nodo.id === 'mensaje-email') {
    return (
      <>
        <label style={rotuloLienzo}>Asunto del correo</label>
        <input
          value={asunto ?? ''} disabled={guardando || !editable || !onAsunto}
          onChange={(e) => onAsunto?.(e.target.value)}
          onBlur={() => onAsuntoGuardar?.()}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAsuntoGuardar?.(); } }}
          // El título como placeholder: es lo que se usa si esto queda vacío, y verlo
          // acá es la diferencia entre «no puse nada» y «puse esto».
          placeholder={nodo.detalle || 'El título del mensaje'}
          maxLength={160}
          style={{ ...inpLienzo, marginBottom: 8 }}
        />
        <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, margin: 0 }}>
          Vacío: va el título. El cuerpo es el mismo que el de WhatsApp.
        </p>
        {nodo.advertencia && (
          <p style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, marginTop: 8, marginBottom: 0 }}>{nodo.advertencia}</p>
        )}
      </>
    );
  }
  if (nodo.id === 'mensaje') {
    /**
     * ⚠️ RECORDATORIOS VIVE ACÁ, NO EN UN NODO APARTE.
     *
     * Pedido textual, dos veces: «lo de «Si no contesta» debería llamarse
     * RECORDATORIOS, y no debería ser una nueva sección, sino una opción dentro de
     * la sección de mensaje, que se pueda activar o desactivar» y, cuando no se
     * hizo, «te dije que el RECORDATORIO se debe configurar dentro del MENSAJE».
     *
     * ⚠️ Y VA ARRIBA DEL `if (!editable)`, no debajo del editor. Hasta acá el
     * interruptor vivía en una rama que NO miraba `editable`, así que era alcanzable
     * siempre; pegarlo abajo del `<EditorMensaje>` lo dejaría detrás de ese return y
     * desaparecería para los avisos que redacta MaKo — que el server SÍ deja
     * configurar (`flujo-set` no pasa por `esAdministrativo`). Esconder un control
     * que el servidor acepta es sacar una función sin decirlo.
     */
    /**
     * ⚠️ ACA VIVIA «RECORDATORIOS», Y SE FUE EL 04/10/2026.
     *
     * Pedido: «elimina el apartado de "Recordatorios", para eso ya tendremos los
     * condicionales y la opción de poner más mensajes». Lo que se sacó es la UI: el
     * paso `insistir` sigue existiendo en el motor (lib/flujos.ts), con su techo de
     * 5 veces, sus 30 minutos mínimos y su corte con un «ok» en el grupo.
     *
     * Se midió antes de sacarlo, que es lo que la regla de la casa pide cuando se
     * saca un patrón: **cero flujos tienen hoy un paso `insistir`** en los cuatro
     * workspaces que tocaron el store. O sea que no quedó ningún mensaje con un
     * recordatorio prendido que ya no se pueda editar — que es el peor de los dos
     * mundos y la razón de medir.
     *
     * ⚠️ Lo que NO se fue y hay que acordarse: el motor sigue ejecutando `insistir`
     * si alguna vez vuelve a aparecer uno (una fila heredada del dueño, un flujo
     * escrito por la API). Si el condicional lo reemplaza de verdad, ahí se saca
     * también del motor; mientras tanto, el código que lo ejecuta es correcto y no
     * tiene quién lo encienda.
     *
     * Y pagó el ítem 6: sacarlo liberó el alto que hacía falta para que la caja de
     * texto creciera sin tocar `PANEL_ANCHO` ni el `maxHeight` del panel, que son
     * constantes compartidas por TODOS los lienzos.
     */

    // El campo se pinta en el frame y se GUARDA al soltar: son palabras separadas por
    // coma, y escribir en la base a mitad de una deja «ok, gr» en la lista del negocio.
    const onAcusesLocal = (v: string) => onAcuses(v, true);

    // ⚠️ `textoEditable`, no `editable` (sexta tanda): en un aviso cuyo texto arma el código el flujo
    // se sigue editando y el mensaje no. Y la nota sirve para los dos casos —el aviso técnico de la
    // agencia y el del cliente que se arma con lo que pasó (el reporte, la reunión, la línea)—: lo que
    // se ve es un ejemplo, y escribir encima no cambiaría lo que llega.
    if (!textoEditable) {
      return (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}><TextoMarcas texto={texto} /></div>
          <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
            Lo redacta MaKo con lo que pasa cada vez: esto es un ejemplo.
          </p>
        </>
      );
    }
    return (
      <>
        {/* ⚠️ SE OFRECE SÓLO LO QUE ESTE MENSAJE PUEDE RESOLVER. Un `{{lead_nombre}}`
            en un aviso que no habla de ningún lead sale CRUDO al WhatsApp del cliente:
            el resolvedor deja intacto lo que no sabe, a propósito, y el filtro de acá
            es lo único que evita que llegue ahí. */}
        {/* ⚠️ EL MISMO EDITOR QUE «MaKo EN WHATSAPP» DEL CHATBOT (MaKo en WhatsApp 2 y 3: «El editable
            de MaKo en WhatsApp debe ser lo mismo que el editable de WhatsApp» y «tienen una interfaz
            vieja, elimina eso»): `EditorMensajeGrupo`, el chat con la burbuja de MaKo, emojis y el
            árbol del «{ }». Hasta la sexta tanda era el editor de marcas de /mensajes (B / I / S y
            «＋ Dato de MaKo», app/agencia/EditorMensaje.tsx), que se fue con esto. El ✦ que le pide el
            texto a MaKo va arriba, a la derecha, como el de la cabecera del WhatsApp. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, minHeight: 28 }}>
          <PedirleAMaKo onProbar={onProbar} probando={probando} />
        </div>
        <EditorMensajeGrupo texto={texto} onTexto={onTexto} deshabilitado={guardando}
          // ⚠️ LO QUE SE PUEDE RESOLVER NO SALE SÓLO DEL FLUJO. Un cron puede traer el
          // lead en la mano —la cobranza es el caso— y preguntando únicamente por el
          // disparador del flujo, ese mensaje mostraba los datos del CRM apagados
          // teniendo cómo resolverlos. Lo declara el catálogo (`aporta`). Y el destino es el
          // EQUIPO: el link al portal del curso de un lead no va al grupo.
          datos={variablesOfrecidas({
            destino: 'equipo',
            conLead: base.disparador.tipo === 'evento' || aporta.includes('lead'),
            conCuota: aporta.includes('cuota'),
          })} />
        {/* ⚠️ LA SUGERENCIA SE APLICA, NO SE MIRA. El botón dejaba un texto en azul
            debajo y no tocaba el mensaje: «no hace nada, me escribe algo abajo pero
            no cambia el texto». Un botón que produce algo y no lo pone donde va es
            medio botón. Nada se publica hasta «Publicar», así que es reversible. */}
        {prueba && prueba !== texto && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 5 }}>MaKo lo escribiría así</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 8 }}><TextoMarcas texto={prueba} /></div>
            <button onClick={() => onTexto(prueba)} style={{ ...btnFantasma, background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Usar este texto
            </button>
          </div>
        )}
      </>
    );
  }

  // Un paso agregado: acción, espera, condición, mensaje al grupo o mensaje al lead.
  //
  // ⚠️ LA ESPERA, LA CONDICIÓN Y EL MENSAJE AL GRUPO CAÍAN AL `return` DEL FINAL (sexta tanda,
  // General 15: «hay plantillas que quedaron viejas… que no tienen sentido»): el panel mostraba una
  // línea y nada más — ni un campo, ni «Quitar este paso». La plantilla de fábrica de la cobranza son
  // EXACTAMENTE esos tres tipos (dos esperas y dos mensajes al grupo), así que la cadencia que Martín
  // pidió editable el 04/10 («que cada usuario lo pueda editar») no se podía tocar, y un DELAY o un
  // CONDITION agregados con el ＋ quedaban para siempre. La pregunta es por el ID (`paso-N`), no por
  // el tipo: el mensaje al grupo es `tipo: 'mako'`, igual que el mensaje principal.
  if (/^paso-\d+$/.test(nodo.id)) {
    const i = nodo.orden ?? 0;
    const vivos = pasosDibujados(base.pasos);
    const paso = vivos[i];
    const reemplazar = (nuevo: Paso) => onFlujo({ ...base, pasos: base.pasos.map((p) => (p === paso ? nuevo : p)) });
    const advertencia = nodo.advertencia && (
      <p style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, marginTop: 6, marginBottom: 0 }}>{nodo.advertencia}</p>
    );
    if (paso?.tipo === 'accion') {
      // El `key` es el del nodo: abrir otra tarjeta de acción tiene que traer SU estado,
      // no reusar el de la anterior (el editor siembra un `useState` de props).
      return (
        <EditorPasoAccion key={nodo.id} paso={paso} onGuardar={reemplazar}
          onQuitar={() => onQuitarPaso(i)} guardando={guardando} advertencia={advertencia}
          panelPendiente={panelPendiente} />
      );
    }
    if (paso?.tipo === 'esperar') {
      return (
        <EditorPasoEspera key={nodo.id} paso={paso} onGuardar={reemplazar} onQuitar={() => onQuitarPaso(i)}
          guardando={guardando} advertencia={advertencia} panelPendiente={panelPendiente} />
      );
    }
    if (paso?.tipo === 'condicional') {
      return (
        <EditorPasoCondicion key={nodo.id} paso={paso} onGuardar={reemplazar} onQuitar={() => onQuitarPaso(i)}
          guardando={guardando} advertencia={advertencia} panelPendiente={panelPendiente} />
      );
    }
    if (paso?.tipo === 'mensaje' && paso.canal === 'aviso_dueno') {
      return (
        <EditorPasoAlGrupo key={nodo.id} paso={paso} onGuardar={reemplazar} onQuitar={() => onQuitarPaso(i)}
          guardando={guardando} advertencia={advertencia} panelPendiente={panelPendiente}
          datos={variablesOfrecidas({
            destino: 'equipo',
            conLead: base.disparador.tipo === 'evento' || aporta.includes('lead'),
            conCuota: aporta.includes('cuota'),
          })} />
      );
    }
    return (
      <>
        {paso?.tipo === 'mensaje' && (
          <>
            <label style={rotuloLienzo}>Qué le escribe al lead</label>
            <textarea value={paso.texto} rows={4} disabled={guardando}
              onChange={(e) => reemplazar({ ...paso, texto: e.target.value })}
              style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45 }} />
            {/* ⛔ Este paso NO SE MANDA (decisión de Martín, 06/10/2026: «nada al
                cliente»; ver la rama en lib/flujos.ts). Hasta el 08/10 esta línea decía
                que MaKo lo proponía en el grupo y salía con un «sí»: no pasaba ni lo uno
                ni lo otro. El lienzo ya no ofrece crearlo; queda para el que exista. */}
            <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 8, marginBottom: 0 }}>
              No se envía: nada sale al cliente.
            </p>
          </>
        )}
        {advertencia}
        <button onClick={() => onQuitarPaso(i)} disabled={guardando} style={btnQuitarPaso}>
          Quitar este paso
        </button>
      </>
    );
  }

  return <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>;
}

/**
 * EL PANEL DEL PASO «⚡ ACCIÓN»: cualquier acción de MaKo, con sus datos.
 *
 * Decisión de Martín (08/10/2026), textual: un paso de un flujo «que pueda hacer todo, sin
 * limitaciones». Lo que se configura acá CORRE SOLO cuando el flujo llega a este paso
 * (`ejecutarDesdeFlujo` en lib/flujos.ts): el dueño confirma al configurar, no después.
 * Por eso ya no hay ninguna línea que prometa «se hace con tu sí» — era cierta para las
 * tres acciones fijas de antes, y ésas no corrían nunca.
 *
 * El editor es el COMPARTIDO por los dos lienzos (`EditorAccionMako`), montado tal cual.
 *
 * ⚠️ TIENE ESTADO PROPIO Y GUARDA CON UN RESPIRO, por tres razones medidas en este archivo:
 *  · `guardarFlujo` no pinta optimista —el flujo se repinta con lo que contesta el server—,
 *    así que un campo de texto controlado por el flujo PIERDE LETRAS si se escribe más
 *    rápido que un POST;
 *  · cada guardado apila un deshacer, y uno por tecla deja un Ctrl+Z que borra una letra;
 *  · no se le pasa `disabled={guardando}`: con el guardado en vuelo el campo se apagaría y
 *    perdería el foco a mitad de una palabra.
 * Elegir la ACCIÓN se guarda en el acto; los datos, 700 ms después de la última tecla.
 *
 * ⚠️ Y LO PENDIENTE SE MANDA AL CERRAR EL PANEL, salvo que se haya QUITADO el paso: el
 * guardado diferido se arma con el flujo de antes de quitarlo, y lo devolvería.
 */
function EditorPasoAccion({ paso, onGuardar, onQuitar, guardando, advertencia, panelPendiente }: {
  paso: PasoAccion;
  onGuardar: (nuevo: PasoAccion) => void;
  onQuitar: () => void;
  guardando: boolean;
  advertencia?: React.ReactNode;
  panelPendiente: React.MutableRefObject<PanelPendiente | null>;
}) {
  // Un paso VIEJO (sólo `accion`, sin `operacion`) se abre sin acción elegida: sus tres
  // valores no son ids del registro y el motor no lo corre.
  const [valor, setValor] = useState<ValorAccion>(() => {
    const op = operacionDelPaso(paso);
    return op ? { operacion: op, params: paso.params ?? {} } : {};
  });
  // El guardado diferido llama al `onGuardar` del ÚLTIMO render: el de un render viejo
  // reemplazaría el paso sobre un flujo que ya cambió.
  const guardarRef = useRef(onGuardar);
  useEffect(() => { guardarRef.current = onGuardar; });
  const pendiente = useRef<ValorAccion | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  const soltar = useCallback(() => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    const v = pendiente.current;
    pendiente.current = null;
    if (v) guardarRef.current(pasoDeAccion(v));
  }, []);
  useEffect(() => soltar, [soltar]);
  // El paso de ESTE render: es el que está en el flujo de ahora, así que es contra el que el
  // tablero reemplaza lo que toma.
  const pasoRef = useRef(paso);
  useEffect(() => { pasoRef.current = paso; });
  useEffect(() => {
    const yo: PanelPendiente = {
      tomar: () => {
        if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
        const v = pendiente.current;
        pendiente.current = null;
        return v ? { original: pasoRef.current, nuevo: pasoDeAccion(v) } : null;
      },
    };
    panelPendiente.current = yo;
    return () => { if (panelPendiente.current === yo) panelPendiente.current = null; };
  }, [panelPendiente]);
  // Y cambiar de pestaña o cerrar el navegador también es salir: ahí el desmonte no corre.
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') soltar(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, [soltar]);

  const cambiar = (v: ValorAccion) => {
    const otraAccion = (v.operacion ?? '') !== (valor.operacion ?? '');
    setValor(v);
    pendiente.current = v;
    if (reloj.current) clearTimeout(reloj.current);
    if (otraAccion) soltar();
    else reloj.current = setTimeout(soltar, 700);
  };

  const quitar = () => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    pendiente.current = null;
    onQuitar();
  };

  return (
    <>
      <EditorAccionMako valor={valor} onCambio={cambiar} />
      {advertencia}
      <button onClick={quitar} disabled={guardando} style={btnQuitarPaso}>
        Quitar este paso
      </button>
    </>
  );
}

/**
 * EL GUARDADO DIFERIDO DE UN PASO, para los editores de la espera, la condición y el mensaje al
 * grupo (sexta tanda). Es el MISMO contrato que `EditorPasoAccion` (arriba, y por las mismas
 * razones): lo escrito espera 700 ms, se registra en `panelPendiente` para que el tablero lo TOME
 * antes de cambiar el flujo por otro camino (un ＋, un deshacer), se manda al desmontar y al ocultar
 * la pestaña, y quitar el paso lo DESCARTA (armado sobre el flujo de antes, lo devolvería).
 * `enElActo` es para lo que se elige de una vez (una opción de un desplegable).
 */
function usePasoDiferido<V>(paso: Paso, inicial: () => V, aPaso: (v: V) => Paso, onGuardar: (nuevo: Paso) => void,
  panelPendiente: React.MutableRefObject<PanelPendiente | null>) {
  const [valor, setValor] = useState<V>(inicial);
  const guardarRef = useRef(onGuardar);
  useEffect(() => { guardarRef.current = onGuardar; });
  const aPasoRef = useRef(aPaso);
  useEffect(() => { aPasoRef.current = aPaso; });
  const pasoRef = useRef(paso);
  useEffect(() => { pasoRef.current = paso; });
  const pendiente = useRef<{ v: V } | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parar = () => { if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; } };
  const soltar = useCallback(() => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    const p = pendiente.current;
    pendiente.current = null;
    if (p) guardarRef.current(aPasoRef.current(p.v));
  }, []);
  useEffect(() => soltar, [soltar]);
  useEffect(() => {
    const yo: PanelPendiente = {
      tomar: () => {
        if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
        const p = pendiente.current;
        pendiente.current = null;
        return p ? { original: pasoRef.current, nuevo: aPasoRef.current(p.v) } : null;
      },
    };
    panelPendiente.current = yo;
    return () => { if (panelPendiente.current === yo) panelPendiente.current = null; };
  }, [panelPendiente]);
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') soltar(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, [soltar]);
  const cambiar = (v: V, enElActo = false) => {
    setValor(v);
    pendiente.current = { v };
    parar();
    if (enElActo) soltar();
    else reloj.current = setTimeout(soltar, 700);
  };
  const descartar = () => { parar(); pendiente.current = null; };
  return { valor, cambiar, descartar };
}

type PropsPaso<P extends Paso> = {
  paso: P;
  onGuardar: (nuevo: Paso) => void;
  onQuitar: () => void;
  guardando: boolean;
  advertencia?: React.ReactNode;
  panelPendiente: React.MutableRefObject<PanelPendiente | null>;
};

/** El tope de una espera: un año, como el de las automatizaciones (`366 * 1440` min en lib/flujo-ia.ts). */
const HORAS_MAX_ESPERA = 8760;

/** DELAY: cuántas horas espera antes del paso siguiente (el motor lee `horas`, lib/flujo-pasos.ts). */
function EditorPasoEspera({ paso, onGuardar, onQuitar, guardando, advertencia, panelPendiente }: PropsPaso<Extract<Paso, { tipo: 'esperar' }>>) {
  const { valor, cambiar, descartar } = usePasoDiferido<string>(paso, () => String(paso.horas),
    (v) => ({ tipo: 'esperar', horas: Math.max(1, Math.min(HORAS_MAX_ESPERA, Math.round(Number(v) || 1))) }),
    onGuardar, panelPendiente);
  return (
    <>
      <label style={rotuloLienzo}>Cuántas horas espera</label>
      <input type="number" inputMode="numeric" min={1} max={HORAS_MAX_ESPERA} step={1} value={valor}
        onChange={(e) => cambiar(e.target.value)} style={inpLienzo} aria-label="Horas de espera" />
      {advertencia}
      <button onClick={() => { descartar(); onQuitar(); }} disabled={guardando} style={btnQuitarPaso}>
        Quitar este paso
      </button>
    </>
  );
}

/** CONDITION: el único dato que este motor ve es si alguien contestó en el grupo (`CONDICIONES_FLUJO`). */
function EditorPasoCondicion({ paso, onGuardar, onQuitar, guardando, advertencia, panelPendiente }: PropsPaso<Extract<Paso, { tipo: 'condicional' }>>) {
  const { valor, cambiar, descartar } = usePasoDiferido<string>(paso, () => paso.condicion,
    (v) => ({ tipo: 'condicional', condicion: v }), onGuardar, panelPendiente);
  return (
    <>
      <label style={rotuloLienzo}>Sigue si</label>
      <Dropdown value={valor} onChange={(v) => cambiar(String(v), true)} ariaLabel="Condición"
        options={CONDICIONES_FLUJO.map((c) => ({ value: c, label: ROTULO_CONDICION[c], icono: ICONO_CONDICION[c] }))} />
      {advertencia}
      <button onClick={() => { descartar(); onQuitar(); }} disabled={guardando} style={btnQuitarPaso}>
        Quitar este paso
      </button>
    </>
  );
}
const ICONO_CONDICION: Record<(typeof CONDICIONES_FLUJO)[number], NombreIconoMenu> = { contestaron: 'check', no_contestaron: 'silenciar' };

/**
 * MAKO EN WHATSAPP, un paso más: lo que sale al grupo, con el MISMO editor que el mensaje principal
 * (`EditorMensajeGrupo`, MaKo en WhatsApp 2) y lo que ESTE aviso puede resolver en el «{ }». Sale
 * tal cual, con los datos puestos por código (lib/flujos.ts).
 */
function EditorPasoAlGrupo({ paso, onGuardar, onQuitar, guardando, advertencia, panelPendiente, datos }: PropsPaso<Extract<Paso, { tipo: 'mensaje' }>> & {
  datos: ReturnType<typeof variablesOfrecidas>;
}) {
  const { valor, cambiar, descartar } = usePasoDiferido<string>(paso, () => paso.texto,
    (v) => ({ ...paso, texto: v }), onGuardar, panelPendiente);
  return (
    <>
      <EditorMensajeGrupo texto={valor} onTexto={(v) => cambiar(v)} datos={datos} />
      {advertencia}
      <button onClick={() => { descartar(); onQuitar(); }} disabled={guardando} style={btnQuitarPaso}>
        Quitar este paso
      </button>
    </>
  );
}

function Opcion({ activa, onClick, disabled, children }: {
  activa: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={activa}
      style={{
        padding: '5px 12px', borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
        border: `1px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`,
        background: activa ? 'var(--primary-bg)' : 'var(--surface)',
        color: activa ? 'var(--primary)' : 'var(--dim)', opacity: disabled ? 0.6 : 1,
      }}>
      {activa ? '✓ ' : ''}{children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────

/**
 * LA SECCIÓN «CRON»: TIEMPO **o** ACCIÓN, nunca las dos.
 *
 * Pedido textual: «El cron debería ser uno de dos… O el usuario lo configura para
 * que salga en TIEMPO… O lo configura que se dispare mediante una ACCIÓN. Y no deben
 * poder editarse los 2 al mismo tiempo, primero se selecciona tiempo o acción y luego
 * se selecciona el desplegable».
 *
 * ⚠️ ES UN COMPONENTE PROPIO PORQUE NECESITA ESTADO, y un `useState` adentro del
 * editor de nodos quedaría detrás de los `return` por tipo de nodo — que es el
 * «Minified React error #300» que esta casa ya pagó con la pantalla en blanco, y que
 * el pre-push mira con `scripts/hooks-en-orden.sh`.
 *
 * ⚠️ Y EL MODO NO SE PUEDE DERIVAR SOLO DE LOS DATOS. La primera versión hacía
 * `modo = cron ? 'tiempo' : evento ? 'accion' : 'nada'`, y con eso apretar «Por una
 * acción» no hacía NADA: sin evento elegido el modo seguía siendo 'nada', el
 * desplegable no se dibujaba, y no había forma de llegar a elegir el evento. Medido en
 * el navegador — el botón cambiaba de color y el panel no cambiaba. Elegir un modo es
 * una INTENCIÓN de quien mira; lo que hay guardado es otra cosa, y la intención manda
 * hasta que se guarde algo.
 *
 * ⚠️ Y HAY UN TERCER ESTADO QUE NO SE PUEDE ESCONDER: 60 de los 65 mensajes del
 * catálogo ya salen por su cuenta, desde el código que los produce. Eso no se apaga
 * desde acá, así que un control de dos opciones donde ninguna está puesta estaría
 * mintiendo sobre qué hace hoy el mensaje. «Nada más» es ese estado con su nombre, y
 * arriba, en una línea, lo que el mensaje hace por su cuenta.
 *
 * Y el desplegable «cada cuánto, como máximo» se fue de la pantalla: «realmente no me
 * hace ningun tipo de sentido». Medido antes de sacarlo — los 108 avisos activos de
 * los 10 workspaces lo tienen en 0, así que no apaga ninguna protección que hoy
 * funcione. El CAMPO y sus dos lectores quedan.
 */
function SeccionCron({ base, cron, tz, guardando, onFlujo, onCron }: {
  base: Flujo; cron: CronAviso | null; tz: string | null;
  guardando: boolean; onFlujo: (f: Flujo | null) => void; onCron: (c: CronAviso | null) => Promise<boolean> | void;
}) {
  const evento = base.disparador.tipo === 'evento' ? base.disparador.evento : '';
  const guardado: ModoDisparo = cron ? 'tiempo' : evento ? 'accion' : null;
  // Sin nada elegido los dos botones están apagados, y eso es cierto para los 65: nadie
  // configuró cuándo sale. Lo que ese estado NO dice es «no sale» — eso lo dice la
  // tarjeta, con el disparador nativo rotulado.
  const [modo, setIntencion] = useModoDisparo(guardado);

  /**
   * ⚠️ LOS BOTONES SON DOS Y APAGAN AL VOLVER A APRETARLOS.
   *
   * «Qué es ese botón de "Nada más" no tiene sentido!!! Quitalo... Son 2 botones como
   * te dije, o por tiempo o por acción.» Lo único que ese tercer botón tenía de propio
   * era APAGAR, así que eso pasa al toggle del que está activo: sin él, elegir «Por
   * tiempo» una vez dejaría el mensaje agendado para siempre, sin ninguna salida que
   * no sea apagar el mensaje entero.
   */
  const elegir = (m: ModoDisparo) => {
    if (m === modo) {
      setIntencion(null);
      if (m === 'tiempo') onCron(null);
      else onFlujo({ ...base, disparador: { tipo: 'manual' } });
      return;
    }
    setIntencion(m);
    // Elegir uno APAGA el otro, y es una ESCRITURA y no un `disabled`: las dos
    // mitades viven en lugares distintos —el evento en el store del flujo, el
    // horario en su tabla— así que dejar el de al lado puesto y sólo grisarlo
    // dejaría un mensaje disparado por las dos cosas con la pantalla diciendo una.
    if (m !== 'accion' && evento) onFlujo({ ...base, disparador: { tipo: 'manual' } });
    if (m !== 'tiempo' && cron) onCron(null);
    // ⚠️ SI EL AGENDADO SE NIEGA, LA INTENCIÓN VUELVE ATRÁS. Pasa con el texto de
    // ejemplo (`motivoNoAgendable`): el server contesta el motivo, `guardarCron`
    // revierte el horario, y sin esto quedaba «Por tiempo» elegido sin nada abajo —
    // un botón que se prendió y no hizo nada.
    if (m === 'tiempo' && !cron) {
      void Promise.resolve(onCron(CRON_DEFAULT)).then((ok) => { if (ok === false) setIntencion(null); });
    }
  };

  return (
    <>
      {/* ⚠️ ACÁ NO VA EL DISPARADOR DEL CATÁLOGO. Esa línea decía «Cron los lunes a la
          mañana» —el campo `disparador`, la descripción de fábrica— arriba de un
          agendado vacío, y se leyó exactamente como lo que parecía: «estás
          PRECONFIGURANDO el cron… cuando JUSTAMENTE lo estamos haciendo editable».
          El hecho no se pierde: lo dice la TARJETA, rotulado «Hoy sale solo». */}
      {/*
        ⚠️ UNA SOLA OPCION A LA VEZ, Y SE VUELVE CON LA FLECHA.
        Pedido con la captura delante: «el CRON debería elegirse 1 sola opción, por
        tiempo o por acción y si se quiere cambiar debería retroceder. No que
        aparezcan siempre ambos botones». Con los dos puestos, el apagado se leia como
        una segunda cosa configurable al lado de la elegida.
        La salida NO se pierde —que es lo que el toggle de antes resolvia—: la flecha
        hace exactamente lo mismo que volver a apretar el activo, o sea apagar el
        agendado. Sin ella, elegir «Por tiempo» una vez dejaria el mensaje agendado
        para siempre sin mas salida que apagar el mensaje entero.
      */}
      <SelectorDisparo modo={modo} disabled={guardando} onModo={(m) => elegir(m ?? modo)} />
      {modo === 'tiempo' && cron && <EditorCron cron={cron} tz={tz} disabled={guardando} onCron={onCron} />}
      {modo === 'accion' && (
        <Dropdown
          value={evento}
          // Un evento que quedó sin emisor no se OFRECE, pero si ya está elegido se muestra marcado:
          // un desplegable cuyo valor no está entre sus opciones no muestra nada (AGENTS.md).
          options={[...EVENTOS, ...EVENTOS_SIN_EMISOR.filter((e) => e.key === evento)]
            .map((e) => ({ value: e.key, label: e.label, icono: ICONO_EVENTO[e.key] }))}
          onChange={(v) => onFlujo({ ...base, activo: true, disparador: { tipo: 'evento', evento: v as typeof EVENTOS[number]['key'] } })}
          width="100%" ariaLabel="Qué acción dispara este mensaje"
        />
      )}
    </>
  );
}

/**
 * Un botón de la pila. Apagado cuando no hay nada que deshacer o rehacer, que es lo
 * que lo vuelve honesto: ofrecer un «Deshacer» que no deshace nada es peor que no
 * ofrecerlo — la misma regla que ya está escrita en `app/_ui/Toast.tsx` para su
 * `onUndo` opcional.
 *
 * ⚠️ `data-no-pan` lo pone el envoltorio y no cada botón: un `pointerdown` en los
 * píxeles de separación no encuentra el botón, y el lienzo lo tomaría como un paneo.
 */
function BotonPila({ titulo, onClick, activo, children }: {
  titulo: string; onClick: () => void; activo: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={!activo} title={titulo} aria-label={titulo}
      style={{
        width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
        color: activo ? 'var(--dim)' : 'var(--faint)', fontSize: 15, fontFamily: 'inherit',
        cursor: activo ? 'pointer' : 'default', opacity: activo ? 1 : 0.45,
      }}>
      {children}
    </button>
  );
}

/**
 * El botón de IA: un ícono que PREGUNTA QUÉ ESCRIBIR antes de escribir.
 *
 * Pedido el 04/10/2026, las dos mitades: «"Que lo escriba MaKo" solo debería ser el
 * ícono de IA, y de última si paso el cursor que diga lo que hace» y «si lo escribe
 * MaKo, debería primero preguntar QUÉ escribir, sino, no tiene contexto sobre que
 * escribir».
 *
 * ⚠️ LA SEGUNDA MITAD ERA UN CAMPO QUE FALTABA DEL LADO DEL CLIENTE, NO UNA
 * CAPACIDAD QUE FALTARA. El parámetro `contexto` ya estaba aceptado en las DOS rutas
 * y nadie lo mandaba nunca: sin él, el server caía a «Usa datos de ejemplo
 * realistas», o sea que MaKo escribía a ciegas. Por eso esto es un input y no un
 * segundo botón.
 *
 * Y no cuesta plata: la feature `avisos` corre en gemini-flash por la cascada gratis
 * con la key del propio workspace, y no está en `CLAUDE_PERMITIDO`, así que el
 * fallback pago muere en el veto. Preguntar antes no cambia quién paga: cambia que
 * la respuesta sirva.
 */
function PedirleAMaKo({ onProbar, probando }: { onProbar: (contexto?: string) => void; probando: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [que, setQue] = useState('');
  const mandar = () => { onProbar(que); setAbierto(false); setQue(''); };

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} disabled={probando}
        title="Que lo escriba MaKo: le dices qué quieres que diga y te lo redacta"
        aria-label="Que lo escriba MaKo"
        style={{
          width: 28, height: 26, borderRadius: 6, border: 'none', background: 'transparent',
          cursor: probando ? 'default' : 'pointer', fontSize: 14, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: probando ? 0.5 : 1,
        }}>
        {/* El logo de MaKo, como el ✦ de la cabecera del WhatsApp del Chatbot (un ícono, no un emoji). */}
        {probando ? '…' : <MakoLogo size={18} animate={false} />}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
      <input
        autoFocus value={que} onChange={(e) => setQue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') mandar(); if (e.key === 'Escape') setAbierto(false); }}
        placeholder="¿Qué quieres que diga?"
        style={{
          flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '5px 9px', borderRadius: 6,
          border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
          color: 'var(--ink)', fontSize: 12, fontFamily: 'inherit', outline: 'none',
        }} />
      <button type="button" onClick={mandar} disabled={!que.trim()} title="Que MaKo lo escriba"
        style={{
          flex: 'none', padding: '5px 10px', borderRadius: 6, border: 'none',
          background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600,
          fontFamily: 'inherit', cursor: que.trim() ? 'pointer' : 'default', opacity: que.trim() ? 1 : 0.45,
        }}>Escribir</button>
    </div>
  );
}

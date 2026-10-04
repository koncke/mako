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
import { BURBUJA_SALIENTE } from '@/app/whatsapp/_shared/BurbujaMaKo';
import { Dropdown } from '../components/Dropdown';
import { EditorMensaje } from './EditorMensaje';
import { grafoDeAviso, podarPosiciones, esInsistir, pasosDibujados, insertarPasoTras, quitarPasoDibujado, type AvisoParaGrafo, type Posiciones } from '@/lib/flujo-aviso';
import { UNIDADES, CADA_MAX, DIA_MES_MAX, sanearCron, textoCron, type CronAviso } from '@/lib/cron-aviso';
import { variablesPara } from '@/lib/variables-aviso';
import {
  EVENTOS, INSISTIR_MAX_VECES, INSISTIR_MIN_MINUTOS, sanearInsistir,
  type Flujo, type Paso, type AccionFlujo,
  ACUSES, UNIDADES_RECORDATORIO, cadaDeMin, aMinutos, type UnidadRecordatorio,
} from '@/lib/flujos-tipos';
import type { NodoFlujo } from '@/lib/lienzo-grafo';

const SANS = "'Geist', sans-serif";

const btnFantasma = {
  padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: SANS,
} as const;

const ACCIONES: Array<{ value: AccionFlujo; label: string }> = [
  { value: 'crear_tarea', label: 'Crear una tarea' },
  { value: 'inscribir_nutricion', label: 'Inscribir en nutrición' },
  { value: 'marcar_lead', label: 'Marcar el lead' },
];

const FLUJO_VACIO: Flujo = { version: 1, activo: true, disparador: { tipo: 'manual' }, pasos: [] };

/** Lo que una pasada de deshacer restaura: el tablero entero, no un campo. */
type FotoTablero = { flujo: Flujo | null; pos: Posiciones };

/** Lo que se agenda al elegir TIEMPO: todos los días a las 9 de la mañana. Es el
 *  caso que más se pidió y el que no necesita ningún campo más. */
const CRON_DEFAULT: CronAviso = { unidad: 'dia', cada: 1, hora: 9, minuto: 0 };

export function FlujoAviso({
  id, disparador, frecuenciaMin, texto, canales, posiciones, endpoint, editable, guardando,
  onTexto, onCambio, probando, prueba, onProbar, chrome, pie,
}: {
  id: string;
  disparador: string;
  frecuenciaMin: number;
  texto: string;
  canales: { wa: boolean; email: boolean };
  posiciones: Posiciones;
  endpoint: string;
  /** Los avisos que redacta MaKo no dejan editar su TEXTO: son hechos exactos. */
  editable: boolean;
  guardando: boolean;
  onTexto: (v: string) => void;
  onCambio?: () => void;
  probando: boolean;
  prueba: string | null;
  onProbar: () => void;
  /** El título, el interruptor y la salida: flotan SOBRE el lienzo. */
  chrome?: React.ReactNode;
  /** Lo que va abajo a la derecha del lienzo. Hoy es «Publicar», y lo pone el
   *  detalle porque es él el que sabe qué está sin publicar. */
  pie?: React.ReactNode;
}) {
  const [sel, setSel] = useState<string | null>(null);
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

  async function guardarCron(c: CronAviso | null) {
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

  const aviso: AvisoParaGrafo = {
    disparador, frecuenciaMin, texto, canales, posiciones: pos, cron, tz,
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
  function agregarTras(nodoId: string) {
    const base = flujo ?? FLUJO_VACIO;
    const nuevo: Paso = { tipo: 'accion', accion: 'crear_tarea' };
    void guardarFlujo({ ...base, activo: true, pasos: insertarPasoTras(base.pasos, nodoId, nuevo) });
  }

  return (
    <>
      <Lienzo
        grafo={grafo} seleccion={sel} onSeleccion={setSel} onMover={mover}
        onAgregarTras={editable ? agregarTras : undefined}
        // Sólo donde el paso va a caer de verdad: `insertarPasoTras` cuelga del
        // MENSAJE todo lo que no sea un `paso-N`, así que el ＋ de la tarjeta del
        // CRON señalaba un lugar y el paso aparecía en otro.
        puedeAgregarTras={(idNodo) => idNodo === 'mensaje' || /^paso-\d+$/.test(idNodo)}
        agregarOcupado={busy}
        chrome={chrome}
        herramientas={editable ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BotonPila titulo="Deshacer (Ctrl+Z)" onClick={deshacer} activo={puedeDeshacer}>↶</BotonPila>
            <BotonPila titulo="Rehacer (Ctrl+Y)" onClick={rehacer} activo={puedeRehacer}>↷</BotonPila>
          </div>
        ) : undefined}
        sinMarco alto="100%"
        renderNodo={(n, activo) => (
          <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={Boolean(n.advertencia)}>
            {n.tipo === 'mensaje' && n.id === 'mensaje'
              ? (
                <div style={{ ...BURBUJA_SALIENTE, maxWidth: '100%', padding: '9px 11px', fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {texto.trim() ? <TextoMarcas texto={texto} /> : <span style={{ color: 'var(--faint)' }}>Sin escribir</span>}
                </div>
              )
              : <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{n.detalle}</div>}
          </TarjetaNodo>
        )}
        renderEditor={(n) => (
          <EditorDelAviso
            nodo={n} id={id} disparador={disparador} frecuenciaMin={frecuenciaMin}
            texto={texto} endpoint={endpoint} editable={editable} guardando={guardando || busy}
            canales={canales} flujo={flujo} insistir={insistir} cron={cron} tz={tz} onCron={guardarCron}
            acusesTxt={acusesTxt} onAcuses={guardarAcuses}
            onTexto={onTexto} onCambio={onCambio} onFlujo={guardarFlujo}
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
  nodo, id, disparador, frecuenciaMin, texto, endpoint, editable, guardando, canales,
  flujo, insistir, cron, tz, onCron, acusesTxt, onAcuses, onTexto, onCambio, onFlujo, onQuitarPaso, probando, prueba, onProbar,
}: {
  nodo: NodoFlujo; id: string; disparador: string; frecuenciaMin: number; texto: string;
  endpoint: string; editable: boolean; guardando: boolean; canales: { wa: boolean; email: boolean };
  flujo: Flujo | null;
  insistir: Extract<Paso, { tipo: 'insistir' }> | null;
  cron: CronAviso | null;
  tz: string | null;
  onCron: (c: CronAviso | null) => void;
  acusesTxt: string;
  onAcuses: (v: string, soloPintar?: boolean) => void;
  onTexto: (v: string) => void;
  onCambio?: () => void;
  onFlujo: (f: Flujo | null) => void;
  onQuitarPaso: (i: number) => void;
  probando: boolean; prueba: string | null; onProbar: () => void;
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
    const prender = () => onFlujo({
      ...base, activo: true,
      pasos: [...base.pasos.filter((p) => p.tipo !== 'insistir'), sanearInsistir({ texto: '', cadaMin: INSISTIR_MIN_MINUTOS, veces: 2 })],
    });
    /**
     * ⚠️ APAGAR ESCRIBE UN FLUJO CON `pasos: []`, NUNCA `null`.
     *
     * El store se HEREDA del dueño entrada por entrada, y `mutar` hace copy-on-write
     * desde lo EFECTIVO: mandar `null` borra la clave propia —que nunca existió— y la
     * lectura vuelve a traer la del dueño, así que el recordatorio reaparece en el
     * mismo frame. Medido: el ws1 tiene `reporte-semanal` con un `insistir` y los ws
     * 3, 4 y 13 lo heredan sin haberlo prendido. Con un objeto explícito, el cliente
     * tiene su propia copia diciendo «acá no hay recordatorio».
     *
     * Y sigue cerrando las insistencias ya abiertas: `setFlujo` lo dispara cuando el
     * flujo pasa de tener `insistir` a no tenerlo (lib/plantillas.ts).
     */
    const apagar = () => onFlujo({ ...base, pasos: base.pasos.filter((p) => p.tipo !== 'insistir') });
    const cambiar = (p: Partial<{ cadaMin: number; veces: number }>) => {
      if (!insistir) return;
      const nuevo = sanearInsistir({ ...insistir, ...p });
      onFlujo({ ...base, pasos: base.pasos.map((x) => (x.tipo === 'insistir' ? nuevo : x)) });
    };

    // El campo se pinta en el frame y se GUARDA al soltar: son palabras separadas por
    // coma, y escribir en la base a mitad de una deja «ok, gr» en la lista del negocio.
    const onAcusesLocal = (v: string) => onAcuses(v, true);
    const recordatorios = (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <label style={rotuloLienzo}>Recordatorios</label>
        <div style={{ display: 'flex', gap: 7, marginBottom: insistir ? 10 : 0 }}>
          <Opcion activa={!insistir} onClick={() => insistir && apagar()} disabled={guardando}>Se manda una vez</Opcion>
          <Opcion activa={!!insistir} onClick={() => !insistir && prender()} disabled={guardando}>Te lo recuerdo</Opcion>
        </div>
        {insistir && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* ⚠️ LA UNIDAD ES UN DESPLEGABLE Y EL DATO SIGUEN SIENDO MINUTOS: el motor
                lee `cada_min` de la fila y el CHECK de la migración es un PISO (>= 30),
                así que día, semana y mes entran sin migración ni campo nuevo. Pedido
                textual: «se debería poder recordar 1 vez al día, a la semana, al mes». */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--dim)', flex: 'none' }}>Cada</span>
              <input type="number" min={1} max={99} value={cadaDeMin(insistir.cadaMin).n} disabled={guardando}
                onChange={(e) => cambiar({ cadaMin: aMinutos(Number(e.target.value), cadaDeMin(insistir.cadaMin).u) })}
                aria-label="Cada cuántos" style={{ ...inpLienzo, width: 62, flex: 'none' }} />
              <Dropdown value={cadaDeMin(insistir.cadaMin).u} width="100%" ariaLabel="Unidad del recordatorio"
                options={UNIDADES_RECORDATORIO.map((x) => ({ value: x.key, label: cadaDeMin(insistir.cadaMin).n === 1 ? x.label : x.plural }))}
                onChange={(v) => cambiar({ cadaMin: aMinutos(cadaDeMin(insistir.cadaMin).n, v as UnidadRecordatorio) })} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--dim)', flex: 'none' }}>Hasta</span>
              <input type="number" min={1} max={INSISTIR_MAX_VECES} value={insistir.veces} disabled={guardando}
                onChange={(e) => cambiar({ veces: Number(e.target.value) })}
                aria-label="Cuántas veces" style={{ ...inpLienzo, width: 62, flex: 'none' }} />
              <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{insistir.veces === 1 ? 'vez' : 'veces'}</span>
            </div>
            {/* Las palabras que lo cortan. El dueño: «se debería poder configurar qué
                palabra hacen que paren los recordatorios, no solo un ok». */}
            <div>
              <label style={rotuloLienzo}>Se corta si alguien escribe</label>
              <input value={acusesTxt} disabled={guardando}
                onChange={(e) => onAcusesLocal(e.target.value)} onBlur={() => onAcuses(acusesTxt)}
                placeholder={ACUSES.slice(0, 4).join(', ')} aria-label="Palabras que cortan los recordatorios"
                style={{ ...inpLienzo, width: '100%', boxSizing: 'border-box' }} />
            </div>
            {!canales.wa && (
              <p style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, margin: 0 }}>
                Los recordatorios salen por WhatsApp, y este mensaje lo tienes apagado ahí.
              </p>
            )}
          </div>
        )}
      </div>
    );

    if (!editable) {
      return (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}><TextoMarcas texto={texto} /></div>
          <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
            Este lo redacta MaKo: informa algo técnico y tiene que decir exactamente lo que pasó.
          </p>
          {recordatorios}
        </>
      );
    }
    return (
      <>
        {/* ⚠️ SE OFRECE SÓLO LO QUE ESTE MENSAJE PUEDE RESOLVER. Un `{{lead_nombre}}`
            en un aviso que no habla de ningún lead sale CRUDO al WhatsApp del cliente:
            el resolvedor deja intacto lo que no sabe, a propósito, y el filtro de acá
            es lo único que evita que llegue ahí. */}
        <EditorMensaje valor={texto} onChange={onTexto} filas={6} disabled={guardando}
          variables={variablesPara({ conLead: base.disparador.tipo === 'evento' })} />
        <button onClick={onProbar} disabled={probando} style={{ ...btnFantasma, marginTop: 10 }}>
          {probando ? 'Escribiendo…' : '✨ Que lo escriba MaKo'}
        </button>
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
        {recordatorios}
      </>
    );
  }

  // Un paso agregado: acción o mensaje al lead.
  if (nodo.tipo === 'accion' || nodo.tipo === 'mensaje-lead') {
    const i = nodo.orden ?? 0;
    const vivos = pasosDibujados(base.pasos);
    const paso = vivos[i];
    const reemplazar = (nuevo: Paso) => onFlujo({ ...base, pasos: base.pasos.map((p) => (p === paso ? nuevo : p)) });
    return (
      <>
        {paso?.tipo === 'accion' && (
          <>
            <label style={rotuloLienzo}>Qué hace</label>
            <Dropdown value={paso.accion} options={ACCIONES}
              onChange={(v) => reemplazar({ ...paso, accion: v as AccionFlujo })}
              width="100%" ariaLabel="Qué hace este paso" />
          </>
        )}
        {paso?.tipo === 'mensaje' && (
          <>
            <label style={rotuloLienzo}>Qué le escribe al lead</label>
            <textarea value={paso.texto} rows={4} disabled={guardando}
              onChange={(e) => reemplazar({ ...paso, texto: e.target.value })}
              style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45 }} />
          </>
        )}
        <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 8, marginBottom: 0 }}>
          {/* No se dispara solo NUNCA: la regla del negocio es que MaKo propone y una
              persona confirma. Decirlo acá evita la sorpresa del primer disparo. */}
          {paso?.tipo === 'mensaje'
            ? 'MaKo te lo propone en el grupo y sale con tu «sí». Nunca se manda solo.'
            : 'MaKo te lo propone en el grupo y se hace con tu «sí».'}
        </p>
        {nodo.advertencia && (
          <p style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, marginTop: 6, marginBottom: 0 }}>{nodo.advertencia}</p>
        )}
        <button onClick={() => onQuitarPaso(i)} disabled={guardando}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: SANS }}>
          Quitar este paso
        </button>
      </>
    );
  }

  return <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>;
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
 * EL CONTROL DEL CRON POR TIEMPO.
 *
 * Un desplegable de unidad y, al lado, SÓLO los campos que esa unidad necesita:
 * una semana pide el día, un mes pide el número, un año pide mes y número, y «cada
 * hora» no pide hora de pared porque ahí no la decide nadie. Dibujar los cinco
 * siempre y desactivar tres es pedirle a la persona que adivine cuáles miran.
 *
 * ⚠️ Y LA FRASE DE ABAJO NOMBRA LA ZONA. Medido el 30/09/2026: de los 10 workspaces
 * activos, SEIS no tienen `mako.timezone` y caen a America/Tijuana. Un «a la mañana»
 * sobre eso es una afirmación que nadie verificó; «9:00 de America/Tijuana» deja que
 * el dueño vea que está mal y lo arregle.
 */
function EditorCron({ cron, tz, disabled, onCron }: {
  cron: CronAviso; tz: string | null; disabled: boolean; onCron: (c: CronAviso | null) => void;
}) {
  const set = (p: Partial<CronAviso>) => { const c = sanearCron({ ...cron, ...p }); if (c) onCron(c); };
  const num = (v: number, min: number, max: number, onSet: (n: number) => void, rotulo: string) => (
    <input type="number" value={v} min={min} max={max} disabled={disabled} aria-label={rotulo}
      onChange={(e) => onSet(Number(e.target.value))}
      style={{ ...inpLienzo, width: 62, flex: 'none' }} />
  );
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--dim)', flex: 'none' }}>Cada</span>
        {num(cron.cada, 1, CADA_MAX, (n) => set({ cada: n }), 'Cada cuántos')}
        <Dropdown value={cron.unidad} width="100%" ariaLabel="Unidad"
          options={UNIDADES.map((u) => ({ value: u.key, label: cron.cada === 1 ? u.label : u.plural }))}
          onChange={(v) => set({ unidad: v as CronAviso['unidad'] })} />
      </div>
      {cron.unidad === 'semana' && (
        <Dropdown value={String(cron.diaSemana ?? 1)} width="100%" ariaLabel="Día de la semana"
          options={DIAS.map((d, i) => ({ value: String(i), label: d }))}
          onChange={(v) => set({ diaSemana: Number(v) })} />
      )}
      {(cron.unidad === 'mes' || cron.unidad === 'anio') && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)', flex: 'none' }}>El día</span>
          {num(cron.diaMes ?? 1, 1, DIA_MES_MAX, (n) => set({ diaMes: n }), 'Día del mes')}
          {cron.unidad === 'anio' && (
            <Dropdown value={String(cron.mes ?? 1)} width="100%" ariaLabel="Mes"
              options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
              onChange={(v) => set({ mes: Number(v) })} />
          )}
        </div>
      )}
      {cron.unidad !== 'hora' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)', flex: 'none' }}>A las</span>
          {num(cron.hora, 0, 23, (n) => set({ hora: n }), 'Hora')}
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>:</span>
          {num(cron.minuto, 0, 59, (n) => set({ minuto: n }), 'Minuto')}
        </div>
      )}
      {/* Y el día 31 no está: no existe en febrero, y saltear el mes o correrlo al 1
          de marzo son dos decisiones que nadie tomó. El tope es 28. */}
      <div style={{ fontSize: 11, color: 'var(--good)', lineHeight: 1.4, fontWeight: 600 }}>{textoCron(cron, tz)}</div>
    </div>
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
type ModoCron = 'tiempo' | 'accion' | null;

function SeccionCron({ base, cron, tz, guardando, onFlujo, onCron }: {
  base: Flujo; cron: CronAviso | null; tz: string | null;
  guardando: boolean; onFlujo: (f: Flujo | null) => void; onCron: (c: CronAviso | null) => void;
}) {
  const evento = base.disparador.tipo === 'evento' ? base.disparador.evento : '';
  const guardado: ModoCron = cron ? 'tiempo' : evento ? 'accion' : null;
  const [intencion, setIntencion] = useState<ModoCron>(null);
  // Sin nada elegido los dos botones están apagados, y eso es cierto para los 65: nadie
  // configuró cuándo sale. Lo que ese estado NO dice es «no sale» — eso lo dice la
  // tarjeta, con el disparador nativo rotulado.
  const modo = intencion ?? guardado;

  /**
   * ⚠️ LOS BOTONES SON DOS Y APAGAN AL VOLVER A APRETARLOS.
   *
   * «Qué es ese botón de "Nada más" no tiene sentido!!! Quitalo... Son 2 botones como
   * te dije, o por tiempo o por acción.» Lo único que ese tercer botón tenía de propio
   * era APAGAR, así que eso pasa al toggle del que está activo: sin él, elegir «Por
   * tiempo» una vez dejaría el mensaje agendado para siempre, sin ninguna salida que
   * no sea apagar el mensaje entero.
   */
  const elegir = (m: ModoCron) => {
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
    if (m === 'tiempo' && !cron) onCron(CRON_DEFAULT);
  };

  return (
    <>
      {/* ⚠️ ACÁ NO VA EL DISPARADOR DEL CATÁLOGO. Esa línea decía «Cron los lunes a la
          mañana» —el campo `disparador`, la descripción de fábrica— arriba de un
          agendado vacío, y se leyó exactamente como lo que parecía: «estás
          PRECONFIGURANDO el cron… cuando JUSTAMENTE lo estamos haciendo editable».
          El hecho no se pierde: lo dice la TARJETA, rotulado «Hoy sale solo». */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([['tiempo', 'Por tiempo'], ['accion', 'Por una acción']] as const).map(([k, txt]) => (
          <button key={k} onClick={() => elegir(k)} disabled={guardando} aria-pressed={modo === k}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11.5, fontWeight: 600, transition: 'background .12s',
              border: `1px solid ${modo === k ? 'var(--primary)' : 'var(--border-strong)'}`,
              background: modo === k ? 'var(--primary)' : 'transparent',
              color: modo === k ? '#fff' : 'var(--dim)',
            }}>{txt}</button>
        ))}
      </div>
      {modo === 'tiempo' && cron && <EditorCron cron={cron} tz={tz} disabled={guardando} onCron={onCron} />}
      {modo === 'accion' && (
        <Dropdown
          value={evento}
          options={EVENTOS.map((e) => ({ value: e.key, label: e.label }))}
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

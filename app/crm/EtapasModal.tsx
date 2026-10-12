'use client';

// =============================================================================
// EtapasModal — el embudo entero se edita SIN salir del CRM
// =============================================================================
// «Quiero eliminar la ruta de funnel, que todo se edite como un pop-up dentro del mismo
// CRM. Así es más simple. Y que sea simple la edición, nada compleja» (28/09/2026).
//
// ⚠️ NO ES `FunnelEditor` ADENTRO DE UN `Modal`. Ese editor eran 527 líneas que dibujaban
// el mapa de transiciones, las plantillas de canal y la tarjeta de entradas, autoguardaban
// el jsonb ENTERO con un debounce por tecla y asumían que eran la pantalla. Se borró el
// 29/09: dos editores del mismo jsonb divergen, y la única pregunta es cuándo.
//
// ⚠️ Y CADA CAMBIO ES UNA OPERACIÓN, no un «Guardar» al final. Al tablero le llegan las
// etapas ya DERIVADAS —el pipeline crudo nunca sale del server— así que mandar una lista
// reconstruida desde acá le haría perder todo lo que la derivación agrega y quita.
//
// ── Lo que cambió con la segunda tanda del 29/09, con el pedido al lado ────────────────
//  · UN solo botón de cerrar (la ✕ de arriba). «Dos botones de cerrar... no entiendo la
//    lógica de eso»: el pie quedó para lo único que va abajo a la izquierda, eliminar.
//  · SIN líneas divisorias. «Quedan mal».
//  · SIN el bloque de las cuatro terminales. «Si quieren cambiar el nombre ya lo pueden
//    hacer en los 3 puntos de la columna».
//  · SIN FRICCIÓN cuando no hay nada que perder. «Si intento eliminar una columna que NO
//    tiene ningún lead, no debería haber nada de fricción. Solo que me salte el pop-up de
//    deshacer». Con leads adentro, ahí sí un diálogo — y un diálogo, no un recuadro abajo.
//  · Las etapas SE ARRASTRAN, con el molde de las filas del plan.
//  · El input del nombre abre SÓLO desde el texto, no desde toda la fila.
//  · «Cómo entran» dejó de ser una subtab: es un desplegable de acá, y una pregunta del
//    alta de producto.

import { Fragment, useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type DragEvent as DragReact } from 'react';
import { useRouter, useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { Modal } from '@/app/_ui/Modal';
import { Confirm } from '@/app/_ui/Confirm';
import { Toast, useToast } from '@/app/_ui/Toast';
import { MAX_LABEL_ETAPA } from '@/lib/pipeline';
import { puedeSerReunion, cambioDeReuniones, reunionSinLugar } from '@/lib/etapa-reunion';
import { puedeTenerPlazo, sanearPlazo, PLAZO_MAX_DIAS } from '@/lib/lead-quieto';
import {
  editarEtapaAction, embudoEnDetalleAction, renombrarEmbudoAction, archivarEmbudoAction,
  restaurarEmbudoAction, extrasDelEmbudoAction,
  type EmbudoEnDetalle, type EtapaDelFunnel, type NutricionDelFunnel, type OpEtapa, type DeshacerEtapa, type ExtrasDelEmbudo,
} from './actions';
import { EmbudoEntradas } from './EmbudoEntradas';
import { CampanasDelProducto } from './CampanasDelProducto';
import { CerrarIcon, LapizIcon } from './iconos';
import { MoverPartido } from './MoverPartido';
import { EditorEtiquetas } from './EditorEtiquetas';

const SANS = "'Geist', sans-serif";

/** La línea de 2 px que dice dónde va a caer la etapa que se está arrastrando. */
const MARCA: CSSProperties = { boxShadow: 'inset 0 2px 0 0 var(--primary)' };
const MARCA_FIN: CSSProperties = { boxShadow: 'inset 0 -2px 0 0 var(--primary)' };

/** El botoncito de una acción por fila. Sin texto: el `aria-label` lleva la frase. */
function AccionFila({ etiqueta, onClick, disabled, children }: {
  etiqueta: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={etiqueta} title={etiqueta} data-nodrag
      style={{
        width: 28, height: 28, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid transparent', background: 'transparent', fontFamily: SANS, fontSize: 13,
        color: disabled ? 'var(--faint)' : 'var(--dim)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
    >{children}</button>
  );
}


/**
 * «Es una reunión», por etapa. Prendido = `kind: 'reunion'` (lib/etapa-reunion.ts): es lo que
 * leen los requisitos de etapa, los dos lugares de fecha del lead y la condición «Asistió / No
 * asistió» del Chatbot. Lo pidió Martín el 09/10/2026: «debería poder seleccionarse qué etapas
 * hacen referencia a una REUNIÓN».
 *
 * La tercera reunión en adelante lleva «Sin fecha»: la tabla `leads` guarda fecha y asistencia
 * de DOS (`slotPorIndice`), y una tercera marcada no tiene dónde. El porqué va en el `title`,
 * no en la pantalla.
 */
function BotonReunion({ etapa, activa, sinLugar, disabled, onClick }: {
  etapa: string; activa: boolean; sinLugar: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <span data-nodrag style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      {activa && sinLugar && (
        <span title="Se guardan la fecha y la asistencia de dos reuniones: esta tercera no tiene dónde."
          style={{ fontFamily: SANS, fontSize: 11, color: 'var(--warn)' }}>Sin fecha</span>
      )}
      <button
        type="button" onClick={onClick} disabled={disabled} aria-pressed={activa}
        title={activa ? `${etapa} es una reunión. Toca para desmarcarla.` : `Marcar ${etapa} como reunión`}
        style={{
          flex: 'none', height: 24, padding: '0 9px', borderRadius: 999, fontFamily: SANS, fontSize: 12, fontWeight: 600,
          border: `1px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`,
          background: activa ? 'var(--primary-weak)' : 'transparent',
          color: activa ? 'var(--primary)' : 'var(--dim)',
          cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
        }}
      >Reunión</button>
    </span>
  );
}

/**
 * El PLAZO de una etapa (#800): si un lead pasa más días que esto ahí, MaKo le avisa al dueño
 * (lib/lead-quieto.ts). Vacío = sin plazo.
 *
 * ⚠️ SE DIBUJA SÓLO CON LO QUE CONTESTÓ EL SERVER (`emb.plazos`), nunca con la semilla del
 * tablero: un «Plazo» vacío pintado antes de saberlo le diría a quien ya puso uno que no tiene.
 *
 * El texto de la pastilla es el dato («5 días»); para qué sirve va en el `title`, no en la
 * pantalla.
 */
function PlazoEtapa({ etapa, dias, disabled, onGuardar }: {
  etapa: string; dias: number | null; disabled?: boolean; onGuardar: (dias: number | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const guardar = (crudo: string) => {
    setEditando(false);
    const limpio = crudo.trim();
    const nuevo = limpio === '' ? null : sanearPlazo(limpio);
    // Un número fuera de rango no borra el plazo que había: se ignora, como un Escape.
    if (limpio !== '' && nuevo == null) return;
    if (nuevo === dias) return;
    onGuardar(nuevo);
  };
  if (editando) {
    return (
      <span data-nodrag style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}>
        <input
          autoFocus type="number" min={1} max={PLAZO_MAX_DIAS} defaultValue={dias ?? ''} aria-label={`Plazo de ${etapa}, en días`}
          onBlur={(ev) => guardar(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
            if (ev.key === 'Escape') setEditando(false);
          }}
          style={{ width: 56, height: 24, fontFamily: SANS, fontSize: 12, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '0 6px', outline: 'none' }}
        />
        <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--dim)' }}>días</span>
      </span>
    );
  }
  const activo = dias != null;
  return (
    <button
      type="button" data-nodrag onClick={() => setEditando(true)} disabled={disabled}
      title={activo
        ? `Si un lead pasa más de ${dias} ${dias === 1 ? 'día' : 'días'} en ${etapa}, MaKo te avisa. Toca para cambiarlo.`
        : `Ponerle un plazo a ${etapa}: si un lead pasa más días ahí, MaKo te avisa.`}
      style={{
        flex: 'none', height: 24, padding: '0 9px', borderRadius: 999, fontFamily: SANS, fontSize: 12, fontWeight: 600,
        border: `1px solid ${activo ? 'var(--primary)' : 'var(--border-strong)'}`,
        background: activo ? 'var(--primary-weak)' : 'transparent',
        color: activo ? 'var(--primary)' : 'var(--dim)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
    >{activo ? `${dias} ${dias === 1 ? 'día' : 'días'}` : 'Plazo'}</button>
  );
}

/** El loader. Nunca la palabra «Cargando…»: un texto no dice que algo está pasando. */
function Cargando() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <span aria-label="Cargando" role="status" style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2.5px solid var(--border)', borderTopColor: 'var(--primary)',
        animation: 'mk-giro .7s linear infinite', display: 'inline-block',
      }} />
      <style>{'@keyframes mk-giro{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

// La tercera, Etiquetas (mig 0224): el CRUD de las etiquetas del CRM vive acá, donde el CRM edita
// sus etapas, porque una etiqueta se VINCULA a una etapa. Son del negocio, no del producto: la
// misma lista desde cualquier producto (app/crm/EditorEtiquetas.tsx).
type Sub = 'etapas' | 'nutricion' | 'etiquetas';

export function EtapasModal({ funnelId, nombre, abrirEntradas, semilla, onCerrar }: {
  /** El embudo que se edita. `null`/`undefined` = el del negocio. */
  funnelId?: number | null;
  /** Cómo se llama, para pintar el título sin esperar la lectura. */
  nombre: string;
  /**
   * Abrir con el desplegable de «Cómo entran» ya desplegado.
   *
   * Lo pide la URL (`?embudo=entradas`) para que un link pueda llevar a una CONFIGURACIÓN
   * y no sólo a una pantalla: el panel de tracking que ve el cliente en su landing dice
   * «activar la landing como entrada de leads», y eso es una casilla de ahí adentro.
   */
  abrirEntradas?: boolean;
  /**
   * Las etapas que el TABLERO ya tiene dibujadas, para pintar la lista sin esperar al
   * server. Sólo viene cuando el pop-up abre sobre el embudo que se está mirando.
   *
   * ⚠️ POR QUÉ, Y ES LA REGLA DE LA CASA: «antes de optimizar una consulta, preguntá si
   * hace falta hacerla». Medido el 29/09 con el navegador, click → primera fila: 941 ms,
   * de los cuales 121 son el montaje y 318 el viaje de la action — para traer una lista
   * que ya estaba en pantalla, arriba, dibujada como columnas del tablero.
   *
   * ⚠️ Y NO REEMPLAZA A LA LECTURA: el server sigue contestando y pisa esto. La semilla
   * dice qué etapas hay; lo que decide si «Eliminar producto» se ofrece, qué nutriciones
   * tiene y por dónde entra la gente llega del server, porque el tablero no lo sabe.
   */
  semilla?: { etapas: EtapaDelFunnel[]; fijas: EtapaDelFunnel[] } | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const ws = useWs();
  const { toast, show, clear } = useToast();
  const [sub, setSub] = useState<Sub>('etapas');
  const [emb, setEmb] = useState<EmbudoEnDetalle | null>(null);
  const [extras, setExtras] = useState<ExtrasDelEmbudo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ titulo: string; cuerpo: string; boton: string; hacer: () => void } | null>(null);
  const [entradasAbierto, setEntradasAbierto] = useState(abrirEntradas === true);
  const [ordenLocal, setOrdenLocal] = useState<EtapaDelFunnel[] | null>(null);
  const [trabajando, startTrabajo] = useTransition();

  const cargar = useCallback(async () => {
    const r = await embudoEnDetalleAction(funnelId ?? undefined);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setEmb(r.embudo);
    setOrdenLocal(null);
  }, [funnelId]);

  useEffect(() => { void cargar(); }, [cargar]);
  // Los conteos, el total y el canal llegan DESPUÉS y no bloquean la apertura: derivar la
  // etapa de un lead exige traerlos todos. Mientras no estén, quitar una etapa pregunta —
  // el default seguro es la fricción.
  useEffect(() => {
    let vivo = true;
    void extrasDelEmbudoAction(funnelId ?? undefined).then((x) => { if (vivo) setExtras(x); }).catch(() => {});
    return () => { vivo = false; };
  }, [funnelId]);

  // El orden que se está arrastrando gana sobre lo del server, y lo del server sobre la
  // semilla. Nunca al revés: la semilla es una foto de cuando se abrió.
  const etapas = ordenLocal ?? emb?.etapas ?? semilla?.etapas ?? [];
  /** ¿Hay algo que listar? Con semilla, sí desde el primer frame. */
  const hayLista = !!emb || !!semilla;
  /**
   * La etapa por donde ENTRA el lead. No se mueve, no se quita, y nada va antes de ella.
   *
   * ⚠️ NO ES «la primera de la lista»: es la que el pipeline declara `kind: 'entrada'`, que es
   * lo que ya distinguían las cinco plantillas. Atarlo a la posición haría que arrastrar
   * otra etapa encima la convirtiera en la entrada sin que nadie lo decida.
   *
   * Y su único control es el LÁPIZ, que abre cómo entra la gente: «desde allí debería
   * salir el desplegable para configurar. Para ello, mejor un botón de lápiz, en lugar de
   * las flechas y la X, ya que no serán necesarios».
   * ⚠️ Y SI NINGUNA LA DECLARA, es la primera. Medido contra la base el 29/09: de los
   * 15 embudos vivos, los 11 con pipeline propio declaran exactamente una entrada y los
   * otros 4 caen al pipeline por defecto, que también la trae. O sea que hoy el respaldo
   * no se usa nunca — y existe igual porque de este lápiz cuelga la ÚNICA pantalla donde
   * se declara cómo entra la gente: un embudo sin entrada no perdería una fila, perdería
   * la puerta.
   */
  const iEntrada = Math.max(0, etapas.findIndex((e) => e.kind === 'entrada'));
  const esEntrada = (e: EtapaDelFunnel) => etapas[iEntrada]?.key === e.key;
  /** Dónde puede caer algo que se arrastra: nunca antes de la entrada. */
  const pisoDelOrden = etapas.length ? iEntrada + 1 : 0;

  const aplicar = (op: OpEtapa, onListo?: (d?: DeshacerEtapa) => void) => {
    startTrabajo(async () => {
      const r = await editarEtapaAction(op, funnelId ?? undefined);
      if (!r.ok) { setError(r.error); setOrdenLocal(null); return; }
      setError(null);
      setRenombrando(null);
      await cargar();
      void extrasDelEmbudoAction(funnelId ?? undefined).then(setExtras).catch(() => {});
      // El tablero de atrás se refresca en CADA cambio: sus columnas se leen en el server,
      // y sin esto quien renombra una etapa y mira detrás del pop-up ve el nombre viejo.
      router.refresh();
      onListo?.(r.deshacer);
    });
  };

  // ── mover una etapa ────────────────────────────────────────────────────────────────
  // ⚠️ OPTIMISTA. Antes cada flecha esperaba al server y recién después repintaba: «cuando
  // muevo de lugar una columna o etapa, se tarda muchísimo». El orden lo pinta el navegador
  // al instante; el server confirma detrás y `cargar()` resincroniza.
  const mover = (key: string, delta: -1 | 1) => {
    const i = etapas.findIndex((e) => e.key === key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= etapas.length) return;
    // Ni se mueve la entrada ni se la pasa por encima.
    if (esEntrada(etapas[i]) || esEntrada(etapas[j])) return;
    const orden = [...etapas];
    [orden[i], orden[j]] = [orden[j], orden[i]];
    setOrdenLocal(orden);
    aplicar({ op: 'mover', key, delta });
  };

  const soltarEn = (key: string, destino: number) => {
    const i = etapas.findIndex((e) => e.key === key);
    if (i < 0) return;
    if (esEntrada(etapas[i])) return;
    const resto = etapas.filter((e) => e.key !== key);
    // El índice se corre uno cuando la etapa venía de más arriba, o soltar hacia abajo
    // cae un lugar antes. Y nunca por encima de la entrada.
    const pos = Math.max(pisoDelOrden, i < destino ? destino - 1 : destino);
    if (pos === i) return;
    const orden = [...resto.slice(0, pos), etapas[i], ...resto.slice(pos)];
    setOrdenLocal(orden);
    aplicar({ op: 'reordenar', keys: orden.map((e) => e.key) });
  };

  // ── el arrastre, con el molde de las filas del plan ────────────────────────────────
  // La foto que sigue al cursor la dibuja el SISTEMA OPERATIVO y ninguna regla CSS la
  // gobierna: se le pasa una VACÍA y la copia la dibujamos nosotros, movida con `transform`
  // sobre un ref (un `setState` por `dragover` redibuja la lista 60 veces por segundo).
  const agarrada = useRef<string | null>(null);
  const copia = useRef<HTMLElement | null>(null);
  const medios = useRef<number[]>([]);
  const lista = useRef<HTMLDivElement | null>(null);
  const [ins, setIns] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  const limpiarDrag = () => {
    setIns(null);
    setArrastrando(null);
    medios.current = [];
    agarrada.current = null;
    copia.current?.remove();
    copia.current = null;
  };

  const agarrar = (e: DragReact<HTMLDivElement>, key: string) => {
    // Donde se escribe texto no arranca el arrastre: ahí arrastrar significa seleccionar.
    if ((e.target as HTMLElement | null)?.closest?.('[data-nodrag]')) { e.preventDefault(); return; }
    const fila = e.currentTarget;
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
    try {
      const vacio = document.createElement('canvas');
      vacio.width = 1; vacio.height = 1;
      e.dataTransfer.setDragImage(vacio, 0, 0);
    } catch { /* si no deja, queda la del navegador */ }

    medios.current = [...(lista.current?.querySelectorAll<HTMLElement>('[data-etapa]') ?? [])]
      .map((f) => { const r = f.getBoundingClientRect(); return r.top + r.height / 2; });

    const r = fila.getBoundingClientRect();
    const clon = fila.cloneNode(true) as HTMLElement;
    Object.assign(clon.style, {
      position: 'fixed', top: '0', left: '0', width: `${r.width}px`, margin: '0',
      background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '10px',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', pointerEvents: 'none', zIndex: '3000',
      transform: `translate3d(${r.left}px, ${r.top}px, 0)`, transition: 'none', opacity: '1',
    });
    document.body.appendChild(clon);
    copia.current = clon;

    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const seguir = (ev: globalThis.DragEvent) => {
      if (!copia.current) { document.removeEventListener('dragover', seguir, true); return; }
      copia.current.style.transform = `translate3d(${ev.clientX - dx}px, ${ev.clientY - dy}px, 0)`;
    };
    document.addEventListener('dragover', seguir, true);
    const fin = () => {
      document.removeEventListener('dragover', seguir, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      copia.current?.remove();
      copia.current = null;
    };
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
    agarrada.current = key;
    // Al nodo ORIGEN no se le toca el TAMAÑO: se marca. Y va en el tick siguiente, porque
    // el navegador saca la foto del arrastre al terminar este handler.
    setTimeout(() => setArrastrando(key), 0);
  };

  const guardarNombreEtapa = (e: EtapaDelFunnel, valor: string) => {
    const limpio = valor.trim();
    // Sin cambio no se escribe: el `onBlur` también salta al apretar Escape.
    if (!limpio || limpio === e.label) { setRenombrando(null); return; }
    aplicar({ op: 'renombrar', key: e.key, label: limpio });
  };

  const guardarNombreEmbudo = (valor: string) => {
    const limpio = valor.trim();
    if (!emb || !limpio || limpio === emb.nombre) return;
    startTrabajo(async () => {
      const r = await renombrarEmbudoAction(funnelId ?? null, limpio);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      await cargar();
      router.refresh();
    });
  };

  /**
   * El plazo de la etapa: un número, null (sin plazo), o undefined = NO SE DIBUJA el campo
   * (el server todavía no contestó, no pudo leerlos, o la etapa no lleva plazo).
   */
  const plazoDe = (e: EtapaDelFunnel): number | null | undefined =>
    emb?.plazos == null || !puedeTenerPlazo(e) ? undefined : (emb.plazos[e.key] ?? null);

  // ── marcar una etapa como reunión ───────────────────────────────────────────────────
  // ⚠️ PREGUNTA SÓLO SI UNA REUNIÓN QUE YA EXISTE CAMBIA DE NÚMERO. La fecha del lead va por
  // ORDEN de las reuniones (lib/etapa-reunion.ts, `cambioDeReuniones`): marcar una etapa que
  // va antes de otra reunión la corre al segundo lugar, y las fechas ya cargadas se verían en
  // otra etapa. Si nada se corre, se marca sin fricción.
  const marcarReunion = (e: EtapaDelFunnel, es: boolean) => {
    const c = cambioDeReuniones(etapas, e.key, es);
    const hacer = () => aplicar({ op: 'reunion', key: e.key, es });
    if (!c.corridas.length) { hacer(); return; }
    setConfirmar({
      titulo: es ? `«${e.label}» es una reunión` : `«${e.label}» deja de ser reunión`,
      cuerpo: `${c.corridas.map((r) => `«${r.label}» pasa a ser la reunión ${r.a}.`).join(' ')} Las fechas ya cargadas van por número: pueden verse en otra etapa.`,
      boton: es ? 'Marcar' : 'Desmarcar',
      hacer,
    });
  };

  // ── quitar una etapa ───────────────────────────────────────────────────────────────
  // ⚠️ SIN FRICCIÓN SI NO HAY NADA QUE PERDER. Con cero leads se quita y sale el toast con
  // «Deshacer» los 5 segundos que dura. Con leads adentro se pregunta, porque ahí el
  // deshacer no alcanza: quedan fuera del embudo mientras tanto.
  const quitarEtapa = (e: EtapaDelFunnel) => {
    const n = extras?.conteos[e.key];
    const hacer = () => aplicar({ op: 'eliminar', key: e.key }, (d) => {
      show(`Quitada «${e.label}»`, d ? () => aplicar({ op: 'insertar', etapa: d.etapa, at: d.at }) : undefined);
    });
    if (n === 0) { hacer(); return; }
    setConfirmar({
      titulo: `Quitar «${e.label}»`,
      cuerpo: n == null
        ? 'No se pudo contar cuántos leads tiene. Los que estén ahí no se borran: quedan fuera del funnel hasta que los muevas.'
        : `Sus ${n} ${n === 1 ? 'lead queda' : 'leads quedan'} fuera del funnel hasta que los muevas. No se borran.`,
      boton: 'Quitar la etapa',
      hacer,
    });
  };

  // ── eliminar el producto ───────────────────────────────────────────────────────────
  const archivar = (conAviso: boolean) => {
    if (funnelId == null || !emb) return;
    startTrabajo(async () => {
      const r = await archivarEmbudoAction(funnelId);
      if (!r.ok) { setError(r.error); return; }
      if (conAviso) {
        onCerrar();
        show(`Eliminado «${emb.nombre}»`, () => {
          void restaurarEmbudoAction(funnelId).then(() => { window.location.href = conWs(`/crm?funnel=${funnelId}`, ws); });
        });
        router.refresh();
        return;
      }
      // ⚠️ NAVEGACIÓN DURA, no `router.refresh()`: lo que cambió no es una fila sino QUÉ
      // EMBUDOS EXISTEN, y medido en el navegador el refresh deja la lista un paso atrás.
      // Y con `conWs`, o el super admin que mira a un cliente termina en su propio CRM.
      window.location.href = conWs('/crm', ws);
    });
  };

  const eliminarProducto = () => {
    if (funnelId == null || !emb) return;
    // Sin leads no hay nada que perder: se elimina y queda el deshacer del toast. Si el
    // conteo todavía no llegó, se pregunta: el default seguro es la fricción.
    if (extras?.leads === 0) { archivar(true); return; }
    setConfirmar({
      titulo: `Eliminar «${emb.nombre}»`,
      cuerpo: extras && extras.leads > 0
        ? `Sus ${extras.leads} ${extras.leads === 1 ? 'lead deja' : 'leads dejan'} de verse hasta que lo recuperes. Se guarda entero y vuelve desde «Funnels eliminados».`
        : 'Se guarda entero y vuelve desde «Funnels eliminados».',
      boton: 'Eliminar el funnel',
      hacer: () => archivar(false),
    });
  };

  /**
   * La CAJA de una etapa: envuelve la fila Y lo que cuelga del lápiz.
   *
   * «Si abro un desplegable, todo lo de abajo lo tiene que englobar el recuadro, sino, no
   * se entiende» (29/09/2026). Antes el fondo y el radio vivían en la fila y el panel
   * colgaba DEBAJO, sin fondo y separado por el `gap: 4` de la lista: dos bloques sueltos.
   */
  const caja: CSSProperties = { borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden' };
  /** La fila va TRANSPARENTE: el fondo lo pone la caja, o volveríamos a tener dos. */
  /**
   * Quitar una nutrición.
   *
   * ⚠️ NO PREGUNTA POR LOS LEADS, a diferencia de quitar una etapa, y no es un descuido:
   * el conteo por etapa sale de `deriveStageKey`, que es un switch cerrado sobre las
   * columnas del lead y **nunca devuelve** `nopaga`, `nocompro` ni `reactivacion` — a esas
   * columnas se llega por `pipeline_stage`. O sea que el contador diría 0 para siempre, y
   * un «¿seguro?» que siempre contesta que no hay nadie es peor que no preguntar: enseña a
   * apretar sin leer. Se deshace con el toast, que acá alcanza porque apagarla no borra
   * leads: los que estén parados ahí se siguen viendo en la primera columna.
   */
  const quitarNutricion = (n: NutricionDelFunnel) => {
    aplicar({ op: 'nutricion', id: n.id, tambien: n.ids, activa: false }, () => {
      show(`Quitada «${n.nombre}»`, () => aplicar({ op: 'nutricion', id: n.id, tambien: n.ids, activa: true }));
    });
  };
  const fila: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px',
  };

  return (
    <>
      <Modal
        titulo={
          // El título es un CAMPO: «Junto con editar el nombre del funnel/producto».
          // Ojo: si el embudo tiene producto principal, esto renombra el PRODUCTO — la
          // pantalla muestra ese nombre, así que tocar el otro no se vería.
          <input
            defaultValue={emb?.nombre ?? nombre}
            key={emb?.nombre ?? nombre}
            maxLength={60}
            aria-label="Nombre del funnel"
            onBlur={(e) => guardarNombreEmbudo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            style={{
              width: '100%', fontFamily: SANS, fontWeight: 600, fontSize: 21, letterSpacing: '-0.01em',
              color: 'var(--ink)', background: 'transparent', border: '1px solid transparent',
              borderRadius: 8, padding: '2px 8px', margin: '0 0 0 -8px', outline: 'none',
            }}
            onFocus={(e) => { e.target.style.background = 'var(--surface-2)'; e.target.style.borderColor = 'var(--primary)'; }}
            onBlurCapture={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
          />
        }
        ancho={760}
        // El alto es un NÚMERO y no un tope: las dos subtabs miden cosas distintas, y una
        // caja que se achica según lo que tenga adentro ya se reportó dos veces.
        alto="min(85vh, 620px)"
        // El cuerpo ya es una lista de filas con su propio fondo: cada filete de la caja
        // es una raya más sobre una pantalla llena de bordes. Se pidió dos veces.
        sinFiletes
        etiqueta={`Editar el funnel ${emb?.nombre ?? nombre}`}
        onCerrar={onCerrar}
        pie={
          // ⚠️ UN SOLO BOTÓN DE CERRAR (la ✕ de arriba). Acá abajo va sólo eliminar, a la
          // izquierda y como TEXTO rojo — no como botón.
          emb && !emb.esDefault && funnelId != null ? (
            <div style={{ flex: 1, display: 'flex' }}>
              <button type="button" onClick={eliminarProducto} disabled={trabajando}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--bad)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: trabajando ? 'default' : 'pointer' }}>
                Eliminar funnel
              </button>
            </div>
          ) : undefined
        }
      >
        {/* Las dos subtabs. Cortadas por PREGUNTA: por dónde pasa un lead, y qué se le
            manda cuando se enfría. */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 999, padding: 3, marginBottom: 18 }}>
          {([['etapas', 'Etapas'], ['nutricion', 'Nutrición'], ['etiquetas', 'Etiquetas']] as Array<[Sub, string]>).map(([k, txt]) => (
            <button key={k} type="button" onClick={() => setSub(k)}
              style={{
                border: 'none', background: sub === k ? 'var(--surface)' : 'transparent',
                color: sub === k ? 'var(--ink)' : 'var(--dim)', fontWeight: sub === k ? 600 : 500,
                fontSize: 13.5, padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS,
                boxShadow: sub === k ? '0 1px 2px rgba(18,21,27,.08)' : 'none',
              }}>{txt}</button>
          ))}
        </div>

        {!hayLista && !error && sub !== 'etiquetas' && <Cargando />}

        {hayLista && sub === 'etapas' && (
          <>
            {/* Los avisos de embudo roto. AVISAN, no bloquean: guardar nunca se bloquea.
                Van arriba porque debajo de la lista ya nadie los lee. */}
            {emb && emb.problemas.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                {emb.problemas.map((t) => (
                  <p key={t} style={{ margin: 0, padding: '9px 12px', borderRadius: 10, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, lineHeight: 1.5 }}>{t}</p>
                ))}
              </div>
            )}

            <div ref={lista} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              onDragOver={(e) => {
                if (!agarrada.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const m = medios.current;
                let idx = m.length;
                for (let i = 0; i < m.length; i++) { if (e.clientY < m[i]) { idx = i; break; } }
                // La marca nunca se dibuja por encima de la entrada: prometer un destino
                // que el drop va a corregir es peor que no dibujarla.
                if (idx < pisoDelOrden) idx = pisoDelOrden;
                // Sólo se repinta cuando el destino CAMBIA: un `setState` por `dragover`
                // redibuja la lista 60 veces por segundo y el gesto se siente roto.
                setIns((p) => (p === idx ? p : idx));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const key = e.dataTransfer.getData('text/plain') || agarrada.current;
                const destino = ins ?? etapas.length;
                limpiarDrag();
                if (key) soltarEn(key, destino);
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIns(null); }}
            >
              {etapas.map((e, i) => (
              <Fragment key={e.key}>
                {/* ⚠️ EL RADIO, EL FONDO, LA MARCA DEL ARRASTRE Y EL BORDE DEL NODO AGARRADO
                    VIVEN ACÁ, en el envoltorio, no en la fila: son lo que hace que la fila y
                    el panel se lean como UNA caja. Si `MARCA_FIN` se quedara en la fila, con
                    el panel abierto la línea de destino se dibujaría en el MEDIO de la caja.

                    ⚠️ Y `data-etapa` / `draggable` se quedan ADENTRO, en la fila: los puntos
                    medios del drop salen de `querySelectorAll('[data-etapa]')` y con el panel
                    abierto el envoltorio mide ~300 px, así que la marca apuntaría a otro
                    lugar. */}
                <div style={{
                  ...caja,
                  // Al nodo ORIGEN no se le toca el tamaño: se marca con un borde.
                  outline: arrastrando === e.key ? '1px solid var(--border-strong)' : 'none',
                  ...(ins === i ? MARCA : ins === i + 1 && i === etapas.length - 1 ? MARCA_FIN : null),
                }}>
                  <div data-etapa draggable={!esEntrada(e)}
                    onDragStart={(ev) => agarrar(ev, e.key)}
                    onDragEnd={limpiarDrag}
                    style={{ ...fila, cursor: esEntrada(e) ? 'default' : 'grab' }}>
                    <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: e.dot }} />
                    {renombrando === e.key ? (
                      <input
                        autoFocus defaultValue={e.label} maxLength={MAX_LABEL_ETAPA} data-nodrag
                        onBlur={(ev) => guardarNombreEtapa(e, ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                          if (ev.key === 'Escape') setRenombrando(null);
                        }}
                        style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', outline: 'none' }}
                      />
                    ) : (
                      // ⚠️ EL INPUT ABRE SÓLO DESDE EL TEXTO: «solo si clickeo en el texto del
                      // título de esa etapa debería abrirme el input, no en toda la fila».
                      // Por eso el botón NO estira: el hueco lo llena un span, que además es
                      // por donde se agarra para arrastrar.
                      <>
                        <button type="button" data-nodrag onClick={() => setRenombrando(e.key)}
                          title={`Cambiar el nombre de ${e.label}`}
                          style={{ flex: 'none', maxWidth: '70%', textAlign: 'left', fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', padding: '4px 0', cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >{e.label}</button>
                        <span style={{ flex: 1 }} />
                      </>
                    )}
                    {/* ⚠️ LA ENTRADA LLEVA LÁPIZ, NO FLECHAS NI ✕: no se mueve, nada va antes,
                        y no se puede quitar —sin ella el embudo no tiene por dónde entrar—.
                        Tres controles apagados dicen lo mismo que uno útil, pero se leen como
                        que la app está rota. El lápiz abre cómo entra la gente.

                        ⚠️ Y CUANDO ESTÁ ABIERTO, EL LÁPIZ ES LA ✕ DE CERRAR: «si le doy al
                        lapiz, debería aparecer una X de cerrar, y si cierro ahí nuevamente el
                        lapiz». No hace falta estado nuevo —el toggle es el mismo
                        `entradasAbierto`—. (Guardar lo cerraba también hasta el 05/10/2026;
                        ya no, porque abajo viven las campañas: ver `onGuardado`.) Y la
                        etiqueta cambia con el ícono: `AccionFila` usa el mismo string para el
                        `aria-label` y el `title`, y una ✕ que dice «Configurar» miente. */}
                    {plazoDe(e) !== undefined && (
                      <PlazoEtapa etapa={e.label} dias={plazoDe(e) ?? null} disabled={trabajando}
                        onGuardar={(dias) => aplicar({ op: 'plazo', key: e.key, dias })} />
                    )}
                    {esEntrada(e) ? (
                      <AccionFila
                        etiqueta={entradasAbierto
                          ? `Cerrar cómo entra la gente a ${e.label}`
                          : `Configurar por dónde entra la gente a ${e.label}`}
                        disabled={trabajando} onClick={() => setEntradasAbierto((v) => !v)}>
                        {entradasAbierto ? <CerrarIcon /> : <LapizIcon />}
                      </AccionFila>
                    ) : (<>
                      {puedeSerReunion(e) && (
                        <BotonReunion etapa={e.label} activa={e.kind === 'reunion'}
                          sinLugar={reunionSinLugar(etapas, e.key)} disabled={trabajando}
                          onClick={() => marcarReunion(e, e.kind !== 'reunion')} />
                      )}
                      {/* Las condiciones son las de siempre: nada sube por encima de la entrada
                          (`pisoDelOrden`) y la última no baja. Lo nuevo es que las dos viven en
                          UN control partido, y que si ninguna sirve no se dibuja nada. */}
                      <MoverPartido label={e.label} trabajando={trabajando}
                        puedeAntes={i > pisoDelOrden} puedeDespues={i !== etapas.length - 1}
                        onAntes={() => mover(e.key, -1)} onDespues={() => mover(e.key, 1)} />
                      <AccionFila etiqueta={`Quitar ${e.label}`} disabled={trabajando}
                        onClick={() => quitarEtapa(e)}><CerrarIcon /></AccionFila>
                    </>)}
                  </div>
                  {/* ⚠️ EL PANEL CUELGA DE SU FILA, no del final de la lista: «desde allí
                      debería salir el desplegable para configurar». Suelto abajo, después de
                      «Agregar etapa», no se entendía de qué etapa hablaba — y se abre desde
                      un lápiz que está cuatro filas más arriba.

                      ⚠️ Y ESPERA AL SERVER, no lo pinta la semilla: el tablero no sabe qué
                      entradas están declaradas, y dibujar las casillas vacías le diría a un
                      negocio que las declaró que no tiene ninguna.

                      ⚠️ LAS DOS RAMAS VAN ADENTRO DE LA CAJA, la del giro incluida: si el
                      `<Cargando />` quedara afuera, la caja se abriría vacía y saltaría cuando
                      llega el server.

                      Y NO LLEVA RÓTULO. Tenía un «Cómo entra tu gente» arriba y Martín lo marcó
                      como informal: el lápiz de esta fila ya dijo de qué se trata, y adentro la
                      primera línea es la regla de la lista. */}
                  {esEntrada(e) && entradasAbierto && !emb && <Cargando />}
                  {esEntrada(e) && entradasAbierto && emb && (
                    <div style={{ padding: '2px 11px 12px' }}>
                      <EmbudoEntradas
                        key={`${emb.id}:${emb.entradas.join(',')}`}
                        initial={emb.entradas} initialEvento={emb.evento} canal={extras?.canal ?? null}
                        funnelId={funnelId ?? undefined}
                        // ⚠️ GUARDAR YA NO CIERRA EL PANEL: desde el 05/10/2026 abajo viven las
                        // campañas, y cerrar al guardar las escondía justo cuando se termina de
                        // contestar lo de arriba. Lo que se pliega es la lista de casillas
                        // (EmbudoEntradas muestra la respuesta y un «Cambiar»).
                        onGuardado={() => { void cargar(); router.refresh(); }}
                      />
                      {/* LAS CAMPAÑAS QUE ENTRAN A ESTE PRODUCTO (05/10/2026). Van en la
                          misma caja que «cómo entra tu gente» porque contestan lo mismo
                          —por dónde llega la gente a ESTE embudo— con un dato más exacto.
                          Cada cambio se guarda solo: no espera al «Guardar» de arriba, que
                          es de las casillas. */}
                      {/* ⚠️ EL PRINCIPAL VA COMO `null`, y no con su id: el selector del
                          tablero abre este pop-up con el id NUMÉRICO del principal, y con
                          ese número el selector no veía sus campañas y no dejaba asignar
                          ninguna (revisión adversarial del 05/10/2026). Es la misma guarda
                          que este modal ya tiene arriba (`!emb.esDefault && funnelId != null`). */}
                      <CampanasDelProducto funnelId={emb.esDefault ? null : emb.id} nombreProducto={emb.nombre} />
                    </div>
                  )}
                </div>
              </Fragment>
              ))}

              {/* «Agregar etapa si le paso el cursor debería reaccionar y al apretarle como
                  mínimo que me pida el nombre de la nueva etapa». */}
              <NuevaEtapa disabled={trabajando} onCrear={(label) => aplicar({ op: 'agregar', label })} />
            </div>
          </>
        )}

        {/* ⚠️ LA SUBTAB DE NUTRICIÓN, con el molde de la de Etapas: una fila por
            nutrición, su ✕ para quitarla y un «Agregar» al pie. Lo que la hace distinta
            es el SEGUNDO RENGLÓN, que es el pedido: «hay que agregarle de qué depende que
            se dispare esa nutrición… la de No show tiene obligatoriamente que el lead
            venga de Agenda R1».

            ⚠️ Y «Sale de X» ES TEXTO, NO UN DESPLEGABLE. Martín dijo «obligatoriamente»:
            de dónde sale una nutrición lo decide la FORMA del recorrido, no una elección.
            Un selector ahí prometería poder cambiar un hecho. Lo que sí es dinámico es el
            NOMBRE: sale de la clave de la etapa, así que renombrar «Agenda R1» a «R1»
            mueve esta lista sola. */}
        {sub === 'nutricion' && !emb && !error && <Cargando />}
        {emb && sub === 'nutricion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {emb.nutriciones.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.55 }}>
                Las nutriciones salen de las etapas. Agrega una reunión o un pago y aparecen solas.
              </p>
            ) : emb.nutriciones.filter((n) => n.activa).map((n) => (
              <div key={n.id} style={fila}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: SANS }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{n.nombre}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
                    Sale de «{n.desdeLabel}» · {n.porque}
                  </span>
                </span>
                {/* ⚠️ SE APAGA LA FILA, NO LA LISTA. `trabajando` es global: deshabilitar
                    todas al tocar una deja la pantalla muerta mientras se guarda. */}
                <AccionFila etiqueta={`Quitar ${n.nombre}`} disabled={trabajando}
                  onClick={() => quitarNutricion(n)}>
                  <CerrarIcon />
                </AccionFila>
              </div>
            ))}

            {/* Lo apagado NO se dibuja en la lista: se ofrece para volver a poner. Una
                casilla desmarcada entre las puestas obliga a leer cinco filas para saber
                cuáles corren. */}
            <NuevaNutricion
              apagadas={emb.nutriciones.filter((n) => !n.activa)}
              disabled={trabajando}
              onPoner={(n) => aplicar({ op: 'nutricion', id: n.id, tambien: n.ids, activa: true })}
            />
          </div>
        )}
        {sub === 'etiquetas' && <EditorEtiquetas />}
        {error && (
          <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{error}</div>
        )}
      </Modal>

      {/* Cuando SÍ hay algo que perder, se pregunta con un DIÁLOGO — no con un recuadro
          abajo, que es lo que se reportó. */}
      {confirmar && (
        <Confirm
          title={confirmar.titulo}
          message={confirmar.cuerpo}
          confirmLabel={confirmar.boton}
          cancelLabel="No, dejarla"
          onCancel={() => setConfirmar(null)}
          onConfirm={() => { const f = confirmar.hacer; setConfirmar(null); f(); }}
        />
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}

/**
 * «+ Agregar etapa»: reacciona al cursor y PIDE el nombre.
 *
 * Antes creaba una «Nueva etapa» sin preguntar y había que renombrarla después — dos pasos
 * para lo que es uno, y mientras tanto una columna con un nombre que no significa nada.
 */
function NuevaEtapa({ disabled, onCrear }: { disabled?: boolean; onCrear: (label: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [hover, setHover] = useState(false);
  const [txt, setTxt] = useState('');

  const cerrar = (guardar: boolean) => {
    const v = txt.trim();
    setTxt('');
    setAbierto(false);
    if (guardar && v) onCrear(v);
  };

  if (abierto) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px', borderRadius: 10, background: 'var(--surface-2)' }}>
        <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: '#5B6472' }} />
        <input
          autoFocus value={txt} maxLength={MAX_LABEL_ETAPA} placeholder="¿Cómo se llama?"
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') cerrar(true);
            if (e.key === 'Escape') cerrar(false);
          }}
          onBlur={() => cerrar(true)}
          style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', outline: 'none' }}
        />
      </div>
    );
  }
  return (
    <button
      type="button" disabled={disabled}
      onClick={() => setAbierto(true)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        marginTop: 2, padding: '10px 12px', borderRadius: 10,
        border: '1px dashed ' + (hover ? 'var(--primary)' : 'var(--border-strong)'),
        background: hover ? 'var(--primary-weak)' : 'none',
        color: hover ? 'var(--primary)' : 'var(--dim)',
        fontFamily: SANS, fontSize: 13.5, fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
        transition: 'background .12s, border-color .12s, color .12s',
      }}
    >
      + Agregar etapa
    </button>
  );
}

/**
 * «Agregar nutrición»: las que el recorrido PERMITE y hoy están apagadas.
 *
 * ⚠️ NO DEJA INVENTAR UNA, y la línea de abajo lo explica en vez de esconderlo. Una
 * nutrición se dispara porque el motor reconoce la etapa donde está el lead, y esas claves
 * son un catálogo cerrado: una nutrición declarada sobre una clave inventada matchearía
 * CERO leads para siempre, sin error y sin log — o sea, una pantalla que promete un mensaje
 * que no sale. Lo que sí destraba crear más es agregar la ETAPA de la que salen, que es lo
 * que dice el texto.
 */
function NuevaNutricion({ apagadas, disabled, onPoner }: {
  apagadas: NutricionDelFunnel[];
  disabled?: boolean;
  onPoner: (n: NutricionDelFunnel) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} disabled={disabled}
        style={{
          marginTop: 6, padding: '10px 12px', borderRadius: 10, textAlign: 'left',
          border: '1px dashed var(--border-strong)', background: 'none', color: 'var(--dim)',
          fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
        }}>
        ＋ Agregar nutrición
      </button>
    );
  }

  return (
    <div style={{ marginTop: 6, padding: '11px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
      {apagadas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {apagadas.map((n) => (
            <button key={n.id} type="button" disabled={disabled}
              onClick={() => { onPoner(n); setAbierto(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)',
                fontFamily: SANS, cursor: disabled ? 'default' : 'pointer',
              }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{n.nombre}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
                Sale de «{n.desdeLabel}» · {n.porque}
              </span>
            </button>
          ))}
        </div>
      )}
      <p style={{ margin: 0, fontFamily: SANS, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>
        Las nutriciones salen de las etapas. Agrega una reunión o un pago en «Etapas» y aparece la suya.
      </p>
      <button type="button" onClick={() => setAbierto(false)}
        style={{ marginTop: 9, background: 'none', border: 'none', padding: 0, color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' }}>
        Cancelar
      </button>
    </div>
  );
}
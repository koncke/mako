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
//    hacer en los 3 puntos de la columna». ⚠️ REVERTIDO el 12/10/2026 (segundo feedback, punto 9):
//    «Pon todas las etapas directamente, incluso ganado y las de descartado... Solo que Ganado y
//    las de descartado no se deberían poder editar mucho». Vuelven, sólo con el nombre (`filaQuieta`).
//  · SIN FRICCIÓN cuando no hay nada que perder. «Si intento eliminar una columna que NO
//    tiene ningún lead, no debería haber nada de fricción. Solo que me salte el pop-up de
//    deshacer». Con leads adentro, ahí sí un diálogo — y un diálogo, no un recuadro abajo.
//  · Las etapas SE ARRASTRAN, con el molde de las filas del plan.
//  · El input del nombre abre SÓLO desde el texto, no desde toda la fila.
//  · «Cómo entran» dejó de ser una subtab: es un desplegable de acá, y una pregunta del
//    alta de producto.
//
// ── Lo que cambió con el feedback del 12/10/2026, con el pedido al lado ──────────────────
//  · SIN SUBTABS. «Elimina las tabs de "Nutrición" y "Etiqueta"... Las etiquetas no se
//    configuran allí, eso en cada lead se le debe poder poner una etiqueta. Y las nutriciones
//    deben tomarse como una etapa más». Queda sólo la lista de etapas, sin fila de pastillas.
//    (El CRUD de etiquetas, app/crm/EditorEtiquetas.tsx, quedó sin pantalla que lo monte;
//    crearlas sigue en «+ Etiqueta» de la ficha del lead.)
//  · EL BOTÓN «Reunión» ES UN DESPLEGABLE DE TIPO: «un desplegable para marcar "Reunión,
//    Nutrición"». Etapa / Reunión / Nutrición, con `conTipo` (lib/etapa-reunion.ts).
//  · SIN «Plazo». «Elimina lo de "Ponerle un plazo", para eso ya tenemos la tab de
//    "Automations"». Lo que quedó del plazo, en la cabecera de lib/lead-quieto-aviso.ts.
//  · (cuarto feedback, misma tarde) EL FUNNEL SE EDITA ARRIBA DE LAS ETAPAS: el tipo de funnel
//    (una opción, se guarda al elegir) y, si es de anuncios, sus campañas de Meta en el paso 2,
//    con una flecha para volver (`SeccionFunnel`). La entrada no lleva lápiz ni «Campañas de
//    Meta». «+ Agregar etapa» va arriba de todo. Sin flechas: cada etapa lleva su ASA y se
//    arrastra; las de nutrición también (entre ellas), se renombran y se quitan TODAS, Manual
//    incluida. Ganado y descartes sin pastilla, con la caja punteada. Borrar es el tacho rojo.
//  · EL NOMBRE DEL FUNNEL SE GUARDA SIEMPRE. «Si lo cambié y cierro la tab, debería
//    cambiarse... Lo que cambio se queda». Se guardaba sólo en el `onBlur`, y cerrar con la ✕,
//    Escape o un clic afuera desmontaba el campo sin que el `blur` llegara.

import { Fragment, useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type DragEvent as DragReact } from 'react';
import { useRouter, useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { Modal } from '@/app/_ui/Modal';
import { Confirm } from '@/app/_ui/Confirm';
import { Toast, useToast } from '@/app/_ui/Toast';
import { Dropdown } from '@/app/components/Dropdown';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { MAX_LABEL_ETAPA, ENTRADAS, TIPOS_FUNNEL, tipoDeFunnel, fechaFijaDelEvento, type EntradaId } from '@/lib/pipeline';
import type { CanalId } from '@/lib/fase-diagnostico';
import { puedeSerReunion, cambioDeReuniones, reunionSinLugar, tipoDeEtapa, tieneEtapaDeReunion, TIPOS_ETAPA, type TipoEtapa } from '@/lib/etapa-reunion';
import {
  editarEtapaAction, embudoEnDetalleAction, renombrarEmbudoAction, archivarEmbudoAction,
  restaurarEmbudoAction, extrasDelEmbudoAction, declararEntradasAction,
  type EmbudoEnDetalle, type EtapaDelFunnel, type OpEtapa, type DeshacerEtapa, type ExtrasDelEmbudo,
} from './actions';
import type { EventoDecl } from './EmbudoEntradas';
import { CampanasModal } from './CampanasModal';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';

const SANS = "'Geist', sans-serif";

/** La línea de 2 px que dice dónde va a caer la etapa que se está arrastrando. */
/**
 * LAS ETAPAS SON TARJETAS (12/10/2026, quinto feedback): «No hagas tan parecido la lista de etapas a la lista
 * de campañas, sino se confunde... tal vez que sean tarjetas más gordas». Fondo blanco, un anillo y una sombra
 * (sin `border`: el anillo no le suma alto a la caja), y más alto que una fila de la tabla de campañas.
 */
const SOMBRA_TARJETA = '0 0 0 1px var(--border-strong), 0 2px 6px rgba(18,21,27,.07)';
// La marca del arrastre SUMA su raya a la sombra: si la pisara, la tarjeta destino perdería el borde.
const MARCA: CSSProperties = { boxShadow: `inset 0 3px 0 0 var(--primary), ${SOMBRA_TARJETA}` };
const MARCA_FIN: CSSProperties = { boxShadow: `inset 0 -3px 0 0 var(--primary), ${SOMBRA_TARJETA}` };

/**
 * El ASA de arrastre al principio de una fila que se puede mover (12/10/2026: «pon al inicio de cada
 * etapa el típico icono de arrastre, para que se entienda que se puede arrastrar»). Reemplaza a las
 * flechas de subir y bajar. Las filas que no se mueven llevan el mismo ancho vacío, para que los
 * puntos de color queden en columna.
 */
function Asa({ quieta = false }: { quieta?: boolean }) {
  if (quieta) return <span aria-hidden style={{ width: 14, flex: 'none' }} />;
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ flex: 'none', color: 'var(--faint)' }}>
      <circle cx="4.5" cy="3" r="1.3" /><circle cx="9.5" cy="3" r="1.3" />
      <circle cx="4.5" cy="7" r="1.3" /><circle cx="9.5" cy="7" r="1.3" />
      <circle cx="4.5" cy="11" r="1.3" /><circle cx="9.5" cy="11" r="1.3" />
    </svg>
  );
}

/** Las dos listas que se arrastran, cada una dentro de sí: las etapas propias y las de nutrición. */
type Grupo = 'propias' | 'nutricion';


/** Cómo se llama y con qué ícono se dibuja cada tipo en el desplegable (un tipo de cosa lleva ícono). */
const TIPO_VISTA: Record<TipoEtapa, { label: string; icono: NombreIconoMenu }> = {
  etapa: { label: 'Etapa', icono: 'etapa' },
  reunion: { label: 'Reunión', icono: 'calendario' },
  nutricion: { label: 'Nutrición', icono: 'repetir' },
};
const OPCIONES_TIPO = TIPOS_ETAPA.map((t) => ({ value: t, label: TIPO_VISTA[t].label, icono: TIPO_VISTA[t].icono }));

/**
 * El TIPO de una etapa: Etapa / Reunión / Nutrición.
 *
 * Era el botón «Reunión» (09/10/2026: «debería poder seleccionarse qué etapas hacen referencia a
 * una REUNIÓN») y desde el 12/10/2026 es un desplegable: «De última, un botón para marcarla como
 * "Nutrición", que sea un desplegable para marcar "Reunión, Nutrición"». Reunión es
 * `kind: 'reunion'` —lo que leen los requisitos de etapa, los dos lugares de fecha del lead y
 * «Asistió / No asistió» de Automations—; Nutrición es una marca aparte que no cambia nada de eso
 * (`conTipo`, lib/etapa-reunion.ts).
 *
 * La tercera reunión en adelante lleva «Sin fecha»: la tabla `leads` guarda fecha y asistencia
 * de DOS (`slotPorIndice`), y una tercera marcada no tiene dónde. El porqué va en el `title`,
 * no en la pantalla.
 */
function SelectorTipo({ etapa, tipo, porNombre, sinLugar, disabled, onElegir }: {
  etapa: string; tipo: TipoEtapa;
  /**
   * Nadie le eligió tipo y su NOMBRE dice reunión («Llamada», «R2»): la ficha la cuenta como
   * reunión para la pestaña «Reuniones» (`tieneEtapaDeReunion`) aunque acá diga «Etapa». Elegir
   * «Etapa» igual se guarda —es decir «no, no es una reunión»—, y el porqué va en el `title`.
   */
  porNombre: boolean;
  sinLugar: boolean; disabled?: boolean; onElegir: (t: TipoEtapa) => void;
}) {
  return (
    <span data-nodrag title={porNombre ? 'Por su nombre, la ficha la cuenta como reunión. Elige «Etapa» si no lo es.' : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      {tipo === 'reunion' && sinLugar && (
        <span title="Se guardan la fecha y la asistencia de dos reuniones: esta tercera no tiene dónde."
          style={{ fontFamily: SANS, fontSize: 11, color: 'var(--warn)' }}>Sin fecha</span>
      )}
      <Dropdown value={tipo} options={OPCIONES_TIPO} search={false} disabled={disabled} width={132}
        ariaLabel={`Tipo de ${etapa}`} align="right"
        buttonStyle={{ height: 28, padding: '0 9px', borderRadius: 999, fontSize: 12.5, gap: 6 }}
        // El desplegable avisa aunque se toque el que ya estaba: el mismo valor no escribe nada,
        // salvo «Etapa» sobre una que cuenta como reunión por el nombre (ver `porNombre`).
        onChange={(v) => { if (v !== tipo || porNombre) onElegir(v as TipoEtapa); }} />
    </span>
  );
}

// ⚠️ ACÁ ESTUVO `PlazoEtapa`, la pastilla «Plazo» de cada etapa (#800), hasta el 12/10/2026:
// «Elimina lo de "Ponerle un plazo", para eso ya tenemos la tab de "Automations"... se configura
// allí, como una automatización que se lo pase a otra etapa». Lo que quedó del plazo (la op
// `plazo` del server, el aviso y los plazos ya guardados), en la cabecera de lib/lead-quieto-aviso.ts.

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

/**
 * El respiro del guardado del nombre del funnel mientras se escribe. No es lo que garantiza que
 * se guarde —eso lo hace cerrar, que manda lo pendiente—: es la red para lo que no pasa por
 * cerrar (cambiar de pestaña, cerrar el navegador). Largo a propósito: el nombre es único por
 * negocio, y guardar cada pausa corta chocaría contra otro funnel a mitad de una palabra.
 */
const RESPIRO_NOMBRE_MS = 1200;

export function EtapasModal({ funnelId, nombre, semilla, onCerrar }: {
  /** El embudo que se edita. `null`/`undefined` = el del negocio. */
  funnelId?: number | null;
  /** Cómo se llama, para pintar el título sin esperar la lectura. */
  nombre: string;
  /**
   * Lo pide la URL (`?embudo=entradas`). Desde el 12/10/2026 el tipo de funnel está siempre a la
   * vista, arriba de las etapas, así que no hay nada que desplegar: se acepta y no hace nada, para
   * que los links que ya salieron (el panel de tracking de la landing) sigan abriendo el pop-up.
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
   * dice qué etapas hay; lo que decide si «Eliminar producto» se ofrece y por dónde entra
   * la gente llega del server, porque el tablero no lo sabe.
   */
  semilla?: { etapas: EtapaDelFunnel[]; fijas: EtapaDelFunnel[]; nutricionEtapas?: EtapaDelFunnel[] } | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const ws = useWs();
  const { toast, show, clear } = useToast();
  const [emb, setEmb] = useState<EmbudoEnDetalle | null>(null);
  const [extras, setExtras] = useState<ExtrasDelEmbudo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ titulo: string; cuerpo: string; boton: string; hacer: () => void } | null>(null);
  const [ordenLocal, setOrdenLocal] = useState<EtapaDelFunnel[] | null>(null);
  /** El orden de las nutriciones que se está arrastrando (optimista, como `ordenLocal`). */
  const [nutriLocal, setNutriLocal] = useState<EtapaDelFunnel[] | null>(null);
  const [trabajando, startTrabajo] = useTransition();

  const cargar = useCallback(async () => {
    const r = await embudoEnDetalleAction(funnelId ?? undefined);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setEmb(r.embudo);
    setOrdenLocal(null);
    setNutriLocal(null);
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
  // Las otras dos familias del tablero (segundo feedback del 12/10/2026, punto 9: «Pon todas las
  // etapas directamente, incluso ganado y las de descartado... Solo que Ganado y las de descartado
  // no se deberían poder editar mucho»). Mismo orden de precedencia que `etapas`.
  const nutricionEtapas = nutriLocal ?? emb?.nutricionEtapas ?? semilla?.nutricionEtapas ?? [];
  const fijas = emb?.fijas ?? semilla?.fijas ?? [];
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
      if (!r.ok) { setError(r.error); setOrdenLocal(null); setNutriLocal(null); return; }
      setError(null);
      setRenombrando(null);
      await cargar();
      void extrasDelEmbudoAction(funnelId ?? undefined).then(setExtras).catch(() => {});
      // El tablero de atrás se refresca en CADA cambio: sus columnas se leen en el server,
      // y sin esto quien renombra una etapa y mira detrás del pop-up ve el nombre viejo.
      router.refresh();
      // ⚠️ SI QUEDÓ REUNIÓN SOLA, SE DICE (punto 13 del 12/10/2026: el nombre «Llamada» o «R2» la
      // marca al crear o renombrar). Un cambio de tipo que nadie eligió no puede pasar callado, y
      // el deshacer la deja como «Etapa» elegida a mano: el nombre ya no la vuelve a marcar.
      const sola = r.reunionSola;
      if (sola) show('Quedó como reunión', () => aplicar({ op: 'tipo', key: sola, tipo: 'etapa' }));
      onListo?.(r.deshacer);
    });
  };

  // ── mover una etapa ────────────────────────────────────────────────────────────────
  // ⚠️ SÓLO ARRASTRANDO desde el 12/10/2026: «En las etapas, elimina los botones de las flechas,
  // pon al inicio de cada etapa el típico icono de arrastre». Y OPTIMISTA, como era la flecha: el
  // orden lo pinta el navegador al instante; el server confirma detrás y `cargar()` resincroniza.
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

  /**
   * Las de NUTRICIÓN también se arrastran (12/10/2026: «Las etapas de nutrición también se deben
   * poder desplazar arrastrando»), entre ellas: su banda es otra columna del tablero, y mezclarlas
   * con el recorrido las convertiría en un paso del pipeline. El orden vive en `data.ordenNutricion`.
   */
  const soltarNutricion = (key: string, destino: number) => {
    const i = nutricionEtapas.findIndex((e) => e.key === key);
    if (i < 0) return;
    const resto = nutricionEtapas.filter((e) => e.key !== key);
    const pos = i < destino ? destino - 1 : destino;
    if (pos === i) return;
    const orden = [...resto.slice(0, pos), nutricionEtapas[i], ...resto.slice(pos)];
    setNutriLocal(orden);
    aplicar({ op: 'ordenNutricion', keys: orden.map((e) => e.key) });
  };

  // ── el arrastre, con el molde de las filas del plan ────────────────────────────────
  // La foto que sigue al cursor la dibuja el SISTEMA OPERATIVO y ninguna regla CSS la
  // gobierna: se le pasa una VACÍA y la copia la dibujamos nosotros, movida con `transform`
  // sobre un ref (un `setState` por `dragover` redibuja la lista 60 veces por segundo).
  const agarrada = useRef<string | null>(null);
  /** De qué lista es lo que se agarró: cada una se reordena sólo dentro de sí. */
  const grupoAgarrado = useRef<Grupo | null>(null);
  const copia = useRef<HTMLElement | null>(null);
  const medios = useRef<number[]>([]);
  const lista = useRef<HTMLDivElement | null>(null);
  const [ins, setIns] = useState<{ g: Grupo; i: number } | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  const limpiarDrag = () => {
    setIns(null);
    setArrastrando(null);
    medios.current = [];
    agarrada.current = null;
    grupoAgarrado.current = null;
    copia.current?.remove();
    copia.current = null;
  };

  const agarrar = (e: DragReact<HTMLDivElement>, key: string, grupo: Grupo) => {
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

    medios.current = [...(lista.current?.querySelectorAll<HTMLElement>(`[data-etapa="${grupo}"]`) ?? [])]
      .map((f) => { const r = f.getBoundingClientRect(); return r.top + r.height / 2; });
    grupoAgarrado.current = grupo;

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

  // ── el nombre del funnel (punto 1 del feedback del 12/10/2026) ──────────────────────────
  // «Si lo cambié y cierro la tab, debería cambiarse. Porque hoy en día tengo que darle un click
  // afuera del modal de escribir pero dentro del modal, es contraintuitivo. Lo que cambio se
  // queda.» Se guardaba sólo en el `onBlur` del título, y cerrar con la ✕, con Escape o con un
  // clic afuera desmonta el campo: el `blur` no llega y lo escrito se perdía.
  //
  // Ahora lo escrito se guarda POR TRES CAMINOS, y cualquiera alcanza: al cerrar (`cerrar`
  // manda lo pendiente antes de irse), al salir del campo, y con un respiro mientras se escribe
  // (la red para lo que no pasa por cerrar: cambiar de pestaña o cerrar el navegador).
  //
  // ⚠️ TODO VIVE EN REFS Y `cerrar` TIENE IDENTIDAD FIJA, y no es prolijidad: el efecto de foco
  // de `Modal` depende de `onCerrar`, y con una flecha nueva por render (el campo ahora es
  // controlado: un render por tecla) devolvería el foco atrás con cada letra — la regla de
  // AGENTS.md «Todo `<Modal>` recibe un `onCerrar` de identidad FIJA».
  const [nombreTxt, setNombreTxt] = useState<string | null>(null);
  const nombreRef = useRef({
    /** Lo que el server tiene (o lo último que se le mandó): contra esto se decide si escribir. */
    base: nombre,
    /** Lo escrito que todavía no salió. */
    pendiente: null as string | null,
    reloj: null as ReturnType<typeof setTimeout> | null,
    /** Se guardó un nombre y el tablero de atrás todavía no se refrescó. */
    sucio: false,
    /** El pop-up ya se cerró: lo que conteste el server no tiene dónde dibujarse. */
    cerrado: false,
  });
  const ctx = useRef({ router, funnelId, onCerrar, setError });
  useEffect(() => { ctx.current = { router, funnelId, onCerrar, setError }; });
  // Mientras nadie escribió, la base es lo que contestó el server.
  useEffect(() => { if (emb && nombreTxt == null) nombreRef.current.base = emb.nombre; }, [emb, nombreTxt]);

  /**
   * Guarda el nombre. `refrescar`: al terminar, el tablero de atrás se vuelve a leer. Con el
   * respiro mientras se escribe va en false —un render del tablero entero por pausa— y queda
   * `sucio` para el próximo `soltarNombre`; ya cerrado el pop-up, se refresca siempre.
   */
  const mandarNombre = useCallback((valor: string, refrescar: boolean) => {
    const n = nombreRef.current;
    const limpio = valor.trim().replace(/\s+/g, ' ');
    // Vacío no se guarda (un funnel necesita nombre) y lo mismo tampoco.
    if (!limpio || limpio === n.base) return;
    const previo = n.base;
    n.base = limpio;
    void renombrarEmbudoAction(ctx.current.funnelId ?? null, limpio)
      .then((r) => {
        if (!r.ok) { n.base = previo; if (!n.cerrado) ctx.current.setError(r.error); return; }
        if (!n.cerrado) ctx.current.setError(null);
        if (refrescar || n.cerrado) { n.sucio = false; ctx.current.router.refresh(); } else n.sucio = true;
      })
      .catch(() => { n.base = previo; });
  }, []);

  /** Manda YA lo pendiente (al salir del campo, al cerrar, al esconder la pestaña). */
  const soltarNombre = useCallback(() => {
    const n = nombreRef.current;
    if (n.reloj) { clearTimeout(n.reloj); n.reloj = null; }
    const v = n.pendiente;
    n.pendiente = null;
    if (v != null) mandarNombre(v, true);
    // Lo que ya había guardado el respiro y el tablero todavía no vio.
    if (n.sucio) { n.sucio = false; ctx.current.router.refresh(); }
  }, [mandarNombre]);

  const escribirNombre = (v: string) => {
    setNombreTxt(v);
    const n = nombreRef.current;
    n.pendiente = v;
    if (n.reloj) clearTimeout(n.reloj);
    n.reloj = setTimeout(() => {
      n.reloj = null;
      const p = n.pendiente;
      n.pendiente = null;
      if (p != null) mandarNombre(p, false);
    }, RESPIRO_NOMBRE_MS);
  };

  /** Cerrar (la ✕, Escape, un clic afuera): primero sale lo escrito. */
  const cerrar = useCallback(() => {
    nombreRef.current.cerrado = true;
    soltarNombre();
    ctx.current.onCerrar();
  }, [soltarNombre]);

  // Y si el pop-up se desmonta por otro camino (eliminar el funnel, el tablero que lo cierra),
  // tampoco se pierde. `cerrado` vuelve a false al montar: el doble montaje de desarrollo lo
  // dejaría puesto y los errores dejarían de verse.
  useEffect(() => {
    const n = nombreRef.current;
    n.cerrado = false;
    const alOcultar = () => { if (document.visibilityState === 'hidden') soltarNombre(); };
    document.addEventListener('visibilitychange', alOcultar);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      n.cerrado = true;
      soltarNombre();
    };
  }, [soltarNombre]);

  // ── el TIPO de una etapa: Etapa / Reunión / Nutrición ────────────────────────────────
  // ⚠️ PREGUNTA SÓLO SI UNA REUNIÓN QUE YA EXISTE CAMBIA DE NÚMERO. La fecha del lead va por
  // ORDEN de las reuniones (lib/etapa-reunion.ts, `cambioDeReuniones`): marcar una etapa que
  // va antes de otra reunión la corre al segundo lugar, y las fechas ya cargadas se verían en
  // otra etapa. Pasar de Reunión a Nutrición o a Etapa la desmarca, y eso también corre a las
  // de después. Entre Etapa y Nutrición no cambia ninguna reunión: se guarda sin fricción.
  const elegirTipo = (e: EtapaDelFunnel, tipo: TipoEtapa) => {
    const es = tipo === 'reunion';
    const c = cambioDeReuniones(etapas, e.key, es);
    const hacer = () => aplicar({ op: 'tipo', key: e.key, tipo });
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

  // ── quitar una nutrición ─────────────────────────────────────────────────────────────
  // Una columna de nutrición NO es una etapa del pipeline: la deriva el recorrido. Quitarla es
  // APAGAR todo lo que llega a ella —la op `quitarNutricion`, por CLAVE: el server decide qué
  // transiciones son (`idsParaQuitarNutricion`)— y el deshacer la vuelve a poner. Desde el 12/10/2026
  // vale para TODAS, «Nutrición - Manual» y «Reunión excepcional» incluidas: «Todas las etapas de
  // nutrición se deben poder editar, incluso si las quiero eliminar todas». Con leads adentro
  // pregunta, igual que quitar una etapa: el default seguro es la fricción.
  const quitarNutricion = (e: EtapaDelFunnel) => {
    const hacer = () => aplicar({ op: 'quitarNutricion', key: e.key }, () => {
      show(`Quitada «${e.label}»`, () => aplicar({ op: 'ponerNutricion', key: e.key }));
    });
    const n = extras?.conteos[e.key];
    if (n === 0) { hacer(); return; }
    setConfirmar({
      titulo: `Quitar «${e.label}»`,
      cuerpo: n == null
        ? 'No se pudo contar cuántos leads tiene. Los que estén ahí no se borran: quedan fuera del funnel hasta que los muevas.'
        : `Sus ${n} ${n === 1 ? 'lead queda' : 'leads quedan'} fuera del funnel hasta que los muevas. No se borran.`,
      boton: 'Quitar la nutrición',
      hacer,
    });
  };

  /** El nombre de una etapa: un clic en el TEXTO lo vuelve un campo (nunca toda la fila). */
  const nombreEditable = (e: EtapaDelFunnel) => (renombrando === e.key ? (
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
    // ⚠️ EL INPUT ABRE SÓLO DESDE EL TEXTO: «solo si clickeo en el texto del título de esa etapa
    // debería abrirme el input, no en toda la fila». El hueco lo llena un span, que además es por
    // donde se agarra para arrastrar.
    <>
      <button type="button" data-nodrag onClick={() => setRenombrando(e.key)}
        title={`Cambiar el nombre de ${e.label}`}
        style={{ flex: 'none', maxWidth: '70%', textAlign: 'left', fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', padding: '4px 0', cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >{e.label}</button>
      <span style={{ flex: 1 }} />
    </>
  ));

  /** El tacho ROJO de la casa (AGENTS.md: «Borrar es UN tacho, rojo»), que no arranca un arrastre. */
  const tacho = (e: EtapaDelFunnel, quitar: () => void) => (
    <span data-nodrag style={{ display: 'inline-flex', flex: 'none' }}>
      <BotonBorrar talla="sm" title={`Quitar ${e.label}`} disabled={trabajando} onClick={quitar} />
    </span>
  );

  /** La marca de destino de un arrastre sobre la fila `i` de la lista `g` (de largo `n`). */
  const marcaDe = (g: Grupo, i: number, n: number): CSSProperties | null =>
    ins?.g !== g ? null : ins.i === i ? MARCA : ins.i === i + 1 && i === n - 1 ? MARCA_FIN : null;

  /**
   * Ganado y las tres de descarte: sólo el NOMBRE se cambia («no se deberían poder editar mucho»), y
   * desde el 12/10/2026 sin la pastilla «Ganado»/«Descartado»: «Elimina los chips de "Ganado y
   * descartado"… que esas etapas simplemente no tengan nada, pero quiero que el contenedor se
   * diferencie». La caja va sin relleno y con el borde punteado: se lee como «esto no se mueve».
   */
  const filaFija = (e: EtapaDelFunnel) => (
    <div key={e.key} style={{ ...caja, background: 'transparent', boxShadow: 'none', border: '1px dashed var(--border-strong)' }}>
      <div style={{ ...fila }}>
        <Asa quieta />
        <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: e.dot }} />
        {nombreEditable(e)}
      </div>
    </div>
  );

  /**
   * Una etapa de NUTRICIÓN, editable como cualquier otra (12/10/2026): se arrastra entre las de su
   * banda, se renombra con un clic en el nombre y se quita con el tacho. La pastilla dice que es una
   * nutrición: su tipo lo decide el recorrido, no se elige.
   */
  const filaNutricion = (e: EtapaDelFunnel, i: number) => (
    <div key={e.key} style={{
      ...caja,
      outline: arrastrando === e.key ? '1px solid var(--border-strong)' : 'none',
      ...marcaDe('nutricion', i, nutricionEtapas.length),
    }}>
      <div data-etapa="nutricion" draggable
        onDragStart={(ev) => agarrar(ev, e.key, 'nutricion')}
        onDragEnd={limpiarDrag}
        style={{ ...fila, cursor: 'grab' }}>
        <Asa />
        <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: e.dot }} />
        {nombreEditable(e)}
        <span title="Esta etapa la arma el recorrido"
          style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 11px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}>
          <IconoMenu nombre="repetir" size={13} />
          Nutrición
        </span>
        {tacho(e, () => quitarNutricion(e))}
      </div>
    </div>
  );

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
  const caja: CSSProperties = { borderRadius: 12, background: 'var(--surface)', boxShadow: SOMBRA_TARJETA, overflow: 'hidden' };
  /** La fila va TRANSPARENTE: el fondo lo pone la caja, o volveríamos a tener dos. */
  const fila: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, minHeight: 34, padding: '12px 12px 12px 12px',
  };

  return (
    <>
      <Modal
        titulo={
          // El título es un CAMPO: «Junto con editar el nombre del funnel/producto».
          // Ojo: si el embudo tiene producto principal, esto renombra el PRODUCTO — la
          // pantalla muestra ese nombre, así que tocar el otro no se vería.
          // ⚠️ CONTROLADO, no `defaultValue` + `key`: con la `key` atada al nombre del server, el
          // campo se remontaba al llegar la lectura y se llevaba lo que se estaba escribiendo.
          <input
            value={nombreTxt ?? emb?.nombre ?? nombre}
            maxLength={60}
            aria-label="Nombre del funnel"
            onChange={(e) => escribirNombre(e.target.value)}
            onBlur={(e) => {
              soltarNombre();
              // Vacío no se guarda: el campo vuelve a mostrar el nombre que tiene.
              if (!e.target.value.trim()) setNombreTxt(nombreRef.current.base);
            }}
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
        ancho={860}
        // El alto es un NÚMERO y no un tope: abrir «cómo entra la gente» cambia lo que hay
        // adentro, y una caja que se achica según lo que tenga ya se reportó dos veces.
        alto="min(88vh, 760px)"
        // El cuerpo ya es una lista de filas con su propio fondo: cada filete de la caja
        // es una raya más sobre una pantalla llena de bordes. Se pidió dos veces.
        sinFiletes
        etiqueta={`Editar el funnel ${emb?.nombre ?? nombre}`}
        // `cerrar` y no `onCerrar`: manda primero el nombre que se estaba escribiendo.
        onCerrar={cerrar}
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
        {/* ⚠️ SIN FILA DE SUBTABS (12/10/2026): «Elimina las tabs de "Nutrición" y
            "Etiqueta"». Con una sola, la fila de pastillas no elige nada. */}
        {!hayLista && !error && <Cargando />}

        {hayLista && (
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

            {/* ⚠️ EL FUNNEL SE EDITA ARRIBA DE LAS ETAPAS (12/10/2026): «Quiero que elimines el botón de
                "editar" de lead entrante, que toda la sección de edición del funnel se haga arriba de las
                etapas». Antes colgaba del lápiz de la etapa de entrada, con «Campañas de Meta» al lado.
                Espera al server: el tablero no sabe qué tipo está declarado, y pintar uno vacío le diría
                a un negocio que lo declaró que no eligió nada. */}
            {!emb ? <Cargando /> : (
              <SeccionFunnel
                key={emb.id ?? 'principal'}
                entradas={emb.entradas} evento={emb.evento} canal={extras?.canal ?? null}
                funnelId={funnelId ?? undefined}
                // El principal va como `null`, igual que desde el tablero (ver CrmBoard).
                funnelIdCampanas={emb.esDefault || funnelId == null ? null : funnelId}
                nombreProducto={emb.nombre}
                onGuardado={() => { void cargar(); router.refresh(); }}
              />
            )}

            <div ref={lista} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              onDragOver={(e) => {
                const g = grupoAgarrado.current;
                if (!agarrada.current || !g) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const m = medios.current;
                let idx = m.length;
                for (let i = 0; i < m.length; i++) { if (e.clientY < m[i]) { idx = i; break; } }
                // La marca nunca se dibuja por encima de la entrada: prometer un destino
                // que el drop va a corregir es peor que no dibujarla.
                if (g === 'propias' && idx < pisoDelOrden) idx = pisoDelOrden;
                // Sólo se repinta cuando el destino CAMBIA: un `setState` por `dragover`
                // redibuja la lista 60 veces por segundo y el gesto se siente roto.
                setIns((p) => (p && p.g === g && p.i === idx ? p : { g, i: idx }));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const key = e.dataTransfer.getData('text/plain') || agarrada.current;
                const g = grupoAgarrado.current;
                const destino = ins?.g === g && ins ? ins.i : (g === 'nutricion' ? nutricionEtapas.length : etapas.length);
                limpiarDrag();
                if (!key) return;
                if (g === 'nutricion') soltarNutricion(key, destino);
                else soltarEn(key, destino);
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIns(null); }}
            >
              {/* «+ Agregar etapa» ARRIBA DE TODO (12/10/2026): «El botón de agregar etapa no puede quedar
                  ahí en el medio, eso está muy mal... Ponlo arriba del todo, arriba de lead entrante».
                  La etapa nueva entra justo DESPUÉS de la entrada (`despuesDe`), que es lo más cerca del
                  botón que puede ir: nada va antes de la entrada. */}
              <NuevaEtapa disabled={trabajando}
                onCrear={(label) => aplicar({ op: 'agregar', label, ...(etapas[iEntrada] ? { despuesDe: etapas[iEntrada].key } : null) })} />

              {etapas.map((e, i) => (
              <Fragment key={e.key}>
                {/* ⚠️ EL RADIO, EL FONDO, LA MARCA DEL ARRASTRE Y EL BORDE DEL NODO AGARRADO VIVEN
                    ACÁ, en el envoltorio. Y `data-etapa` / `draggable` se quedan ADENTRO, en la fila:
                    los puntos medios del drop salen de `querySelectorAll('[data-etapa="propias"]')`. */}
                <div style={{
                  ...caja,
                  // Al nodo ORIGEN no se le toca el tamaño: se marca con un borde.
                  outline: arrastrando === e.key ? '1px solid var(--border-strong)' : 'none',
                  ...marcaDe('propias', i, etapas.length),
                }}>
                  <div data-etapa="propias" draggable={!esEntrada(e)}
                    onDragStart={(ev) => agarrar(ev, e.key, 'propias')}
                    onDragEnd={limpiarDrag}
                    style={{ ...fila, cursor: esEntrada(e) ? 'default' : 'grab' }}>
                    {/* La entrada no se mueve: sin asa, con su mismo ancho. */}
                    <Asa quieta={esEntrada(e)} />
                    <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: e.dot }} />
                    {nombreEditable(e)}
                    {/* ⚠️ LA ENTRADA YA NO LLEVA NADA a la derecha (12/10/2026): ni el lápiz ni
                        «Campañas de Meta» — el tipo de funnel y sus campañas viven arriba. No se mueve
                        y no se quita: sin ella el embudo no tiene por dónde entrar. */}
                    {!esEntrada(e) && (<>
                      {/* Sólo las que pueden ser reunión tienen tipo: la entrada, el pago y el
                          cierre ya tienen el suyo (`puedeSerReunion`, y la action lo repite). */}
                      {puedeSerReunion(e) && (
                        <SelectorTipo etapa={e.label} tipo={tipoDeEtapa(e)}
                          porNombre={!e.marcadaComo && tipoDeEtapa(e) === 'etapa' && tieneEtapaDeReunion([e])}
                          sinLugar={reunionSinLugar(etapas, e.key)} disabled={trabajando}
                          onElegir={(t) => elegirTipo(e, t)} />
                      )}
                      {tacho(e, () => quitarEtapa(e))}
                    </>)}
                  </div>
                </div>
              </Fragment>
              ))}

              {/* LAS OTRAS ETAPAS DEL TABLERO, EN LA MISMA LISTA Y EN EL ORDEN DEL TABLERO: el recorrido
                  termina en Ganado, después la banda Nutrición y al final las de descarte (tercer feedback
                  del 12/10/2026, punto 1: «No separes las secciones en 2 partes»). Ganado y las de descarte
                  sólo cambian de nombre y no se arrastran (sin `data-etapa`); las de nutrición se
                  arrastran entre ellas, se renombran y se quitan. */}
              {fijas.filter((e) => e.key === 'ganado').map((e) => filaFija(e))}
              {nutricionEtapas.map((e, i) => filaNutricion(e, i))}
              {fijas.filter((e) => e.key !== 'ganado').map((e) => filaFija(e))}
            </div>
          </>
        )}

        {/* ⚠️ ACÁ ESTUVIERON LAS SUBTABS «Nutrición» (las nutriciones que deriva el recorrido,
            con su ✕ y su «Agregar») y «Etiquetas» (el CRUD de app/crm/EditorEtiquetas.tsx)
            hasta el 12/10/2026: «Elimina las tabs de "Nutrición" y "Etiqueta"». Una nutrición
            ahora se MARCA en la etapa (el desplegable de tipo). Las columnas de nutrición que el
            recorrido deriva volvieron a la lista el mismo día (punto 9 del segundo feedback), con
            su ✕ por la op `nutricion` (`quitarNutricion`). */}
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

/** El ícono de cada tipo de funnel (cada opción lleva el suyo: AGENTS.md, «íconos en los desplegables»). */
const ICONO_TIPO: Record<(typeof TIPOS_FUNNEL)[number]['id'], NombreIconoMenu> = {
  anuncios_landing: 'web',
  anuncios_whatsapp: 'whatsapp',
  prospeccion: 'enviar',
  anuncios_carrito: 'dinero',
  anuncios_formulario: 'nota',
};

const DIAS_EVENTO = [
  { n: 1, l: 'L' }, { n: 2, l: 'M' }, { n: 3, l: 'X' }, { n: 4, l: 'J' },
  { n: 5, l: 'V' }, { n: 6, l: 'S' }, { n: 0, l: 'D' },
];

/**
 * El TIPO DE FUNNEL y sus campañas, arriba de las etapas (12/10/2026). Reemplaza al formulario
 * «Marca hasta tres» que colgaba del lápiz de la entrada. Lo pedido, punto por punto:
 *  · «que solo se pueda elegir 1 opción», «Elimina los subtitulos», «elimina el texto "Marca hasta
 *    tres."» → una fila de opciones (`TIPOS_FUNNEL`, lib/pipeline.ts), sin glosa;
 *  · «elimina los botones de "guardar y dejar como estaba" cuando el usuario clickea en algo ya se
 *    guarda automáticamente» → elegir guarda en el acto (optimista; si el server dice que no,
 *    vuelve a lo de antes y lo dice);
 *  · «al clickear una opción de anuncios, ahí se ponga por defecto abierta el modal de "Campañas de
 *    Meta" en donde estaba el form del tipo de funnel... Si quiero cambiar de funnel una flechita
 *    para ir al paso de atrás» → dos pasos en la misma caja, con la flecha;
 *  · «Solo el funnel "prospección" no debería tener la opción de "Campañas de Meta" por ningún lado».
 *
 * ⚠️ El tipo se guarda como la ENTRADA de siempre (`declararEntradasAction`), así que lo siguen
 * leyendo los audios, el ensayo, las secuencias y el opt-in de la landing. Y lo ya declarado que no
 * es un tipo (p. ej. «Agendan llamada») se MUESTRA elegido hasta que alguien elija otro: esconderlo
 * no es lo mismo que no ofrecerlo, y hidratar no escribe.
 */
function SeccionFunnel({ entradas, evento, canal, funnelId, funnelIdCampanas, nombreProducto, onGuardado }: {
  entradas: EntradaId[];
  evento: EventoDecl | null;
  canal: CanalId | null;
  /** Cuál embudo declara esto. `undefined` = el del NEGOCIO. */
  funnelId?: number;
  /** El mismo embudo para las campañas, con el principal como `null` (ver `destino` en campanas-actions.ts). */
  funnelIdCampanas: number | null;
  nombreProducto: string;
  onGuardado: () => void;
}) {
  const [sel, setSel] = useState<EntradaId[]>(entradas);
  const tipo = tipoDeFunnel(sel);
  const [paso, setPaso] = useState<'tipo' | 'campanas'>(tipo?.anuncios ? 'campanas' : 'tipo');
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // El encuentro de fecha fija (un taller todos los miércoles) sólo se pregunta donde la fecha la
  // pone el NEGOCIO; se guarda al salir de cada campo, con el tipo que esté elegido.
  const pideEvento = fechaFijaDelEvento(canal);
  const [lugar, setLugar] = useState(evento?.lugar ?? '');
  const [dias, setDias] = useState<number[]>(evento?.dias ?? []);
  const [hora, setHora] = useState(evento?.hora ?? '');
  const [cupo, setCupo] = useState(evento?.cupo != null ? String(evento.cupo) : '');
  const eventoDe = (o?: { dias?: number[] }) => (pideEvento
    ? { lugar: lugar.trim() || null, dias: o?.dias ?? dias, hora: hora.trim() || null, tz: null, cupo: cupo.trim() ? Number(cupo) : null }
    : null);

  async function guardar(nuevas: EntradaId[], ev: ReturnType<typeof eventoDe>, antes: EntradaId[]): Promise<boolean> {
    setErr(null); setGuardando(true);
    try {
      const r = await declararEntradasAction(nuevas, ev, funnelId);
      if (!r.ok) { setSel(antes); setErr(r.error); return false; }
      onGuardado();
      return true;
    } catch (e) {
      setSel(antes); setErr(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function elegir(t: (typeof TIPOS_FUNNEL)[number]) {
    if (guardando) return;
    // El que ya está: con anuncios, vuelve a sus campañas; sin anuncios, no hay nada que hacer.
    if (tipo?.id === t.id) { if (t.anuncios) setPaso('campanas'); return; }
    const antes = sel;
    setSel([t.entrada]);
    if (await guardar([t.entrada], eventoDe(), antes) && t.anuncios) setPaso('campanas');
  }

  /** Guardar el evento (al salir de un campo): sólo si ya hay un tipo, que es lo que lleva. */
  const guardarEvento = (o?: { dias?: number[] }) => { if (sel.length && !guardando) void guardar(sel, eventoDe(o), sel); };

  const caja: CSSProperties = { borderRadius: 12, background: 'var(--surface-2)', padding: 12, marginBottom: 12 };

  if (paso === 'campanas' && tipo?.anuncios) {
    return (
      <div style={caja}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button type="button" onClick={() => setPaso('tipo')} aria-label="Cambiar el tipo de funnel" title="Cambiar el tipo de funnel"
            style={{ width: 30, height: 30, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer' }}>
            <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <IconoMenu nombre={ICONO_TIPO[tipo.id]} size={15} />
          <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{tipo.label}</span>
        </div>
        <CampanasModal enLinea funnelId={funnelIdCampanas} nombreProducto={nombreProducto} />
      </div>
    );
  }

  // Lo ya declarado que no es un tipo se muestra ELEGIDO, al final (la regla del `<select>`).
  const fuera = tipo ? [] : sel.filter((x) => !TIPOS_FUNNEL.some((t) => t.entrada === x));
  const pastilla = (on: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 13px', borderRadius: 999,
    fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: guardando ? 'default' : 'pointer',
    border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border-strong)'),
    background: on ? 'var(--primary-weak)' : 'var(--surface)',
    color: on ? 'var(--primary)' : 'var(--ink)',
  });

  return (
    <div style={caja}>
      <span style={{ display: 'block', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', marginBottom: 8 }}>Tipo de funnel</span>
      <div role="radiogroup" aria-label="Tipo de funnel" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TIPOS_FUNNEL.map((t) => {
          const on = tipo?.id === t.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} disabled={guardando}
              onClick={() => void elegir(t)} style={pastilla(on)}>
              <IconoMenu nombre={ICONO_TIPO[t.id]} size={14} />
              {t.label}
            </button>
          );
        })}
        {fuera.map((x) => ENTRADAS[x]).filter(Boolean).map((e) => (
          <span key={e.id} role="radio" aria-checked style={{ ...pastilla(true), cursor: 'default' }}>{e.label}</span>
        ))}
      </div>

      {pideEvento && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿Dónde es?</span>
            <input value={lugar} onChange={(ev) => setLugar(ev.target.value)} onBlur={() => guardarEvento()} placeholder="Huayacán, Cancún"
              style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, fontFamily: SANS }} />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿Qué días?</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {DIAS_EVENTO.map((d) => {
                const on = dias.includes(d.n);
                return (
                  <button key={d.n} type="button" aria-pressed={on} aria-label={`Día ${d.l}`}
                    onClick={() => {
                      const nuevos = on ? dias.filter((x) => x !== d.n) : [...dias, d.n];
                      setDias(nuevos);
                      guardarEvento({ dias: nuevos });
                    }}
                    style={{
                      width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
                      border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border-strong)'),
                      background: on ? 'var(--primary)' : 'var(--surface)', color: on ? '#fff' : 'var(--dim)',
                    }}>{d.l}</button>
                );
              })}
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿A qué hora?</span>
            <input value={hora} onChange={(ev) => setHora(ev.target.value)} onBlur={() => guardarEvento()} placeholder="19:00" inputMode="numeric"
              style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, width: 90, fontFamily: SANS }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>¿Hay cupo?</span>
            <input value={cupo} onChange={(ev) => setCupo(ev.target.value.replace(/\D/g, ''))} onBlur={() => guardarEvento()} placeholder="20" inputMode="numeric"
              style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, width: 90, fontFamily: SANS }} />
          </label>
        </div>
      )}
      {err && <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--bad)' }}>{err}</p>}
    </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 34, padding: '12px', borderRadius: 12, background: 'var(--surface)', boxShadow: SOMBRA_TARJETA }}>
        {/* Hueco, no gris: el color lo elige el server al crearla (`colorParaNueva`), y un punto
            gris acá era justo lo que se reportó: «el circulito al lado de la etapa aparece en gris». */}
        <span aria-hidden style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', border: '1.5px dashed var(--border-strong)', boxSizing: 'border-box' }} />
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

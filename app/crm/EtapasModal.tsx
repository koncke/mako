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
import { MAX_LABEL_ETAPA } from '@/lib/pipeline';
import { puedeSerReunion, cambioDeReuniones, reunionSinLugar, tipoDeEtapa, tieneEtapaDeReunion, TIPOS_ETAPA, type TipoEtapa } from '@/lib/etapa-reunion';
import {
  editarEtapaAction, embudoEnDetalleAction, renombrarEmbudoAction, archivarEmbudoAction,
  restaurarEmbudoAction, extrasDelEmbudoAction,
  type EmbudoEnDetalle, type EtapaDelFunnel, type OpEtapa, type DeshacerEtapa, type ExtrasDelEmbudo,
} from './actions';
import { EmbudoEntradas } from './EmbudoEntradas';
import { CampanasDelProducto } from './CampanasDelProducto';
import { CerrarIcon, LapizIcon } from './iconos';
import { MoverPartido } from './MoverPartido';

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
  // Las otras dos familias del tablero (segundo feedback del 12/10/2026, punto 9: «Pon todas las
  // etapas directamente, incluso ganado y las de descartado... Solo que Ganado y las de descartado
  // no se deberían poder editar mucho»). Mismo orden de precedencia que `etapas`.
  const nutricionEtapas = emb?.nutricionEtapas ?? semilla?.nutricionEtapas ?? [];
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
      if (!r.ok) { setError(r.error); setOrdenLocal(null); return; }
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

  // ── quitar una nutrición (segundo feedback del 12/10/2026, punto 9) ─────────────────────
  // Una columna de nutrición NO es una etapa del pipeline: es el destino de una transición que
  // deriva el recorrido (`generateFunnel`). Quitarla es APAGAR esa nutrición —la op `nutricion`,
  // con TODOS sus ids: «Reactivación» sale de dos etapas—, y el deshacer la vuelve a prender.
  // Con leads adentro pregunta, igual que quitar una etapa: el default seguro es la fricción.
  const nutricionDe = (key: string) =>
    emb?.nutriciones.find((n) => n.activa && n.ids.some((id) => id.split('>')[1] === key)) ?? null;
  const quitarNutricion = (e: EtapaDelFunnel) => {
    const nut = nutricionDe(e.key);
    if (!nut) return;
    const [id, ...tambien] = nut.ids;
    const hacer = () => aplicar({ op: 'nutricion', id, activa: false, tambien }, () => {
      show(`Quitada «${e.label}»`, () => aplicar({ op: 'nutricion', id, activa: true, tambien }));
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

  /**
   * Una fila de las etapas que NO son del recorrido: las de nutrición y las cuatro fijas.
   * «Ganado y las de descartado no se deberían poder editar mucho»: sólo el nombre. Las de
   * nutrición además se quitan (si el recorrido las deriva). Ni tipo, ni flechas, ni arrastre:
   * su lugar lo decide el recorrido.
   */
  const filaQuieta = (e: EtapaDelFunnel, rotulo: string, onQuitar?: () => void) => (
    <div key={e.key} style={{ ...caja }}>
      <div style={{ ...fila }}>
        <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: e.dot }} />
        {renombrando === e.key ? (
          <input
            autoFocus defaultValue={e.label} maxLength={MAX_LABEL_ETAPA}
            onBlur={(ev) => guardarNombreEtapa(e, ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
              if (ev.key === 'Escape') setRenombrando(null);
            }}
            style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', outline: 'none' }}
          />
        ) : (
          <>
            <button type="button" onClick={() => setRenombrando(e.key)} title={`Cambiar el nombre de ${e.label}`}
              style={{ flex: 'none', maxWidth: '70%', textAlign: 'left', fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', padding: '4px 0', cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >{e.label}</button>
            <span style={{ flex: 1 }} />
          </>
        )}
        <span style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: 'var(--dim)', padding: '0 4px' }}>{rotulo}</span>
        {onQuitar && (
          <AccionFila etiqueta={`Quitar ${e.label}`} disabled={trabajando} onClick={onQuitar}><CerrarIcon /></AccionFila>
        )}
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
  const caja: CSSProperties = { borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden' };
  /** La fila va TRANSPARENTE: el fondo lo pone la caja, o volveríamos a tener dos. */
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
        ancho={760}
        // El alto es un NÚMERO y no un tope: abrir «cómo entra la gente» cambia lo que hay
        // adentro, y una caja que se achica según lo que tenga ya se reportó dos veces.
        alto="min(85vh, 620px)"
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
                    {esEntrada(e) ? (
                      <AccionFila
                        etiqueta={entradasAbierto
                          ? `Cerrar cómo entra la gente a ${e.label}`
                          : `Configurar por dónde entra la gente a ${e.label}`}
                        disabled={trabajando} onClick={() => setEntradasAbierto((v) => !v)}>
                        {entradasAbierto ? <CerrarIcon /> : <LapizIcon />}
                      </AccionFila>
                    ) : (<>
                      {/* Sólo las que pueden ser reunión tienen tipo: la entrada, el pago y el
                          cierre ya tienen el suyo (`puedeSerReunion`, y la action lo repite). */}
                      {puedeSerReunion(e) && (
                        <SelectorTipo etapa={e.label} tipo={tipoDeEtapa(e)}
                          porNombre={!e.marcadaComo && tipoDeEtapa(e) === 'etapa' && tieneEtapaDeReunion([e])}
                          sinLugar={reunionSinLugar(etapas, e.key)} disabled={trabajando}
                          onElegir={(t) => elegirTipo(e, t)} />
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

            {/* LAS OTRAS ETAPAS DEL TABLERO (segundo feedback del 12/10/2026, punto 9): «En la
                edición de las etapas faltan las etapas de nutrición que hoy ya tengo en el
                funnel... Pon todas las etapas directamente, incluso ganado y las de descartado».
                Van debajo del recorrido y en el orden de las bandas del tablero: nutrición, y
                después Ganado y las de descarte, que sólo cambian de nombre. Afuera de la lista
                de arriba a propósito: ésa se arrastra, y éstas no tienen lugar que elegir. */}
            {(nutricionEtapas.length > 0 || fijas.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14 }}>
                {nutricionEtapas.map((e) => filaQuieta(e, 'Nutrición', nutricionDe(e.key) ? () => quitarNutricion(e) : undefined))}
                {fijas.map((e) => filaQuieta(e, e.key === 'ganado' ? 'Ganado' : 'Descartado'))}
              </div>
            )}
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

'use client';

// =============================================================================
// Galeria — «Añadir un gráfico», lo que se INSERTA, y las piezas flotantes del editor
// =============================================================================
// La galería agrupada como la de Looker Studio. «Insertar» (punto 18 del feedback del 11/10/2026, y la
// decisión 6 del mismo día): texto, enlace, imagen, video, una página insertada, línea y flecha
// (TIPOS_ELEMENTO), que dibujan app/dashboard/Elemento.tsx y ElementoInsertado.tsx.
//
// TANDA v5 (12/10/2026, interfaz I7 del contrato): «Los bloques se van» —los migra el saneo a gráficos del
// catálogo, así que la galería ya no tiene la sección «Bloques de MaKo»— y se van las FORMAS (rectángulo y
// círculo: 0 guardados, medido). Entran:
//   · «Sección» (un contenedor a lo ancho que agrupa las filas de abajo) y «Desplegable», que es la MISMA
//     sección, plegable (decisión 2 de Martín: «Contenedor = Sección… Es TAMBIÉN el Desplegable»).
//   · «Conclusiones de MaKo» (una caja de IA; apagada si la hoja ya tiene `MAX_IA_POR_HOJA`) y «Acción»
//     (un botón que corre una acción de MaKo, como «Sincronizar llamadas»).
//   · «Conectar», en el menú de la Línea: una flecha que UNE dos bloques y los sigue al moverlos. No es un
//     elemento de la grilla: llama a `onConectar` y lo implementa la pantalla.
//   · «Ficha» (una pieza de lo que se abrió: una llamada, un anuncio): SÓLO adentro de un pop-up.
// Acá sólo se DIBUJAN los menús: qué hace cada opción lo decide quien los monta (app/dashboard/EditorInforme.tsx).
//
// Acá viven también el `Flotante` (el panel anclado a un botón que usan todos los menús del editor) y los
// íconos de la barra, para que la topbar (./Cabecera.tsx), el panel (./Propiedades.tsx) y el editor los
// compartan sin importarse entre sí.
//
// Tanda de la topbar (11/10/2026), punto 8: «El tema de formas, flechas, texto, fijate como lo posiciona
// Looker, que sea igual.» En la barra de Looker lo que se inserta va SUELTO, un ícono por cosa (código,
// imagen, texto, línea, formas), y lo que tiene variantes abre su menú. `BARRA_INSERTAR` es ese orden, con
// lo nuestro que Looker no tiene al lado de su pariente (el video junto a lo insertado, el enlace junto al
// texto) y lo de MaKo al final. En el celular no entran: va un solo «Insertar ▾» (`MenuInsertar`).

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GRUPOS, MAX_IA_POR_HOJA, TIPOS, TIPOS_ELEMENTO, type Componente, type Elemento, type GrupoElemento, type TipoElemento } from '@/lib/graficos-catalogo';
import { PALETA_MAKO } from '@/lib/graficos-temas';
import { ELEMENTOS_FUERA_DE_GENERAL } from '@/lib/general-piezas';
import { useCapaModal } from '@/app/_components/pila-modales';
import { IconoElemento } from './Elemento';

/** Dónde se abre un `Flotante`: debajo del botón (los menús) o al COSTADO de una fila (el ⋮ de una hoja). */
export type LadoFlotante = 'abajo' | 'derecha';

/**
 * Un panel anclado a un botón, PORTALEADO al body y ubicado por cuenta: el panel de propiedades y el
 * lienzo scrollean, y un menú adentro se cortaría. Se cierra tocando afuera o con Escape.
 * ⚠️ Es una CAPA: se registra en la pila (`useCapaModal`, anidada: no tapa lo de abajo) y contesta al
 *    Escape sólo si es la de arriba, frenando a los demás con `stopImmediatePropagation` (los Escape de la
 *    casa viven en `document`, en captura). Sin la pila, el Escape de un menú abierto encima de un modal
 *    cerraba también el modal.
 * ⚠️ `anidado`: un Flotante que se abre DESDE otro (el submenú de una hoja, al costado de su fila). El de
 *    abajo NO se cierra con un clic adentro del de arriba: los dos son portales distintos y, sin esto, tocar
 *    «Renombrar» en el submenú cerraba la lista de hojas antes de que el clic llegara. El de arriba se registra
 *    después en la pila, así que el primer Escape lo cierra sólo a él.
 * `lado: 'derecha'`: a la derecha del ancla (alineado arriba con ella); si no entra, se da vuelta a la
 * izquierda (molde: el `Flotante` del editor de landing, app/landing-generator/editor/extensiones/piezas.tsx).
 * z-index 580: arriba del recorrido (400) y abajo del toast (600).
 */
export function Flotante({ ancla, onCerrar, ancho, lado = 'abajo', anidado = false, children }: {
  ancla: HTMLElement; onCerrar: () => void; ancho: number; lado?: LadoFlotante; anidado?: boolean; children: ReactNode;
}) {
  const capa = useCapaModal(true, { anidada: true });
  const esArriba = capa.esElDeArriba;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; alto: number } | null>(null);
  const cerrar = useRef(onCerrar);
  // El último `onCerrar`, al día ANTES de los efectos que lo llaman (un efecto de layout corre en orden). En
  // un efecto y no en el render: un ref escrito al dibujar es lo que el lint de la casa rechaza.
  useLayoutEffect(() => { cerrar.current = onCerrar; });
  useLayoutEffect(() => {
    const ubicar = () => {
      if (!ancla.isConnected) { cerrar.current(); return; }
      const r = ancla.getBoundingClientRect();
      const alto = ref.current?.offsetHeight ?? 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (lado === 'derecha') {
        const w = Math.min(ancho, vw - 16);
        let left = r.right + 4;
        if (left + w > vw - 8) left = r.left - w - 4;
        left = Math.max(8, Math.min(left, vw - w - 8));
        // La primera opción a la altura de la fila (el panel tiene 6 px de aire arriba).
        let top = r.top - 6;
        if (top + alto > vh - 8) top = vh - 8 - alto;
        top = Math.max(8, top);
        setPos({ left, top, alto: Math.max(160, vh - top - 8) });
        return;
      }
      const w = Math.min(Math.max(ancho, r.width), vw - 16);
      const left = Math.min(Math.max(8, r.left), vw - w - 8);
      const abajo = r.bottom + 6;
      const libreAbajo = vh - abajo - 8;
      const top = alto > libreAbajo && r.top - alto - 6 > 8 ? r.top - alto - 6 : abajo;
      setPos({ left, top, alto: Math.max(160, top === abajo ? libreAbajo : r.top - 14) });
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [ancla, ancho, lado]);
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ancla.contains(t)) return;
      // Un clic adentro de un Flotante ANIDADO (abierto desde éste) no cierra a éste.
      const el = t instanceof Element ? t : t.parentElement;
      if (!anidado && el?.closest('[data-lk-anidado]')) return;
      cerrar.current();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && esArriba()) { e.stopImmediatePropagation(); e.preventDefault(); cerrar.current(); } };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla, esArriba, anidado]);
  return createPortal(
    <div ref={ref} className="lk lk-flotante" data-lk-anidado={anidado || undefined}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(ancho, typeof window === 'undefined' ? ancho : window.innerWidth - 16), maxHeight: pos?.alto ?? 400, visibility: pos ? 'visible' : 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}

/**
 * La galería: los tipos de gráfico por grupo. (Desde v5 sin «Bloques de MaKo»: los bloques se migran.) `tipos` la
 * acota (General ofrece pocos: `TIPOS_GENERAL`, lib/general-piezas.ts); un grupo sin ninguno no se dibuja.
 */
export function Galeria({ actual, onElegir, tipos }: { actual?: string; onElegir: (tipo: string) => void; tipos?: readonly string[] }) {
  const ofrecidos = tipos ? TIPOS.filter((x) => tipos.includes(x.id)) : TIPOS;
  return (
    <div className="lk-galeria" role="menu">
      {GRUPOS.filter((gr) => ofrecidos.some((x) => x.grupo === gr)).map((gr) => (
        <div key={gr}>
          <div className="lk-galeria-tit">{gr}</div>
          <div className="lk-galeria-fila">
            {ofrecidos.filter((x) => x.grupo === gr).map((x) => (
              <button key={x.id} type="button" role="menuitem" className="lk-galeria-tipo" data-actual={actual === x.id || undefined} title={x.nombre} aria-label={x.nombre} onClick={() => onElegir(x.id)}>
                <IconoTipo tipo={x.id} size={34} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Lo que se inserta ───────────────────────────────────────────────────────────────────────

/** Los menús de la barra de inserción (lo que tiene variantes). Desde v5 sin «Formas». */
export type MenuBarra = 'lineas' | 'estructura' | 'mako';
/**
 * Una opción de un menú: un TIPO del catálogo, con su nombre y, si es una variante, lo que trae de entrada
 * (el «Desplegable» es una sección plegable). Quien la recibe arma el elemento con `nuevoElemento(tipo)` y le
 * pone `inicial` encima.
 */
export type OpcionInsertar = { tipo: TipoElemento; nombre: string; inicial?: Partial<Pick<Elemento, 'seccion'>> };
/**
 * Un lugar de la barra de inserción: un tipo suelto (un ícono), o un menú con sus opciones. `soloPopup`: sólo
 * se ofrece editando un pop-up (una Ficha muestra lo que se abrió; en una hoja no hay qué abrir). `conectar`:
 * el menú suma «Conectar dos bloques» (sólo en una hoja: un pop-up no tiene conectores).
 */
export type LugarInsertar =
  | { clase: 'suelto'; tipo: TipoElemento; soloPopup?: true }
  | { clase: 'menu'; menu: MenuBarra; nombre: string; icono: TipoElemento; opciones: readonly OpcionInsertar[]; conectar?: true };

/**
 * La barra de inserción en el ORDEN de Looker (código, imagen, texto, línea), con el video junto a lo
 * insertado, el enlace junto al texto y lo nuevo de v5 al final (la sección, lo de MaKo, la ficha de un
 * pop-up). Cada tipo de `TIPOS_ELEMENTO` vive en UN lugar —un lugar puede ofrecerlo con variantes: la Sección
 * y el Desplegable—: lo fija tests/dashboard-topbar.test.ts, así un tipo nuevo del catálogo no queda sin
 * lugar en la barra ni en dos.
 */
export const BARRA_INSERTAR: readonly LugarInsertar[] = [
  { clase: 'suelto', tipo: 'insertado' },
  { clase: 'suelto', tipo: 'video' },
  { clase: 'suelto', tipo: 'imagen' },
  { clase: 'suelto', tipo: 'texto' },
  { clase: 'suelto', tipo: 'enlace' },
  { clase: 'menu', menu: 'lineas', nombre: 'Línea', icono: 'linea', conectar: true, opciones: [{ tipo: 'linea', nombre: 'Línea' }, { tipo: 'flecha', nombre: 'Flecha' }] },
  {
    clase: 'menu', menu: 'estructura', nombre: 'Sección', icono: 'seccion', opciones: [
      { tipo: 'seccion', nombre: 'Sección' },
      // Abierta: recién insertada se ve lo que tiene adentro; quien la arma decide si arranca plegada.
      { tipo: 'seccion', nombre: 'Desplegable', inicial: { seccion: { fondo: null, plegable: true, abierto: true } } },
    ],
  },
  { clase: 'menu', menu: 'mako', nombre: 'MaKo', icono: 'ia', opciones: [{ tipo: 'ia', nombre: 'Conclusiones de MaKo' }, { tipo: 'accion', nombre: 'Acción' }] },
  { clase: 'suelto', tipo: 'entidad', soloPopup: true },
];

/**
 * Los lugares que se ofrecen: la Ficha sólo editando un pop-up. En General, sin el código insertado ni lo de MaKo
 * (`ELEMENTOS_FUERA_DE_GENERAL`, lib/general-piezas.ts): un menú que se queda sin opciones no se dibuja.
 */
export const lugaresInsertar = (enPopup = false, enGeneral = false): LugarInsertar[] => BARRA_INSERTAR
  .filter((l) => l.clase !== 'suelto' || !l.soloPopup || enPopup)
  .filter((l) => !enGeneral || (l.clase === 'suelto'
    ? !(ELEMENTOS_FUERA_DE_GENERAL as readonly string[]).includes(l.tipo)
    : l.opciones.some((o) => !(ELEMENTOS_FUERA_DE_GENERAL as readonly string[]).includes(o.tipo))));

/**
 * Por qué no se puede insertar un tipo ahora (corto: va en el `title` de la opción apagada), o null. Una caja
 * de «Conclusiones de MaKo» gasta cuota de IA al correr: hasta `MAX_IA_POR_HOJA` por hoja (el saneo descarta
 * la que sobre; acá se apaga antes, que es donde se ve).
 */
export function motivoInsertar(tipo: TipoElemento, componentes: readonly Componente[]): string | null {
  if (tipo === 'ia' && componentes.filter((c) => c.clase === 'elemento' && c.tipo === 'ia').length >= MAX_IA_POR_HOJA) return `Hasta ${MAX_IA_POR_HOJA} por hoja`;
  return null;
}

/** El dibujo de «Conectar»: dos bloques unidos por una línea con codo. */
function IconoConectar({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', display: 'block' }}>
      <rect x="3" y="3.5" width="7" height="6" rx="1.5" /><rect x="14" y="14.5" width="7" height="6" rx="1.5" /><path d="M10 6.5h3.5a2.5 2.5 0 0 1 2.5 2.5v5.5" />
    </svg>
  );
}

type PropsInsertar = {
  /** Lo que se eligió: el tipo y, si es una variante, lo que trae de entrada (el Desplegable). */
  onElegir: (t: TipoElemento, inicial?: OpcionInsertar['inicial']) => void;
  /** Lo que ya tiene la hoja (o el pop-up): apaga «Conclusiones de MaKo» con 4 cajas. */
  componentes?: readonly Componente[];
  /** Editando un pop-up: suma la Ficha y saca «Conectar». */
  enPopup?: boolean;
  /** En General: sin el código insertado ni lo de MaKo. */
  enGeneral?: boolean;
  /** «Conectar dos bloques»: lo implementa la pantalla. Sin esto, la opción no se ofrece. */
  onConectar?: () => void;
};

/** Las opciones de un lugar (un suelto es una opción con el nombre del catálogo). */
const opcionesDe = (l: LugarInsertar): readonly OpcionInsertar[] =>
  l.clase === 'menu' ? l.opciones : [{ tipo: l.tipo, nombre: TIPOS_ELEMENTO.find((t) => t.id === l.tipo)?.nombre ?? l.tipo }];

/** Un renglón de un menú de inserción: su dibujo y su nombre, apagado con su motivo si no se puede. */
function Opcion({ o, componentes, onElegir }: { o: OpcionInsertar; componentes: readonly Componente[]; onElegir: PropsInsertar['onElegir'] }) {
  const motivo = motivoInsertar(o.tipo, componentes);
  return (
    <button type="button" role="menuitem" className="lk-opcion" disabled={!!motivo} title={motivo ?? undefined} onClick={() => onElegir(o.tipo, o.inicial)}>
      <IconoElemento tipo={o.tipo} size={17} /> <span>{o.nombre}</span>
    </button>
  );
}

/** Los grupos del menú «Insertar» del celular, en orden: los del catálogo (`grupo` de TIPOS_ELEMENTO). */
const GRUPOS_ELEMENTO: readonly GrupoElemento[] = ['texto', 'medios', 'formas', 'estructura', 'mako', 'entidad'];

/**
 * «Insertar» del celular (en la compu, la barra): todo lo que se inserta, cada opción con su dibujo (la regla
 * de la casa: un desplegable lleva ícono en cada opción). El dibujo es el de ./Elemento.tsx, el mismo de la
 * cabecera de su panel: un solo lugar. Los grupos van separados por un filete, sin rótulo.
 */
export function MenuInsertar({ onElegir, componentes = [], enPopup = false, enGeneral = false, onConectar }: PropsInsertar) {
  const lugares = lugaresInsertar(enPopup, enGeneral);
  const grupos = GRUPOS_ELEMENTO
    .map((g) => ({ g, opciones: lugares.flatMap(opcionesDe).filter((o) => TIPOS_ELEMENTO.find((t) => t.id === o.tipo)?.grupo === g) }))
    .filter((x) => x.opciones.length);
  const conConectar = !enPopup && !!onConectar;
  return (
    <div className="lk-lista" role="menu">
      {grupos.map(({ g, opciones }, i) => (
        <div key={g} role="group">
          {i > 0 && <div className="lk-sep-h" role="separator" />}
          {opciones.map((o) => <Opcion key={`${o.tipo}:${o.nombre}`} o={o} componentes={componentes} onElegir={onElegir} />)}
          {g === 'formas' && conConectar && (
            <button type="button" role="menuitem" className="lk-opcion" onClick={onConectar}><IconoConectar /> <span>Conectar dos bloques</span></button>
          )}
        </div>
      ))}
    </div>
  );
}

/** El menú de un lugar de la barra (la Línea, la Sección, MaKo): cada opción con su dibujo y su nombre. */
export function MenuElementos({ menu, onElegir, componentes = [], enPopup = false, onConectar }: PropsInsertar & { menu: MenuBarra }) {
  const lugar = BARRA_INSERTAR.find((l): l is Extract<LugarInsertar, { clase: 'menu' }> => l.clase === 'menu' && l.menu === menu);
  if (!lugar) return null;
  const conConectar = !!lugar.conectar && !enPopup && !!onConectar;
  return (
    <div className="lk-lista" role="menu">
      {lugar.opciones.map((o) => <Opcion key={`${o.tipo}:${o.nombre}`} o={o} componentes={componentes} onElegir={onElegir} />)}
      {conConectar && (
        <>
          <div className="lk-sep-h" role="separator" />
          <button type="button" role="menuitem" className="lk-opcion" onClick={onConectar}><IconoConectar /> <span>Conectar dos bloques</span></button>
        </>
      )}
    </div>
  );
}

/**
 * El dibujito de cada tipo de gráfico, para la galería y el panel. Los colores de las series son los de
 * la paleta de MaKo (legibles sobre las dos superficies); los grises y la tinta, tokens de la app, así se
 * dan vuelta en el tema oscuro.
 */
export function IconoTipo({ tipo, size = 34 }: { tipo: string; size?: number }) {
  const s: CSSProperties = { width: size, height: size * 0.82, flex: 'none' };
  const [A, B, C, , R, V] = PALETA_MAKO;
  const G = 'var(--faint)', L = 'var(--border-strong)', T = 'currentColor', F = 'var(--surface)';
  const caja = (hijos: ReactNode) => <svg viewBox="0 0 40 32" style={s} fill="none" aria-hidden>{hijos}</svg>;
  const filasTabla = (extra?: ReactNode) => caja(<>{[6, 12, 18, 24].map((y) => <rect key={y} x="4" y={y} width="32" height="3" rx="1" fill={L} />)}<rect x="4" y="2" width="32" height="3" rx="1" fill={G} />{extra}</>);
  switch (tipo) {
    case 'tabla': return filasTabla();
    case 'tabla_barras': return filasTabla(<>{[6, 12, 18, 24].map((y, i) => <rect key={y} x="22" y={y} width={[12, 8, 5, 10][i]} height="3" fill={A} />)}</>);
    case 'tabla_calor': return filasTabla(<>{[6, 12, 18, 24].map((y, i) => <rect key={y} x="22" y={y} width="14" height="3" fill={A} opacity={[1, 0.6, 0.3, 0.8][i]} />)}</>);
    case 'numero': return caja(<><rect x="3" y="5" width="34" height="22" rx="2" stroke={L} /><text x="7" y="13" fontSize="5" fill={G}>Total</text><text x="7" y="23" fontSize="9" fill={T}>1,168</text></>);
    case 'numero_compacto': return caja(<><rect x="3" y="5" width="34" height="22" rx="2" stroke={L} /><text x="7" y="13" fontSize="5" fill={G}>Sesiones</text><text x="7" y="23" fontSize="9" fill={T}>69.3K</text></>);
    case 'numero_tendencia': return caja(<><rect x="3" y="5" width="34" height="22" rx="2" stroke={L} /><text x="7" y="15" fontSize="8" fill={T}>812</text><path d="M7 23l6-3 5 2 6-5 6 2 5-4" stroke={A} strokeWidth="1.6" /></>);
    case 'serie': case 'lineas': return caja(<path d="M3 24l8-7 7 4 8-10 11 4" stroke={A} strokeWidth="2" strokeLinejoin="round" />);
    case 'serie_sparkline': return caja(<path d="M3 18l3-4 3 5 3-6 3 7 3-3 3 2 3-6 3 5 3-3 3 4 3-2" stroke={A} strokeWidth="1.6" />);
    case 'serie_suave': case 'lineas_suaves': return caja(<path d="M3 24c6 0 6-9 12-9s6 6 12 1 6-7 10-9" stroke={A} strokeWidth="2" />);
    case 'columnas': return caja(<>{[5, 11, 17, 23, 29].map((x, i) => <rect key={x} x={x} y={[16, 10, 18, 8, 14][i]} width="4" height={28 - [16, 10, 18, 8, 14][i]} fill={A} />)}</>);
    case 'columnas_apiladas': return caja(<>{[5, 11, 17, 23, 29].map((x, i) => <g key={x}><rect x={x} y={[16, 10, 18, 8, 14][i]} width="4" height="6" fill={B} /><rect x={x} y={[22, 16, 24, 14, 20][i]} width="4" height={28 - [22, 16, 24, 14, 20][i]} fill={A} /></g>)}</>);
    case 'columnas_100': return caja(<>{[5, 11, 17, 23, 29].map((x, i) => <g key={x}><rect x={x} y="4" width="4" height={[8, 12, 6, 10, 9][i]} fill={C} /><rect x={x} y={4 + [8, 12, 6, 10, 9][i]} width="4" height="7" fill={B} /><rect x={x} y={11 + [8, 12, 6, 10, 9][i]} width="4" height={17 - [8, 12, 6, 10, 9][i]} fill={A} /></g>)}</>);
    case 'barras': return caja(<>{[5, 11, 17, 23].map((y, i) => <rect key={y} x="4" y={y} width={[30, 22, 16, 10][i]} height="4" fill={A} />)}</>);
    case 'barras_apiladas': return caja(<>{[5, 11, 17, 23].map((y, i) => <g key={y}><rect x="4" y={y} width={[18, 14, 10, 6][i]} height="4" fill={A} /><rect x={4 + [18, 14, 10, 6][i]} y={y} width="8" height="4" fill={B} /></g>)}</>);
    case 'barras_100': return caja(<>{[5, 11, 17, 23].map((y, i) => <g key={y}><rect x="4" y={y} width={[16, 12, 20, 10][i]} height="4" fill={A} /><rect x={4 + [16, 12, 20, 10][i]} y={y} width="8" height="4" fill={B} /><rect x={12 + [16, 12, 20, 10][i]} y={y} width={24 - [16, 12, 20, 10][i]} height="4" fill={C} /></g>)}</>);
    case 'histograma': return caja(<>{[4, 10, 16, 22, 28].map((x, i) => <rect key={x} x={x} y={[20, 12, 6, 14, 22][i]} width="6" height={28 - [20, 12, 6, 14, 22][i]} fill={A} stroke={F} />)}<path d="M4 18c6-8 10-14 14-14s10 10 18 16" stroke={B} strokeWidth="1.4" /></>);
    case 'circular': return caja(<><circle cx="20" cy="16" r="12" fill={A} /><path d="M20 16V4a12 12 0 0 1 10.4 18Z" fill={B} /><path d="M20 16l10.4 6A12 12 0 0 1 14 26.4Z" fill={C} /></>);
    case 'anillo': return caja(<><circle cx="20" cy="16" r="10" stroke={A} strokeWidth="5" /><path d="M20 6a10 10 0 0 1 8.7 15" stroke={B} strokeWidth="5" /></>);
    case 'combinado': return caja(<>{[5, 13, 21, 29].map((x, i) => <rect key={x} x={x} y={[14, 18, 10, 16][i]} width="5" height={28 - [14, 18, 10, 16][i]} fill={A} />)}<path d="M7 12l8-4 8 6 8-8" stroke={B} strokeWidth="2" /></>);
    case 'combinado_apilado': return caja(<>{[5, 13, 21, 29].map((x, i) => <g key={x}><rect x={x} y={[14, 18, 10, 16][i]} width="5" height="5" fill={C} /><rect x={x} y={[19, 23, 15, 21][i]} width="5" height={28 - [19, 23, 15, 21][i]} fill={A} /></g>)}<path d="M7 10l8-4 8 6 8-8" stroke={B} strokeWidth="2" /></>);
    case 'area': return caja(<path d="M3 28V20l8-6 8 4 9-9 9 5v14Z" fill={A} opacity=".5" stroke={A} />);
    case 'area_apilada': return caja(<><path d="M3 28V18l8-6 8 4 9-9 9 5v16Z" fill={B} opacity=".6" /><path d="M3 28v-5l8-3 8 2 9-5 9 3v8Z" fill={A} opacity=".8" /></>);
    case 'area_100': return caja(<><rect x="3" y="4" width="34" height="24" fill={C} opacity=".5" /><path d="M3 28V14l8-4 8 5 9-7 9 4v16Z" fill={B} opacity=".7" /><path d="M3 28v-6l8-2 8 3 9-4 9 2v7Z" fill={A} /></>);
    case 'dispersion': return caja(<>{[[8, 22], [12, 16], [17, 19], [21, 11], [26, 14], [31, 7], [15, 24], [28, 20]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill={A} />)}</>);
    case 'burbujas': return caja(<>{[[9, 20, 4], [18, 12, 6], [28, 18, 3], [30, 8, 2.5], [14, 25, 2]].map(([x, y, rr]) => <circle key={`${x}${y}`} cx={x} cy={y} r={rr} fill={A} opacity=".75" />)}</>);
    case 'dinamica': return caja(<>{[4, 10, 16, 22].map((y) => <rect key={y} x="4" y={y + 2} width="32" height="3" rx="1" fill={L} />)}<rect x="4" y="2" width="9" height="24" fill={G} opacity=".4" /></>);
    case 'dinamica_barras': return caja(<>{[4, 10, 16, 22].map((y, i) => <g key={y}><rect x="4" y={y + 2} width="32" height="3" rx="1" fill={L} /><rect x="16" y={y + 2} width={[14, 8, 18, 5][i]} height="3" fill={A} /></g>)}</>);
    case 'dinamica_calor': return caja(<>{[4, 10, 16, 22].map((y, i) => [16, 23, 30].map((x, j) => <rect key={`${y}${x}`} x={x} y={y + 2} width="6" height="4" fill={A} opacity={[[1, 0.4, 0.2], [0.6, 0.9, 0.3], [0.2, 0.5, 1], [0.8, 0.3, 0.6]][i][j]} />))}<rect x="4" y="2" width="9" height="24" fill={G} opacity=".4" /></>);
    case 'bala': return caja(<><rect x="3" y="11" width="34" height="10" fill={L} /><rect x="3" y="14" width="22" height="4" fill={A} /><rect x="28" y="9" width="2" height="14" fill={T} /></>);
    case 'rectangulos': return caja(<><rect x="3" y="4" width="18" height="24" fill={A} /><rect x="22" y="4" width="15" height="12" fill={B} /><rect x="22" y="17" width="7" height="11" fill={C} /><rect x="30" y="17" width="7" height="11" fill={V} /></>);
    case 'sankey': return caja(<><rect x="3" y="4" width="3" height="10" fill={A} /><rect x="3" y="17" width="3" height="11" fill={B} /><rect x="34" y="4" width="3" height="14" fill={C} /><rect x="34" y="20" width="3" height="8" fill={V} /><path d="M6 9c14 0 14 2 28 2M6 22c14 0 14-11 28-11M6 25c14 0 14 0 28-1" stroke={A} strokeWidth="3" opacity=".35" /></>);
    case 'indicador': return caja(<><path d="M6 26a14 14 0 0 1 28 0" stroke={L} strokeWidth="6" /><path d="M6 26a14 14 0 0 1 20-12.6" stroke={A} strokeWidth="6" /></>);
    case 'indicador_rangos': return caja(<><path d="M6 26a14 14 0 0 1 4-9.9" stroke={R} strokeWidth="6" /><path d="M10 16.1a14 14 0 0 1 19.8 0" stroke={B} strokeWidth="6" /><path d="M29.8 16.1A14 14 0 0 1 34 26" stroke={V} strokeWidth="6" /><path d="M20 26l6-10" stroke={T} strokeWidth="1.6" /></>);
    case 'cascada': return caja(<><rect x="4" y="16" width="5" height="12" fill={A} /><rect x="11" y="10" width="5" height="6" fill={V} /><rect x="18" y="10" width="5" height="5" fill={R} /><rect x="25" y="5" width="5" height="10" fill={V} /><rect x="32" y="5" width="5" height="23" fill={A} /></>);
    case 'cronologia': return caja(<><rect x="5" y="5" width="16" height="4" fill={A} /><rect x="12" y="12" width="20" height="4" fill={B} /><rect x="8" y="19" width="10" height="4" fill={C} /><rect x="22" y="26" width="13" height="3" fill={V} /></>);
    case 'embudo': return caja(<><path d="M4 4h32l-4 7H8Z" fill={A} /><path d="M9 12h22l-3 7H12Z" fill={B} /><path d="M13 20h14l-3 7h-8Z" fill={C} /></>);
    case 'embudo_vertical': return caja(<><path d="M5 3h30l-4 6H9Z" fill={A} /><rect x="17" y="10.5" width="6" height="2" rx="1" fill={C} /><path d="M10 14h20l-3 6H13Z" fill={B} /><rect x="17" y="21.5" width="6" height="2" rx="1" fill={C} /><path d="M14 25h12l-2 4h-8Z" fill={C} /></>);
    case 'embudo_barras': return caja(<><rect x="4" y="5" width="32" height="6" fill={A} /><rect x="9" y="13" width="22" height="6" fill={B} /><rect x="14" y="21" width="12" height="6" fill={C} /></>);
    case 'embudo_columnas': return caja(<><rect x="4" y="4" width="8" height="24" fill={A} /><rect x="16" y="12" width="8" height="16" fill={B} /><rect x="28" y="19" width="8" height="9" fill={C} /></>);
    case 'mapa': return caja(<><path d="M5 9l7-3 8 3 6-2 9 4-2 7-6 3-3 6-6-2-5 1-4-6 2-5Z" fill={A} opacity=".35" stroke={A} strokeWidth="1.2" /><circle cx="22" cy="15" r="2" fill={A} /></>);
    // v5: los tipos que reemplazan a los bloques.
    case 'barra_proporcion': return caja(<><rect x="3" y="12" width="21" height="8" rx="2" fill={V} /><rect x="24" y="12" width="13" height="8" rx="2" fill={R} /><text x="3" y="9" fontSize="5" fill={G}>Cobrado</text></>);
    case 'tramos': return caja(<>{[[3, 9], [12, 7], [19, 12], [31, 6]].map(([x, w], i) => <rect key={x} x={x} y="13" width={w - 1} height="6" rx="1.5" fill={i === 2 ? R : A} opacity={i === 2 ? 1 : 0.7} />)}<path d="M3 24h34" stroke={L} /></>);
    case 'tarjetas': return caja(<>{[[3, 4], [21, 4], [3, 17], [21, 17]].map(([x, y]) => <g key={`${x}${y}`}><rect x={x} y={y} width="16" height="11" rx="2" stroke={L} /><rect x={x + 2} y={y + 2} width="5" height="7" rx="1" fill={G} opacity=".5" /><rect x={x + 9} y={y + 7} width="5" height="2" fill={A} /></g>)}</>);
    case 'mapa_calor': return caja(<><rect x="6" y="2" width="28" height="28" rx="2" stroke={L} /><rect x="9" y="5" width="22" height="3" rx="1" fill={L} /><circle cx="15" cy="16" r="5" fill={R} opacity=".45" /><circle cx="26" cy="22" r="3.5" fill={B} opacity=".55" /></>);
    default: return caja(<rect x="4" y="4" width="32" height="24" stroke={L} />);
  }
}

// ── Íconos de la barra (trazos de Material, a 20 px, en el color del texto) ─────────────────
const svg = (d: ReactNode, extra?: CSSProperties) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...extra }} aria-hidden>{d}</svg>;
export const SvgDeshacer = ({ espejo }: { espejo?: boolean }) => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>, espejo ? { transform: 'scaleX(-1)' } : undefined);
export const SvgAgregarDatos = () => svg(<><rect x="3" y="4" width="13" height="16" rx="1.5" /><path d="M6.5 8.5h6M6.5 12h6M6.5 15.5h3.5M19 9v6M16 12h6" /></>);
export const SvgAgregarGrafico = () => svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7.5 16.5v-4M12 16.5v-8M16.5 16.5v-6" /></>);
export const SvgInsertar = () => svg(<><rect x="3" y="3" width="8" height="8" rx="1.5" /><circle cx="17" cy="7" r="4" /><path d="M3 17h8M17 13v8M13 17h8" /></>);
export const SvgEstilo = () => svg(<><path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4Z" /><circle cx="7.5" cy="11.5" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15" cy="8" r="1" /></>);
export const SvgFlecha = ({ arriba }: { arriba?: boolean }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden style={{ flex: 'none', ...(arriba ? { transform: 'rotate(180deg)' } : {}) }}><path d="M7 10l5 5 5-5z" /></svg>;
export const SvgOjo = () => svg(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const SvgLapiz = () => svg(<><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>);
export const SvgLupa = () => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>);
export const SvgCalendario = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden style={{ flex: 'none' }}><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>;

'use client';

// =============================================================================
// <Mako> — los nueve estados de la inteligencia, una sola pieza
// =============================================================================
// Parte 3 del rediseño (#520). El catálogo de estados y sus reglas viven en
// lib/mako-gramatica.ts; acá vive únicamente cómo se ven.
//
// Es UN componente con nueve variantes y no nueve componentes, por la misma
// razón que Banner y Alert son el mismo: son la misma forma con distinto
// contenido obligatorio. Nueve componentes se habrían separado a la tercera
// edición, y volveríamos a tener «MaKo detectó» distinto en el CRM y en el Plan
// — que es exactamente el problema que esta tarea viene a cerrar.
//
// ⚠️ EL RÓTULO NO ES UN PROP. Sale de GRAMATICA. Si se pudiera pasar por
// parámetro, en dos semanas hay tres pantallas escribiendo «Analizando…»,
// «Pensando…» y «MaKo está trabajando» para el mismo estado, y el usuario no
// tiene cómo saber que son lo mismo. El criterio de «listo» de la tarea es
// literalmente que se llame igual en las cuatro tabs.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { MakoStar } from '@/app/_components/MakoBrand';
import { GRAMATICA, type EstadoMako, type DefEstado } from '@/lib/mako-gramatica';
import { TONO, type Tono } from './tokens';
import { Button, ButtonLink } from './Button';
// `Progress` ya no se importa: la barra de una fila en curso NO es el componente
// suelto de 200 px, es un filete de 2 px pegado al borde de la fila (ver
// `.mk-fila__barra` en ui.css). El componente sigue existiendo para las barras
// que sí son un elemento propio de una pantalla.
import { Modal } from './Modal';

/** Un campo de los que el estado exige. La `k` es el rótulo, la `v` el valor. */
export type DatoMako = { k: string; v: ReactNode };

type Accion = { label: string; onClick?: () => void; href?: string };

export type MakoProps = {
  estado: EstadoMako;
  /**
   * La frase concreta. El documento pide «título directo», no un encabezado.
   *
   * Opcional SOLO por el chip: ahí muchas veces el referente ya está en la fila
   * («esta campaña» al lado del nombre de la campaña) y repetirlo es ruido. En
   * la tarjeta entera va siempre — sin frase no está diciendo nada.
   */
  titulo?: ReactNode;
  detalle?: ReactNode;
  /**
   * LA LÍNEA QUE DECIDE SI VALE LA PENA ABRIR. Es el único dato que sobrevive al
   * colapso, así que va en prosa y con el número adentro —«340 mensajes de
   * WhatsApp · no se puede deshacer»—, nunca como etiqueta y valor.
   *
   * ⚠️ Es un prop propio y NO se deriva de `datos[0]`, a propósito. El diseño
   * anterior mostraba el primer campo del array y escondía el resto: en la
   * aprobación eso dejaba arriba «A quiénes» y detrás de un click «Qué reciben»,
   * mientras el botón que manda los mensajes estaba siempre a la vista. Elegir
   * por posición no es elegir. El día que esto vuelva a salir de `datos[0]`,
   * vuelve el mismo defecto por otra puerta.
   */
  consecuencia?: ReactNode;
  /**
   * Lo que no tiene vuelta atrás, PEGADO ARRIBA DEL BOTÓN y en tinta normal, no
   * en gris. Es feedforward (Microsoft HAX G16-A): la consecuencia se comunica
   * antes de que el usuario actúe, y en el lugar donde va a actuar. Solo tiene
   * sentido en `aprobacion`.
   */
  advertencia?: ReactNode;
  /** Los campos obligatorios del estado. Ver `exige` en lib/mako-gramatica.ts. */
  datos?: DatoMako[];
  /** Lo que respalda la afirmación. Va en el segundo nivel: respalda, no se lee siempre. */
  evidencia?: ReactNode;
  /**
   * Cómo se llama la evidencia adentro del modal. Por defecto «En qué me baso».
   * En la aprobación NO es evidencia sino lo que se va a hacer, así que ahí el
   * call-site pone «Los mensajes que se van a enviar»: tres frases entre
   * comillas sin un rótulo que diga qué son obligan a deducirlo.
   */
  evidenciaRotulo?: string;
  /**
   * Cuándo pasó. Va en el riel derecho de la fila, que es donde lo ponen Gmail,
   * GitHub y Linear — y es lo que impide que una fila con dos líneas de texto a
   * la izquierda se vea medio vacía.
   */
  cuando?: string;
  /** De dónde salieron los datos. Obligatorio mientras MaKo analiza. */
  fuente?: string;
  /** 0 a 1. Sin esto, «analizando» es un spinner eterno — que el documento prohíbe. */
  progreso?: number;
  /** Solo para `detecto`: cuánto importa lo que encontró. */
  importancia?: 'alta' | 'media' | 'baja';
  accion?: Accion;
  secundaria?: Accion;
  /**
   * Deshacer. Va SOLO en `completo`, y es la pieza que permite que MaKo haga las
   * cosas reversibles sin pedir permiso: si se puede desandar, se hace y se
   * ofrece esto. Sin Deshacer, la única salida honesta es `aprobacion`.
   */
  deshacer?: Accion;
  /** Versión de una línea, para una fila de tabla o el encabezado de una card. */
  compacto?: boolean;
  /**
   * Abre el modal apenas se monta. **Por defecto NO**, ni siquiera para la
   * aprobación, y el cambio es deliberado: mientras el detalle se desplegaba en
   * el lugar, abrir solo el que bloquea era ahorrarle un click al usuario; un
   * MODAL que se abre solo al cargar la pantalla es otra cosa —tapa todo y hay
   * que despacharlo antes de poder mirar nada—, que es exactamente lo que las
   * guías marcan como el abuso del diálogo.
   *
   * Queda para el caso de llegar por link directo a una decisión.
   */
  arrancaAbierta?: boolean;
  /**
   * La sugerencia va PEGADA al dato que propone cambiar, no en una tarjeta
   * aparte — el patrón de Linear. El «por qué» no ocupa espacio: viaja en el
   * title y aparece al pasar el cursor.
   *
   * Es la diferencia entre «un panel de IA atornillado al costado» y una IA que
   * vive donde estás trabajando.
   */
  inline?: boolean;
};

/**
 * Qué prop cubre cada requisito del documento. No es lo mismo que `exige` de la
 * gramática: aquello es el texto que lee un humano, esto es lo que la interfaz
 * puede comprobar sola. Alimenta el aviso de desarrollo de más abajo.
 */
// ⚠️ `titulo` es obligatorio en los NUEVE. Ahora los nueve se pintan con la
// misma fila, y el título es el único texto que la fila siempre muestra: sin él
// no dice nada y queda un renglón vacío que igual se come el gap.
const REQUIERE: Record<EstadoMako, (keyof MakoProps)[]> = {
  detecto: ['titulo', 'importancia', 'evidencia'],
  analizando: ['titulo', 'progreso', 'fuente'],
  explica: ['titulo', 'evidencia'],
  // ⚠️ `titulo` y `consecuencia` son obligatorios en los tres estados de
  // decisión, y no es burocracia: son los DOS ÚNICOS elementos de texto que la
  // fila muestra cerrada. Si falta uno, la fila no dice nada y el usuario tiene
  // que abrir las tres para averiguar cuál le importa — que es el «mystery ≠
  // minimalism» que la guía de diseño marca como lo peor de esconder cosas.
  //
  // Antes `titulo` no era obligatorio para NINGÚN estado y se renderizaba igual:
  // un `titulo` undefined dejaba un <div> vacío que igual se comía el gap.
  recomienda: ['titulo', 'consecuencia', 'datos'],
  // ⚠️ `evidencia` es obligatoria acá, y es el ítem que más fácil se pierde.
  // Qué prop cubre cada cosa que `exige` la aprobación:
  //     «el alcance»                    → datos
  //     «los cambios previstos»         → evidencia  ← el TEXTO REAL de lo que
  //                                        se va a mandar, no cuántos son
  //     «la consecuencia, pegada al botón» → advertencia
  // Sin `evidencia` en esta lista, un <Mako estado="aprobacion"> con título,
  // consecuencia, datos, acción y advertencia pinta el botón de enviar y no
  // avisa nada: vuelve entero el defecto original —el botón a la vista y qué
  // dicen los mensajes en ningún lado— con el checklist diciendo que está bien.
  aprobacion: ['titulo', 'consecuencia', 'datos', 'accion', 'advertencia', 'evidencia'],
  ejecuta: ['titulo', 'progreso', 'datos'],
  completo: ['titulo', 'datos'],
  vigila: ['titulo', 'datos'],
  sin_conclusion: ['titulo', 'consecuencia', 'datos', 'accion'],
};

/** Ya avisados, para no repetir el mismo warning en cada render. */
const avisados = new Set<string>();

function useAvisoDeDesarrollo(estado: EstadoMako, props: MakoProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    // El chip y la pastilla en línea NO tienen que cumplir el contrato: son
    // REFERENCIAS a un estado («esta fila está en aprobación»), no su
    // presentación. Los campos obligatorios los debe el lugar donde el estado
    // se muestra entero. Sin esta línea, una tabla de 40 filas escupe 40 avisos
    // que no se pueden resolver, y a la semana nadie mira la consola.
    //
    // ⚠️ `inline` faltaba, y el efecto era peor que un aviso de más: la clave
    // que dedup-ea (`recomienda:consecuencia,datos`) se quema con el falso
    // positivo del inline, y a partir de ahí el aviso VERDADERO —una tarjeta de
    // recomendación sin consecuencia, en cualquier pantalla— ya no se imprime.
    // Un falso positivo acá no hace ruido: apaga la guarda.
    if (props.compacto || props.inline) return;
    const faltan = REQUIERE[estado].filter((k) => {
      const v = props[k];
      return v === undefined || v === null || (Array.isArray(v) && v.length === 0);
    });
    if (!faltan.length) return;
    const clave = `${estado}:${faltan.join(',')}`;
    if (avisados.has(clave)) return;
    avisados.add(clave);
    // No rompe la pantalla a propósito: un estado incompleto sigue siendo mejor
    // que ninguno. Pero el documento es explícito en que sin estos campos el
    // estado no comunica lo que dice comunicar.
    console.warn(
      `[Mako] «${GRAMATICA[estado].rotulo}» sin ${faltan.join(' ni ')}. Este estado exige: ${GRAMATICA[estado].exige.join(' · ')}.`,
    );
  }, [estado, props]);
}

function Boton({ a, variant }: { a: Accion; variant: 'primary' | 'secondary' | 'tertiary' }) {
  if (a.href) return <ButtonLink href={a.href} size="sm" variant={variant}>{a.label}</ButtonLink>;
  return <Button size="sm" variant={variant} onClick={a.onClick}>{a.label}</Button>;
}

const IMPORTANCIA: Record<'alta' | 'media' | 'baja', string> = {
  alta: 'Importante', media: 'A tener en cuenta', baja: 'Menor',
};


function Chevron() {
  return (
    <svg className="mk-fila__ir" width="14" height="14" viewBox="0 0 14 14" aria-hidden focusable="false">
      <path d="M5.5 3 10 7l-4.5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Aviso() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden focusable="false">
      <path d="M8 1.8 15 14H1L8 1.8Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6v3.4M8 11.6v.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** El nombre del estado. UN componente para los dos usos que antes eran dos. */
function Pill({ def, t, conMarca, marca }: { def: DefEstado; t: (typeof TONO)[Tono]; conMarca?: boolean; marca?: ReactNode }) {
  return (
    <span className={`mk-pill${conMarca ? ' mk-pill--con-marca' : ''}`} style={{ background: t.bg, color: t.ink }}>
      {conMarca && marca}
      {def.rotulo}
    </span>
  );
}

// =============================================================================
// LA FILA — lo único que MaKo pone en una lista
// =============================================================================
// ⚠️ ACÁ HABÍA CUATRO PIEZAS Y ES UNA. Convivían una fila para las decisiones,
// una línea con una barra suelta para el trabajo en curso, una tarjeta con caja
// para los avisos y una pastilla aparte para la tabla. Las cuatro ya tenían la
// MISMA anatomía —marca de 16 px, columna de texto que se estira, riel
// derecho— y se diferenciaban sólo en el relleno, el separador y qué iba en el
// riel. No eran cuatro piezas: era una pieza con cuatro juegos de números.
//
// El modal NO cuenta como un tratamiento aparte: es la segunda capa de la fila,
// igual que un <summary> no es un componente distinto de su <details>.
//
//   [marca]  título + píldora ....................... riel derecho  [chevron]
//            la segunda línea, en gris
//
// Lo único que cambia entre los tres usos:
//
//   decisión   riel = cuándo                    · chevron sí · 2ª línea = consecuencia
//   en curso   riel = el porcentaje             · chevron NO · 2ª línea = fuente · avance
//   aviso      riel = importancia y cuándo      · chevron sí · 2ª línea = detalle
//
// Y el RÓTULO es siempre la píldora al final del título. Antes el aviso lo
// pintaba como kicker arriba (prohibido), el curso lo pintaba en gris antes del
// título, y la decisión lo pintaba como píldora. Tres tratamientos para el
// mismo dato.
function Fila({
  props, def, t, marca,
}: { props: MakoProps; def: DefEstado; t: (typeof TONO)[Tono]; marca: ReactNode }) {
  const {
    titulo, detalle, consecuencia, advertencia, datos, evidencia, evidenciaRotulo,
    cuando, fuente, progreso, importancia, accion, secundaria, deshacer, arrancaAbierta,
  } = props;

  const enCurso = def.forma === 'curso';
  // ¿Hay segunda capa? Si no hay nada que el modal pueda agregar, no hay
  // chevron ni click: una flecha en una fila que no abre nada es una promesa
  // que no se cumple. El trabajo en curso nunca abre — todavía no hay resultado.
  const hayDetalle = !enCurso && Boolean(detalle || datos?.length || evidencia || accion || secundaria || deshacer);

  const [abierto, setAbierto] = useState(arrancaAbierta === true && hayDetalle);
  const cerrar = useCallback(() => setAbierto(false), []);

  // La segunda línea, en prosa. En el trabajo en curso se arma con la fuente y
  // el avance unidos por punto medio, que es el separador que usan Uppy y Geist
  // para la línea secundaria de un progreso.
  const bajo = enCurso
    ? [fuente, ...(datos ?? []).map((d) => `${d.k} ${typeof d.v === 'string' ? d.v : ''}`.trim())].filter(Boolean).join(' · ')
    : (consecuencia ?? detalle);

  // El riel derecho. Nunca lleva texto largo y nunca se parte.
  const riel = enCurso
    ? (progreso !== undefined ? `${Math.round(progreso * 100)}%` : null)
    : [importancia ? IMPORTANCIA[importancia] : null, cuando].filter(Boolean).join(' · ') || null;

  const cuerpo = (
    <>
      {marca}
      <span className="mk-fila__txt">
        <span className="mk-fila__l1">
          <span className="mk-fila__t">{titulo}</span>
          <Pill def={def} t={t} />
        </span>
        {bajo && <span className="mk-fila__c">{bajo}</span>}
      </span>
      {riel && <span className="mk-fila__riel">{riel}</span>}
      {hayDetalle && <Chevron />}
      {/* La barra va PEGADA al borde de la fila y a todo su ancho, no flotando
          al lado del texto. El porqué completo, en ui.css. */}
      {enCurso && progreso !== undefined && (
        <span className="mk-fila__barra"><i style={{ width: `${Math.round(progreso * 100)}%` }} /></span>
      )}
    </>
  );

  return (
    <>
      {hayDetalle ? (
        <button type="button" className="mk-fila mk-fila--abre" onClick={() => setAbierto(true)} aria-haspopup="dialog">
          {cuerpo}
        </button>
      ) : (
        // Sin segunda capa no es un control: es contenido. Un <button> que no
        // hace nada igual entra en el orden de tabulación y se anuncia como
        // botón, así que quien usa teclado o lector para en algo que no responde.
        <div className="mk-fila" role={enCurso ? 'status' : undefined} aria-live={enCurso ? 'polite' : undefined}>
          {cuerpo}
        </div>
      )}

      {abierto && (
        <Modal
          titulo={titulo}
          encabezado={<Pill def={def} t={t} />}
          onCerrar={cerrar}
          pie={(accion || secundaria || deshacer) && (
            <>
              {/* Secundaria primero y a la izquierda: la salida sin compromiso
                  va antes y la de compromiso queda última, pegada al borde. */}
              {secundaria && <Boton a={secundaria} variant="tertiary" />}
              {/* Deshacer NO se pinta en la fila. La regla «una fila colapsada
                  no lleva botones» existe para que nadie DECIDA sin leer, y
                  deshacer no es decidir — pero tampoco es urgente acá: lo que
                  MaKo hace sin permiso es, por definición, reversible. */}
              {deshacer && <Boton a={deshacer} variant="secondary" />}
              {accion && (
                <span className={def.bloquea ? 'mk-det__cta' : undefined}>
                  <Boton a={accion} variant={def.bloquea ? 'primary' : 'secondary'} />
                </span>
              )}
            </>
          )}
        >
          {/* Cada hijo directo del cuerpo es un BLOQUE, y el modal les pone el
              filete que los separa. Eso es lo que convierte una pila de textos
              sueltos en grupos. */}
          {detalle && consecuencia && (
            <div className="mk-det"><p className="mk-det__p">{detalle}</p></div>
          )}

          {!!datos?.length && (
            <div className="mk-det">
              <dl className="mk-det__campos">
                {datos.map((d) => (
                  <div key={d.k} className="mk-det__campo">
                    <dt className="mk-det__k">{d.k}</dt>
                    <dd className="mk-det__v">{d.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {evidencia && (
            <div className="mk-det">
              {/* La evidencia SÍ lleva nombre: unas frases sin un rótulo que
                  diga qué son obligan a deducirlo. Y ya no va plegada — el
                  <details> adentro del modal sería un tercer nivel. */}
              <span className="mk-det__h">{evidenciaRotulo ?? 'En qué me baso'}</span>
              <div className="mk-det__cita">{evidencia}</div>
            </div>
          )}

          {advertencia && (
            <div className="mk-det">
              {/* Último bloque, así queda pegado al pie: la consecuencia se lee
                  donde se actúa (Microsoft HAX G16-A). */}
              <p className="mk-det__adv"><Aviso />{advertencia}</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

export function Mako(props: MakoProps) {
  const { estado, titulo, detalle, datos, accion, secundaria, compacto, inline } = props;
  const def = GRAMATICA[estado];
  const t = TONO[def.tono];
  useAvisoDeDesarrollo(estado, props);

  // La estrella brilla SOLO mientras hay proceso. En reposo va quieta: un
  // destello permanente deja de querer decir «MaKo está haciendo algo».
  const enProceso = estado === 'analizando' || estado === 'ejecuta';
  // Siempre adentro de su caja: es lo que hace que una estrella de 14 px y un
  // punto de 7 px dejen el texto en el mismo lugar en los nueve estados.
  //
  // ⚠️ La estrella va en TODOS menos donde el tono trae su propio color con
  // significado (`completo` en verde). Con la regla vieja —estrella solo si el
  // tono es `mako`— la aprobación y «falta un dato» arrancaban con un punto de
  // color, o sea dos señales cromáticas en una lista donde el único color
  // permitido es el del botón que bloquea.
  const conEstrella = def.tono !== 'good';
  const marca = (
    <span className="mk-mako__marca" aria-hidden>
      {conEstrella
        ? <MakoStar size={compacto ? 12 : 14} animate={enProceso} />
        : <span className="mk-dot" style={{ background: t.fill }} />}
    </span>
  );

  // ── LA PÍLDORA SUELTA ─────────────────────────────────────────────────────
  // Para una celda de tabla o un filtro. Acá SÍ lleva la marca adentro: la
  // píldora viaja sola y hay que decir que eso lo dijo MaKo. En una fila no,
  // porque la fila ya tiene su marca a la izquierda.
  if (compacto) return <Pill def={def} t={t} conMarca marca={marca} />;

  // ── PEGADO AL DATO ────────────────────────────────────────────────────────
  // Lo único que no vive en una lista: vive pegado al campo que propone
  // cambiar. Sin caja (ver ui.css) y con UNA sola acción visible — dos botones
  // es el doble de lo que usa cualquiera, y «Asignar a Carolina» al lado de un
  // valor que ya dice «Carolina» repetía el dato adentro del botón.
  if (inline) {
    return (
      <span className="mk-inline">
        <span className="mk-inline__l1">
          {marca}
          <span className="mk-inline__v">{titulo}</span>
          <span className="mk-inline__acc">
            {accion && <Boton a={accion} variant="secondary" />}
            {secundaria && <Boton a={secundaria} variant="tertiary" />}
          </span>
        </span>
        {/* El porqué, VISIBLE. Antes viajaba en el `title`: un tooltip nativo
            que no aparece con teclado, no existe en pantalla táctil y no se
            puede leer sin mantener el cursor encima — los tres requisitos de
            WCAG 1.4.13 fallando a la vez, y era la única explicación de por qué
            MaKo propone lo que propone. */}
        {detalle && <span className="mk-inline__d">{detalle}</span>}
        {!detalle && !!datos?.length && (
          <span className="mk-inline__d">{datos.map((d) => `${d.k}: ${typeof d.v === 'string' ? d.v : ''}`).join(' · ')}</span>
        )}
      </span>
    );
  }

  return <Fila props={props} def={def} t={t} marca={marca} />;
}

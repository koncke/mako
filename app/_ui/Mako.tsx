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
import { Progress } from './Feedback';
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
const REQUIERE: Record<EstadoMako, (keyof MakoProps)[]> = {
  detecto: ['importancia', 'evidencia'],
  analizando: ['progreso', 'fuente'],
  explica: ['evidencia'],
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
  ejecuta: ['datos'],
  completo: ['datos'],
  vigila: ['datos'],
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


/** Va a otra capa, no despliega en el lugar: el ícono tiene que decir a dónde va. */
function Chevron() {
  return (
    <svg className="mk-dec__ir" width="14" height="14" viewBox="0 0 14 14" aria-hidden focusable="false">
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

// =============================================================================
// DECISIÓN — una FILA de lista, y el detalle en un MODAL
// =============================================================================
// Tercera versión, y las dos anteriores fallaron por cosas distintas:
//
//   1ª  una tarjeta que mostraba los CINCO campos siempre. 14 elementos de texto
//       para decidir si te interesa una sugerencia.
//   2ª  una fila que desplegaba un panel en el lugar. Bajó a 2 elementos
//       cerrada —eso funcionó— pero el panel abierto quedó como una pila de
//       textos de 12 y 13 px flotando, y **el texto ocupaba 603 px dentro de una
//       caja de 1134**: el 47% vacío a la derecha y el párrafo cortado al medio.
//
// El pedido, textual: «Prefiero que NO sea un desplegable, no se ve lindo, que
// sea un pop-up con detail BIEN diseñado».
//
// Y no es solo estética: el modal ARREGLA el ancho muerto por construcción. La
// caja mide 600 px, así que el texto llena su renglón sin que nadie le ponga un
// tope. La regla que salió de esto vive en app/_ui/Modal.tsx y es corta: **el
// único ancho máximo del diseño vive en el contenedor del modal**; adentro nadie
// lleva `max-width`.
//
// LA FILA. Anatomía copiada de la lista de advisories de GitHub, que resolvió
// exactamente este problema:
//
//   ✦  Título de lo que pasa  «Aprobación pendiente»        hace 2 h   ›
//      la consecuencia, en una línea gris
//
// La píldora del estado va INLINE al final del título y no alineada a la
// derecha: como los nombres miden muy distinto («Sugerencia» contra «Aprobación
// pendiente»), a la derecha dejan el borde izquierdo dentado fila por fila.
// A la derecha va el tiempo, que es lo que ponen ahí Gmail, GitHub y Linear —
// y es lo que impide que la fila se vea medio vacía.
//
// DOS TAMAÑOS EN TODA LA FILA. La jerarquía la hacen el peso y el color, no más
// tamaños: GitHub usa 16 y 12 con tres pesos y dos colores, y la tabla de Geist
// de Vercel usa UN solo tamaño y cambia el peso. El defecto de la versión
// anterior era el contrario — siete elementos repartidos entre 12 y 13 px, o
// sea todo pesando igual.
function Decision({
  props, def, t, marca,
}: { props: MakoProps; def: DefEstado; t: (typeof TONO)[Tono]; marca: ReactNode }) {
  const {
    titulo, detalle, consecuencia, advertencia, datos, evidencia,
    evidenciaRotulo, cuando, accion, secundaria, arrancaAbierta,
  } = props;

  const [abierto, setAbierto] = useState(arrancaAbierta === true);
  const cerrar = useCallback(() => setAbierto(false), []);

  const pill = <span className="mk-dec__pill" style={{ background: t.bg, color: t.ink }}>{def.rotulo}</span>;

  return (
    <>
      {/* La fila ENTERA es el control, y es un <button> de verdad: ya no hay
          nada interactivo adentro, así que no hay conflicto de anidación y el
          teclado la alcanza sola. */}
      <button type="button" className="mk-dec" onClick={() => setAbierto(true)} aria-haspopup="dialog">
        {marca}
        <span className="mk-dec__txt">
          <span className="mk-dec__l1">
            <span className="mk-dec__t">{titulo}</span>
            {pill}
          </span>
          {consecuencia && <span className="mk-dec__c">{consecuencia}</span>}
        </span>
        {cuando && <span className="mk-dec__cuando">{cuando}</span>}
        <Chevron />
      </button>

      {abierto && (
        <Modal
          titulo={titulo}
          encabezado={pill}
          onCerrar={cerrar}
          pie={(accion || secundaria) && (
            <>
              {/* Secundaria primero y a la izquierda: en las cuatro guías que
                  publican el orden, la salida sin compromiso va antes y la de
                  compromiso queda última, pegada al borde. */}
              {secundaria && <Boton a={secundaria} variant="tertiary" />}
              {/* El botón lleno es SOLO el de la que bloquea, y toma el naranja
                  del estado. Aceptar una sugerencia o ir a cargar un dato no son
                  compromisos: van en secundario. */}
              {accion && (
                <span className={def.bloquea ? 'mk-det__cta' : undefined}>
                  <Boton a={accion} variant={def.bloquea ? 'primary' : 'secondary'} />
                </span>
              )}
            </>
          )}
        >
          {/* Cada hijo directo del cuerpo es un BLOQUE, y el modal les pone el
              filete que los separa (la regla de las Section de Polaris). Eso es
              lo que convierte una pila de textos sueltos en grupos. */}
          {detalle && (
            <div className="mk-det">
              <p className="mk-det__p">{detalle}</p>
            </div>
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
              {/* La evidencia SÍ lleva nombre. Tres frases entre comillas sin
                  un rótulo que diga qué son obligan a deducirlo, y en la
                  aprobación son literalmente los mensajes que se van a enviar. */}
              <span className="mk-det__h">{evidenciaRotulo ?? 'En qué me baso'}</span>
              <div className="mk-det__cita">{evidencia}</div>
            </div>
          )}

          {advertencia && (
            <div className="mk-det">
              {/* Último bloque del cuerpo, así queda pegado al pie: la
                  consecuencia se lee donde se actúa (Microsoft HAX G16-A). */}
              <p className="mk-det__adv"><Aviso />{advertencia}</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

export function Mako(props: MakoProps) {
  const { estado, titulo, detalle, datos, evidencia, fuente, progreso, importancia, accion, secundaria, deshacer, compacto, inline } = props;
  const def = GRAMATICA[estado];
  const t = TONO[def.tono];
  useAvisoDeDesarrollo(estado, props);

  // La estrella brilla SOLO mientras hay proceso. En reposo va quieta: un
  // destello permanente deja de querer decir «MaKo está haciendo algo».
  const enProceso = estado === 'analizando' || estado === 'ejecuta';
  // Siempre adentro de su caja: es lo que hace que una estrella de 14 px y un
  // punto de 7 px dejen el texto en el mismo lugar en los nueve estados.
  //
  // ⚠️ En las tres de DECISIÓN va la estrella aunque el tono no sea `mako`. La
  // aprobación es `warn` y «falta un dato» es `neutral`, así que con la regla de
  // arriba arrancaban con un punto de color: dos señales cromáticas en una lista
  // donde el único color permitido es el del botón que bloquea. Y en las tres
  // habla MaKo — la marca dice quién, no qué tan grave es.
  const conEstrella = def.tono === 'mako' || def.forma === 'decision';
  const marca = (
    <span className="mk-mako__marca" aria-hidden>
      {conEstrella
        ? <MakoStar size={compacto ? 12 : 14} animate={enProceso} />
        : <span className="mk-dot" style={{ background: t.fill }} />}
    </span>
  );

  if (compacto) {
    return (
      <span className="mk-mako mk-mako--chip" style={{ background: t.bg, borderColor: t.border, color: t.ink }}>
        {marca}
        <span className="mk-mako__rot">{def.rotulo}</span>
        {titulo && <span className="mk-mako__t">{titulo}</span>}
      </span>
    );
  }

  // ── EN LÍNEA (el patrón de Linear) ────────────────────────────────────────
  // La sugerencia pegada al dato, con dos salidas y sin robar espacio. El «por
  // qué» va en el `title`: aparece al pasar el cursor y no empuja nada.
  if (inline) {
    const porQue = [detalle, ...(datos ?? []).map((d) => `${d.k}: ${typeof d.v === 'string' ? d.v : ''}`)]
      .filter(Boolean).join(' · ');
    return (
      <span className="mk-mako mk-mako--inline">
        <span className="mk-mako__l1">
          {marca}
          <span className="mk-mako__t">{titulo}</span>
          <span className="mk-mako__acc">
            {/* Secundario, NO primario: un botón azul lleno adentro de una caja
                dorada son dos acentos peleando, y encima le da a una sugerencia
                el peso de la acción principal de la pantalla. */}
            {accion && <Boton a={accion} variant="secondary" />}
            {secundaria && <Boton a={secundaria} variant="tertiary" />}
          </span>
        </span>
        {porQue && <span className="mk-mako__d">{porQue}</span>}
      </span>
    );
  }

  // ── EN CURSO ──────────────────────────────────────────────────────────────
  // NO es una tarjeta. Que MaKo esté trabajando no merece una caja: merece una
  // línea. Y el rótulo viaja pegado a la fuente, porque «Revisando» solo no dice
  // nada — es el «Processing…» que Apple marca como el copy a evitar.
  if (def.forma === 'curso') {
    return (
      <div className="mk-mako mk-mako--curso" role="status" aria-live="polite">
        {/* El rótulo arranca la frase y el TÍTULO la completa: «Revisando · por
            qué cayó la conversión». Manda el título, que es lo que dice qué está
            haciendo; el rótulo va un escalón abajo y en gris.
            La fuente bajó a la línea del progreso: arriba metía un tercer texto
            entre el rótulo y el título y partía la frase al medio. */}
        <div className="mk-mako__cab">
          {marca}
          <span className="mk-mako__rot">{def.rotulo}</span>
          {titulo && <span className="mk-mako__t">{titulo}</span>}
        </div>
        {/* La barra va acotada y pegada a su línea. A todo el ancho de la
            pantalla, una barra de 4 px se lee como un renglón cortado, no como
            progreso — y los datos van en la MISMA línea, no sueltos abajo:
            «Van: 1 de 3» colgando solo parecía texto que sobró. */}
        <div className="mk-mako__proc">
          {/* `flex: '0 0 220px'` y no `maxWidth`: adentro de una fila flex un
              contenedor sin ancho se encoge a su contenido, y como la barra mide
              100% del padre, el resultado era 0 px — la barra existía y no se
              veía. Justo en el estado que sin progreso no comunica nada. */}
          {/* ⚠️ ×100. `progreso` de <Mako> va de 0 a 1 (así lo declara su prop) y
              `Progress.value` va de 0 a 100. Sin la conversión, un 0,62 se
              redondeaba a **1%** y un 0,33 a **0%**: la barra existía, medía lo
              que tenía que medir, y estaba vacía. Se ajustó su ancho tres veces
              —incluido el `flex: 0 0 220px` de acá abajo— sin mirar nunca el
              valor. Justo en el estado que sin progreso real no comunica nada. */}
          {progreso !== undefined && <span style={{ flex: '0 0 220px' }}><Progress value={progreso * 100} tono="mako" /></span>}
          {/* La fuente y el avance, en la misma línea que la barra. Un «68%» sin
              decir de qué no informa más que un spinner, y la fuente sola
              arriba partía la frase del título. */}
          {(fuente || !!datos?.length) && (
            <span className="mk-mako__fuente">
              {[
                fuente,
                ...(datos ?? []).map((d) => `${d.k} ${typeof d.v === 'string' ? d.v : ''}`),
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      </div>
    );
  }


  // ── DECISIÓN ──────────────────────────────────────────────────────────────
  // Una fila que se abre. El porqué completo, arriba de `Decision`.
  if (def.forma === 'decision') {
    return <Decision props={props} def={def} t={t} marca={marca} />;
  }

  // ── AVISO ─────────────────────────────────────────────────────────────────
  // Te estás enterando de algo: no hay nada que decidir ni nada corriendo. Esta
  // sí es una tarjeta, porque es una unidad cerrada que se lee entera de una vez
  // y no tiene segundo nivel que esconder.
  //
  // Sin fondo de color y SIN RÓTULO arriba: el kicker se sacó también acá (ver
  // el porqué arriba de `Decision`). La marca va en la misma línea que el
  // título y no en un renglón propio, porque un renglón con la marca sola es
  // una fila fantasma de 16 px que igual se come el `gap` de la tarjeta — el
  // mismo defecto del `titulo` undefined que este archivo documenta más arriba.
  return (
    <div className="mk-mako">
      <div className="mk-mako__linea">
        {marca}
        <span className="mk-mako__t">{titulo}</span>
        {importancia && <span className="mk-mako__imp">{IMPORTANCIA[importancia]}</span>}
      </div>
      {detalle && <div className="mk-mako__d">{detalle}</div>}

      {!!datos?.length && (
        <dl className="mk-mako__datos">
          {datos.map((d) => (
            <div key={d.k} className="mk-mako__dato">
              <dt className="mk-mako__k">{d.k}</dt>
              <dd className="mk-mako__v">{d.v}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* La evidencia RESPALDA la afirmación: se lee cuando dudás, no siempre. */}
      {evidencia && (
        <details className="mk-mako__ev">
          <summary>Evidencia</summary>
          <div className="mk-mako__evc">{evidencia}</div>
        </details>
      )}

      {deshacer && (
        <div className="mk-row" style={{ marginTop: 2 }}>
          {/* Deshacer NO es una acción principal: es la salida de emergencia de
              algo que ya pasó, y es lo que permite que MaKo haga sin preguntar
              todo lo que se puede desandar. */}
          <Boton a={deshacer} variant="secondary" />
        </div>
      )}
    </div>
  );
}

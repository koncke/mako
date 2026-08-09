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

import { useEffect, useState, type ReactNode } from 'react';
import { MakoStar } from '@/app/_components/MakoBrand';
import { GRAMATICA, type EstadoMako, type DefEstado } from '@/lib/mako-gramatica';
import { TONO, type Tono } from './tokens';
import { Button, ButtonLink } from './Button';
import { Progress } from './Feedback';

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
  /** Lo que respalda la afirmación. Va PLEGADO: respalda, no se lee siempre. */
  evidencia?: ReactNode;
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
   * Fuerza el estado inicial del panel. Por defecto lo decide la gramática:
   * abre sola la que BLOQUEA, porque el usuario la va a abrir siempre y hacerle
   * pagar un click para llegar a lo que sí o sí tiene que leer es costo puro.
   *
   * ⚠️ Existe por UN caso: con dos aprobaciones vivas, dos paneles abiertos son
   * otra vez el muro que este rediseño vino a sacar. La lista deja abierta la
   * primera y le pasa `arrancaAbierta={false}` al resto.
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

/** El significante de «esto se abre acá, no te lleva a otra página». */
function Caret() {
  return (
    <svg className="mk-dec__caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
      <path d="M3 4.5 6 8l3-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// =============================================================================
// DECISIÓN — una FILA que se abre, no una tarjeta
// =============================================================================
// El pedido del dueño, textual: «es mejor que muestre poco en la tarjeta y si la
// abrís te muestre todo». La versión anterior mostraba 7, 8 y 6 elementos de
// texto sin abrir nada, y él la rechazó tres veces seguidas. Las tres rondas de
// arreglos movieron cómo se veían esos elementos y nunca preguntaron por qué
// estaban ahí.
//
// La causa de raíz era que la tarjeta dibujaba los CAMPOS del estado en vez de la
// consecuencia de decidir: `exige` se leyó como instrucción de layout, así que
// cada tarjeta salía como un formulario —etiqueta gris, valor, etiqueta gris,
// valor— y encima con un <details> cuyo `summary` era el ÍNDICE de las etiquetas
// que había adentro. Se le sacaron filas al formulario y siguió siendo un
// formulario.
//
// Lo que queda cerrado son DOS elementos de texto:
//
//   TÍTULO        el hecho. Sin él la fila no dice nada.
//   CONSECUENCIA  la frase con el número que permite decidir SI vale abrir.
//
// No hay un tercero porque cualquier tercer texto vuelve a ser un campo. Y no
// hay botones: un botón en una fila cerrada invita a decidir sin haber leído, y
// en la aprobación eso era directamente un defecto de seguridad.
//
// Tres cosas que se sacaron y por qué, cada una con su fuente:
//
//   · EL RÓTULO EN MONOSPACE arriba del título. Es un «kicker», y la guía de
//     oficio que usamos lo prohíbe sin excepción: «A kicker or eyebrow above a
//     heading. This one is a ban, not a default: no brief earns it back. The
//     heading carries its own weight». Sigue vivo en GRAMATICA —el chip, la
//     tabla y el panel abierto lo pintan—, así que el contrato de que el estado
//     se llame igual en las cuatro tabs no se rompe.
//     Y se sacó también de la forma `aviso`, más abajo: el test es si el rótulo
//     dice algo que el título no diga ya, y en tres de los cuatro la respuesta
//     era no («El costo se duplicó en 3 días» ES «Algo cambió»). El único que
//     cargaba peso real era «Hecho» sobre «3 anuncios pausados», que es ambiguo
//     entre «hay 3 pausados» y «acabo de pausar 3» — y eso se arregla poniendo
//     el verbo en el título, no dejando una excepción a un veto sin excepciones.
//   · LA CAJA. «Cards are the lazy container»: tres tarjetas del mismo tamaño
//     apiladas son el antipatrón nombrado. Son una lista con filete de 1 px.
//   · EL FONDO DE COLOR de la aprobación. Fondo + borde + botón lleno eran tres
//     señales para decir una sola cosa. Queda el botón, que además es el único
//     naranja de la pantalla.
function Decision({
  props, def, t, marca,
}: { props: MakoProps; def: DefEstado; t: (typeof TONO)[Tono]; marca: ReactNode }) {
  const { titulo, detalle, consecuencia, advertencia, datos, evidencia, accion, secundaria, arrancaAbierta } = props;

  // Abre sola la que BLOQUEA. El dueño la va a abrir siempre —nada se mueve sin
  // su sí—, así que cobrarle un click para llegar a lo que tiene que leer es
  // costo de interacción puro. Las otras dos arrancan cerradas.
  const [abierta, setAbierta] = useState(arrancaAbierta ?? def.bloquea === true);

  // Controlado y no `<details open>` suelto: React vuelve a sincronizar la
  // propiedad `open` en cada render, así que sin este estado el panel se
  // cerraría solo cuando algo de arriba se vuelva a renderizar.
  return (
    <details
      className={`mk-dec${def.bloquea ? ' mk-dec--bloquea' : ''}`}
      open={abierta}
      onToggle={(e) => setAbierta(e.currentTarget.open)}
    >
      {/* Nada de <details name>: acordeón exclusivo NO. Cerrar una para abrir
          otra mueve de lugar el botón que el usuario iba a tocar y rompe la
          comparación que está haciendo — que es justo la tarea acá. */}
      <summary className="mk-dec__fila">
        {marca}
        <span className="mk-dec__txt">
          <span className="mk-dec__t">{titulo}</span>
          {consecuencia && <span className="mk-dec__c">{consecuencia}</span>}
        </span>
        <Caret />
      </summary>

      <div className="mk-dec__panel">
        {/* Acá sí va el rótulo: adentro no es un kicker —el título quedó arriba,
            en la fila— y es lo que sostiene que el estado se llame igual en el
            Plan, el Dashboard, el CRM y el chat. */}
        <span className="mk-dec__rot" style={{ color: t.ink }}>{def.rotulo}</span>

        {detalle && <p className="mk-dec__porque">{detalle}</p>}

        {/* Los campos, TODOS. Acá el formulario está permitido: es el segundo
            nivel, y son los que impiden que una recomendación sea un consejo
            genérico. Lo que estaba mal era mostrarlos antes de que los pidas. */}
        {!!datos?.length && (
          <dl className="mk-dec__campos">
            {datos.map((d) => (
              <div key={d.k} className="mk-dec__campo">
                <dt className="mk-dec__k">{d.k}</dt>
                <dd className="mk-dec__v">{d.v}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Sin sub-plegado. Dos niveles, nunca tres. */}
        {evidencia && <div className="mk-dec__ev">{evidencia}</div>}

        {(accion || secundaria || advertencia) && (
          <div className="mk-dec__pie">
            {/* La consecuencia va PEGADA al botón y en tinta normal, no en gris
                arriba de todo: es feedforward (Microsoft HAX G16-A), se lee
                donde se actúa. En gris y lejos, no la lee nadie. */}
            {advertencia && <p className="mk-dec__adv">{advertencia}</p>}
            <div className="mk-row">
              {/* El botón lleno es SOLO de la que bloquea. Un botón lleno es un
                  compromiso: aceptar una sugerencia opcional no lo es, y abrir
                  otra pantalla tampoco. */}
              {accion && <Boton a={accion} variant={def.bloquea ? 'primary' : 'secondary'} />}
              {secundaria && <Boton a={secundaria} variant="tertiary" />}
            </div>
          </div>
        )}
      </div>
    </details>
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
      <span className="mk-mako mk-mako--inline" title={porQue || undefined}>
        {marca}
        <span className="mk-mako__t">{titulo}</span>
        {/* Secundario, NO primario: un botón azul lleno adentro de una pastilla
            dorada de 28 px son dos acentos peleando otra vez, y encima le da a
            una sugerencia el peso de la acción principal de la pantalla. */}
        {accion && <Boton a={accion} variant="secondary" />}
        {secundaria && <Boton a={secundaria} variant="tertiary" />}
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
        <div className="mk-mako__cab">
          {marca}
          <span className="mk-mako__rot" style={{ color: t.ink }}>{def.rotulo}</span>
          {fuente && <span className="mk-mako__fuente">· {fuente}</span>}
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
          {progreso !== undefined && <span style={{ flex: '0 0 220px' }}><Progress value={progreso} tono="mako" /></span>}
          {!!datos?.length && (
            <span className="mk-mako__fuente">{datos.map((d) => `${d.k} ${typeof d.v === 'string' ? d.v : ''}`).join(' · ')}</span>
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

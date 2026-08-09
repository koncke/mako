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

import { useEffect, type ReactNode } from 'react';
import { MakoStar } from '@/app/_components/MakoBrand';
import { GRAMATICA, type EstadoMako } from '@/lib/mako-gramatica';
import { TONO } from './tokens';
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
  recomienda: ['datos'],
  aprobacion: ['datos', 'accion'],
  ejecuta: ['datos'],
  completo: ['datos'],
  vigila: ['datos'],
  sin_conclusion: ['datos', 'accion'],
};

/** Ya avisados, para no repetir el mismo warning en cada render. */
const avisados = new Set<string>();

function useAvisoDeDesarrollo(estado: EstadoMako, props: MakoProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    // El chip NO tiene que cumplir el contrato: es una REFERENCIA a un estado
    // («esta fila está en aprobación»), no su presentación. Los campos
    // obligatorios los debe el lugar donde el estado se muestra entero. Sin
    // esta línea, una tabla de 40 filas escupe 40 avisos que no se pueden
    // resolver, y a la semana nadie mira la consola.
    if (props.compacto) return;
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
  const marca = (
    <span className="mk-mako__marca" aria-hidden>
      {def.tono === 'mako'
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

  // El fondo del tono SOLO cuando el estado te está esperando. Para el resto, la
  // tarjeta común: el estado ya lo dicen la marca y el rótulo, y pintar las nueve
  // deja el color sin significado justo donde hace falta que lo tenga.
  const esperando = def.esperaAlUsuario === true;

  return (
    <div
      // El botón toma el color del estado SOLO en la aprobación (tono warn).
      // «Falta un dato» también espera al usuario, pero su acción —«Ir a
      // completarlos en el CRM»— es navegación normal y le toca el azul de
      // siempre: azul es «vos actuás». Pintarlo naranja como la aprobación decía
      // «cuidado» donde no hay ningún riesgo.
      className={`mk-mako${esperando && def.tono === 'warn' ? ' mk-mako--espera' : ''}`}
      // `aria-live` solo donde el estado CAMBIA solo: anunciar una tarjeta
      // estática cada vez que se monta es ruido para quien usa lector.
      role={enProceso ? 'status' : undefined}
      aria-live={enProceso ? 'polite' : undefined}
      style={esperando ? { background: t.bg, borderColor: t.border } : undefined}
    >
      <div className="mk-mako__cab">
        {marca}
        <span className="mk-mako__rot" style={{ color: t.ink }}>{def.rotulo}</span>
        {importancia && <span className="mk-mako__imp">{IMPORTANCIA[importancia]}</span>}
      </div>

      <div className="mk-mako__t">{titulo}</div>
      {detalle && <div className="mk-mako__d">{detalle}</div>}

      {/* El progreso va con su fuente pegada: «68%» sin decir de qué no informa
          más que un spinner, y el documento pide las dos cosas juntas. */}
      {(progreso !== undefined || fuente) && (
        <div className="mk-mako__proc">
          {progreso !== undefined && <Progress value={progreso} tono="mako" />}
          {fuente && <span className="mk-mako__fuente">Leyendo {fuente}</span>}
        </div>
      )}

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

      {evidencia && (
        <details className="mk-mako__ev">
          <summary>Ver la evidencia</summary>
          <div className="mk-mako__evc">{evidencia}</div>
        </details>
      )}

      {(accion || secundaria || deshacer) && (
        <div className="mk-row" style={{ marginTop: 2 }}>
          {accion && <Boton a={accion} variant="primary" />}
          {/* Deshacer NO es la acción principal: es la salida de emergencia de
              algo que ya pasó. En secundario, y siempre primero entre las
              secundarias — es lo que la gente busca cuando se arrepiente. */}
          {deshacer && <Boton a={deshacer} variant="secondary" />}
          {secundaria && <Boton a={secundaria} variant="tertiary" />}
        </div>
      )}
    </div>
  );
}

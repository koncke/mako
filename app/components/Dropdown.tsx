'use client';

// =============================================================================
// Dropdown — desplegable estilizado (reemplaza el <select> nativo plano)
// =============================================================================
// Botón + menú flotante con ítems de hasta dos líneas (título + subtítulo) y un
// punto de color opcional. Cierra por click afuera, Escape, scroll o resize.
// El menú se renderiza en un PORTAL (position: fixed sobre document.body) para
// que NO lo recorte ningún contenedor con overflow (ej. el scroll del modal de
// detalle): antes, dentro de un modal scrolleable el menú se cortaba al abrir.

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties , type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { puedeApagar, rotuloDeVarios } from './dropdown-varios';
import { altoMaximoDelMenu, lugarDelMenu, CAJA_MENU, SEPARACION_MENU } from './dropdown-lugar';
import { conBuscador, estiloDeVariante, anchoPorDefecto, type VarianteDropdown } from './dropdown-reglas';
import { IconoMenu, esIconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';

const SANS = "'Geist', sans-serif";

/**
 * El ícono de un renglón o de una sección (sexta tanda, general 10: «pon íconos en todos los
 * desplegable, en todas las opciones»). Tres formas en UN campo, y no tres campos para el mismo lugar:
 *   · el NOMBRE de uno del set de la casa (`'duplicar'`, app/_ui/iconos-menu.tsx), que se puede pedir
 *     desde una lista armada en un `.ts`; `'borrar'` sale rojo siempre;
 *   · la URL de una imagen o un `data:` de un SVG (los logos del ＋ del lienzo, como hasta ahora);
 *   · un dibujo propio (un elemento de React).
 * Un nombre nunca trae `:` ni `/`, así que no se confunde con una URL (`esIconoMenu`).
 */
export type IconoDeOpcion = NombreIconoMenu | (string & {}) | ReactElement;

/** El ícono de una opción, venga como nombre del set, como URL o como elemento. Lo usa también el menú del lienzo. */
export function IconoOpcion({ icono, size = 18 }: { icono: IconoDeOpcion; size?: number }) {
  if (typeof icono === 'string') {
    if (esIconoMenu(icono)) return <span aria-hidden style={{ display: 'inline-flex', flex: 'none', color: 'var(--dim)' }}><IconoMenu nombre={icono} size={size - 1} /></span>;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icono} alt="" width={size} height={size} style={{ display: 'block', flex: 'none' }} />;
  }
  return <span aria-hidden style={{ display: 'inline-flex', flex: 'none', color: 'var(--dim)' }}>{icono}</span>;
}

// Avatar de una opción-persona: foto de perfil o iniciales. Se muestra cuando la
// opción trae la prop `avatar` (string = foto · null = persona sin foto → iniciales).
const optIniciales = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
// `cuadrado` = imagen rectangular con esquinas apenas redondeadas (banderas de
// país): una bandera recortada en círculo pierde la mitad del diseño.
function OptAvatar({ url, name, size = 22, cuadrado = false }: { url: string | null | undefined; name: string; size?: number; cuadrado?: boolean }) {
  const radio = cuadrado ? 3 : '50%';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={cuadrado ? Math.round(size * 0.75) : size} style={{ borderRadius: radio, display: 'block', flex: 'none', objectFit: 'cover' }} referrerPolicy="no-referrer" />;
  }
  return <span aria-hidden style={{ width: size, height: size, borderRadius: radio, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.42), fontWeight: 700, background: 'var(--primary)', color: '#fff' }}>{optIniciales(name)}</span>;
}

/**
 * La elección MÚLTIPLE, cuando el desplegable la tiene prendida (prop `varios`).
 *
 * Va como UN objeto y no como dos parámetros sueltos: `renderOption` ya recibe siete
 * posicionales, y un octavo y un noveno que siempre viajan juntos son la forma de que
 * un call site pase uno y se olvide del otro.
 */
type Varios = { valores: string[]; minimo: number };

// Botón de una opción del menú (compartido por la lista plana y las columnas).
//
// En columnas el `sub` se omite POR DEFECTO: el título del grupo ya da ese contexto. Lo
// vuelve a prender `subEnColumnas`, para las listas donde el `sub` no es contexto sino
// el DATO —un valor de ejemplo— o el MOTIVO por el que la opción está apagada. Sin eso,
// una opción `disabled` en columnas es un renglón gris sin una palabra que lo explique,
// que es exactamente lo que esta casa llama un control que se lee como roto. Medido en
// el navegador el 04/10/2026 con el catálogo de datos de un mensaje.
function renderOption(
  o: DropdownOption,
  value: string,
  resetAfterSelect: boolean,
  onChange: (v: string) => void,
  close: () => void,
  enColumna: boolean,
  conSub = false,
  varios?: Varios,
) {
  // Con `varios`, «elegido» es estar EN el conjunto; sin él, ser EL valor — y ése es el
  // camino de siempre, intacto para las decenas de pantallas que no eligen varios.
  const on = varios ? varios.valores.includes(o.value) : !resetAfterSelect && o.value === value;
  // ⚠️ EL ÚLTIMO QUE QUEDA NO SE PUEDE APAGAR. Es lo que hace que «tiene que quedar al
  // menos uno» sea una propiedad del control y no una validación al guardar: un
  // desplegable que deja vaciarse y después dice «no podés» es un control que miente
  // durante un click.
  const bloqueado = !!varios && !puedeApagar(varios.valores, o.value, varios.minimo);
  const cuerpo = (
    <>
      {/* ⚠️ EN ELECCIÓN MÚLTIPLE VA UNA CASILLA, y SIN TILDE. Hace falta una: el botón
          no puede decir cuáles están marcados uno por uno, y sin ella un renglón
          «prendido» se lee igual que el renglón sobre el que está el cursor. Pero sin
          el ✓, por el pedido de Martín del 29/09/2026 sobre este mismo desplegable —«no
          pongas un check»—: lo marcado se dice RELLENANDO la casilla, que es un portador
          distinto del peso del texto y no repite el que él sacó. Lo fija
          tests/funnel-estructura.test.ts («sin tilde»). */}
      {varios && (
        <span aria-hidden style={{
          width: 15, height: 15, flex: 'none', borderRadius: 4,
          border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
          background: on ? 'var(--primary)' : 'transparent',
          // ⚠️ El último marcado NO se aclara aunque no se pueda desmarcar: pálida, la
          // casilla se leía como desmarcada (visto en el navegador el 06/10/2026). Que
          // está bloqueada lo dicen el cursor y el `title` del renglón.
        }} />
      )}
      {o.avatar !== undefined && <OptAvatar url={o.avatar} name={o.label} size={22} cuadrado={o.avatarCuadrado} />}
      {o.icono && <IconoOpcion icono={o.icono} />}
      {o.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: o.color, flex: 'none' }} />}
      {o.crear && <span aria-hidden style={{ flex: 'none', fontSize: 13, lineHeight: 1 }}>＋</span>}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: on ? 700 : 600, color: on ? (varios ? 'var(--ink)' : 'var(--primary)') : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
        {(!enColumna || conSub) && o.sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 1, lineHeight: 1.3 }}>{o.sub}</span>}
      </span>
      {/* ⚠️ ACÁ HABÍA UN ✓ y se fue el 29/09/2026: «no pongas un check, solo haz que sea
          más notorio que estamos parados en ese producto». Lo elegido ya se dice DOS veces
          —el renglón lleva su fondo y su texto en tinta fuerte, y el botón de arriba lo
          muestra escrito—: el tilde era un tercer portador del mismo dato. */}
    </>
  );
  const estilo: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '9px 11px', borderRadius: 8, border: 'none',
    cursor: o.disabled || bloqueado ? 'default' : 'pointer',
    // Lo elegido, LLAMATIVO (10/10/2026, CRON 4: «que esté pintado o llamativo de otra manera»): el fondo
    // del color primario suave. Con casillas (`varios`) la casilla rellena ya lo dice: ahí sigue el gris.
    background: on ? (varios ? 'var(--surface-2)' : 'var(--primary-bg)') : 'transparent',
    color: o.crear || o.sutil ? 'var(--faint)' : 'var(--ink)',
    fontFamily: SANS, fontSize: o.sutil ? 12.5 : 13.5,
    opacity: o.disabled ? 0.45 : o.sutil ? 0.7 : o.crear ? 0.8 : 1,
    // ⚠️ EL FILETE VA DEBAJO DE «Nuevo producto», no encima: «que la linea divisoria esté
    // debajo de "Nuevo producto" y que el "Productos eliminados" esté centrado» (Martín,
    // 30/09/2026). Crear uno nuevo es la última acción de la LISTA de productos, así que
    // va pegada a ella; lo eliminado es otra cosa, y el filete es lo que las separa.
    // Sólo hay UN call site de `crear` (app/crm/CrmToolbar.tsx), así que mover la línea no
    // le toca el menú a ninguna otra pantalla. Y sin renglón sutil no hay filete: ahí
    // «Nuevo producto» cierra la lista y no hay nada de lo que separarse.
    ...(o.crear ? { borderRadius: 0, marginTop: 4 } : null),
    // El centrado va por `textAlign` y NO por `justifyContent`: el rótulo vive en un span
    // con `flex: 1`, o sea que ocupa el renglón entero y el eje principal ya no mueve nada.
    ...(o.sutil ? { borderTop: '1px solid var(--border)', borderRadius: 0, textAlign: 'center', marginTop: 4, padding: '8px 11px 3px' } : null),
    transition: 'color .12s, opacity .12s',
  };
  // Con `varios` se ALTERNA y el menú NO se cierra: marcar tres productos no puede costar
  // abrir el desplegable tres veces. Quien llama recibe el valor tocado y arma el
  // conjunto — el componente no guarda estado propio de la selección, igual que con un
  // solo valor.
  const elegir = () => {
    if (o.disabled) return;
    if (varios) { if (!bloqueado) onChange(o.value); return; }
    onChange(o.value); close();
  };

  // ⚠️ SÓLO LAS ACCIONES: el renglón no lleva rótulo ni parte clicable propia — son DOS
  // BOTONES en una línea. «El botón de mover no debería tener la palabra mover, solo las
  // flechas… en realidad, deberían ser 2 botones diferentes, solo que están en la misma
  // linea» (Martín, 30/09/2026). Se resuelve ANTES del renglón con acciones de abajo,
  // donde el rótulo se queda con el `flex: 1`: con el texto vacío eso deja media fila que
  // se ve clicable y no hace nada, que es peor que el rótulo que se vino a sacar.
  //
  // ⚠️ Y EL HOVER VA INLINE, no por el velo de `.crm-hover`: el menú se dibuja por PORTAL
  // sobre el <body>, así que la regla del `<main>` de la ruta no lo alcanza.
  if (o.soloAcciones && o.acciones?.length) {
    return (
      <div key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
        {o.acciones.map((a) => (
          <button key={a.title} type="button" title={a.title} aria-label={a.title}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); a.onClick(); if (a.cierra) close(); }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--faint)'; }}
            style={{
              flex: 1, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer',
              color: a.tone === 'bad' ? 'var(--bad)' : 'var(--faint)', transition: 'background .12s, color .12s',
            }}>
            {a.icono}
          </button>
        ))}
      </div>
    );
  }
  // Sin acciones, el renglón es EXACTAMENTE el de siempre: un solo <button>. Se
  // deja intacto a propósito — este componente lo usan decenas de pantallas y la
  // variante nueva no tiene por qué tocarles el marcado.
  if (!o.acciones?.length) {
    return (
      <button key={o.value} type="button" disabled={o.disabled} onClick={elegir}
        // Un renglón que se prende y se apaga es un botón de dos estados: `aria-pressed`
        // dice cuál, sin tener que declararle un rol a éste solo (ningún renglón de este
        // menú declara el suyo, y uno solo con rol es peor que ninguno).
        aria-pressed={varios ? on : undefined}
        title={bloqueado ? 'Tiene que quedar al menos uno' : undefined}
        // El de CREAR no cambia de fondo: se enciende. Apagado dice «esto todavía no
        // existe»; encendido, «esto se puede hacer».
        onMouseEnter={(e) => {
          if (o.disabled || on) return;
          if (o.crear || o.sutil) { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.opacity = '1'; }
          else e.currentTarget.style.background = 'var(--surface-2)';
        }}
        onMouseLeave={(e) => {
          if (o.crear || o.sutil) { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.opacity = o.sutil ? '0.7' : '0.8'; return; }
          if (!on) e.currentTarget.style.background = 'transparent';
        }}
        style={estilo}>
        {cuerpo}
      </button>
    );
  }

  // ⚠️ CON ACCIONES, el renglón NO puede ser un botón: un <button> adentro de otro
  // es marcado inválido y el click del de afuera se dispara igual, así que
  // «borrar» además seleccionaría lo que se acaba de borrar. Van como hermanos
  // dentro de una fila, y el hover lo maneja la fila.
  return (
    <div key={o.value} data-fila-opcion
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
      style={{ display: 'flex', alignItems: 'center', gap: 2, borderRadius: 8, paddingRight: 5, background: on ? 'var(--surface-2)' : 'transparent' }}>
      <button type="button" disabled={o.disabled} onClick={elegir} style={{ ...estilo, background: 'transparent', minWidth: 0, flex: 1 }}>
        {cuerpo}
      </button>
      {o.acciones.map((a) => (
        <button key={a.title} type="button" title={a.title} aria-label={a.title}
          // stopPropagation Y preventDefault: el menú se cierra por un listener de
          // click en el documento, así que sin esto la acción corre y el panel
          // desaparece — que se lee como que no pasó nada.
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); a.onClick(); if (a.cierra) close(); }}
          onMouseDown={(e) => e.stopPropagation()}
          // ⚠️ SIN RECUADRO: «pon solo el lápiz, no un recuadro alrededor del lápiz». Un
          // borde por renglón convierte una lista de cuatro productos en ocho cajas.
          style={{ flex: 'none', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: a.tone === 'bad' ? 'var(--bad)' : 'var(--faint)' }}>
          {a.icono}
        </button>
      ))}
    </div>
  );
}

/**
 * Un botón de acción DENTRO de un renglón del menú (corregir, quitar…).
 *
 * Existe porque una colección que se elige de un desplegable es también una
 * colección que hay que mantener, y hacerlo desde afuera solo alcanza para la
 * que está seleccionada: con 40 renglones, «quitá el que sobra» obligaba a
 * seleccionarlo primero — o sea, a elegir lo que se quiere sacar.
 */
export type DropdownAccion = { icono: ReactNode; title: string; tone?: 'bad'; onClick: () => void;
  /**
   * La acción ABRE OTRA PANTALLA (un editor, un modal): el menú se cierra al tocarla.
   *
   * ⚠️ El default es NO cerrar, y está bien para lo que se hace ADENTRO del menú (quitar
   * un renglón y seguir mirando la lista). Lo que abre un modal es lo contrario: el menú
   * vive en un portal sobre el `body` con su propio z-index, así que queda flotando
   * ENCIMA del modal que se acaba de abrir — medido el 05/10/2026 con el lápiz del
   * selector de productos de Customer Success, tapando el título del editor.
   */
  cierra?: boolean };

export type DropdownOption = { value: string; label: string; /** Un ícono antes del título, a 18 px: el NOMBRE de uno del set de la casa (`'duplicar'`, app/_ui/iconos-menu.tsx), una URL o `data:` de un SVG (un logo), o un dibujo propio. Una persona va con `avatar`; una etapa o una etiqueta del negocio, con `color` (no se estandarizan). */ icono?: IconoDeOpcion; sub?: string; /** Texto extra que la búsqueda mira, además del título y el subtítulo. Para cuando el dato que uno recuerda no está escrito en el renglón (un token, un alias, un código). */ buscar?: string; color?: string; disabled?: boolean; /** Avatar de persona: URL de foto, o null = sin foto (iniciales). undefined = no es persona (no muestra avatar). */ avatar?: string | null; /** true = imagen rectangular con esquinas suaves (banderas), no círculo. */ avatarCuadrado?: boolean; /** Acciones propias del renglón. Con esto el renglón deja de ser un <button>. */ acciones?: DropdownAccion[];
  /**
   * La salida para CREAR uno nuevo, no una opción más de la lista.
   *
   * Se dibuja APAGADA —`--faint`, con su `＋` y una línea que la separa— y se ILUMINA
   * al pasar el cursor. Es el mismo molde que «＋ Nueva tarea» del tablero del plan
   * (`app/plan/board/BoardShell.tsx`), y el pedido fue textual: «que sea algo
   * transparente, opaco, como queriendo agregar uno nuevo, y que al pasar el cursor se
   * ilumine, ya lo hicimos un montón de veces».
   *
   * Por qué es un flag del primitive y no un estilo en cada llamador: con el mismo peso
   * que las opciones reales, «crear» compite con ellas justo cuando lo que se está
   * haciendo es elegir entre las que ya existen. Eso vale para todo desplegable, no
   * para éste — y si vive en el llamador, el próximo nace sin él.
   */
  crear?: boolean;
  /**
   * Un renglón que es CASI sólo texto: más chico, más apagado y sin el `+` de `crear`.
   *
   * Para lo que tiene que estar pero no compite con las opciones de verdad — la puerta de
   * vuelta a lo eliminado, por ejemplo. Con `crear` se veía igual que «Nuevo producto», y
   * dos renglones con el mismo peso son dos acciones con el mismo peso.
   */
  /**
   * El renglón NO dibuja su rótulo: son sus `acciones` y nada más, repartidas a lo ancho.
   *
   * `label` queda como nombre interno (la key del renglón y lo que se lee en el código);
   * lo que la persona ve es el `title` de cada botón. Para un par de acciones opuestas
   * —mover a la izquierda / a la derecha— donde el rótulo no agrega nada: los dos íconos
   * ya dicen qué hace cada uno, y la palabra de más convierte dos botones en un renglón.
   */
  soloAcciones?: boolean;
  sutil?: boolean;
  /**
   * Una LÍNEA arriba de este renglón: separa dos preguntas adentro de la misma lista.
   *
   * Existe por el filtro de la lista de /automations (quinta tanda, punto 4, pedido literal: «dentro
   * de la sección canal, luego de WhatsApp y Email, un divider y las opciones "A clientes" y "Al
   * WhatsApp de MaKo"»): por dónde sale y a quién le llega son dos preguntas, y sin la línea se
   * leían como cuatro canales. Es una línea suelta y no un borde del renglón: el renglón sigue
   * con su fondo redondeado al pasar el cursor.
   */
  lineaArriba?: boolean };
/** Grupo con título para menús en columnas (ver prop `columns`) o por secciones (`secciones`). */
export type DropdownGroup = { title: string; options: DropdownOption[];
  /** Sólo con `secciones`: el ícono de la fila que ABRE la sección (CRM, WhatsApp…), como el de un renglón. */
  icono?: IconoDeOpcion;
  /**
   * Sólo con `secciones`: la sección es un ATAJO — sus opciones viven TAMBIÉN en otra sección
   * («Más usadas» del selector de acciones de un flujo, 08/10/2026). En la raíz se ofrece como
   * cualquiera; con texto en el buscador NO se dibuja, porque buscar aplana y cada resultado salía
   * dos veces, una con el rótulo del atajo y otra con el de su sección de verdad. Opcional: ninguna
   * de las pantallas de antes lo pasa, así que para ellas no cambia nada.
   */
  atajo?: boolean;
  /**
   * Sólo con `secciones`: UN NIVEL MÁS. La sección no lista opciones sino otras secciones, que se
   * abren igual (con su ‹ para volver). Existe por el disparador del CRON de /automations (tercera tanda,
   * 09/10/2026): «los productos, solo el nombre... al ingresar, 2 opciones: Entrega o Adquisición, y
   * dentro las etapas de cada kanban». Buscar aplana también esto: el rótulo de cada tramo es el
   * camino («Producto · Adquisición de clientes»). Opcional: sin `grupos`, nada cambia.
   */
  grupos?: DropdownGroup[];
  /**
   * Sólo con `secciones`: lo que la fila de la sección dice a la DERECHA en la raíz, en vez de
   * cuántas opciones tiene. Es el «resumen» del filtro del Plan (app/plan/board/BoardShell.tsx,
   * `FilterMenu`): «Todos», lo que está marcado, o «2 elegidos» — dice qué tiene puesto cada
   * sección sin tener que entrar. Existe por el filtro de la lista de /automations (quinta tanda,
   * punto 4: «Replica el desplegable de Filtro que tenemos en el plan»). Sin esto, el conteo de
   * siempre.
   */
  resumen?: string;
  /** Con `resumen`: la sección tiene algo marcado, y el resumen se pinta en el color de lo elegido. */
  activo?: boolean };

/** Las opciones de un grupo y de todos los de adentro. */
function opcionesDe(g: DropdownGroup): DropdownOption[] {
  return [...g.options, ...(g.grupos ?? []).flatMap(opcionesDe)];
}
/**
 * EL CAMINO HASTA LO ELEGIDO: los títulos de las secciones que hay que abrir para llegar al renglón de
 * `valor` (null = no está en ninguna). Lo usa la apertura: el menú abre PARADO ahí (10/10/2026, CRON 4:
 * «si ya tengo configurado un cron, al abrir el desplegable me marque y este ya abierto la opción que
 * seleccioné»). Exportado para el test.
 */
export function caminoDe(gs: readonly DropdownGroup[] | undefined, valor: string): string[] | null {
  if (!gs || !valor) return null;
  for (const g of gs) {
    if (g.options.some((o) => o.value === valor)) return [g.title];
    const adentro = caminoDe(g.grupos, valor);
    if (adentro) return [g.title, ...adentro];
  }
  return null;
}
/** Los grupos con algo que mostrar después de filtrar, con sus hijos filtrados también. */
function filtrarGrupos(gs: readonly DropdownGroup[], coincide: (o: DropdownOption) => boolean, sinAtajos: boolean): DropdownGroup[] {
  return gs
    .filter((g) => !(sinAtajos && g.atajo))
    .map((g) => ({ ...g, options: g.options.filter(coincide), ...(g.grupos ? { grupos: filtrarGrupos(g.grupos, coincide, sinAtajos) } : {}) }))
    .filter((g) => g.options.length > 0 || (g.grupos?.length ?? 0) > 0);
}
/** Buscando se aplana: un tramo por grupo con opciones, rotulado con su camino. */
function tramosPlanos(gs: readonly DropdownGroup[], camino: string[] = []): Array<{ title: string; options: DropdownOption[] }> {
  return gs.flatMap((g) => [
    ...(g.options.length ? [{ title: [...camino, g.title].join(' · '), options: g.options }] : []),
    ...tramosPlanos(g.grupos ?? [], [...camino, g.title]),
  ]);
}

type MenuPos = { top?: number; bottom?: number; left?: number; right?: number; width: number;
  /** El alto que queda entre el botón y el borde de la ventana, del lado donde abre. */
  espacio?: number };

export function Dropdown({
  value,
  options,
  columns,
  onChange,
  placeholder = 'Seleccionar…',
  width,
  align = 'left',
  buttonStyle,
  resetAfterSelect = false,
  sinFlecha: sinFlechaPedida = false,
  ariaLabel,
  botonLabel,
  disabled = false,
  search,
  secciones,
  subEnColumnas = false,
  alContenido = false,
  portalTo,
  icono,
  varios,
  minimo = 0,
  menuAncho,
  menuMinAncho,
  menuAlto,
  pie,
  variante,
}: {
  value: string;
  options?: DropdownOption[];
  /**
   * Menú en columnas lado a lado (evita el scroll de listas largas): cada
   * columna es una lista de grupos {título, opciones}. Si se pasa, `options`
   * se ignora. En pantallas angostas las columnas hacen wrap a una sola.
   */
  columns?: DropdownGroup[][];
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  /** De qué lado del botón se abre el menú. `afuera`: a la DERECHA del botón y a su altura, sin
   *  taparlo ni tapar lo que está a su izquierda (el «⋯» de una fila de una lista: «el desplegable
   *  debería salir para el otro lado, no tapar a la tarjeta», 09/10/2026). */
  align?: 'left' | 'right' | 'afuera';
  buttonStyle?: CSSProperties;
  /** Para selects-acción (ej. "Mover a…"): no refleja la selección, vuelve al placeholder. */
  resetAfterSelect?: boolean;
  /** Menú de acciones: sin la flecha del desplegable. */
  sinFlecha?: boolean;
  ariaLabel?: string;
  /** Deshabilita TODO el desplegable (no se puede abrir): p.ej. mientras cargan las opciones. */
  disabled?: boolean;
  /**
   * Caja de búsqueda arriba del menú. Sin pasar nada aparece SOLA cuando hay más
   * de 7 opciones (`UMBRAL_BUSCADOR`, ./dropdown-reglas.ts; eran 8 hasta la sexta
   * tanda: «Agrega la barra de busqueda en todos los desplegables... Al menos que
   * por defecto tenga muy pocas opciones»). `false` la apaga a mano.
   */
  search?: boolean;
  /**
   * MENÚ POR SECCIONES: primero se elige la CATEGORÍA y adentro la opción, con una
   * flecha para volver. Si se pasa, `options` y `columns` se ignoran.
   *
   * ⚠️ ES EL PATRÓN DEL FILTRO DEL PLAN, y lo pidió Martín así: «para el desplegable de
   * acciones, copia el estilo del desplegable del filtro del plan, que justamente se
   * abren secciones dentro del desplegable». Aquel (app/plan/board/BoardShell.tsx) no se
   * puede reusar tal cual —cada categoría suya dibuja un control distinto: casillas,
   * radios, un orden— así que lo que se trae es la NAVEGACIÓN, que es lo que él señaló.
   *
   * ⚠️ Y SE ELIGE POR EL TAMAÑO DE LA LISTA, NO POR COHERENCIA. Dos niveles sobre cuatro
   * opciones es un clic de más para no ahorrar nada: el mismo día se probó en el ＋ del
   * lienzo y Martín lo devolvió («son pocas opciones»). Acá son 42 en 8 grupos.
   *
   * ⚠️ Buscar APLANA. Con texto escrito no hay secciones: se ven los resultados de
   * todas, con su grupo como rótulo. Obligar a entrar a una sección para buscar sería
   * pedirle a la persona que sepa dónde está lo que está buscando.
   */
  secciones?: DropdownGroup[];
  /**
   * Dibuja el `sub` TAMBIÉN en modo columnas. Por defecto se omite porque el título del
   * grupo ya da el contexto; se prende cuando el `sub` es el dato (un valor de ejemplo) o
   * el motivo por el que la opción está apagada — que es lo único que explica un renglón
   * gris, y sin él se lee como un control roto.
   */
  subEnColumnas?: boolean;
  /**
   * Con `columns` de UNA columna (grupos uno debajo del otro): el menú mide lo que su
   * contenido —tope 360, como una lista— y no los 500 px de un menú a varias columnas.
   *
   * ⚠️ OPT-IN, y no la regla para toda columna única: hay pantallas que la usan con
   * opciones largas y cuentan con ese ancho. Medido el 05/10/2026 en «Mover a» de
   * Customer Success: nueve etapas de 10 a 20 letras en un menú de 500, con dos tercios
   * vacíos y la última etapa cortada por el alto. Por eso también sube el tope de alto —y
   * lo topea el lugar que QUEDA del lado donde abre: con un tope fijo, abierto desde la
   * mitad de una tabla, se salía 32 px por debajo de la ventana (medido el mismo día).
   */
  alContenido?: boolean;
  /**
   * Dónde se monta el menú. Por defecto `document.body`, que es lo correcto en toda la
   * app.
   *
   * ⚠️ EXISTE POR LA PANTALLA COMPLETA. Cuando un elemento entra al *top layer* del
   * navegador con `requestFullscreen()`, TODO lo que esté fuera de ese subárbol deja de
   * pintarse — incluido un portal a `document.body`. El menú se abre, existe en el DOM,
   * responde al teclado… y no se ve. Sin error y sin warning, que es lo que lo vuelve
   * caro de diagnosticar. El lienzo del grafo usa esa API, así que ahí hay que pasarle
   * `document.fullscreenElement ?? document.body`.
   */
  portalTo?: HTMLElement | null;
  /** Icono fijo a la izquierda del rótulo — el que dice QUÉ hace este control, no qué
   *  está elegido. Va acá y no en cada `option` porque no cambia con la selección: un
   *  desplegable de filtro tiene que leerse como filtro incluso cuando dice «todo». */
  icono?: ReactNode;
  /**
   * Qué dibuja el BOTÓN, cuando no alcanza con el label de la opción elegida.
   *
   * Existe por la categoría del editor de mensajes: el MENÚ tiene que decir
   * «⚡ Acción» —un emoji solo no alcanza, lo fija docs/branding-mako.md: «un color
   * solo deja afuera a quien no lo distingue»— y el BOTÓN tiene que ser nada más que
   * el emoji, porque vive antes del título y un desplegable de 168 px ahí se lee como
   * un paso de la secuencia. Son dos preguntas distintas y antes compartían campo.
   *
   * ⚠️ No reemplaza al `ariaLabel`: el botón sigue anunciándose por él, que es lo que
   * hace que un emoji suelto no deje a nadie afuera.
   */
  botonLabel?: ReactNode;
  /**
   * ELEGIR VARIOS. Con esto cada renglón se PRENDE o se APAGA, el menú NO se cierra al
   * tocar, y `onChange` recibe el valor tocado — quien llama arma el conjunto. `value` se
   * ignora.
   *
   * Existe por el paso 2 del Pixel (app/integraciones/AsignarProducto.tsx): una landing
   * puede vender varios productos, y el pedido fue textual, «hazlo también dentro de un
   * desplegable». Va ACÁ y no en un componente propio por la regla de app/_ui/Select.tsx:
   * «si necesitás algo que el Dropdown no hace, se lo agregás AL Dropdown, no escribís un
   * segundo».
   *
   * ⚠️ Sólo cubre los renglones PLANOS. Un renglón con `acciones` o `soloAcciones` sigue
   * eligiendo uno y cerrando: no hay hoy ningún desplegable que necesite las dos cosas, y
   * mezclar «alternar» con «borrar este renglón» en la misma fila es una pregunta de
   * diseño que no se contesta en una línea.
   */
  varios?: string[];
  /** Con `varios`: cuántos tienen que quedar marcados. El renglón que lo rompería no se apaga. */
  minimo?: number;
  /**
   * El TOPE de ancho y de alto del menú de lista (y del de secciones), en px. Sin pasar nada, los de
   * siempre: 360 × 340. No aplica a `columns`, que tiene los suyos.
   *
   * Existe por el selector de acciones de un flujo (08/10/2026): 17 secciones y renglones de dos
   * líneas (el título y qué hace) en 340 px de alto eran seis renglones a la vista. El alto sigue
   * topado por el lugar que QUEDA del lado donde abre (`altoMaximoDelMenu`), así que pedir más no
   * saca el menú de la ventana.
   */
  menuAncho?: number;
  /** El ancho MÍNIMO del menú, cuando el botón que lo abre es chico (un ＋ de 22 px abría un menú
   *  apretado: «Que sea un poco más ancho el desplegable», 09/10/2026). */
  menuMinAncho?: number;
  menuAlto?: number;
  /**
   * UN TEXTO SUTIL ABAJO DEL TODO del menú, que no es una opción: «Quitar filtros».
   *
   * Pedido de Martín (quinta tanda, punto 4), sobre el filtro del Plan: «"Quitar filtros" es un
   * texto sutil abajo del todo». La cuarta tanda lo había puesto como el PRIMER renglón de la
   * lista, con el peso de una opción, y competía con lo que se estaba eligiendo. Va con la cara
   * del renglón `sutil` (apagado, centrado, con su línea arriba, y se enciende al pasar el cursor)
   * y NO cierra el menú: lo que se quitó se ve en la lista de al lado. Ausente = nada.
   */
  pie?: { label: string; onClick: () => void };
  /**
   * LA CARA DEL BOTÓN (./dropdown-reglas.ts, sexta tanda):
   *   · `principal`: el desplegable que MANDA en un editor —qué acción, qué condición, qué operación—,
   *     más alto, en negrita y de ancho completo si no se le da otro. «Se tiene que diferenciar el
   *     desplegable principal del resto... Tiene que tener más protagonismo el principal» (CONDITION 3,
   *     «para todos lados»);
   *   · `placeholder`: el que AGREGA algo, con borde punteado, el texto centrado y sin flecha, que se
   *     enciende al pasar el cursor (CONDITION 4: «siempre que puedas usa ese diseño tipo placeholder»).
   * Ausente = la cara de siempre: ninguna de las pantallas de antes la pasa. `buttonStyle` va encima.
   */
  variante?: VarianteDropdown;
}) {
  const [open, setOpen] = useState(false);
  /** El cursor sobre el botón: sólo lo usa la variante `placeholder`, que se enciende. */
  const [encima, setEncima] = useState(false);
  // El placeholder agrega algo: no elige un valor, así que no lleva la flecha de «acá se elige».
  const sinFlecha = sinFlechaPedida || variante === 'placeholder';
  const ancho = width ?? anchoPorDefecto(variante);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  /**
   * En qué sección está parada la persona: el CAMINO de títulos (`[]` = la raíz, con la lista de
   * secciones). Un camino y no un título porque una sección puede tener `grupos` adentro.
   */
  const [ruta, setRuta] = useState<string[]>([]);

  // Calcula la posición fija del menú a partir del rect del botón. Abre hacia
  // arriba si abajo no hay lugar (sin empujar el layout). En coordenadas de
  // viewport porque el menú vive en un portal con position: fixed.
  //
  // ⚠️ DECIDE CON LO QUE MIDE EL MENÚ (`alto`, ./dropdown-lugar.ts), no con un número fijo: con «abajo
  // si quedan 300 px» un menú de 340 abría para abajo y se cortaba (item 7 del curso, 08/10/2026). El
  // primer cuadro no tiene el menú para medir y va con la regla de siempre; el efecto de abajo lo mide
  // y lo vuelve a ubicar ANTES de pintar.
  const place = (alto: number | null = null, ancho: number | null = null) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const lugar = lugarDelMenu({ top: r.top, bottom: r.bottom, ventana: window.innerHeight, alto });
    const up = lugar.arriba;
    const vertical = align === 'afuera'
      ? (up ? { bottom: window.innerHeight - r.bottom } : { top: r.top })
      : up ? { bottom: window.innerHeight - r.top + SEPARACION_MENU } : { top: r.bottom + SEPARACION_MENU };
    // El alto que le queda al CONTENIDO: el lugar menos el relleno y el borde de la caja.
    const espacio = Math.max(0, lugar.espacio - CAJA_MENU);
    // Con columnas el ancho del menú es conocido → clampear al viewport para
    // que en pantallas angostas no se salga por el lado del anclaje.
    if (columns && !alContenido) {
      const w = Math.min(500, window.innerWidth - 24);
      const left = Math.min(Math.max(12, align === 'right' ? r.right - w : r.left), window.innerWidth - 12 - w);
      setPos({ width: r.width, ...vertical, left, espacio });
      return;
    }
    // ⚠️ QUE NO SE SALGA POR EL COSTADO (10/10/2026: «al darle se esconde fuera de la pantalla el
    // desplegable, eso no debe pasar», sobre «Probar» pegado al borde derecho). Con el ancho MEDIDO
    // (el segundo cuadro), un menú que abre hacia la derecha y no entra se ancla al borde derecho del
    // botón, y uno que abre «afuera» y no entra, del otro lado del botón.
    const noEntra = (izq: number) => ancho != null && izq + ancho > window.innerWidth - 12;
    const horizontal = align === 'right'
      ? { right: window.innerWidth - r.right }
      : align === 'afuera'
        ? (noEntra(r.right + SEPARACION_MENU) ? { right: window.innerWidth - r.left + SEPARACION_MENU } : { left: r.right + SEPARACION_MENU })
        : (noEntra(r.left) ? { right: Math.max(12, window.innerWidth - r.right) } : { left: r.left });
    setPos({ width: r.width, ...vertical, espacio, ...horizontal });
  };
  const toggle = () => {
    if (disabled) return;
    // El filtro se limpia AL ABRIR y no al cerrar: el menú solo existe abierto,
    // y limpiarlo al cerrar obligaría a un setState por cada camino de cierre
    // (click afuera, Escape, scroll, elegir una opción).
    if (!open) { place(); setQ(''); medido.current = null; }
    setOpen((v) => !v);
  };

  /**
   * EL MENÚ YA EXISTE: se mide su contenido entero y se lo vuelve a ubicar con su alto de verdad, antes
   * de pintar (`useLayoutEffect`). UNA vez por apertura: lo que mide `scrollHeight` no depende del lado
   * donde quedó, así que no hay ida y vuelta; y escribir en el buscador no lo mueve de lugar (un menú que
   * salta de arriba a abajo mientras se tipea se lee como roto).
   */
  const medido = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!open || medido.current != null || !menuRef.current) return;
    // `scrollHeight` es el contenido, aunque el alto máximo lo esté recortando; el borde va aparte.
    medido.current = menuRef.current.scrollHeight + 2;
    place(medido.current, menuRef.current.getBoundingClientRect().width);
    // `place` se arma en cada render y lee las props de ahora: no es una dependencia que cambie el qué.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    /**
     * ⚠️ EN CAPTURA, Y CORTANDO EL EVENTO. Un `<select>` nativo se come el Escape mientras
     * su popup está abierto; este menú no lo hacía, así que abrir un desplegable adentro de
     * un modal y apretar Escape para arrepentirse **cerraba el modal entero**. Medido el
     * 25/09/2026 con la barra de selección del /plan adentro del detalle de un proyecto: el
     * `onKey` del modal (`BoardShell.tsx`) también vive en `document` y también en burbuja,
     * y como se registró al montarse corre ANTES que éste — así que un `stopPropagation`
     * desde acá no llega a tiempo, y un `stopImmediatePropagation` en burbuja tampoco.
     * La captura corre antes que TODA la fase de burbuja del documento, así que es el único
     * lugar desde donde este menú puede quedarse con la tecla.
     *
     * Sólo mientras está abierto: el efecto entero sale con `if (!open) return`, así que un
     * desplegable cerrado no toca el Escape de nadie.
     */
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      setOpen(false);
      // El foco vuelve al botón que abrió: si se queda en el aire, el siguiente Tab
      // arranca desde el principio del documento.
      ref.current?.querySelector('button')?.focus();
    };
    // Al scrollear/redimensionar el menú fijo se despegaría del botón → cerrar.
    // PERO si el scroll ocurre DENTRO del propio menú (lista larga), NO cerrar.
    const onScrollResize = (e?: Event) => {
      if (e && e.type === 'scroll' && e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc, true);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc, true);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open]);

  const flat = secciones ? secciones.flatMap(opcionesDe)
    : columns ? columns.flat().flatMap((g) => g.options)
    : (options ?? []);
  const selected = resetAfterSelect || varios ? undefined : flat.find((o) => o.value === value);
  // ⚠️ CON VARIOS, EL BOTÓN DICE CUÁLES — no «2 seleccionados». Un número obliga a abrir
  // el menú para saber qué se eligió, que es justo lo que el botón de un desplegable
  // existe para ahorrar. Con tres o más no entran: van los dos primeros y cuántos más.
  // El orden es el del CONJUNTO y no el de la lista: el primero que se marcó es el que el
  // botón nombra primero, y es el mismo «principal» que usa quien guarda.
  const marcados = varios
    ? varios.map((v) => flat.find((o) => o.value === v)).filter((o): o is DropdownOption => !!o)
    : [];
  const rotuloVarios = rotuloDeVarios(marcados.map((o) => o.label));
  const elegidoVisible = !!selected || marcados.length > 0;

  // Búsqueda: aparece sola pasadas las 7 opciones (`conBuscador`, ./dropdown-reglas.ts). Filtra por
  // título Y subtítulo (en las listas de personas el dato que uno recuerda suele ser el subtítulo).
  const conBusqueda = conBuscador(flat.length, search);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  // ⚠️ Y TAMBIÉN POR `buscar`, cuando la opción lo trae. Es para las listas donde el
  // dato que uno recuerda no está escrito en ningún renglón: el catálogo de datos de un
  // mensaje se llama «Cuánto falta cobrarle» y el token es `{{lead_saldo}}`, así que
  // buscar «saldo» —que es la palabra que esa persona tiene en la cabeza— daba CERO
  // resultados sobre una lista de 42 (medido en el navegador el 04/10/2026). No se mira
  // el `value` de toda opción a propósito: en una lista de personas o de ids eso haría
  // matchear números sueltos sin que nadie lo pida.
  // ⚠️ «CREAR» NO SE FILTRA: es una acción, no un dato de la lista. Filtrado por su título
  // («Nueva»), escribir en el buscador lo escondía, y el buscador aparece pasadas las 7: el
  // desplegable de etiquetas con 8 o más no dejaba crear una justo cuando uno escribe la que no
  // está (docs/relevo/crm.md, 12/10/2026). Lo fija tests/dropdown-crear-visible.test.ts.
  const coincide = (o: DropdownOption) => !!o.crear || !q.trim() || norm(`${o.label} ${o.sub ?? ''} ${o.buscar ?? ''}`).includes(norm(q.trim()));
  const optsVisibles = (options ?? []).filter(coincide);
  const colsVisibles = columns?.map((col) => col.map((g) => ({ ...g, options: g.options.filter(coincide) })).filter((g) => g.options.length));
  const buscando = q.trim().length > 0;
  // Las secciones con algo que mostrar, ya filtradas por la búsqueda. Buscando, sin los ATAJOS: sus
  // opciones también están en su sección de verdad (ver `atajo` en DropdownGroup).
  const seccVisibles = secciones ? filtrarGrupos(secciones, coincide, buscando) : undefined;
  // La sección abierta: se baja por el camino, nivel por nivel. Un camino que ya no existe (las
  // opciones cambiaron) se lee como la raíz.
  let abierta: DropdownGroup | null = null;
  for (const t of ruta) {
    const nivel: DropdownGroup[] = abierta ? (abierta.grupos ?? []) : (seccVisibles ?? []);
    abierta = nivel.find((g) => g.title === t) ?? null;
    if (!abierta) break;
  }
  const sinResultados = q.trim().length > 0 && (
    secciones ? !seccVisibles?.length
      : columns ? !colsVisibles?.some((c) => c.length)
      : optsVisibles.length === 0);

  // El foco entra solo en la búsqueda: con el menú abierto ya se puede escribir,
  // sin tener que ir a buscar el campo con el mouse.
  useEffect(() => {
    if (!open) { setRuta([]); return; }
    // Se abre PARADO EN LO ELEGIDO (CRON 4); sin nada elegido, en la raíz. Un valor que no está en el
    // árbol (una opción que se fue) también abre en la raíz.
    const elegido = !resetAfterSelect ? (varios?.length ? varios[0] : value) : '';
    const camino = caminoDe(secciones, elegido);
    if (camino) setRuta(camino);
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // Sólo al ABRIR: lo elegido de ese momento. Elegir adentro (con `varios`) no tiene que mover el menú.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** El renglón que ABRE una sección (en la raíz, o adentro de otra con `grupos`). */
  // La sección donde está lo elegido se PINTA (CRON 4: «que esté pintado o llamativo»): así se ve el
  // camino aunque se vuelva atrás.
  const elegidoEn = (g: DropdownGroup) => {
    const marcados = resetAfterSelect ? [] : varios?.length ? varios : value ? [value] : [];
    return marcados.length > 0 && opcionesDe(g).some((o) => marcados.includes(o.value));
  };
  const botonSeccion = (g: DropdownGroup) => (
    <button key={g.title} type="button" onClick={() => setRuta((r) => [...r, g.title])}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 9, width: '100%', padding: '10px 9px', borderRadius: 7, border: 'none', background: elegidoEn(g) ? 'var(--primary-bg)' : 'transparent', cursor: 'pointer', fontSize: 13, color: elegidoEn(g) ? 'var(--primary)' : 'var(--ink)', textAlign: 'left', fontFamily: SANS }}
      onMouseEnter={(e) => { e.currentTarget.style.background = elegidoEn(g) ? 'var(--primary-bg)' : 'var(--surface-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = elegidoEn(g) ? 'var(--primary-bg)' : 'transparent'; }}>
      {/* El ícono de la sección (CRM, WhatsApp…), como el de un renglón: el árbol se lee por su forma. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {g.icono && <IconoOpcion icono={g.icono} />}
        <span style={{ fontWeight: 600 }}>{g.title}</span>
      </span>
      {/* El conteo es el «resumen» de la fila, como en el filtro del plan: dice si vale la pena
          entrar antes de entrar. Una sección de secciones (`grupos`) no cuenta: sólo la flecha.
          Con `resumen`, la fila dice lo que tiene PUESTO (el filtro del Plan, con sus mismos
          números: 12 px, el color de lo elegido si hay algo, y la › aparte). */}
      {g.resumen != null ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: g.activo ? 'var(--primary)' : 'var(--faint)', fontWeight: g.activo ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{g.resumen}</span>
          <span style={{ color: 'var(--faint)', fontSize: 16, lineHeight: 1, flex: 'none' }}>›</span>
        </span>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--faint)', flex: 'none' }}>{g.grupos?.length ? '›' : `${g.options.length} ›`}</span>
      )}
    </button>
  );
  /** La línea suelta de `lineaArriba`, antes del renglón que la pide. */
  const conLinea = (o: DropdownOption, renglon: ReactNode) => (o.lineaArriba
    ? <Fragment key={o.value}><div aria-hidden style={{ borderTop: '1px solid var(--border)', margin: '4px 8px' }} />{renglon}</Fragment>
    : renglon);

  const rotuloGrupo: CSSProperties = {
    fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.1em',
    textTransform: 'uppercase', color: 'var(--faint)', padding: '8px 11px 4px',
  };
  const btn: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: elegidoVisible ? 'var(--ink)' : 'var(--dim)',
    fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none',
    width: ancho ?? 'auto', opacity: disabled ? 0.6 : 1,
    // La variante va ENTRE lo de siempre y lo de quien llama: `buttonStyle` sigue mandando.
    ...estiloDeVariante(variante, encima && !disabled), ...buttonStyle,
  };
  const conHover = variante === 'placeholder';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: ancho ?? 'auto' }}>
      <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-disabled={disabled} disabled={disabled} onClick={toggle} style={btn}
        onMouseEnter={conHover ? () => setEncima(true) : undefined} onMouseLeave={conHover ? () => setEncima(false) : undefined}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {icono && <span style={{ flex: 'none', display: 'flex', color: conHover ? 'inherit' : 'var(--faint)' }}>{icono}</span>}
          {selected?.avatar !== undefined && <OptAvatar url={selected.avatar} name={selected.label} size={20} cuadrado={selected.avatarCuadrado} />}
          {/* El ícono de lo elegido también va en el botón (como su color o su avatar): el botón dice lo
              mismo que el renglón. Con `botonLabel`, quien llama dibuja el botón entero y no se agrega. */}
          {!botonLabel && selected?.icono && <IconoOpcion icono={selected.icono} size={variante === 'principal' ? 20 : 18} />}
          {selected?.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.color, flex: 'none' }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{botonLabel ?? (selected ? selected.label : rotuloVarios ?? placeholder)}</span>
        </span>
        {/* ⚠️ UN MENÚ DE ACCIONES NO LLEVA FLECHA. La flecha dice «acá se elige un valor
            y el elegido queda escrito»; un menú de tres puntos dice «acá hay cosas para
            hacer». Con las dos juntas el control se veía «⋯ ▾», que se lee como un
            desplegable a medio dibujar — se reportó así: «son tres puntos, no 2 y una
            flecha». */}
        {!sinFlecha && (
          <span style={{ flex: 'none', fontSize: variante === 'principal' ? 13 : 10, color: 'var(--faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
        )}
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} role="listbox" aria-multiselectable={varios ? true : undefined} style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, zIndex: 1000, minWidth: Math.max(pos.width ?? 0, menuMinAncho ?? 0), width: columns && !alContenido ? 'min(500px, calc(100vw - 24px))' : 'max-content', maxWidth: columns && !alContenido ? undefined : (menuAncho ?? 360), maxHeight: columns ? (alContenido ? Math.max(200, Math.min(560, pos.espacio ?? 560)) : altoMaximoDelMenu(480, pos.espacio, 200)) : altoMaximoDelMenu(menuAlto ?? 340, pos.espacio), overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(18,21,27,.22)', padding: 6 }}>
          {conBusqueda && (
            // Queda PEGADA arriba: en una lista larga el buscador tiene que
            // seguir a la vista mientras se scrollea, o deja de servir.
            <div style={{ position: 'sticky', top: -6, zIndex: 1, background: 'var(--surface)', padding: '2px 2px 6px', margin: '-2px -2px 0' }}>
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar…" aria-label="Buscar opción" className="mk-input"
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}
                style={{ minHeight: 34, padding: '7px 10px', fontSize: 13.5, borderRadius: 9 }} />
            </div>
          )}
          {secciones ? (
            // ── Por secciones: la raíz lista las categorías; adentro, sus opciones.
            buscando ? (
              // Buscando se APLANA: el grupo pasa a ser el rótulo de cada tramo.
              tramosPlanos(seccVisibles ?? []).map((g) => (
                <div key={g.title}>
                  <div style={rotuloGrupo}>{g.title}</div>
                  {g.options.map((o) => renderOption(o, value, resetAfterSelect, onChange, () => setOpen(false), false, false, varios ? { valores: varios, minimo } : undefined))}
                </div>
              ))
            ) : abierta ? (
              <>
                <button type="button" onClick={() => setRuta((r) => r.slice(0, -1))} aria-label={`Volver (${abierta.title})`} title="Volver"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 6px 10px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 700, marginBottom: 4 }}>
                  ‹ {abierta.title}
                </button>
                {(abierta.grupos ?? []).map((g) => botonSeccion(g))}
                {abierta.options.map((o) => conLinea(o, renderOption(o, value, resetAfterSelect, onChange, () => setOpen(false), false, false, varios ? { valores: varios, minimo } : undefined)))}
              </>
            ) : (
              (seccVisibles ?? []).map((g) => botonSeccion(g))
            )
          ) : columns ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(colsVisibles ?? columns).map((col, ci) => (
                <div key={ci} style={{ flex: '1 1 190px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {col.map((g, gi) => (
                    <div key={g.title || `g${gi}`}>
                      {/* Un grupo SIN título es un grupo separado por una línea (el ＋ del lienzo:
                          «separa las secciones con divider»), y el primero no lleva nada arriba. */}
                      {g.title
                        ? <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)', padding: '8px 11px 4px' }}>{g.title}</div>
                        : gi > 0 ? <div aria-hidden style={{ borderTop: '1px solid var(--border)', margin: '4px 8px' }} /> : null}
                      {g.options.map((o) => renderOption(o, value, resetAfterSelect, onChange, () => setOpen(false), true, subEnColumnas, varios ? { valores: varios, minimo } : undefined))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <>
              {optsVisibles.map((o) => conLinea(o, renderOption(o, value, resetAfterSelect, onChange, () => setOpen(false), false, false, varios ? { valores: varios, minimo } : undefined)))}
              {(options ?? []).length === 0 && <div style={{ padding: '9px 11px', fontSize: 13, color: 'var(--faint)' }}>Sin opciones</div>}
            </>
          )}
          {/* «No hay resultados» NO es lo mismo que «no hay opciones»: acá hay
              datos y el filtro no encontró nada. Confundirlos hace pensar que
              la lista está vacía. */}
          {sinResultados && (
            <div style={{ padding: '10px 11px', fontSize: 13, color: 'var(--faint)', lineHeight: 1.5 }}>
              Nada coincide con «{q.trim()}».
            </div>
          )}
          {/* El texto sutil de abajo del todo (`pie`): la cara del renglón `sutil`, y NO cierra. */}
          {pie && !buscando && (
            <button type="button" onClick={pie.onClick}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.opacity = '0.7'; }}
              style={{ display: 'block', width: '100%', textAlign: 'center', padding: '8px 11px 3px', marginTop: 4, border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0, background: 'transparent', color: 'var(--faint)', opacity: 0.7, fontFamily: SANS, fontSize: 12.5, cursor: 'pointer', transition: 'color .12s, opacity .12s' }}>
              {pie.label}
            </button>
          )}
        </div>,
        portalTo ?? document.body,
      )}
    </div>
  );
}

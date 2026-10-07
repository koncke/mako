'use client';

// =============================================================================
// EtapasEntregaModal — el editor de la ENTREGA de un producto: UNA lista
// =============================================================================
// «No me gusta el diseño de las fases y las etapas... Es muy confuso, vuelve a diseñarlo,
// hazlo de la mejor manera que te parezca pero que sea simple de entender, minimalista»
// (Martín, 05/10/2026, sobre la versión copiada del CRM: rótulos de fase en versalitas, un
// selector de fase con cara de campo de texto en cada fila, flechas, ✕ y un recuadro
// punteado de «Agregar etapa» después de cada grupo — todo dibujado todo el tiempo).
//
// Y al día siguiente, sobre esa versión (fases como títulos sueltos, filas con sólo un
// punto, «+ Fase» y «+ Etapa» como texto, todo sobre blanco): «No hagas que el editor sea
// totalmente blanco que parezca que están flotando las cosas, eso no se entiende... Yo lo
// que pienso es que las fases sean contenedores grandes, y que el botón de nueva fase sea
// como una fase arriba del todo, así como hacemos lo de "Nuevo proyecto" que es como mas
// gris y opaco» (Martín, 06/10/2026).
//
// LO QUE HAY, y es lo que hay que conservar:
//  · CADA FASE ES UNA CAJA (`.ee-caja`: `--surface-2`, borde y radio propios) con su título
//    arriba —punto de color y nombre— y sus etapas ADENTRO, como filas blancas. La última
//    fila de la caja es «Nueva etapa». Las etapas sin fase tienen su propia caja, «Sin
//    fase»; sin ninguna fase es UNA caja sin título. Nada flota sobre el blanco del modal.
//  · «NUEVA FASE» ES UNA FASE DE MENTIRA, ARRIBA DE TODO: una caja con la forma de las
//    otras, punteada, gris y apagada, que se ilumina con el cursor. Es el molde de «Crear
//    nuevo proyecto» del Plan (app/plan/board/BoardShell.tsx). Arriba y no abajo: «agregar
//    fase debería estar arriba del todo», pedido anterior que sigue valiendo.
//  · LAS ACCIONES VAN CALLADAS: la ✕ y el asa de arrastre aparecen SÓLO con el cursor
//    encima o con el foco adentro (`.ee-oculto`), en las filas y en el título de una fase
//    (nombre, color, sacarla). Sacar una fase NO borra sus etapas: quedan «Sin fase».
//  · ORDENAR Y CAMBIAR DE FASE SON EL MISMO GESTO: se arrastra la fila, y soltarla adentro
//    de OTRA caja la pasa a esa fase — esa caja se ENCIENDE mientras sea el destino. El
//    destino sale primero de la CAJA que está a la altura del cursor y recién ahí del lugar
//    más cercano adentro de ella (`destinoEn`): con el lugar más cercano a secas, el título
//    de la caja de abajo seguía apuntando al final de la de arriba. Con el teclado, Alt+↑ /
//    Alt+↓ sobre la fila hace lo mismo un lugar por vez, cruzando de caja en los bordes.
//  · DONDE VA A CAER SE ABRE UN HUECO (`.ee-hueco`): «al arrastrar, copia la misma animación
//    que tenemos en el CRM o ahí mismo en las tarjetas de clientes, ya que si lo estoy
//    arrastrando se tiene que ver donde va a caer» (Martín, 06/10/2026). Antes era una LÍNEA
//    de 2 px arriba de la fila, y la copia que sigue al cursor la tapaba casi siempre: con
//    el cursor en el medio de la fila agarrada, la copia cubre justo la franja donde cae la
//    línea. El hueco es la pieza del kanban de clientes (`.ke-hueco`, KanbanEntrega.tsx) y
//    del Plan: punteado de 2 px del color que la etapa VA a tener ahí, fondo de ese color
//    al 7 % y el alto de UNA fila, y las filas de abajo se corren para dejarle lugar. Al
//    arrastrar una fase entera, lo mismo entre cajas: un hueco del alto de una caja chica.
//
//    ⚠️ Y NO SE ABRE DONDE SOLTAR NO CAMBIA NADA (`cambiaAlSoltar`): la fila agarrada sigue
//    en su lugar —al nodo origen no se le toca el tamaño— y ESO es lo que dice «se queda
//    acá». Con el hueco ahí, desde el primer píxel del gesto la fila de origen saltaba una
//    fila para abajo debajo de la copia y volvía al cruzar su mitad: la misma razón por la
//    que la caja de origen no se enciende.
//
// Lo que NO cambió del molde del CRM (app/crm/EtapasModal.tsx): caja de 760 con alto FIJO,
// el título es un input que renombra el producto, el pie es sólo «Eliminar producto» en rojo
// a la izquierda, y el velo de hover es el de `.crm-hover` (app/_ui/ui.css) — allá lo pone el
// `<main>` de la ruta, acá no hay nada arriba que lo ponga, así que lo pone el envoltorio.
//
// ⚠️ SIN TABS. Lo único que hay de las secuencias es CUÁNTAS apuntan a cada etapa, y ese
// número vive donde decide algo: en el aviso de la ✕. Las secuencias se editan en Chatbot.
//
// ─────────────────────────────────────────────────────────────────────────────
// LAS DECISIONES QUE NO SE VEN, cada una con lo que rompía
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ SE GUARDA LA LISTA ENTERA, con un respiro. Las etapas son un ORDEN: un merge por
// clave no puede expresar «esta columna va antes que aquélla» ni un borrado. El respiro
// existe porque renombrar es una tecla por letra.
//
// ⚠️ «¿HAY ALGO QUE GUARDAR?» SE CONTESTA COMPARANDO, NO CON UN «ES EL PRIMER RENDER».
// Abrir el editor no puede escribir: ese upsert marca el servicio como DECLARADO, y
// mirar la pantalla convertiría el default en una configuración que nadie escribió. La
// guarda de antes era `if (primera.current)`, y Next 16 corre el App Router en Strict
// Mode por default: en desarrollo cada efecto corre DOS veces al montar, la segunda ya
// con la bandera en false, así que abrir el editor en local programaba un guardado — y
// bootear local escribe en la base de producción. Comparar la FIRMA de lo que se
// mandaría contra la de lo último que se mandó no depende de cuántas veces corra el
// efecto, y de paso no escribe cuando alguien deshace a mano lo que acababa de hacer.
//
// ⚠️ LO QUE SE GUARDA ES EL ORDEN QUE SE VE (`enOrden`). El tablero tiene UN orden y las
// fases sólo lo agrupan; con el modelo de antes un grupo podía quedar PARTIDO en el tablero
// (cambiarle la fase a una etapa la dejaba en su lugar: «A, X, B, C» con X de otra fase)
// mientras el editor lo dibujaba junto. Ahora cada cambio manda los grupos uno detrás del
// otro, y las fases en ese mismo orden — así el filtro de fases del tablero las lista como
// aparecen las columnas. ⚠️ Y LA FIRMA INICIAL SE CALCULA SOBRE ESE MISMO ORDEN: si no, una
// lista que llega partida del server «cambiaba» al abrir y se guardaba sin que nadie tocara
// nada, que es justo lo que la comparación de firmas viene a impedir.
//
// ⚠️ CERRAR NO PIERDE LO ÚLTIMO. Con el respiro, renombrar una columna y cerrar en el
// mismo medio segundo limpiaba el timer en el desmonte y el nombre no se guardaba nunca,
// sin un error. El desmonte manda lo pendiente. Y los guardados van EN FILA: dos upserts
// del objeto entero que salen a la vez pueden llegar al revés, y el que gana es el viejo.
//
// ⚠️ LA CLAVE DE UNA ETAPA BORRADA NO VUELVE. `nuevaClaveEtapa` recibe TODAS las claves
// que esta sesión vio, las que están y las que se sacaron: si se reusara, los clientes
// que estaban en la etapa vieja reaparecerían dentro de la nueva, en una columna a la
// que nadie los movió. El «Deshacer» del toast sí devuelve la MISMA clave: es la misma
// etapa que vuelve, no una nueva con su nombre. Y entran también las fases a las que
// APUNTA una etapa aunque ya no existan: una fase nueva con esa clave se llevaría a esas
// etapas adentro sin que nadie las mueva.
//
// ⚠️ LA PRIMERA ETAPA ES LA ENTRADA: no se mueve, no se quita y nada va antes de ella.
// No es un gusto: «un cliente SIN fila está en la PRIMERA etapa» es una regla DERIVADA
// (lib/servicio-etapas.ts), así que mover otra columna arriba pasaba EN SILENCIO a todos
// los clientes sin fila a esa columna, y sacarla los pasaba a la segunda — con el aviso de
// la ✕ diciendo «quedan sin columna», que era falso para ellos. Con la entrada fija, el
// número del aviso es exacto: en cualquier otra columna sólo cuentan los que tienen fila.
// Lo que SÍ puede cambiar es su FASE (antes era el selector de su fila): se arrastra a otro
// grupo y cae PRIMERA de ese grupo, y ese grupo pasa a dibujarse primero — la columna
// sigue siendo la primera del tablero. Dentro de su grupo no tiene a dónde ir.
//
// ⚠️ EL ESCAPE ADENTRO DE UN CAMPO NO PUEDE LLEGAR AL MODAL. `Modal` escucha la tecla en
// `document` y en CAPTURA, o sea ANTES que cualquier `onKeyDown` de un input, y además
// frena la propagación: el Escape para cancelar un nombre cerraba el editor entero, y el
// `stopPropagation` que había en el input no podía evitarlo porque nunca le llegaba la
// tecla. Lo mismo con el «¿seguro?»: `Confirm` escucha en `document` también, así que un
// Escape cerraba la pregunta Y el editor. El único lugar que llega antes que `document`
// es `window` en captura: ahí se frena, y el campo vuelve a su valor. La paleta de color
// de una fase se cierra por el mismo camino.
//
// ⚠️ EL ARRASTRE ESCUCHA EN `document`, NO EN LA LISTA. Es el pedido 6 del mismo día sobre
// el tablero («si lo muevo muy al costado, se sale del contenedor... y deja de desplazar»)
// aplicado acá antes de que se reporte: el destino y el empuje del scroll salen sólo de la
// ALTURA del cursor, así que irse de costado —sobre el borde del modal o afuera— sigue
// moviendo el hueco y scrolleando el cuerpo. Y el `drop` se resuelve en `document` también:
// soltar fuera de la lista suelta en el hueco que se ve, no se pierde el gesto.
//
// ─────────────────────────────────────────────────────────────────────────────
// LAS FASES
// ─────────────────────────────────────────────────────────────────────────────
// «Al crear columnas también se puedan crear FASES… dentro de una fase pueden haber varias
// etapas (columnas), y que se le ponga el color a esa fase y que sus columnas adopten eso»
// (Martín). Es el mismo modelo que el CRM ya tiene con Activo / Nutrición / Descartado.
//
// ⚠️ UNA ETAPA SIN FASE ES EL CASO NORMAL, no un hueco por llenar. Sin ninguna fase esta
// pantalla es una sola caja, sin título.
//
// ⚠️ UNA FASE VACÍA NO TIENE LUGAR EN EL TABLERO, así que su caja se dibuja al final con un
// «arrastra etapas aquí». Y la caja «Sin fase» aparece como destino mientras se arrastra
// aunque no tenga ninguna etapa: es la única forma de sacar una etapa de su fase sin borrar
// la fase.
//
// ⚠️ LAS FASES TAMBIÉN SE REORDENAN: se arrastra el título (y viaja la caja entera), o
// Alt+↑ / Alt+↓ sobre su nombre. El destino es el espacio entre dos cajas (`.ee-entre`), y
// ahí se abre el hueco. Un grupo con etapas se mueve entre los que tienen etapas y nunca
// antes del de la entrada; uno vacío, entre los vacíos.
//
// ─────────────────────────────────────────────────────────────────────────────
// EL LINK DE AGENDA DE UNA ETAPA (#665, 06/10/2026)
// ─────────────────────────────────────────────────────────────────────────────
// «El link de Calendly de la sesión aparece en el portal recién con la etapa completa» (decisión
// de Martín). Cada fila lleva un calendario CALLADO como la ✕ (aparece con el cursor), que queda a
// la vista y en color cuando la etapa ya tiene su link: así se ve de un vistazo cuáles lo tienen.
// Abre un campo DEBAJO de la fila, no una columna más — una fila de 38 px no tiene lugar para un
// link. Se guarda al salir del campo con el mismo respiro que un nombre, y un link que no es https
// NO se guarda: se dice «Usa un link https.» y el campo se queda abierto con lo escrito.
// ⚠️ Vacío lo SACA: es la forma de quitarle la agenda a una etapa.
// El porqué de la traba blanda está en lib/servicio-etapas.ts (`agendaUrl`).

import {
  Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type DragEvent as DragReact, type KeyboardEvent as TeclaReact, type ReactNode,
} from 'react';
import { Modal, Confirm, Toast, useToast } from '@/app/_ui';
import { CerrarIcon } from '@/app/crm/iconos';
import { NEW_STAGE_PALETTE } from '@/lib/pipeline';
import {
  nuevaClaveEtapa, nuevaClaveFase, colorNuevaEtapa, normalizarEtapas, colorDeEtapa, agendaValida, MAX_AGENDA,
  type EtapaEntrega, type FaseEntrega,
} from '@/lib/servicio-etapas';

const SANS = "'Geist', sans-serif";
/** Un tablero de una sola columna no es un tablero. */
const MINIMO = 2;
/** Lo que se espera antes de escribir. Renombrar es una tecla por letra. */
const RESPIRO_MS = 600;
const MAX_LABEL = 40;
/** El mismo tope que el título del editor del CRM y que `renombrarServicioAction`. */
const MAX_NOMBRE = 60;

/** El alto de una fila. Es también el del HUECO de una etapa: «el hueco mide lo que una
 *  fila», y con dos números sueltos el primer retoque los separa. */
const FILA = 38;
/** El alto de una caja chica (sólo su título): el de «Nueva fase» y el del hueco de una
 *  FASE entre dos cajas. */
const CAJA_CHICA = 48;
const PUNTO: CSSProperties = { width: 9, height: 9, flex: 'none', borderRadius: '50%' };
const INPUT: CSSProperties = {
  flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 500, fontSize: 14, color: 'var(--ink)',
  background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7,
  padding: '4px 8px', outline: 'none',
};
/** Lo que se lee pero no se ve (el aviso de un movimiento con el teclado). */
const SOLO_LECTOR: CSSProperties = {
  position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
};

/**
 * La hoja del editor.
 *
 * ⚠️ EL TÍTULO ESTIRA. `.mk-modal__tit` es una columna flex con `align-items: flex-start`,
 * así que el `<h2>` mide lo que mide su contenido — y un `<input>` no mide su texto: su
 * ancho natural sale del atributo `size` (20) contado en el dígito «0» de la fuente
 * activa. Estirado, el input ocupa la cabecera.
 *
 * ⚠️ LO QUE APARECE CON EL CURSOR VA CON `opacity`, NO CON `display`: así el asa y la ✕
 * guardan su lugar (el número de clientes no salta de columna al pasar el cursor) y siguen
 * recibiendo el foco del teclado — `:focus-within` las muestra cuando se llega con Tab. En
 * una pantalla sin cursor (`hover: none`) van siempre visibles: no hay cómo descubrirlas.
 *
 * ⚠️ Las clases van con el prefijo `ee-` y SIN colgar de `.ee-modal`: la copia que sigue al
 * cursor durante un arrastre es un clon pegado al `body`, afuera del modal, y tiene que
 * conservar la forma de la fila (o de la caja entera, si lo que viaja es una fase).
 *
 * ⚠️ LA CAJA QUE SE ENCIENDE NO CAMBIA DE TAMAÑO: el borde es de 1 px siempre y el anillo
 * de más es una sombra. Los lugares del arrastre se miden al agarrar, SIN el hueco; lo
 * único que corre las filas a propósito es el hueco, y `medir` lo apaga para leer. Un
 * borde que engorda al ser destino correría todo lo de abajo sin que `medir` lo sepa.
 *
 * ⚠️ TODO ALINEA CONTRA LA MISMA COLUMNA: el asa de una fila, la del título de una fase, el
 * hueco de «Nueva etapa» y el de «Nueva fase» caen a 14 px del borde de afuera de la caja
 * (1 de borde + 6 de padding + 1 de borde + 6 de padding), así los puntos quedan uno debajo
 * del otro. Por eso el título lleva un borde transparente y «Nueva fase» 12,5 de padding
 * contra su borde de 1,5.
 *
 * Sin backticks adentro de esta cadena, ni en un comentario: la cierran a la mitad.
 */
const CSS = [
  '.ee-modal .mk-modal__h{align-self:stretch}',
  // La CAJA de una fase: el gris que hace que las filas no floten sobre el blanco.
  '.ee-caja{display:flex;flex-direction:column;gap:4px;padding:4px 6px 6px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);transition:border-color .12s,box-shadow .12s,background-color .12s}',
  // El DESTINO de un arrastre que cambia de fase: la caja entera, además del hueco.
  '.ee-caja.ee-destino{border-color:var(--primary);background:var(--primary-bg);box-shadow:0 0 0 1px var(--primary)}',
  // El espacio entre dos cajas. Es flex para que el margen del hueco de una fase no se
  // escape por arriba y por abajo (en un bloque, los márgenes del hijo colapsan con el padre).
  '.ee-entre{flex:none;display:flex;flex-direction:column;min-height:12px}',
  '.ee-fila,.ee-fase{display:flex;align-items:center;gap:8px;padding:0 6px;border-radius:9px;border:1px solid transparent;font-family:' + SANS + '}',
  // Las etapas son filas BLANCAS adentro de la caja gris.
  '.ee-fila{min-height:' + FILA + 'px;background:var(--surface);border-color:var(--border)}',
  // EL HUECO: donde va a caer lo que se arrastra. La pieza de .ke-hueco (el kanban de
  // clientes) y del Plan, con el alto de una fila y el radio de una fila. El color va
  // inline: es el de la fase destino.
  '.ee-hueco{flex:none;height:' + FILA + 'px;border-radius:9px;border:2px dashed var(--primary);transition:height .12s}',
  // El de una FASE, entre dos cajas: el alto y el radio de una caja chica, con el aire de
  // siempre arriba y abajo.
  '.ee-entre>.ee-hueco{height:' + CAJA_CHICA + 'px;border-radius:12px;margin:12px 0}',
  // En una caja vacía el hueco va EN LUGAR del texto, como el guion de una columna vacía
  // del Plan: los dos dicen «acá», y juntos la caja crecía una fila entera.
  '.ee-hueco+.ee-vacia{display:none}',
  // Mientras se mide, la lista se lee como si no hubiera hueco (ver medir).
  '.ee-midiendo .ee-hueco{display:none}',
  '.ee-midiendo .ee-hueco+.ee-vacia{display:block}',
  '.ee-fila:hover,.ee-fila:focus-within{border-color:var(--border-strong)}',
  '.ee-fase{min-height:36px}',
  '.ee-oculto{opacity:0;transition:opacity .12s}',
  '.ee-fila:hover .ee-oculto,.ee-fila:focus-within .ee-oculto,.ee-fase:hover .ee-oculto,.ee-fase:focus-within .ee-oculto{opacity:1}',
  '@media (hover:none){.ee-oculto{opacity:1}}',
  '.ee-asa{width:12px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--faint)}',
  // «Nueva etapa»: la última fila de la caja, apagada hasta que se le pasa el cursor.
  '.ee-mas{display:flex;align-items:center;gap:8px;width:100%;min-height:34px;padding:0 7px;border:none;background:none;border-radius:9px;font:500 13px/1.2 ' + SANS + ';color:var(--faint);text-align:left;cursor:pointer;transition:color .12s}',
  '.ee-mas:hover,.ee-mas:focus-visible{color:var(--primary)}',
  // «Nueva fase»: una caja de mentira, punteada, gris y apagada, que se ilumina con el
  // cursor. El molde es «Crear nuevo proyecto» del Plan. Mide 48, lo mismo que la caja que
  // aparece al apretarla (título de 36 + padding 10 + borde 2): con 46, abrirla corría todo.
  '.ee-fase-nueva{display:flex;align-items:center;gap:8px;width:100%;min-height:' + CAJA_CHICA + 'px;padding:0 12.5px;border:1.5px dashed var(--border-strong);border-radius:12px;background:transparent;font:600 13.5px/1.2 ' + SANS + ';color:var(--faint);text-align:left;opacity:.85;cursor:pointer;transition:border-color .12s,color .12s,opacity .12s}',
  '.ee-fase-nueva:hover,.ee-fase-nueva:focus-visible{border-color:var(--primary);color:var(--primary);opacity:1}',
  '.ee-punto{width:18px;height:18px;flex:none;display:inline-flex;align-items:center;justify-content:center;border:none;background:none;padding:0;border-radius:50%;cursor:pointer}',
  '.ee-punto:hover>span,.ee-punto:focus-visible>span{outline:2px solid var(--border-strong);outline-offset:2px}',
  '.ee-vacia{margin:0;padding:10px 8px;border-radius:9px;border:1px solid transparent;font:400 12.5px/1.3 ' + SANS + ';color:var(--faint);text-align:center}',
  // El campo del link de agenda: debajo de su fila, alineado con el nombre. (Sin el número de la
  // tarea acá: el guard de los colores lee esta hoja y un numeral de tres cifras parece un color.)
  '.ee-agenda{display:flex;flex-direction:column;gap:4px;padding:2px 6px 6px 38px}',
  '.ee-agenda-nota{font:400 12px/1.3 ' + SANS + ';color:var(--faint)}',
].join('\n');

/** El botoncito de una acción por fila (el de app/crm/EtapasModal.tsx). Sin texto: el
 *  `aria-label` y el `title` llevan la frase. */
function AccionFila({ etiqueta, onClick, disabled, className, children }: {
  etiqueta: string; onClick: () => void; disabled?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={etiqueta} title={etiqueta} data-nodrag
      className={className}
      style={{
        width: 28, height: 28, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid transparent', background: 'transparent', fontFamily: SANS, fontSize: 13,
        color: disabled ? 'var(--faint)' : 'var(--dim)', cursor: disabled ? 'default' : 'pointer',
      }}
    >{children}</button>
  );
}

/** Un calendario: el link de agenda de la etapa. En color cuando la etapa ya lo tiene. */
function AgendaIcon({ activa }: { activa: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activa ? 'var(--primary)' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

/** El asa de arrastre: seis puntos. Decorativa — el gesto es de toda la fila. */
function AsaIcon() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="currentColor" aria-hidden>
      <circle cx="1.6" cy="1.6" r="1.3" /><circle cx="6.4" cy="1.6" r="1.3" />
      <circle cx="1.6" cy="6.5" r="1.3" /><circle cx="6.4" cy="6.5" r="1.3" />
      <circle cx="1.6" cy="11.4" r="1.3" /><circle cx="6.4" cy="11.4" r="1.3" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EL MODELO DE LA LISTA (puro: lo ejecuta tests/cs-kanban-fases.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** A qué grupo se dibuja una etapa. `''` = sin fase (o con una fase que ya no existe,
 *  que es la misma regla que `colorDeEtapa`: cae a lo suyo). */
function grupoDe(e: EtapaEntrega, fases: readonly FaseEntrega[]): string {
  return e.fase && fases.some((f) => f.key === e.fase) ? e.fase : '';
}

/** Un grupo de la lista: una fase (o «Sin fase», `''`) con sus etapas en orden. */
export type GrupoEditor = { clave: string; etapas: EtapaEntrega[] };

/**
 * Los grupos en el orden en que se dibujan: los que tienen etapas, en el orden en que
 * aparecen en el tablero; después las fases vacías, en su orden.
 *
 * `conSueltas` agrega «Sin fase» VACÍO al final si hay fases y ninguna etapa está suelta:
 * es el destino de un arrastre o de un Alt+↓ que quiere sacar una etapa de su fase.
 */
export function gruposDe(lista: readonly EtapaEntrega[], fases: readonly FaseEntrega[], conSueltas = false): GrupoEditor[] {
  const orden: string[] = [];
  const por = new Map<string, EtapaEntrega[]>();
  for (const e of lista) {
    const g = grupoDe(e, fases);
    if (!por.has(g)) { por.set(g, []); orden.push(g); }
    por.get(g)!.push(e);
  }
  for (const f of fases) if (!por.has(f.key)) { por.set(f.key, []); orden.push(f.key); }
  if (conSueltas && fases.length > 0 && !por.has('')) { por.set('', []); orden.push(''); }
  return orden.map((clave) => ({ clave, etapas: por.get(clave)! }));
}

/** Los grupos, uno detrás del otro: la lista del tablero que corresponde a lo que se ve. */
function aplanar(grupos: readonly GrupoEditor[]): EtapaEntrega[] {
  return grupos.flatMap((g) => g.etapas);
}

/**
 * Lo que se GUARDA: las etapas en el orden en que se dibujan y las fases en ese mismo
 * orden. Ver «LO QUE SE GUARDA ES EL ORDEN QUE SE VE» en el encabezado.
 */
export function enOrden(lista: readonly EtapaEntrega[], fases: readonly FaseEntrega[]): { etapas: EtapaEntrega[]; fases: FaseEntrega[] } {
  const grupos = gruposDe(lista, fases);
  const orden = grupos.map((g) => g.clave);
  return {
    etapas: aplanar(grupos),
    fases: [...fases].sort((a, b) => orden.indexOf(a.key) - orden.indexOf(b.key)),
  };
}

/** La etapa con la fase de su grupo nuevo. `''` le SACA la fase (no la deja en `undefined`). */
function conFase(e: EtapaEntrega, grupo: string): EtapaEntrega {
  const out: EtapaEntrega = { ...e };
  if (grupo) out.fase = grupo; else delete out.fase;
  return out;
}

/**
 * Llevar una etapa al lugar `slot` del grupo `grupo` — ordenar y cambiar de fase son esto.
 *
 * `slot` cuenta los lugares del grupo COMO SE VEN, con la etapa todavía adentro si es del
 * mismo grupo: soltar «antes de la fila 3» es `slot` 3 aunque la arrastrada sea la 1.
 *
 * ⚠️ NADA VA ANTES DE LA ENTRADA: en el grupo de la entrada el piso es 1. Y la entrada no
 * cambia de lugar: si va a otro grupo cae PRIMERA y ese grupo pasa a dibujarse primero.
 * Un grupo que no existe no se inventa: se devuelve la lista como estaba.
 */
export function llevarEtapa(
  lista: readonly EtapaEntrega[], fases: readonly FaseEntrega[], key: string, grupo: string, slot: number,
): EtapaEntrega[] {
  const i = lista.findIndex((e) => e.key === key);
  if (i < 0) return [...lista];
  const e = lista[i];
  const grupos = gruposDe(lista, fases, true).map((g) => ({ clave: g.clave, etapas: [...g.etapas] }));
  const destino = grupos.find((g) => g.clave === grupo);
  const origen = grupos.find((g) => g.etapas.includes(e));
  if (!destino || !origen) return [...lista];
  const pos = origen.etapas.indexOf(e);
  if (i === 0) {
    if (destino === origen) return [...lista];
    origen.etapas.splice(pos, 1);
    destino.etapas.unshift(conFase(e, grupo));
    return aplanar([destino, ...grupos.filter((g) => g !== destino)]);
  }
  // El índice se corre uno cuando la etapa venía de más arriba en el mismo grupo.
  let at = destino === origen && slot > pos ? slot - 1 : slot;
  origen.etapas.splice(pos, 1);
  const piso = destino.etapas[0]?.key === lista[0]?.key ? 1 : 0;
  at = Math.max(piso, Math.min(at, destino.etapas.length));
  destino.etapas.splice(at, 0, destino === origen ? e : conFase(e, grupo));
  return aplanar(grupos);
}

/**
 * Alt+↑ / Alt+↓ sobre una etapa: un lugar por vez, y en el borde del grupo pasa al de al
 * lado (o sea, cambia de fase). La entrada no se mueve: recorre las fases — «Sin fase»
 * primero y después cada fase en su orden —, que es lo que hacía el selector de su fila.
 */
export function pasoDeEtapa(lista: readonly EtapaEntrega[], fases: readonly FaseEntrega[], key: string, dir: -1 | 1): EtapaEntrega[] {
  const i = lista.findIndex((e) => e.key === key);
  if (i < 0) return [...lista];
  const grupos = gruposDe(lista, fases, true);
  const gi = grupos.findIndex((g) => g.etapas.some((x) => x.key === key));
  const g = grupos[gi];
  if (i === 0) {
    const opciones = ['', ...fases.map((f) => f.key)];
    const j = opciones.indexOf(g.clave) + dir;
    if (j < 0 || j >= opciones.length) return [...lista];
    return llevarEtapa(lista, fases, key, opciones[j], 0);
  }
  const k = g.etapas.findIndex((x) => x.key === key);
  const piso = g.etapas[0]?.key === lista[0]?.key ? 1 : 0;
  if (dir === -1) {
    if (k > piso) return llevarEtapa(lista, fases, key, g.clave, k - 1);
    const antes = grupos[gi - 1];
    return antes ? llevarEtapa(lista, fases, key, antes.clave, antes.etapas.length) : [...lista];
  }
  if (k < g.etapas.length - 1) return llevarEtapa(lista, fases, key, g.clave, k + 2);
  const despues = grupos[gi + 1];
  return despues ? llevarEtapa(lista, fases, key, despues.clave, 0) : [...lista];
}

/**
 * Hasta dónde se puede mover un GRUPO entero (`slot` = «antes del grupo N», contado con él
 * adentro). Uno con etapas, entre los que tienen etapas y nunca antes del de la entrada (el
 * 0); uno vacío, entre los vacíos — una fase vacía no tiene lugar en el tablero. `null` = no
 * se mueve: el grupo de la entrada, «Sin fase», o uno que no existe.
 */
export function rangoDeFase(grupos: readonly GrupoEditor[], clave: string): [number, number] | null {
  const gi = grupos.findIndex((g) => g.clave === clave);
  if (gi <= 0 || !clave) return null;
  const llenos = grupos.filter((g) => g.etapas.length > 0).length;
  return grupos[gi].etapas.length > 0 ? [1, llenos] : [llenos, grupos.length];
}

/** Llevar una fase entera (su título y sus etapas) a `slot`. Ver `rangoDeFase`. */
export function llevarFase(
  lista: readonly EtapaEntrega[], fases: readonly FaseEntrega[], clave: string, slot: number,
): { etapas: EtapaEntrega[]; fases: FaseEntrega[] } {
  const grupos = gruposDe(lista, fases);
  const rango = rangoDeFase(grupos, clave);
  if (!rango) return { etapas: [...lista], fases: [...fases] };
  const gi = grupos.findIndex((g) => g.clave === clave);
  let at = Math.max(rango[0], Math.min(slot, rango[1]));
  if (at > gi) at -= 1;
  const resto = grupos.filter((_, j) => j !== gi);
  resto.splice(at, 0, grupos[gi]);
  const orden = resto.map((g) => g.clave);
  return {
    etapas: aplanar(resto),
    fases: [...fases].sort((a, b) => orden.indexOf(a.key) - orden.indexOf(b.key)),
  };
}

/** Alt+↑ / Alt+↓ sobre el nombre de una fase. */
export function pasoDeFase(
  lista: readonly EtapaEntrega[], fases: readonly FaseEntrega[], clave: string, dir: -1 | 1,
): { etapas: EtapaEntrega[]; fases: FaseEntrega[] } {
  const gi = gruposDe(lista, fases).findIndex((g) => g.clave === clave);
  return llevarFase(lista, fases, clave, dir === -1 ? gi - 1 : gi + 2);
}

/** El mismo saneo que corre en el server, antes de mandar: así el error se ve acá y no
 *  vuelve como un «no se pudo guardar» que no dice qué arreglar. */
function limpiar(lista: readonly EtapaEntrega[]): EtapaEntrega[] | null {
  return normalizarEtapas(lista.map((e) => ({ ...e, label: e.label.trim() || e.key })));
}

/** Lo que identifica a un guardado. Dos firmas iguales = no hay nada que mandar. */
function firmaDe(etapas: readonly EtapaEntrega[], fases: readonly FaseEntrega[]): string {
  return JSON.stringify([etapas, fases]);
}

type Pendiente = { etapas: EtapaEntrega[]; fases: FaseEntrega[]; firma: string };
type Confirmar = {
  titulo: string; cuerpo: string; boton: string; cancelar: string;
  tono?: 'danger' | 'primary'; hacer: () => void;
};
/** Lo que se está arrastrando: una etapa, o una fase entera desde su título. */
export type Agarre ={ tipo: 'etapa'; key: string } | { tipo: 'fase'; clave: string };
/** Dónde va a caer: un lugar de un grupo, o un lugar entre grupos. */
export type Destino = { tipo: 'etapa'; grupo: string; slot: number } | { tipo: 'fase'; slot: number };
/** Un lugar donde se puede soltar, a su altura en coordenadas del CONTENIDO del cuerpo. */
export type Lugar = { d: Destino; y: number };
/** La caja de un grupo, de arriba abajo, en las mismas coordenadas que los lugares. */
export type CajaMedida = { grupo: string; top: number; bottom: number };

const mismoDestino = (a: Destino | null, b: Destino | null) =>
  a === b || (!!a && !!b && a.tipo === b.tipo && a.slot === b.slot
    && (a.tipo === 'fase' || (b.tipo === 'etapa' && a.grupo === b.grupo)));

/**
 * El destino de un arrastre a la altura `y`: primero la CAJA, después el lugar.
 *
 * ⚠️ EL LUGAR MÁS CERCANO A SECAS NO ALCANZA CON CAJAS. Entre la última fila de una caja y la
 * primera de la de abajo están el pie de la primera, su padding, el hueco y el TÍTULO de la
 * segunda: con el cursor sobre ese título —que es donde uno apunta para «meterla en esta
 * fase»— el lugar más cercano podía seguir siendo el final de la caja de ARRIBA. Así que se
 * elige la caja que contiene la altura (o, en un hueco entre dos, la más cercana) y recién
 * ahí el lugar más cercano DE ESA caja. Sin cajas (el arrastre de una fase entera, que cae
 * entre cajas) es el más cercano de todos.
 *
 * Una caja sin lugares válidos no se elige: se cae al más cercano de todos, que es lo que
 * había antes y nunca deja el gesto sin destino.
 */
export function destinoEn(lugares: readonly Lugar[], cajas: readonly CajaMedida[], y: number): Destino | null {
  const cercano = (ls: readonly Lugar[]): Destino | null => {
    let mejor: Destino | null = null;
    let dist = Infinity;
    for (const l of ls) {
      const d = Math.abs(l.y - y);
      if (d < dist) { dist = d; mejor = l.d; }
    }
    return mejor;
  };
  let caja = cajas.find((c) => y >= c.top && y <= c.bottom) ?? null;
  if (!caja) {
    let dist = Infinity;
    for (const c of cajas) {
      const d = y < c.top ? c.top - y : y - c.bottom;
      if (d < dist) { dist = d; caja = c; }
    }
  }
  const grupo = caja?.grupo;
  const adentro = grupo === undefined ? [] : lugares.filter((l) => l.d.tipo === 'etapa' && l.d.grupo === grupo);
  return cercano(adentro.length ? adentro : lugares);
}

/**
 * ¿Soltar `a` en `d` CAMBIA lo que se guarda? Es lo que decide si se abre el hueco.
 *
 * Los lugares que no cambian nada son dos por fila —arriba y abajo de sí misma— y el de la
 * entrada en su propio grupo (ver «Y NO SE ABRE DONDE SOLTAR NO CAMBIA NADA» arriba). Se
 * contesta con el MODELO y no con índices: así no hay una segunda copia de las reglas de
 * `llevarEtapa` (la entrada, el piso, el índice corrido) que se pueda desincronizar.
 *
 * ⚠️ SE COMPARA EL ORDEN QUE SE GUARDA (`enOrden`), no la lista cruda: una lista que llega
 * con un grupo PARTIDO sale de `llevarEtapa` agrupada aunque la etapa no se mueva, y
 * comparando crudo esa lista abría el hueco pegado a la fila de origen.
 */
export function cambiaAlSoltar(
  lista: readonly EtapaEntrega[], fases: readonly FaseEntrega[], a: Agarre, d: Destino,
): boolean {
  const despues = a.tipo === 'etapa' && d.tipo === 'etapa'
    ? enOrden(llevarEtapa(lista, fases, a.key, d.grupo, d.slot), fases)
    : a.tipo === 'fase' && d.tipo === 'fase' ? llevarFase(lista, fases, a.clave, d.slot) : null;
  if (!despues) return false;
  const antes = enOrden(lista, fases);
  return firmaDe(despues.etapas, despues.fases) !== firmaDe(antes.etapas, antes.fases);
}

export function EtapasEntregaModal({
  servicio, etapas, fases, conteo, secuencias, onGuardar, onRenombrar, onEliminar, conEmbudo, onCerrar,
}: {
  /** El nombre actual del producto: es el título, y se edita ahí. */
  servicio: string;
  etapas: EtapaEntrega[];
  fases: FaseEntrega[];
  /** Cuántos clientes hay en cada etapa. Es lo que hace que sacar una sea una decisión. */
  conteo: Record<string, number>;
  /**
   * Cuántas SECUENCIAS cuelgan de cada etapa. Los clientes eran sólo la mitad de lo que
   * apunta a una columna: la otra mitad son los mensajes automáticos, y ésos no «quedan
   * sin columna» cuando la etapa desaparece — dejan de dispararse, en silencio.
   *
   * ⚠️ `null` = NO SE PUDO LEER, que no es lo mismo que ninguna: decirlo sobre una
   * consulta caída es exactamente la afirmación que hace apretar el botón.
   */
  secuencias: Record<string, number> | null;
  onGuardar: (etapas: EtapaEntrega[], fases: FaseEntrega[]) => Promise<string | null>;
  /**
   * Renombra el PRODUCTO. `null` = listo; un texto = el error, que se muestra tal cual.
   * El server escribe el mismo campo que lee el CRM, así que el nombre cambia en los dos
   * lados sin sincronizar nada.
   */
  onRenombrar: (nombre: string) => Promise<string | null>;
  /**
   * Archiva el producto, como el «Eliminar» del CRM. Si no viene, el botón NO se dibuja:
   * un «Eliminar» que contesta «no se puede» se lee como que la app está rota. Con
   * `null` el editor se cierra; con un texto, lo muestra y se queda abierto.
   */
  onEliminar?: () => Promise<string | null>;
  /**
   * ¿El producto tiene un embudo vivo en el CRM? Sólo entonces eliminarlo lo ARCHIVA y vuelve
   * desde «Productos eliminados»; sin embudo se da de baja (`eliminarServicioAction`).
   *
   * ⚠️ SIN DEFAULT: un `= false` deja que un llamador se lo olvide, y la confirmación dejaría
   * de decir de dónde se recupera sin que nada avise. Con la lectura de embudos caída llega
   * `false` (ver `productosOfrecibles`): no saberlo es no prometerlo.
   */
  conEmbudo: boolean;
  onCerrar: () => void;
}) {
  const [lista, setLista] = useState<EtapaEntrega[]>(() => etapas.map((e) => ({ ...e })));
  const [tramos, setTramos] = useState<FaseEntrega[]>(() => fases.map((f) => ({ ...f })));
  /**
   * TODAS las claves que esta sesión vio — etapas y fases, incluidas las que se sacaron, y
   * las fases a las que apunta una etapa aunque la fase ya no exista.
   *
   * ⚠️ NO SE DERIVA DE LA LISTA: justamente las borradas son las que ya no están ahí, y
   * son las que no se pueden reusar. Van las dos familias juntas porque una fase y una
   * etapa pueden llamarse igual, y el prefijo `f_` es lo único que las separa.
   */
  const [vistas, setVistas] = useState<string[]>(() => [
    ...etapas.map((e) => e.key), ...fases.map((f) => f.key),
    ...etapas.flatMap((e) => (e.fase ? [e.fase] : [])),
  ]);
  /** Error al guardar las etapas. */
  const [mal, setMal] = useState('');
  /** Error al renombrar o eliminar el producto. Va aparte: son dos escrituras distintas. */
  const [malProducto, setMalProducto] = useState('');
  /** Qué nombre está abierto para editar: `e:<clave>` una etapa, `f:<clave>` una fase. */
  const [renombrando, setRenombrando] = useState<string | null>(null);
  /** La fase con la paleta de color abierta. */
  const [colorDe, setColorDe] = useState<string | null>(null);
  /** La etapa con el campo del link de agenda abierto, y por qué no se guardó lo escrito. */
  const [agendaDe, setAgendaDe] = useState<string | null>(null);
  const [malAgenda, setMalAgenda] = useState('');
  const [confirmar, setConfirmar] = useState<Confirmar | null>(null);
  const [ocupado, setOcupado] = useState(false);
  /** Lo que dice el lector de pantalla después de un Alt+↑ / Alt+↓. */
  const [aviso, setAviso] = useState('');
  const { toast, show, clear } = useToast();
  const listaRef = useRef<HTMLDivElement | null>(null);

  // ── El guardado automático ───────────────────────────────────────────────────
  const guardarRef = useRef(onGuardar);
  useEffect(() => { guardarRef.current = onGuardar; }, [onGuardar]);
  /** La firma de lo que vino del server, EN EL ORDEN QUE SE VE: abrir y cerrar sin tocar
   *  nada no escribe, aunque la lista llegue con un grupo partido. */
  const [firmaInicial] = useState(() => {
    const o = enOrden(limpiar(etapas) ?? etapas, fases);
    return firmaDe(o.etapas, o.fases);
  });
  /** Lo último que se le PIDIÓ al server, y lo último que CONFIRMÓ. */
  const enviada = useRef(firmaInicial);
  const confirmada = useRef(firmaInicial);
  const pendiente = useRef<Pendiente | null>(null);
  /** Los guardados salen de a uno: ver el encabezado. */
  const cola = useRef<Promise<void>>(Promise.resolve());

  const enviar = useCallback((): void => {
    const p = pendiente.current;
    if (!p) return;
    pendiente.current = null;
    enviada.current = p.firma;
    cola.current = cola.current.then(async () => {
      try {
        const err = await guardarRef.current(p.etapas, p.fases);
        if (err) { enviada.current = confirmada.current; setMal(err); return; }
        confirmada.current = p.firma;
        setMal('');
      } catch {
        enviada.current = confirmada.current;
        setMal('No se pudo guardar.');
      }
    });
  }, []);

  /** Lo que impide guardar la lista como está. Se CALCULA, no se dispara desde el efecto:
   *  así se va sola apenas la lista vuelve a valer (antes quedaba puesta hasta el próximo
   *  guardado bueno) y el efecto no repinta dentro de sí mismo. */
  const invalida = lista.length < MINIMO
    ? `Hacen falta al menos ${MINIMO} etapas.`
    : limpiar(lista) ? '' : 'Esas etapas no se pueden guardar.';

  useEffect(() => {
    if (lista.length < MINIMO) return;
    const limpias = limpiar(lista);
    if (!limpias) return;
    const orden = enOrden(limpias, tramos);
    const firma = firmaDe(orden.etapas, orden.fases);
    // Sin cambios respecto de lo último que se mandó, no hay nada que escribir: cubre el
    // montaje (las dos corridas de Strict Mode incluidas) y el deshacer a mano.
    if (firma === enviada.current) { pendiente.current = null; return; }
    pendiente.current = { etapas: orden.etapas, fases: orden.fases, firma };
    const t = setTimeout(enviar, RESPIRO_MS);
    return () => clearTimeout(t);
  }, [lista, tramos, enviar]);

  // Al cerrar, lo que quedó esperando el respiro sale igual.
  useEffect(() => () => enviar(), [enviar]);

  // ── El nombre del producto (el título) ──────────────────────────────────────
  // El nombre que el server ya tiene. Se resiembra si el padre trae otro (otra pantalla
  // lo renombró), sin desmontar el editor.
  const [nombreOk, setNombreOk] = useState(servicio);
  const [nombreVisto, setNombreVisto] = useState(servicio);
  if (servicio !== nombreVisto) { setNombreVisto(servicio); setNombreOk(servicio); }
  const tituloRef = useRef<HTMLInputElement | null>(null);

  const guardarNombre = async (valor: string) => {
    const limpio = valor.trim().replace(/\s+/g, ' ');
    // Vacío no es un nombre, y uno igual no se manda: en los dos casos vuelve el que está.
    if (!limpio || limpio === nombreOk) {
      if (tituloRef.current) tituloRef.current.value = nombreOk;
      return;
    }
    let err: string | null;
    try { err = await onRenombrar(limpio); } catch { err = 'No se pudo renombrar.'; }
    // Con error, el campo se queda con lo escrito para poder corregirlo; Escape lo devuelve.
    if (err) { setMalProducto(err); return; }
    setMalProducto('');
    setNombreOk(limpio);
  };

  // ── Eliminar el producto ────────────────────────────────────────────────────
  const borrar = async () => {
    if (!onEliminar) return;
    // Lo que esperaba el respiro no se escribe sobre un producto que se va. Si eliminar
    // falla, vuelve a la fila y sale.
    const enEspera = pendiente.current;
    pendiente.current = null;
    setOcupado(true);
    let err: string | null;
    try { err = await onEliminar(); } catch { err = 'No se pudo eliminar.'; }
    setOcupado(false);
    if (err) {
      setMalProducto(err);
      if (enEspera && !pendiente.current) { pendiente.current = enEspera; enviar(); }
      return;
    }
    onCerrar();
  };

  /**
   * ⚠️ SIEMPRE PREGUNTA, al revés que el CRM con un embudo sin leads. Allá lo que lo
   * permite es el «Deshacer» del toast, que vuelve a activar el embudo; acá no hay con
   * qué deshacerlo desde esta pantalla, y sin deshacer la fricción es la red.
   *
   * El texto base dice sólo lo que vale en los dos caminos de `eliminarServicioAction`: un
   * producto con embudo se archiva y otro sin embudo se da de baja, y sólo el primero
   * aparece en «Productos eliminados». Por eso DE DÓNDE VUELVE se dice SÓLO con `conEmbudo`
   * (06/10/2026: el dato viaja desde `productosOfrecibles`, que ya leía los embudos de cada
   * producto). Prometerlo siempre sería cierto a medias; callarlo siempre dejaba a quien
   * eliminó sin saber que lo puede deshacer.
   */
  const eliminar = () => {
    if (!onEliminar) return;
    setConfirmar({
      titulo: `Eliminar «${nombreOk}»`,
      cuerpo: 'Deja de verse aquí y en el CRM. No se borra ningún cliente ni su historial.'
        + (conEmbudo ? ' Lo recuperas en Productos eliminados del CRM.' : ''),
      boton: 'Eliminar el producto',
      cancelar: 'No, dejarlo',
      hacer: () => { void borrar(); },
    });
  };

  // ── Las etapas ──────────────────────────────────────────────────────────────
  /** La entrada: la primera columna del tablero, donde cae todo cliente sin fila. */
  const entrada = lista[0]?.key ?? null;
  const esEntrada = (e: EtapaEntrega) => e.key === entrada;

  /** Una etapa nueva cae al FINAL DE SU GRUPO, también en el tablero. */
  const agregarEtapa = (label: string, fase?: string) => {
    const key = nuevaClaveEtapa(label, vistas);
    setLista((v) => {
      const nueva: EtapaEntrega = { key, label, ...colorNuevaEtapa(v.length), ...(fase ? { fase } : {}) };
      return aplanar(gruposDe([...v, nueva], tramos));
    });
    setVistas((v) => [...v, key]);
  };

  const guardarNombreEtapa = (e: EtapaEntrega, valor: string) => {
    const limpio = valor.trim().replace(/\s+/g, ' ');
    setRenombrando(null);
    // Sin cambio no se toca: el blur también llega con Escape, ya con el valor devuelto.
    if (!limpio || limpio === e.label) return;
    setLista((v) => v.map((x) => (x.key === e.key ? { ...x, label: limpio } : x)));
  };

  /**
   * El link de agenda de una etapa, al salir del campo. Vacío lo saca; uno que no es https no se
   * guarda y el campo se queda abierto (ver el encabezado). Sin cambio no se toca: el blur también
   * llega con Escape, ya con el valor devuelto.
   */
  const guardarAgenda = (e: EtapaEntrega, valor: string) => {
    const escrito = valor.trim();
    if (!escrito) {
      setMalAgenda('');
      setAgendaDe(null);
      if (e.agendaUrl) setLista((v) => v.map((x) => (x.key === e.key ? { ...x, agendaUrl: undefined } : x)));
      return;
    }
    const link = agendaValida(escrito);
    if (!link) { setMalAgenda('Usa un link https.'); return; }
    setMalAgenda('');
    setAgendaDe(null);
    if (link !== e.agendaUrl) setLista((v) => v.map((x) => (x.key === e.key ? { ...x, agendaUrl: link } : x)));
  };

  /** La saca y ofrece devolverla — la MISMA, con su clave, en su lugar. */
  const quitarEtapa = (e: EtapaEntrega) => {
    const i = lista.findIndex((x) => x.key === e.key);
    setLista((v) => v.filter((x) => x.key !== e.key));
    show(`Quitada «${e.label}»`, () => setLista((v) => (
      v.some((x) => x.key === e.key) ? v : [...v.slice(0, i), e, ...v.slice(i)]
    )));
  };

  /**
   * Sacar una etapa, diciendo ANTES lo que se lleva puesto.
   *
   * ⚠️ SIN BOTÓN DE GUARDAR, EL AVISO VA PEGADO A LA ✕. Guardando solo no hay dónde frenar
   * después, así que la consecuencia va antes del click. Y sin nada que perder no hay
   * fricción: sale y queda el «Deshacer», igual que en el CRM.
   *
   * ⚠️ LAS DOS CONSECUENCIAS VAN SEPARADAS PORQUE SON DISTINTAS: un cliente sin columna se
   * puede volver a mover y mientras tanto el tablero lo muestra aparte; una secuencia sin
   * etapa deja de dispararse y no se ve en ningún lado.
   */
  const sacar = (e: EtapaEntrega) => {
    if (lista.length <= MINIMO || esEntrada(e)) return;
    const n = conteo[e.key] ?? 0;
    const q = secuencias?.[e.key] ?? 0;
    const partes: string[] = [];
    if (n > 0) partes.push(n + (n === 1 ? ' cliente queda' : ' clientes quedan') + ' sin columna');
    if (q > 0) partes.push(q + (q === 1 ? ' secuencia deja' : ' secuencias dejan') + ' de dispararse');
    // «No pude revisar» no es «no hay»: con la lectura caída se avisa igual.
    if (secuencias === null) partes.push('no pude revisar si hay secuencias apuntando aquí');
    const hacer = () => quitarEtapa(e);
    if (!partes.length) { hacer(); return; }
    const frase = partes.join(' y ');
    setConfirmar({
      titulo: 'Sacar «' + e.label + '»',
      cuerpo: frase.charAt(0).toUpperCase() + frase.slice(1) + '.',
      boton: 'Sacar la columna',
      cancelar: 'No, dejarla',
      hacer,
    });
  };

  // ── Las fases ───────────────────────────────────────────────────────────────
  /** La fase recién creada, para traerla a la vista: nace al final, lejos del botón. */
  const faseNueva = useRef<string | null>(null);

  /* El `+ 3` corre la paleta para que la primera fase no nazca del color de la primera
     etapa: con los dos puntos iguales, agrupar no se ve. */
  const agregarFase = (label: string) => {
    const key = nuevaClaveFase(label, vistas);
    faseNueva.current = key;
    setTramos((v) => [...v, { key, label, ...colorNuevaEtapa(v.length + 3) }]);
    setVistas((v) => [...v, key]);
  };

  /** El cuerpo del modal: el ÚNICO que scrollea. */
  const scroller = useCallback(() => listaRef.current?.closest<HTMLElement>('.mk-modal__cuerpo') ?? null, []);
  /** Traer un nodo a la vista. ⚠️ A MANO Y SOBRE EL CUERPO DEL MODAL, no con
   *  `scrollIntoView`: ése scrollea TODOS los ancestros, incluidos los que tienen
   *  `overflow: hidden`, y ahí lo que se ve y dónde cae el clic dejan de coincidir. */
  const aLaVista = useCallback((el: HTMLElement) => {
    const sc = scroller();
    if (!sc) return;
    const r = el.getBoundingClientRect();
    const rs = sc.getBoundingClientRect();
    if (r.bottom > rs.bottom) sc.scrollTop += r.bottom - rs.bottom + 8;
    else if (r.top < rs.top) sc.scrollTop -= rs.top - r.top + 8;
  }, [scroller]);

  useEffect(() => {
    const key = faseNueva.current;
    if (!key) return;
    faseNueva.current = null;
    const el = listaRef.current?.querySelector<HTMLElement>(`[data-grupo-fase="${key}"]`);
    if (el) aLaVista(el);
  }, [tramos, aLaVista]);

  const guardarNombreFase = (f: FaseEntrega, valor: string) => {
    const limpio = valor.trim().replace(/\s+/g, ' ');
    setRenombrando(null);
    if (!limpio || limpio === f.label) return;
    setTramos((v) => v.map((x) => (x.key === f.key ? { ...x, label: limpio } : x)));
  };

  const colorDeFase = (f: FaseEntrega, i: number) => {
    setColorDe(null);
    setTramos((v) => v.map((x) => (x.key === f.key ? { ...x, ...colorNuevaEtapa(i) } : x)));
  };

  /** Sacar una fase NO borra sus etapas: quedan sueltas, con su color propio. */
  const sacarFase = (f: FaseEntrega) => {
    const miembros = lista.filter((e) => e.fase === f.key).map((e) => e.key);
    const i = tramos.findIndex((x) => x.key === f.key);
    const hacer = () => {
      setTramos((v) => v.filter((x) => x.key !== f.key));
      setLista((v) => v.map((e) => (e.fase === f.key ? conFase(e, '') : e)));
      show(`Quitada «${f.label}»`, () => {
        setTramos((v) => (v.some((x) => x.key === f.key) ? v : [...v.slice(0, i), f, ...v.slice(i)]));
        setLista((v) => v.map((e) => (miembros.includes(e.key) && !e.fase ? { ...e, fase: f.key } : e)));
      });
    };
    const n = miembros.length;
    if (!n) { hacer(); return; }
    setConfirmar({
      titulo: 'Sacar la fase «' + f.label + '»',
      cuerpo: n + (n === 1 ? ' columna queda suelta' : ' columnas quedan sueltas') + ', con su color propio. No se borra ninguna.',
      boton: 'Sacar la fase',
      cancelar: 'No, dejarla',
      tono: 'primary',
      hacer,
    });
  };

  // ── El teclado: Alt+↑ / Alt+↓ (ver el encabezado) ───────────────────────────
  /** El nombre que tiene que recuperar el foco después de un movimiento: la fila puede
   *  haber cambiado de lugar en el DOM, y un nodo movido pierde el foco. */
  const enfocar = useRef<string | null>(null);
  useEffect(() => {
    const k = enfocar.current;
    if (!k) return;
    enfocar.current = null;
    const el = listaRef.current?.querySelector<HTMLElement>(`[data-foco="${k}"]`);
    if (!el) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    aLaVista(el);
  }, [lista, tramos, aLaVista]);

  const teclaEtapa = (ev: TeclaReact<HTMLElement>, e: EtapaEntrega) => {
    if (!ev.altKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
    if (ev.target instanceof HTMLInputElement) return;
    ev.preventDefault();
    const nueva = pasoDeEtapa(lista, tramos, e.key, ev.key === 'ArrowUp' ? -1 : 1);
    const g = gruposDe(nueva, tramos).find((x) => x.etapas.some((y) => y.key === e.key));
    // En el borde no hay a dónde: ni se repinta ni se anuncia un movimiento que no pasó.
    if (!g || firmaDe(nueva, tramos) === firmaDe(lista, tramos)) return;
    enfocar.current = 'e:' + e.key;
    setLista(nueva);
    const fase = tramos.find((f) => f.key === g.clave)?.label;
    const lugar = (g.etapas.findIndex((y) => y.key === e.key) + 1) + ' de ' + g.etapas.length;
    setAviso(e.label + (tramos.length ? ' en ' + (fase ?? 'Sin fase') : '') + ', ' + lugar);
  };

  const teclaFase = (ev: TeclaReact<HTMLElement>, f: FaseEntrega) => {
    if (!ev.altKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
    if (ev.target instanceof HTMLInputElement) return;
    ev.preventDefault();
    const r = pasoDeFase(lista, tramos, f.key, ev.key === 'ArrowUp' ? -1 : 1);
    if (firmaDe(r.etapas, r.fases) === firmaDe(lista, tramos)) return;
    enfocar.current = 'f:' + f.key;
    setLista(r.etapas);
    setTramos(r.fases);
    setAviso(f.label + ', ' + (r.fases.findIndex((x) => x.key === f.key) + 1) + ' de ' + r.fases.length);
  };

  // ── El Escape, antes que el modal (ver el encabezado) ───────────────────────
  /** Lo que se está arrastrando (ver «El arrastre», más abajo). */
  const agarrada = useRef<Agarre | null>(null);
  const hayPregunta = confirmar !== null;
  const hayPaleta = colorDe !== null;
  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      // Con el «¿seguro?» abierto, el Escape cierra SÓLO la pregunta.
      if (hayPregunta) { ev.stopPropagation(); setConfirmar(null); return; }
      // Con la paleta de una fase abierta, cierra SÓLO la paleta.
      if (hayPaleta) { ev.stopPropagation(); setColorDe(null); return; }
      // A mitad de un arrastre, el Escape lo cancela el navegador: no puede cerrar el editor.
      if (agarrada.current) { ev.stopPropagation(); return; }
      // En un campo de este editor, devuelve el valor y suelta el foco: el `onBlur` de
      // cada campo ya sabe que un valor sin cambios no se guarda.
      const el = ev.target;
      if (!(el instanceof HTMLInputElement) || el.dataset.eeEsc === undefined) return;
      ev.stopPropagation();
      el.value = el.dataset.eeEsc;
      el.blur();
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => window.removeEventListener('keydown', alTeclear, true);
  }, [hayPregunta, hayPaleta]);

  // ── El arrastre ─────────────────────────────────────────────────────────────
  // La foto que sigue al cursor la dibuja el SISTEMA OPERATIVO y ninguna regla CSS la
  // gobierna: se le pasa una VACÍA y la copia la dibujamos nosotros, movida con
  // `transform` sobre un ref. El destino sale de los LUGARES medidos al agarrar (el borde
  // de arriba de cada fila y de cada «Nueva etapa», o el medio de cada espacio entre cajas)
  // y de las CAJAS: ver `destinoEn`.
  //
  // ⚠️ CON EL HUECO ABIERTO, LO DE ABAJO SE CORRE — y por eso las medidas NO se vuelven a
  // leer en el `dragover`: el cursor se compara contra las del agarre, que es lo que hace el
  // CRM con `medidasTarjetas`. Releyéndolas, el hueco empuja la fila de abajo debajo del
  // cursor, el lugar más cercano pasa a ser otro, el hueco se muda, la fila vuelve, y el
  // destino oscila entre dos lugares en cada evento.
  const copia = useRef<HTMLElement | null>(null);
  /** Los lugares donde se puede soltar, con su altura EN COORDENADAS DEL CONTENIDO del
   *  cuerpo (`+ scrollTop`): si el cuerpo se corre durante el gesto, siguen valiendo. */
  const lugares = useRef<Lugar[]>([]);
  /** Las cajas de los grupos, en las mismas coordenadas. Vacío al arrastrar una fase. */
  const cajas = useRef<CajaMedida[]>([]);
  const destinoRef = useRef<Destino | null>(null);
  /** Dónde arrancó el gesto: desde un control no se arrastra la fila. */
  const origen = useRef<EventTarget | null>(null);
  /** Quita los listeners de `document` del gesto en curso. */
  const soltarListeners = useRef<(() => void) | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [arrastrando, setArrastrando] = useState<Agarre | null>(null);
  /** Lo que leen los listeners nativos, que no ven el render de ahora. */
  const estado = useRef({ lista, tramos });
  useEffect(() => { estado.current = { lista, tramos }; }, [lista, tramos]);

  const limpiarDrag = useCallback(() => {
    soltarListeners.current?.();
    soltarListeners.current = null;
    setDestino(null);
    setArrastrando(null);
    lugares.current = [];
    cajas.current = [];
    destinoRef.current = null;
    agarrada.current = null;
    copia.current?.remove();
    copia.current = null;
  }, []);

  /**
   * Mide los lugares válidos para lo que se agarró. Corre al agarrar y otra vez cuando
   * aparece «Sin fase» como destino (un render después).
   *
   * ⚠️ SE MIDE CON EL HUECO APAGADO (`.ee-midiendo`). La segunda medida llega con el
   * `setTimeout` del agarre, y nada garantiza que llegue ANTES del primer `dragover`: si el
   * hueco ya está abierto, todo lo que queda debajo se mide una fila más abajo y el destino
   * apunta a otro lado el resto del gesto. Apagarlo, leer y volver a prenderlo es síncrono:
   * no se pinta nada en el medio.
   *
   * ⚠️ Y EL SCROLL SE DEVUELVE. Sin el hueco el contenido es más corto, y si el cuerpo
   * estaba scrolleado hasta el fondo el navegador recorta `scrollTop` — que no vuelve solo
   * cuando el hueco reaparece. La base de las medidas se lee DESPUÉS de apagarlo, que es la
   * que vale para los rectángulos de ese momento.
   */
  const medir = useCallback(() => {
    const a = agarrada.current;
    const raiz = listaRef.current;
    if (!a || !raiz) return;
    const sc = raiz.closest<HTMLElement>('.mk-modal__cuerpo');
    const scroll = sc?.scrollTop ?? 0;
    // Sólo si HAY un hueco: la primera medida corre adentro del `dragstart`, y ahí no se
    // toca el DOM que no haga falta tocar.
    const conHueco = !!raiz.querySelector('.ee-hueco');
    if (conHueco) raiz.classList.add('ee-midiendo');
    const base = sc?.scrollTop ?? 0;
    const { lista: l, tramos: t } = estado.current;
    const out: Lugar[] = [];
    const cs: CajaMedida[] = [];
    if (a.tipo === 'etapa') {
      for (const el of raiz.querySelectorAll<HTMLElement>('[data-caja]')) {
        const r = el.getBoundingClientRect();
        cs.push({ grupo: el.dataset.caja ?? '', top: r.top + base, bottom: r.bottom + base });
      }
      const grupoEntrada = l[0] ? grupoDe(l[0], t) : '';
      const agarroEntrada = l[0]?.key === a.key;
      for (const el of raiz.querySelectorAll<HTMLElement>('[data-slot]')) {
        const grupo = el.dataset.grupo ?? '';
        const slot = Number(el.dataset.slot);
        // La entrada sólo cambia de grupo y cae primera (su propio lugar queda como el
        // «no la muevo»: sin él, soltarla donde estaba la llevaría al grupo de al lado);
        // lo demás, nunca antes de ella.
        if (agarroEntrada ? slot !== 0 : (grupo === grupoEntrada && slot === 0)) continue;
        out.push({ d: { tipo: 'etapa', grupo, slot }, y: el.getBoundingClientRect().top + base });
      }
    } else {
      const rango = rangoDeFase(gruposDe(l, t), a.clave);
      // El lugar de una fase es el ESPACIO entre dos cajas, y cuenta su MEDIO.
      if (rango) for (const el of raiz.querySelectorAll<HTMLElement>('[data-fslot]')) {
        const slot = Number(el.dataset.fslot);
        if (slot < rango[0] || slot > rango[1]) continue;
        const r = el.getBoundingClientRect();
        out.push({ d: { tipo: 'fase', slot }, y: r.top + r.height / 2 + base });
      }
    }
    if (conHueco) {
      raiz.classList.remove('ee-midiendo');
      if (sc && sc.scrollTop !== scroll) sc.scrollTop = scroll;
    }
    lugares.current = out;
    cajas.current = cs;
  }, []);

  useLayoutEffect(() => { if (arrastrando) medir(); }, [arrastrando, medir]);

  const aplicarDestino = () => {
    const a = agarrada.current;
    const d = destinoRef.current;
    limpiarDrag();
    if (!a || !d) return;
    const { lista: l, tramos: t } = estado.current;
    if (a.tipo === 'etapa' && d.tipo === 'etapa') {
      setLista(llevarEtapa(l, t, a.key, d.grupo, d.slot));
    } else if (a.tipo === 'fase' && d.tipo === 'fase') {
      const r = llevarFase(l, t, a.clave, d.slot);
      setLista(r.etapas);
      setTramos(r.fases);
    }
  };

  const agarrar = (e: DragReact<HTMLElement>, a: Agarre) => {
    const desde = origen.current instanceof Element ? origen.current : null;
    if (desde?.closest('[data-nodrag]')) { e.preventDefault(); return; }
    // Lo que se agarra de una fase es su TÍTULO, pero lo que viaja es la caja entera.
    const nodo = a.tipo === 'fase' ? (e.currentTarget.closest<HTMLElement>('[data-caja]') ?? e.currentTarget) : e.currentTarget;
    e.dataTransfer.setData('text/plain', a.tipo === 'etapa' ? a.key : a.clave);
    e.dataTransfer.effectAllowed = 'move';
    try {
      const vacio = document.createElement('canvas');
      vacio.width = 1; vacio.height = 1;
      e.dataTransfer.setDragImage(vacio, 0, 0);
    } catch { /* si no deja, queda la del navegador */ }
    agarrada.current = a;
    medir();

    const r = nodo.getBoundingClientRect();
    const clon = nodo.cloneNode(true) as HTMLElement;
    Object.assign(clon.style, {
      position: 'fixed', top: '0', left: '0', width: `${r.width}px`, margin: '0',
      background: a.tipo === 'fase' ? 'var(--surface-2)' : 'var(--surface)',
      border: '1px solid var(--border-strong)', borderRadius: a.tipo === 'fase' ? '12px' : '10px',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', pointerEvents: 'none', zIndex: '3000',
      transform: `translate3d(${r.left}px, ${r.top}px, 0)`, transition: 'none', opacity: '1',
    });
    document.body.appendChild(clon);
    copia.current = clon;

    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    // ⚠️ TODO VA EN `dragover`: durante un arrastre nativo el navegador congela los timers
    // y `requestAnimationFrame`, y sólo sigue entregando este evento.
    const sobre = (ev: globalThis.DragEvent) => {
      if (!agarrada.current) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      if (copia.current) copia.current.style.transform = `translate3d(${ev.clientX - dx}px, ${ev.clientY - dy}px, 0)`;
      // El empuje del cuerpo: sólo la ALTURA cuenta, el cursor puede estar afuera de costado.
      const sc = scroller();
      if (sc) {
        const rs = sc.getBoundingClientRect();
        const borde = 40;
        if (ev.clientY < rs.top + borde) sc.scrollTop -= Math.min(22, Math.ceil((rs.top + borde - ev.clientY) / 3));
        else if (ev.clientY > rs.bottom - borde) sc.scrollTop += Math.min(22, Math.ceil((ev.clientY - rs.bottom + borde) / 3));
      }
      const y = ev.clientY + (sc?.scrollTop ?? 0);
      const mejor = destinoEn(lugares.current, cajas.current, y);
      // Sólo se repinta cuando el destino CAMBIA: lo de arriba corre en cada evento, esto
      // no. El soltar usa el destino tal cual; lo que se DIBUJA es `null` donde soltar no
      // cambia nada (ver «Y NO SE ABRE…» en el encabezado).
      if (mismoDestino(destinoRef.current, mejor)) return;
      destinoRef.current = mejor;
      const { lista: l, tramos: t } = estado.current;
      setDestino(mejor && cambiaAlSoltar(l, t, a, mejor) ? mejor : null);
    };
    /**
     * ⚠️ EL `dragenter` TAMBIÉN SE ACEPTA, o soltar ENCIMA DEL HUECO se pierde. Cuando el
     * elemento bajo el cursor CAMBIA, Chromium dispara `dragenter` y `dragleave` y NO
     * `dragover` en esa vuelta (lo deja para la siguiente), y lo que decide si se puede
     * soltar en esa vuelta es si el `dragenter` se canceló. El hueco aparece justo debajo
     * del cursor, así que el elemento cambia sin que el mouse se mueva: MEDIDO en el arnés
     * (06/10/2026), con el cursor quieto sobre el hueco recién abierto el `drop` no llegaba
     * —sólo `dragend`— y el guardado no salía; con esta línea, sale.
     */
    const entra = (ev: globalThis.DragEvent) => {
      if (!agarrada.current) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    };
    const alSoltar = (ev: globalThis.DragEvent) => {
      if (!agarrada.current) return;
      // ⚠️ Y SE FRENA EL DEFAULT: soltar sobre un campo de texto pegaría la clave adentro.
      ev.preventDefault();
      aplicarDestino();
    };
    const fin = () => limpiarDrag();
    document.addEventListener('dragenter', entra, true);
    document.addEventListener('dragover', sobre, true);
    document.addEventListener('drop', alSoltar, true);
    document.addEventListener('dragend', fin, true);
    soltarListeners.current = () => {
      document.removeEventListener('dragenter', entra, true);
      document.removeEventListener('dragover', sobre, true);
      document.removeEventListener('drop', alSoltar, true);
      document.removeEventListener('dragend', fin, true);
    };
    // Al nodo ORIGEN no se le toca el tamaño: se marca. Y en el tick siguiente, porque el
    // navegador saca la foto del arrastre al terminar este handler.
    setTimeout(() => { if (agarrada.current === a) setArrastrando(a); }, 0);
  };

  // Si el editor se cierra a mitad de un gesto, los listeners de `document` se van con él.
  useEffect(() => () => { soltarListeners.current?.(); copia.current?.remove(); }, []);

  // ── Lo que se dibuja ────────────────────────────────────────────────────────
  const hayFases = tramos.length > 0;
  const arrastraEtapa = arrastrando?.tipo === 'etapa';
  // Mientras se arrastra una etapa, «Sin fase» existe como destino aunque esté vacío.
  const grupos = gruposDe(lista, tramos, arrastraEtapa);
  /** Los grupos SIN el «Sin fase» de mentira: los lugares entre grupos cuentan sobre éstos. */
  const nGrupos = gruposDe(lista, tramos).length;
  const agarradaEtapa = arrastrando?.tipo === 'etapa' ? lista.find((e) => e.key === arrastrando.key) ?? null : null;
  const agarradaFase = arrastrando?.tipo === 'fase' ? tramos.find((f) => f.key === arrastrando.clave) ?? null : null;
  /** La caja que se ENCIENDE: la del destino, sólo si es OTRA que la de la etapa agarrada.
   *  Reordenar adentro de la misma caja ya lo dice el hueco; encenderla desde el primer
   *  píxel del gesto —que es lo que pasaría, porque el destino arranca siendo la suya— es
   *  una caja azul que no dice nada. */
  const agarradaEn = agarradaEtapa ? grupoDe(agarradaEtapa, tramos) : null;
  const cajaDestino = destino?.tipo === 'etapa' && destino.grupo !== agarradaEn ? destino.grupo : null;
  /**
   * EL HUECO (ver el encabezado). Del color que lo arrastrado VA a tener ahí: el de la fase
   * destino, o el propio de la etapa si cae «Sin fase» — el punto de la fila cambia a ése
   * al soltar, y el hueco lo anticipa. Hasta que llega `arrastrando` (un tick después del
   * agarre) no se sabe qué viaja: el de la casa.
   *
   * ⚠️ `color-mix` Y NO EL SUFIJO HEX del kanban (`color + '12'`): ése sólo vale con un hex
   * de 6 dígitos, y con cualquier otra cosa —el `var()` de acá abajo— el navegador descarta
   * el fondo entero en silencio.
   */
  const hueco = (color: string) => (
    <div className="ee-hueco" aria-hidden
      style={{ borderColor: color, background: 'color-mix(in srgb, ' + color + ' 7%, transparent)' }} />
  );
  const huecoEtapa = (grupo: string, slot: number) => (
    destino?.tipo === 'etapa' && destino.grupo === grupo && destino.slot === slot
      ? hueco(agarradaEtapa ? colorDeEtapa(conFase(agarradaEtapa, grupo), tramos) : 'var(--primary)')
      : null
  );
  const huecoFase = (slot: number) => (
    destino?.tipo === 'fase' && destino.slot === slot ? hueco(agarradaFase?.dot ?? 'var(--primary)') : null
  );

  return (
    <div className="crm-hover ee-modal" style={{ display: 'contents' }}>
      <Modal
        titulo={
          // El título es un CAMPO, como en el CRM: renombra el producto al salir.
          <input
            ref={tituloRef}
            key={nombreOk}
            defaultValue={nombreOk}
            maxLength={MAX_NOMBRE}
            aria-label="Nombre del producto"
            data-ee-esc={nombreOk}
            onBlur={(e) => { void guardarNombre(e.target.value); }}
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
        // El alto es un NÚMERO y no un tope: agregar o sacar una fila no puede achicar la
        // caja («JAMÁS achiques el tamaño de un detail según lo que contenga dentro»).
        alto="min(85vh, 620px)"
        sinFiletes
        etiqueta={`Editar el producto ${nombreOk}`}
        onCerrar={onCerrar}
        pie={
          // ⚠️ UN SOLO BOTÓN DE CERRAR (la ✕ de arriba). Acá abajo va sólo eliminar, a la
          // izquierda y como TEXTO rojo — no como botón.
          onEliminar ? (
            <div style={{ flex: 1, display: 'flex' }}>
              <button type="button" onClick={eliminar} disabled={ocupado}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--bad)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: ocupado ? 'default' : 'pointer' }}>
                Eliminar producto
              </button>
            </div>
          ) : undefined
        }
      >
        {/* ⚠️ UN SOLO BLOQUE: `.mk-modal__cuerpo` le da 18 px arriba y abajo a CADA hijo
            directo (ui.css), así que «+ Fase» y la lista sueltos quedaban separados por un
            hueco de 40 px que nadie puso. */}
        <div>
        {/* «Nueva fase» es una fase de mentira ARRIBA de todo (ver el encabezado). */}
        <div style={{ marginBottom: 12 }}>
          <NuevoRenglon tipo="fase" onCrear={agregarFase} />
        </div>

        <div ref={listaRef} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* ⚠️ UNA CAJA POR GRUPO. Antes la lista era PLANA a propósito —títulos, filas y
              «+ Etapa» hermanos— para que una fila que cambia de grupo fuera el mismo nodo de
              React. Con cajas, esa fila se DESMONTA de una y se monta en la otra, y no pierde
              nada: todo lo suyo vive en el editor (`renombrando`, `colorDe`), y el foco que
              un Alt+↑/↓ deja en el aire lo devuelve `enfocar` por `data-foco`. Los lugares
              del arrastre se siguen midiendo de UNA consulta sobre toda la lista
              (`querySelectorAll`), así que el anidado no les cambia nada. */}
          {grupos.map((g, gi) => {
            const fase = g.clave ? tramos.find((f) => f.key === g.clave) ?? null : null;
            const sueltaDeMentira = !g.clave && g.etapas.length === 0;
            // Se mueve si tiene a dónde: un rango de N lugares son N-1 posiciones finales.
            const rango = fase ? rangoDeFase(gruposDe(lista, tramos), fase.key) : null;
            const fasePuedeMoverse = !!rango && rango[1] - rango[0] >= 2;
            const viaja = !!fase && arrastrando?.tipo === 'fase' && arrastrando.clave === fase.key;

            // El título existe sólo si hay fases: sin ninguna, es una caja sola sin nombre.
            // «Sin fase» también se rotula, o sus etapas se leerían como de otra fase.
            const titulo = !hayFases ? null : fase ? (
              <div className="ee-fase"
                draggable={fasePuedeMoverse && renombrando !== 'f:' + fase.key}
                onPointerDown={(ev) => { origen.current = ev.target; }}
                onDragStart={(ev) => agarrar(ev, { tipo: 'fase', clave: fase.key })}
                onDragEnd={limpiarDrag}
                onKeyDown={(ev) => teclaFase(ev, fase)}
                style={{ cursor: fasePuedeMoverse ? 'grab' : 'default' }}>
                <span className={'ee-asa' + (fasePuedeMoverse ? ' ee-oculto' : '')} aria-hidden
                  title={fasePuedeMoverse ? 'Arrastra o usa Alt+↑ ↓' : undefined}>
                  {fasePuedeMoverse && <AsaIcon />}
                </span>
                <button type="button" className="ee-punto" data-nodrag data-paleta-de={fase.key}
                  aria-label={'Color de ' + fase.label} title="Cambiar el color" aria-expanded={colorDe === fase.key}
                  onClick={() => setColorDe((c) => (c === fase.key ? null : fase.key))}>
                  <span style={{ ...PUNTO, background: fase.dot }} />
                </button>
                {renombrando === 'f:' + fase.key ? (
                  <input
                    autoFocus defaultValue={fase.label} maxLength={MAX_LABEL} data-nodrag data-ee-esc={fase.label}
                    aria-label={'Nombre de la fase ' + fase.label}
                    onBlur={(ev) => guardarNombreFase(fase, ev.target.value)}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
                    style={{ ...INPUT, fontSize: 13.5, fontWeight: 600 }}
                  />
                ) : (
                  <>
                    <button type="button" data-nodrag data-foco={'f:' + fase.key}
                      onClick={() => setRenombrando('f:' + fase.key)}
                      title={'Cambiar el nombre de ' + fase.label} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                      style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '70%', textAlign: 'left', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', background: 'none', border: 'none', borderRadius: 6, padding: '4px 2px', cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >{fase.label}</button>
                    <span style={{ flex: 1 }} />
                  </>
                )}
                <AccionFila className="ee-oculto" etiqueta={'Sacar la fase ' + fase.label}
                  onClick={() => sacarFase(fase)}><CerrarIcon /></AccionFila>
              </div>
            ) : (
              <div className="ee-fase">
                <span className="ee-asa" aria-hidden />
                <span style={{ width: 18, flex: 'none', display: 'inline-flex', justifyContent: 'center' }} aria-hidden>
                  <span style={{ ...PUNTO, boxShadow: 'inset 0 0 0 1.5px var(--border-strong)' }} />
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--faint)', padding: '4px 2px' }}>Sin fase</span>
              </div>
            );

            return (
              <Fragment key={'c:' + (g.clave || '_')}>
                {/* El espacio entre dos cajas: es el lugar de un arrastre de FASE («antes
                    del grupo gi»), y ahí adentro se abre su hueco. El de «Sin fase» de
                    mentira no cuenta: sólo existe mientras se arrastra una etapa. */}
                {gi > 0 && (
                  <div className="ee-entre" aria-hidden data-fslot={sueltaDeMentira ? undefined : gi}>
                    {!sueltaDeMentira && huecoFase(gi)}
                  </div>
                )}
                <div className={'ee-caja' + (cajaDestino === g.clave ? ' ee-destino' : '')}
                  data-caja={g.clave} data-grupo-fase={fase?.key}
                  // Al nodo ORIGEN no se le toca el tamaño: se marca con un borde.
                  style={viaja ? { outline: '1px solid var(--border-strong)', outlineOffset: 2 } : undefined}>
                  {titulo}
                  {fase && colorDe === fase.key && (
                    <Paleta actual={fase.dot} onElegir={(i) => colorDeFase(fase, i)} onCerrar={() => setColorDe(null)} />
                  )}

                  {g.etapas.map((e, k) => {
                    const entra = esEntrada(e);
                    const editando = renombrando === 'e:' + e.key;
                    // La entrada se arrastra sólo para cambiar de fase: sin fases no tiene a dónde.
                    const arrastrable = (!entra || hayFases) && !editando;
                    // ⚠️ EL HUECO VA PRIMERO Y EN EL MISMO `Fragment`, con la fila siempre en
                    // el segundo lugar: así abrirlo o cerrarlo no remonta la fila, y la fila
                    // agarrada es el nodo ORIGEN del gesto — remontada, el `dragend` le llega
                    // a un nodo suelto y no a `document`.
                    return (
                      <Fragment key={'e:' + e.key}>
                      {huecoEtapa(g.clave, k)}
                      <div className="ee-fila"
                        data-etapa={e.key} data-grupo={g.clave} data-slot={k}
                        draggable={arrastrable}
                        onPointerDown={(ev) => { origen.current = ev.target; }}
                        onDragStart={(ev) => agarrar(ev, { tipo: 'etapa', key: e.key })}
                        onDragEnd={limpiarDrag}
                        onKeyDown={(ev) => teclaEtapa(ev, e)}
                        title={entra ? 'Aquí empieza todo cliente nuevo' : undefined}
                        style={{
                          cursor: arrastrable ? 'grab' : 'default',
                          // Al nodo ORIGEN no se le toca el tamaño: se marca con un borde.
                          outline: arrastrando?.tipo === 'etapa' && arrastrando.key === e.key ? '1px solid var(--border-strong)' : 'none',
                        }}>
                        <span className={'ee-asa' + (arrastrable ? ' ee-oculto' : '')} aria-hidden
                          title={arrastrable ? 'Arrastra o usa Alt+↑ ↓' : undefined}>
                          {arrastrable && <AsaIcon />}
                        </span>
                        <span style={{ width: 18, flex: 'none', display: 'inline-flex', justifyContent: 'center' }} aria-hidden>
                          <span style={{ ...PUNTO, background: colorDeEtapa(e, tramos) }} />
                        </span>
                        {editando ? (
                          <input
                            autoFocus defaultValue={e.label} maxLength={MAX_LABEL} data-nodrag data-ee-esc={e.label}
                            aria-label={'Nombre de ' + e.label}
                            onBlur={(ev) => guardarNombreEtapa(e, ev.target.value)}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
                            style={INPUT}
                          />
                        ) : (
                          // ⚠️ EL INPUT ABRE SÓLO DESDE EL TEXTO: «solo si clickeo en el texto
                          // del título de esa etapa debería abrirme el input, no en toda la
                          // fila». El botón NO estira; el hueco lo llena el span.
                          <>
                            <button type="button" data-nodrag data-foco={'e:' + e.key}
                              onClick={() => setRenombrando('e:' + e.key)}
                              title={`Cambiar el nombre de ${e.label}`} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                              style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '70%', textAlign: 'left', fontFamily: SANS, fontWeight: 500, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', borderRadius: 6, padding: '4px 2px', cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >{e.label}</button>
                            <span style={{ flex: 1 }} />
                          </>
                        )}
                        {/* El link de agenda (#665): callado sin link, a la vista y en color con él. */}
                        <AccionFila className={e.agendaUrl ? undefined : 'ee-oculto'}
                          etiqueta={e.agendaUrl ? 'Cambiar el link de agenda' : 'Agregar link de agenda'}
                          onClick={() => { setMalAgenda(''); setAgendaDe((k) => (k === e.key ? null : e.key)); }}>
                          <AgendaIcon activa={!!e.agendaUrl} />
                        </AccionFila>
                        <span title="Clientes en esta columna"
                          style={{ flex: 'none', minWidth: 22, textAlign: 'right', fontSize: 12.5, fontWeight: 500, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                          {conteo[e.key] ?? 0}
                        </span>
                        {/* ⚠️ LA ENTRADA NO LLEVA ✕ (ver el encabezado), pero su lugar se guarda:
                            sin el hueco, su número quedaría corrido respecto de los de las otras
                            filas. Con el mínimo justo la ✕ se APAGA y lo dice en el title: un
                            botón que no hace nada y no explica por qué se lee como roto. */}
                        {!entra ? (
                          <AccionFila className="ee-oculto"
                            etiqueta={lista.length <= MINIMO ? `Hacen falta al menos ${MINIMO} etapas` : 'Sacar ' + e.label}
                            disabled={lista.length <= MINIMO}
                            onClick={() => sacar(e)}><CerrarIcon /></AccionFila>
                        ) : <span style={{ width: 28, flex: 'none' }} aria-hidden />}
                      </div>
                      {/* El campo del link de agenda, DEBAJO de su fila (ver el encabezado). Sin
                          `data-slot`: no es un lugar donde soltar. */}
                      {agendaDe === e.key && (
                        <div className="ee-agenda" data-nodrag>
                          <input
                            autoFocus type="url" inputMode="url" defaultValue={e.agendaUrl ?? ''} maxLength={MAX_AGENDA}
                            placeholder="https://calendly.com/…" data-ee-esc={e.agendaUrl ?? ''}
                            aria-label={'Link para agendar la sesión de ' + e.label}
                            onBlur={(ev) => guardarAgenda(e, ev.target.value)}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
                            style={{ ...INPUT, fontSize: 13, fontWeight: 400 }}
                          />
                          <span className="ee-agenda-nota">{malAgenda || 'Aparece cuando completa la etapa.'}</span>
                        </div>
                      )}
                      </Fragment>
                    );
                  })}

                  {/* Una caja vacía es un destino: dice que se le pueden soltar etapas. Su
                      hueco va JUSTO ANTES del texto, que la hoja esconde mientras el hueco
                      esté (`.ee-hueco+.ee-vacia`) — el texto sigue en el DOM porque es su
                      lugar medido (`data-slot`). */}
                  {g.etapas.length === 0 && (
                    <>
                      {huecoEtapa(g.clave, 0)}
                      <div className="ee-vacia" data-grupo={g.clave} data-slot={0}>
                        {sueltaDeMentira ? 'Suelta aquí para sacarla de su fase' : 'Arrastra etapas aquí'}
                      </div>
                    </>
                  )}

                  {/* «Nueva etapa» es la ÚLTIMA fila de su caja, y es también el lugar de «al
                      final»: su hueco va arriba de ella, debajo de la última fila. La caja de
                      mentira no lo lleva: no es un grupo de verdad. */}
                  {g.etapas.length > 0 && huecoEtapa(g.clave, g.etapas.length)}
                  {!sueltaDeMentira && (
                    <div data-grupo={g.clave}
                      data-slot={g.etapas.length > 0 ? g.etapas.length : undefined}>
                      <NuevoRenglon tipo="etapa" grupo={fase?.label ?? null} onCrear={(v) => agregarEtapa(v, g.clave || undefined)} />
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
          {/* El lugar «después de la última caja» de un arrastre de fase. */}
          {hayFases && (
            <div className="ee-entre" aria-hidden data-fslot={nGrupos}>
              {huecoFase(nGrupos)}
            </div>
          )}
        </div>

        <span aria-live="polite" style={SOLO_LECTOR}>{aviso}</span>
        {malProducto && <p style={ERROR}>{malProducto}</p>}
        {(invalida || mal) && <p style={ERROR}>{invalida || mal}</p>}
        </div>
      </Modal>

      {/* Cuando SÍ hay algo que perder, se pregunta con un DIÁLOGO, pegado al click. */}
      {confirmar && (
        <Confirm
          title={confirmar.titulo}
          message={confirmar.cuerpo}
          confirmLabel={confirmar.boton}
          cancelLabel={confirmar.cancelar}
          tone={confirmar.tono ?? 'danger'}
          onCancel={() => setConfirmar(null)}
          onConfirm={() => { const f = confirmar.hacer; setConfirmar(null); f(); }}
        />
      )}
      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/** El recuadro de error del CRM: al pie, en rojo, en negrita. */
const ERROR: CSSProperties = {
  margin: '12px 0 0', borderRadius: 10, padding: '10px 14px', fontFamily: SANS, fontSize: 13.5,
  fontWeight: 600, lineHeight: 1.45, background: 'var(--bad-bg)', color: 'var(--bad)',
};

/**
 * La paleta de una fase: los diez colores del CRM, en línea debajo del título.
 *
 * ⚠️ EN LÍNEA Y NO FLOTANDO: un popover adentro del cuerpo del modal (que scrollea) se
 * recorta contra su borde, y sacarlo por portal pide ubicarlo a mano y registrarlo en la
 * pila de capas. Diez puntos en un renglón no necesitan nada de eso. Se cierra al elegir,
 * con Escape (desde `window`, ver el encabezado) o cuando el foco se va.
 */
function Paleta({ actual, onElegir, onCerrar }: { actual: string; onElegir: (i: number) => void; onCerrar: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? ref.current?.querySelector<HTMLElement>('button');
    el?.focus();
  }, []);
  return (
    <div ref={ref} role="group" aria-label="Color de la fase"
      onBlur={(e) => {
        const a = e.relatedTarget as HTMLElement | null;
        // Al punto que la abrió no: su click ya la cierra, y cerrarla acá la reabriría.
        if (e.currentTarget.contains(a) || a?.closest?.('[data-paleta-de]')) return;
        onCerrar();
      }}
      // El primer color cae debajo del punto de la fase (ver «TODO ALINEA» en la hoja).
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '2px 6px 6px 27px' }}>
      {NEW_STAGE_PALETTE.map((dot, i) => (
        <button key={dot} type="button" data-nodrag aria-label={'Color ' + (i + 1)} aria-pressed={dot === actual}
          onClick={() => onElegir(i)}
          style={{
            width: 18, height: 18, flex: 'none', borderRadius: '50%', border: 'none', padding: 0, background: dot, cursor: 'pointer',
            // El elegido con `outline`: el velo de hover de `.crm-hover` usa `box-shadow`.
            outline: dot === actual ? '2px solid ' + dot : 'none', outlineOffset: 2,
          }} />
      ))}
    </div>
  );
}

/**
 * «Nueva etapa» / «Nueva fase»: al apretarlo pide el nombre ahí mismo.
 *
 * Antes se creaba una «Nueva etapa» sin preguntar y había que renombrarla después — dos
 * pasos para lo que es uno, y mientras tanto una columna con un nombre que no significa
 * nada.
 *
 * Las dos tienen la FORMA de lo que van a crear: «Nueva etapa» es la última fila de su
 * caja, y «Nueva fase» es una caja de mentira —punteada, gris, apagada— que se ilumina con
 * el cursor (el molde de «Crear nuevo proyecto» del Plan). Abierta, la de fase sigue
 * siendo una caja con su título por escribir, y la de etapa una fila blanca: lo que se
 * escribe aparece donde va a quedar.
 *
 * ⚠️ EL PUNTEADO ES UNO SOLO, el de «Nueva fase». Un recuadro punteado por grupo —lo que
 * había antes del 05/10— eran seis recuadros en una lista de nueve filas, la mitad de lo
 * que se veía.
 *
 * ⚠️ EL INPUT ES NO CONTROLADO, a propósito: el Escape lo resuelve el editor desde
 * `window` escribiéndole el valor vacío y soltando el foco. Con un input controlado ese
 * valor no llegaría al estado de React y el blur crearía igual lo que se quiso cancelar.
 */
function NuevoRenglon({ tipo, grupo, onCrear }: { tipo: 'etapa' | 'fase'; grupo?: string | null; onCrear: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const fase = tipo === 'fase';
  const cerrar = (guardar: boolean, v: string) => {
    setAbierto(false);
    const t = v.trim().replace(/\s+/g, ' ');
    if (guardar && t) onCrear(t);
  };
  if (abierto) {
    const renglon = (
      <div className={fase ? 'ee-fase' : 'ee-fila'}>
        <span className="ee-asa" aria-hidden />
        <span style={{ width: 18, flex: 'none', display: 'inline-flex', justifyContent: 'center' }} aria-hidden>
          <span style={{ ...PUNTO, ...(fase ? { boxShadow: 'inset 0 0 0 1.5px var(--border-strong)' } : { background: 'var(--faint)' }) }} />
        </span>
        <input
          autoFocus maxLength={MAX_LABEL} data-ee-esc=""
          placeholder={fase ? 'Nombre de la fase' : 'Nombre de la etapa'}
          aria-label={fase ? 'Nombre de la fase nueva' : 'Nombre de la etapa nueva'}
          onBlur={(e) => cerrar(true, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          style={fase ? { ...INPUT, fontSize: 13.5, fontWeight: 600 } : INPUT}
        />
      </div>
    );
    return fase ? <div className="ee-caja">{renglon}</div> : renglon;
  }
  return (
    <button type="button" className={fase ? 'ee-fase-nueva' : 'ee-mas'} onClick={() => setAbierto(true)}
      aria-label={fase ? 'Agregar fase' : grupo ? 'Agregar etapa a ' + grupo : 'Agregar etapa'}>
      <span className="ee-asa" aria-hidden />
      <span aria-hidden style={{ width: 18, flex: 'none', display: 'inline-flex', justifyContent: 'center', fontSize: fase ? 17 : 15, lineHeight: 1 }}>+</span>
      {fase ? 'Nueva fase' : 'Nueva etapa'}
    </button>
  );
}

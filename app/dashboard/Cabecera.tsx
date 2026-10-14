'use client';

// =============================================================================
// Cabecera — la TOPBAR del Dashboard (como la de Looker Studio) y el desplegable de las hojas
// =============================================================================
// Tanda de la topbar, Martín (11/10/2026), textual:
//   1. «Elimina todos las tabs de arriba, mejor que sea un desplegable en donde está el título grande
//      abajo de la topbar... Que ahí sea un desplegable para elegir otra tab o en su defecto crear una
//      nueva con el placeholder "Nueva hoja", que siempre el placeholder sea la primera opción.»
//   5. «El emoji, el título y el subtitulo debería poder editarse ahí mismo si le doy click, no hace
//      falta entrar a la vista de edición.»
//   6. «Elimina el icono de dashboard de la topbar. El título pasa a ser la topbar, junto al botón de
//      editar y los 3 puntos.»
//   8. «La topbar se tiene que ver igual a la de looker como en la captura. En lugar de los botones de
//      "Archivo, vista, pagina, ayuda", ahí va el subtitulo.»
//
// De ahí la forma: a la izquierda el EMOJI grande y, apilados, el TÍTULO de la hoja (con ▾ que abre el
// desplegable de las hojas) y debajo, chico, el SUBTÍTULO — donde Looker tiene «Archivo · Vista ·
// Página · Ayuda». A la derecha lo que manda la pantalla (`derecha`): los filtros, Compartir, Editar y ⋮.
// Sin pestañas, sin el ícono de la tab y sin «Restablecer el informe».
//
// ⚠️ EDITAR EN EL LUGAR ES `editable`, NO `editando`. Mirando también se cambia el emoji, el título o el
//    subtítulo con un clic (punto 5). Lo que lo apaga es no poder guardar: el closer, un link compartido,
//    o la lectura del informe caída (el primer cambio pisaría el informe real).
// ⚠️ EL TÍTULO ES UN `contentEditable` (EditableInline), NO UN INPUT: un input no mide su texto y se
//    cortaba según la fuente (AGENTS.md, «Un ancho que sale de una métrica tipográfica…»). Y no lleva
//    `white-space: nowrap`: un título largo baja de renglón, no se corta.
// ⚠️ EL DESPLEGABLE se abre con el ▾ (no con el título, que se edita con el clic); sin poder editar, el
//    título mismo es el botón. Y si no hay a dónde ir (una sola hoja y sin «Nueva hoja», como en un link
//    compartido de una hoja), no hay ▾: un desplegable de una opción es un control que no hace nada.

import { useCallback, useState, type ReactNode } from 'react';
import { EditableInline } from '@/app/_components/EditableInline';
import { NuevoPlaceholder } from '@/app/automations/NuevoPlaceholder';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { conBuscador } from '@/app/components/dropdown-reglas';
import { MAX_HOJAS, type Hoja } from '@/lib/graficos-catalogo';
import { Flotante, SvgFlecha, SvgLupa } from './Galeria';

type CambioCabecera = Partial<Pick<Hoja, 'nombre' | 'emoji' | 'subtitulo'>>;

/**
 * La topbar. `periodo` es la línea que sólo sale en el PDF (los filtros no se imprimen). El desplegable y
 * el selector de emoji los abre la pantalla (son `Flotante`s de ./Galeria.tsx): acá sólo los botones.
 */
export function BarraSuperior({ hoja, editable, conHojas, hojasAbierto, emojiAbierto, periodo, onHojas, onEmoji, onCambiar, derecha }: {
  hoja: Hoja;
  /** Se puede guardar: el emoji, el título y el subtítulo se editan con un clic, mirando o editando. */
  editable: boolean;
  /** Hay a dónde ir: más de una hoja, o «Nueva hoja». Sin eso no hay desplegable. */
  conHojas: boolean;
  hojasAbierto: boolean;
  emojiAbierto: boolean;
  periodo: string;
  onHojas: (ancla: HTMLElement) => void;
  onEmoji: (ancla: HTMLElement) => void;
  onCambiar: (p: CambioCabecera) => void;
  /** Lo de la derecha: los filtros de la hoja, Compartir, Editar/Ver y el ⋮. */
  derecha: ReactNode;
}) {
  return (
    <header className="lk-top">
      <div className="lk-top-izq" data-recorrido="dash-titulo">
        {editable ? (
          <button type="button" className={`lk-top-emoji lk-top-emoji--btn${hoja.emoji ? '' : ' lk-top-emoji--vacio'}`}
            aria-label="Cambiar el emoji" title="Cambiar el emoji" aria-haspopup="dialog" aria-expanded={emojiAbierto}
            onClick={(e) => onEmoji(e.currentTarget)}>
            {hoja.emoji || <IconoMenu nombre="emoji" size={22} />}
          </button>
        ) : hoja.emoji ? <span className="lk-top-emoji" aria-hidden>{hoja.emoji}</span> : null}
        <div className="lk-top-textos">
          <div className="lk-top-fila">
            {editable ? (
              <>
                <h1 className="lk-top-tit">
                  {/* Un título vacío no se guarda vacío: «Sin título», así el desplegable nunca muestra un hueco. */}
                  <EditableInline key={hoja.id} valor={hoja.nombre} maxLargo={40} titulo="Nombre de la hoja"
                    onGuardar={(v) => onCambiar({ nombre: v || 'Sin título' })} />
                </h1>
                {conHojas && (
                  <button type="button" className="lk-top-hojas" data-recorrido="dash-hojas" aria-label="Cambiar de hoja" title="Cambiar de hoja"
                    aria-haspopup="menu" aria-expanded={hojasAbierto} onClick={(e) => onHojas(e.currentTarget)}>
                    <SvgFlecha arriba={hojasAbierto} />
                  </button>
                )}
              </>
            ) : conHojas ? (
              <h1 className="lk-top-tit">
                <button type="button" className="lk-top-tit-btn" data-recorrido="dash-hojas" title="Cambiar de hoja"
                  aria-haspopup="menu" aria-expanded={hojasAbierto} onClick={(e) => onHojas(e.currentTarget)}>
                  <span>{hoja.nombre}</span>
                  <SvgFlecha arriba={hojasAbierto} />
                </button>
              </h1>
            ) : (
              <h1 className="lk-top-tit">{hoja.nombre}</h1>
            )}
          </div>
          {editable ? (
            <p className="lk-top-sub">
              <EditableInline key={hoja.id} valor={hoja.subtitulo} maxLargo={140} placeholder="Agrega un subtítulo" titulo="Subtítulo de la hoja"
                onGuardar={(v) => onCambiar({ subtitulo: v })} />
            </p>
          ) : hoja.subtitulo ? <p className="lk-top-sub">{hoja.subtitulo}</p> : null}
          <p className="lk-solo-imprimir lk-cab-periodo">{periodo}</p>
        </div>
      </div>
      <div className="lk-top-der">{derecha}</div>
    </header>
  );
}

/** Lo que se le puede hacer a una hoja desde el desplegable (con el ⋮ de su fila o con clic derecho). */
export type AccionesHoja = {
  onRenombrar: (id: string, nombre: string) => void;
  onDuplicar: (id: string) => void;
  /** «Copiar dashboard»: el TOKEN de la hoja al portapapeles, para pegarla en «Nueva hoja» de otro informe o negocio. */
  onCopiar: (id: string) => void;
  onMover: (id: string, delta: number) => void;
  onEliminar: (id: string) => void;
};

/**
 * El desplegable de las hojas: «＋ Nueva hoja» PRIMERA siempre (punto 1; el placeholder punteado de
 * Automations, importado), después las hojas —la abierta marcada— y, pasadas siete, el buscador de la
 * casa (`conBuscador`). Cada hoja lleva su ⋮ (y clic derecho) con Renombrar, Duplicar, Copiar dashboard (el
 * token para pegarla en otro lado, lib/graficos-copia.ts), Subir, Bajar y Eliminar.
 *
 * Tanda v5 (12/10/2026), punto 5: «el ⋮ queda en blanco» y «reemplaza las opciones».
 *   · LA FILA ENTERA se pinta (el hover y la abierta), no sólo el botón de la hoja: el ⋮, el espacio entre
 *     los dos y el margen derecho quedaban con el fondo del panel, una franja blanca (editor-css.ts).
 *   · El ⋮ abre un SEGUNDO desplegable AL COSTADO (`Flotante` con `lado="derecha"` y `anidado`, que se da
 *     vuelta si no entra), en vez de reemplazar la lista: las hojas siguen a la vista mientras se elige qué
 *     hacerle a una. Hasta v4 se reemplazaba porque «un segundo flotante anclado a una fila que se desmonta se
 *     cerraría solo»: la fila NO se desmonta al abrirlo (sólo al renombrarla o eliminarla, y ahí el submenú se
 *     cierra solo por `!ancla.isConnected`, que es lo correcto), y el de abajo ya no se cierra con un clic
 *     adentro del de arriba (`anidado`, ./Galeria.tsx).
 *   · Cada acción cierra el submenú: Subir y Bajar MUEVEN la fila, y un submenú anclado a una fila que se fue
 *     a otro lado señalaría la hoja equivocada.
 * `acciones` en null = no se puede guardar (el closer, un link compartido): sólo se elige.
 */
export function MenuHojas({ hojas, activa, puedeNueva, acciones, onIr, onNueva }: {
  hojas: readonly Hoja[];
  activa: string;
  puedeNueva: boolean;
  acciones: AccionesHoja | null;
  onIr: (id: string) => void;
  onNueva: () => void;
}) {
  const [q, setQ] = useState('');
  const [opciones, setOpciones] = useState<{ id: string; ancla: HTMLElement } | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const cerrarOpciones = useCallback(() => setOpciones(null), []);
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const busca = norm(q.trim());
  const visibles = hojas.filter((h) => !busca || norm(h.nombre).includes(busca));
  const deOpciones = opciones ? hojas.find((h) => h.id === opciones.id) : undefined;
  /** Abre (o cierra, si ya estaba abierto) el submenú de una hoja, anclado a SU fila. */
  const alternarOpciones = (id: string, fila: HTMLElement | null) => {
    if (!fila) return;
    setOpciones((o) => (o && o.id === id ? null : { id, ancla: fila }));
  };

  const submenu = (() => {
    if (!acciones || !deOpciones || !opciones) return null;
    const i = hojas.findIndex((h) => h.id === deOpciones.id);
    const op = (texto: string, icono: NombreIconoMenu, fn: () => void, deshabilitada = false, peligro = false) => (
      <button type="button" role="menuitem" className={`lk-opcion${peligro ? ' lk-opcion--peligro' : ''}`} disabled={deshabilitada}
        onClick={() => { setOpciones(null); fn(); }}>
        <IconoMenu nombre={icono} size={17} /> <span>{texto}</span>
      </button>
    );
    return (
      <Flotante ancla={opciones.ancla} onCerrar={cerrarOpciones} ancho={210} lado="derecha" anidado>
        <div className="lk-lista" role="menu" aria-label={`Opciones de ${deOpciones.nombre}`}>
          {op('Renombrar', 'renombrar', () => setRenombrando(deOpciones.id))}
          {op('Duplicar', 'duplicar', () => acciones.onDuplicar(deOpciones.id), hojas.length >= MAX_HOJAS)}
          {op('Copiar dashboard', 'copiar', () => acciones.onCopiar(deOpciones.id))}
          {op('Subir', 'arriba', () => acciones.onMover(deOpciones.id, -1), i <= 0)}
          {op('Bajar', 'abajo', () => acciones.onMover(deOpciones.id, 1), i >= hojas.length - 1)}
          <div className="lk-sep-h" />
          {op('Eliminar', 'borrar', () => acciones.onEliminar(deOpciones.id), hojas.length <= 1, true)}
        </div>
      </Flotante>
    );
  })();

  return (
    <div className="lk-lista" role="menu" aria-label="Hojas">
      {puedeNueva && (
        <span className="lk-hoja-nueva" data-recorrido="dash-nueva-hoja">
          <NuevoPlaceholder chico texto="Nueva hoja" onClick={onNueva} style={{ height: 36 }} />
        </span>
      )}
      {conBuscador(hojas.length) && (
        <div className="lk-buscar lk-buscar--lista"><SvgLupa /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar una hoja" /></div>
      )}
      {visibles.map((h) => {
        const esActiva = h.id === activa;
        if (renombrando === h.id && acciones) {
          return (
            <div key={h.id} className="lk-hoja-fila">
              <input autoFocus defaultValue={h.nombre} maxLength={40} className="lk-hoja-input" aria-label="Nombre de la hoja"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.nombre) acciones.onRenombrar(h.id, v); setRenombrando(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setRenombrando(null); }
                }} />
            </div>
          );
        }
        const abiertas = opciones?.id === h.id;
        return (
          <div key={h.id} className="lk-hoja-fila" data-activa={esActiva || undefined} data-opciones={abiertas || undefined}
            onContextMenu={(e) => { if (!acciones) return; e.preventDefault(); alternarOpciones(h.id, e.currentTarget); }}>
            <button type="button" role="menuitemradio" aria-checked={esActiva} className="lk-opcion lk-hoja-op" onClick={() => onIr(h.id)} title={h.nombre}>
              <span className="lk-hoja-marca">{esActiva && <IconoMenu nombre="check" size={15} />}</span>
              {h.emoji && <span aria-hidden>{h.emoji}</span>}
              <span className="lk-hoja-nombre">{h.nombre}</span>
            </button>
            {acciones && (
              <button type="button" className="lk-hoja-mas" aria-label={`Opciones de ${h.nombre}`} aria-haspopup="menu" aria-expanded={abiertas}
                onClick={(e) => alternarOpciones(h.id, e.currentTarget.parentElement)}>⋮</button>
            )}
          </div>
        );
      })}
      {!visibles.length && <div className="lk-hojas-vacio">Ninguna hoja se llama así.</div>}
      {submenu}
    </div>
  );
}

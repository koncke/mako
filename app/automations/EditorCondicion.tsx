'use client';

// =============================================================================
// EditorCondicion — el editor de la tarjeta CONDITION del lienzo de /automations
// =============================================================================
// Pedido de Martín (09/10/2026, tercera tanda, punto 9): «Haz que el editable del condicional sea
// mucho más simple de entender, como el resto, no tan ancho que ocupe todo». Y el punto 10: todas las
// condiciones del negocio, por secciones, filtradas por el CRON (lib/condiciones-catalogo.ts).
//
// CUARTA TANDA (09/10/2026, mañana):
//   · Punto 7: «No entiendo el botón de "+Rama", es básicamente lo mismo que "+condición"... Eso
//     eliminalo. Y también me gustaba antes la opción de "+y" "+o", para que cumplan ambas o una de las
//     2». Sin «＋ Rama» y sin el selector de la rama entera: una condición nueva es UNA pregunta con «Sí»
//     y «Si no», y cada fila nueva RECUERDA con qué se une a la de arriba (`FilaCondicion.union`). El
//     separador entre dos filas se ve («y» / «o») y se cambia tocándolo. Las condiciones de antes con
//     varias ramas se siguen dibujando (numeradas) y editando; sólo no se ofrece agregar otra.
//   · Punto 5: la familia de la reunión suma un selector de una o más etapas de REUNIÓN del kanban.
//   · Punto 6: «Pagó / No pagó» suma la cuota (vacío = como siempre): «No pagó la cuota 1».
//
// SEXTA TANDA (09/10/2026, noche), los cuatro puntos de «CONDITION» y el 12 de «General»:
//   · Punto 3: «Se tiene que diferenciar el desplegable principal del resto... Tiene que tener más
//     protagonismo el principal». La pregunta de cada fila es el CAMPO GRANDE de la casa (`botonGrande`,
//     48 de alto, letra 16) y lo que pide va debajo, más chico y colgando de una línea a la izquierda.
//   · Punto 1: «primero selecciono el módulo y ahí me aparecen las clases de ese módulo... Esto para
//     TODO». Los valores con jerarquía se eligen por un árbol (`arbolDeOpciones`): curso → módulo →
//     clase, producto → etapa, embudo → reunión.
//   · Punto 4: «El botón de "+y" "+o" que sean como en la captura de Manychat de "+Nuevo disparador"...
//     tipo placeholder, centrado... uno al lado del otro, pero que ocupen todo el ancho». Borde punteado,
//     texto en el color primario, centrado, 48 de alto y los dos repartiendo el renglón.
//   · Punto 12: «Reply ya te dije que tiene que estar dentro de CONDITION». La condición que escucha
//     las respuestas (el nodo `respuesta` de siempre) se edita ACÁ (`EditorCondicionDeRespuesta`): cada
//     caso es una fila «Su respuesta trata de» con su nombre y cuándo aplica, y el «Si no» es lo que
//     antes era «Otra cosa». Y una condición VACÍA puede pasar a escuchar (`onPasarARespuesta`).
//
// ⚠️ EL BUG DE «+y» QUE CREABA «+o» (tercera tanda) NO VUELVE: aquellos dos botones agregaban la fila Y
// cambiaban el modo de la rama ENTERA, así que el separador de TODAS las filas cambiaba con el último
// tocado. Ahora cada botón fija la unión de SU fila y de ninguna otra.
//
// ⚠️ ESTE ARCHIVO NO GUARDA NADA (como FlujoLienzo): cada cambio sube por `cambiar` (o por los de
// `EdicionRespuesta`), y quitar una rama —que se lleva lo que colgaba de ella— por `onQuitarRama`, que
// hace el lienzo sobre el flujo entero.

import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown, type DropdownGroup, type DropdownOption } from '../components/Dropdown';
import { SelectorEtiqueta } from '@/app/_components/etiquetas-cliente';
import { inpLienzo, botonGrande } from '@/app/_components/Lienzo';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { TOPE_FILAS, TOPE_CASOS, ROTULO_RESPUESTA, unionDe, rotuloSiNoDeRespuesta, type FilaCondicion, type RamaCondicion, type CasoRespuesta } from '@/lib/flujo-grafo';
import {
  condicionPorId, seccionesDeCondiciones, arbolDeOpciones, esArbol, filaNueva, deValorOpcion, valorOpcion, problemaDeFila,
  nombreDeValor, nombresCatalogoDe, cuotaDeFila, SIMBOLO_OP, TOPE_CUOTA, TOPE_REUNIONES, SECCION_RESPUESTA,
  type AmbitoDisparo, type CatalogosCondicion, type CursoCondicion, type DefCondicion, type ProductoCondicion,
  type ReunionesDeEmbudo, type SeccionOpciones, type NivelArbol,
} from '@/lib/condiciones-catalogo';

const SANS = "'Geist', sans-serif";

/** El id de la fila de la condición que escucha las respuestas (lib/condiciones-catalogo.ts). */
const ID_RESPUESTA = 'respuesta_trata_de';

/** Las etapas de venta de UN producto (la forma de `SeccionEtapas` de FlujoLienzo). */
type EtapasDeProducto = { title: string; funnelId: number; options: Array<{ value: string; label: string }> };

/** La condición que ESCUCHA LAS RESPUESTAS (el nodo `respuesta`): sus casos y cómo se editan. */
export type EdicionRespuesta = {
  casos: readonly CasoRespuesta[];
  /** Un cambio del nombre o del «cuándo aplica» de un caso. `apilar`: entra a la pila de deshacer. */
  cambiarCasos: (casos: CasoRespuesta[], apilar: boolean) => void;
  /** «＋ o»: un caso más, con su tarjeta «MaKo contesta» (`agregarCaso`, lib/flujo-conversacion.ts). */
  onAgregarCaso: () => void;
  /** Quitar un caso, con lo que colgaba de él (`quitarCaso`). */
  onQuitarCaso: (casoId: string) => void;
  /** Abre la tarjeta del «Si no» (lo que antes era «Otra cosa»), si tiene una. */
  onVerSiNo?: () => void;
};

export type EditorCondicionProps = {
  /** La tarjeta: sus ramas (el «Si no» es fijo). */
  paso: { ramas?: RamaCondicion[] };
  /** Un cambio de ESTA tarjeta. `apilar`: entra a la pila de deshacer (todo menos tipear). */
  cambiar: (patch: { ramas: RamaCondicion[] }, apilar: boolean) => void;
  /** De qué lado es el CRON (`ambitoDeDisparo(trigger_tipo)`): qué condiciones se ofrecen. */
  ambito: AmbitoDisparo;
  /** Las etapas de venta por producto (la fila «Está en la etapa»). */
  etapas: EtapasDeProducto[];
  /** Los productos con su embudo y su entrega (`ProductoParaDisparo`). */
  productos: ProductoCondicion[];
  busy: boolean;
  /**
   * @deprecated Cuarta tanda, punto 7: «el botón de "+Rama"... Eso eliminalo». El editor ya no lo dibuja; queda
   * opcional para que quien lo monta compile hasta que deje de pasarlo.
   */
  onAgregarRama?: () => void;
  /** Quitar una rama entera, con lo que colgaba de ella (al quitar su última fila). */
  onQuitarRama: (ramaId: string) => void;
  /** Los catálogos de la base (cursos, posts, campañas, reuniones). Ausente = los lee el editor solo. */
  catalogos?: CatalogosRemotos | null;
  /**
   * SEXTA TANDA: esta condición, VACÍA, puede pasar a escuchar las respuestas (`condicionARespuesta`,
   * lib/flujo-grafo.ts): el desplegable de su primera fila ofrece «Su respuesta trata de». Ausente = no
   * se ofrece (ya hay una en la automatización, o quien monta no lo enchufó).
   */
  onPasarARespuesta?: () => void;
};

/** Lo que trae GET /api/chat-agent/condiciones. `reuniones` en null = no se pudo leer. */
export type CatalogosRemotos = {
  cursos: CursoCondicion[]; posts: Array<{ id: number; titulo: string }>; campanas: string[];
  reuniones?: ReunionesDeEmbudo[] | null;
};

// ── Los catálogos de la base, leídos UNA vez por página ───────────────────────────
// «No pude leer» es un tercer estado (AGENTS.md): con el GET caído, las condiciones que los
// necesitan NO se ofrecen (no hay con qué completarlas), pero una fila ya puesta se sigue dibujando.

let enVuelo: Promise<CatalogosRemotos | null> | null = null;

function leerCatalogos(): Promise<CatalogosRemotos | null> {
  enVuelo ??= fetch('/api/chat-agent/condiciones', { signal: AbortSignal.timeout(35_000) })
    .then(async (r) => {
      const j = await r.json().catch(() => null) as ({ ok?: boolean } & Partial<CatalogosRemotos>) | null;
      if (!r.ok || !j?.ok) throw new Error('catálogos');
      // Las reuniones van aparte del resto (la ruta las lee con su propio catch): sin el campo, o en
      // null, «no se pudo leer», nunca «este negocio no tiene reuniones».
      return { cursos: j.cursos ?? [], posts: j.posts ?? [], campanas: j.campanas ?? [], reuniones: Array.isArray(j.reuniones) ? j.reuniones : null };
    })
    .catch(() => { enVuelo = null; return null; });
  return enVuelo;
}

/**
 * Los catálogos de las condiciones (cursos, módulos, clases, posts, campañas, reuniones). Lo usa este
 * editor y lo usan el lienzo y «Probar» para que la TARJETA diga el nombre de lo elegido
 * (`nombresCatalogoDe` → `NombresParaTexto.catalogo`). `activo` en false no pide nada: el lienzo lo
 * pide sólo si el flujo tiene una condición y quien mira es admin (la ruta es de admin).
 */
export function useCatalogosCondicion(activo = true): CatalogosRemotos | null {
  const [cat, setCat] = useState<CatalogosRemotos | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    void leerCatalogos().then((c) => { if (vivo) setCat(c); });
    return () => { vivo = false; };
  }, [activo]);
  return cat;
}

/** Los catálogos juntos, en la forma que piden las funciones del catálogo. */
export function catalogosDe(p: { etapas: EtapasDeProducto[]; productos: ProductoCondicion[]; remotos: CatalogosRemotos | null }): CatalogosCondicion {
  return {
    etapas: p.etapas, productos: p.productos, cursos: p.remotos?.cursos, posts: p.remotos?.posts, campanas: p.remotos?.campanas,
    // undefined = todavía no llegó; null = no se pudo leer. Las dos dejan el selector apagado.
    reuniones: p.remotos ? p.remotos.reuniones ?? null : undefined,
  };
}

// ── Las piezas de la cara ─────────────────────────────────────────────────────────

/**
 * EL PLACEHOLDER de la casa para agregar (sexta tanda, punto 4, el «+ Nuevo disparador» de ManyChat):
 * borde punteado, el texto en el color primario y centrado, 48 de alto. Lo que se ve es el botón de un
 * desplegable (`Agregar`), así que el estilo va como `buttonStyle`.
 */
const PLACEHOLDER: CSSProperties = {
  ...botonGrande, width: '100%', justifyContent: 'center', background: 'transparent',
  border: '1.5px dashed var(--border-strong)', fontSize: 14.5,
};

/** Lo que pide una condición, debajo de la pregunta: más chico y colgando de una línea a la izquierda. */
const SECUNDARIO: CSSProperties = { minHeight: 38, padding: '7px 11px', fontSize: 13.5, fontWeight: 500, borderRadius: 9 };
const COLGANDO: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 12, borderLeft: '2px solid var(--border)', marginLeft: 6 };

// ── El editor ─────────────────────────────────────────────────────────────────────

export function EditorCondicion({ paso, cambiar, ambito, etapas, productos, busy, onQuitarRama, catalogos, onPasarARespuesta }: EditorCondicionProps) {
  const leidos = useCatalogosCondicion();
  const remotos = catalogos !== undefined ? catalogos : leidos;
  const cat = catalogosDe({ etapas, productos, remotos });
  const ramas = paso.ramas ?? [];
  const setRama = (ri: number, r: RamaCondicion, apilar: boolean) => cambiar({ ramas: ramas.map((x, k) => (k === ri ? r : x)) }, apilar);
  const deLaSalida = seccionesDeCondiciones(ambito, cat);
  // Una condición VACÍA puede pasar a escuchar las respuestas: se ofrece su familia, al final.
  const vacia = ramas.every((r) => !(r.filas?.length));
  const secciones: SeccionOpciones[] = vacia && onPasarARespuesta
    ? [...deLaSalida, { title: SECCION_RESPUESTA, options: [{ value: valorOpcion(ID_RESPUESTA, false), label: ROTULO_RESPUESTA }] }]
    : deLaSalida;
  // Varias ramas = una condición de ANTES de la cuarta tanda: cada una numerada y en su caja, y el «Si
  // no» al pie para que se entienda el orden. Una sola (todo lo nuevo): la pregunta, sin cajas.
  const varias = ramas.length > 1;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ramas.map((r, ri) => (
        <Rama key={r.id} rama={r} numero={varias ? ri + 1 : null} secciones={secciones} cat={cat} busy={busy}
          onCambiar={(nr, apilar) => setRama(ri, nr, apilar)}
          // La última fila de una rama se lleva la rama (y lo que colgaba de ella), salvo que sea la
          // ÚNICA rama: una condición sin ramas no se puede publicar. Ahí la fila se vacía.
          onQuitarRama={() => onQuitarRama(r.id)}
          puedeQuitarRama={varias}
          onPasarARespuesta={onPasarARespuesta}
        />
      ))}
      {varias && <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--dim)' }}>Si no</div>}
    </div>
  );
}

function Rama({ rama, numero, secciones, cat, busy, onCambiar, onQuitarRama, puedeQuitarRama, onPasarARespuesta }: {
  rama: RamaCondicion; numero: number | null; secciones: SeccionOpciones[]; cat: CatalogosCondicion; busy: boolean;
  onCambiar: (r: RamaCondicion, apilar: boolean) => void; onQuitarRama: () => void; puedeQuitarRama: boolean;
  onPasarARespuesta?: () => void;
}) {
  const filas = rama.filas ?? [];
  /** Agrega la fila elegida. `union`: con qué se une a la de arriba (la primera no se une a nada). */
  const agregar = (union: 'y' | 'o' | null) => (v: string) => {
    const d = deValorOpcion(v);
    // «Su respuesta trata de» no es una fila de la salida: la tarjeta pasa a escuchar las respuestas.
    if (d?.id === ID_RESPUESTA) { onPasarARespuesta?.(); return; }
    const f = d ? filaNueva(d.id, d.no) : null;
    if (!f) return;
    onCambiar({ ...rama, filas: [...filas, filas.length && union ? { ...f, union } : f] }, true);
  };
  const setFila = (fi: number, nf: FilaCondicion, apilar: boolean) => onCambiar({ ...rama, filas: filas.map((x, k) => (k === fi ? nf : x)) }, apilar);
  const quitarFila = (fi: number) => {
    if (filas.length > 1) onCambiar({ ...rama, filas: filas.filter((_, k) => k !== fi) }, true);
    else if (puedeQuitarRama) onQuitarRama();
    else onCambiar({ ...rama, filas: [] }, true);
  };
  const lleno = busy || filas.length >= TOPE_FILAS;
  // Lo que se agrega DESPUÉS de una fila es de la salida: «Su respuesta trata de» sólo en la primera.
  const deLaSalida = secciones.filter((s) => s.title !== SECCION_RESPUESTA);
  const caja: CSSProperties = numero != null
    ? { border: '1px solid var(--border)', borderRadius: 10, padding: '10px 10px 9px', background: 'var(--surface)' }
    : {};
  return (
    <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {numero != null && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', fontFamily: SANS }}>{numero}</span>}
      {filas.map((f, fi) => (
        <Fragment key={fi}>
          {fi > 0 && <Union union={unionDe(rama, fi)} busy={busy} onCambiar={(u) => setFila(fi, { ...f, union: u }, true)} />}
          <FilaFrase fila={f} cat={cat} secciones={deLaSalida} busy={busy}
            onCambiar={(nf, apilar) => setFila(fi, nf, apilar)}
            // ⚠️ CON UN SOLO DESPLEGABLE, SIN TACHO (10/10/2026, condición 1: «si hay un solo desplegable
            // no debería estar el tacho de basura, para eso se elimina toda la tarjeta, y para eso ya
            // tenemos el botón al lado de cerrar»).
            onQuitar={filas.length > 1 || puedeQuitarRama ? () => quitarFila(fi) : undefined} />
        </Fragment>
      ))}
      {filas.length === 0
        ? <Agregar texto="＋ Condición" aria="Agregar una condición" secciones={secciones} disabled={lleno} onElegir={agregar(null)} falta />
        : (
          // Los dos placeholders LADO A LADO y repartiendo el renglón (punto 4: «no pongas uno abajo
          // del otro, sino que uno al lado del otro, pero que ocupen todo el ancho»).
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <Agregar texto="＋ y" aria="Agregar una condición que se cumpla además" titulo="Se cumplen las dos" secciones={deLaSalida} disabled={lleno} onElegir={agregar('y')} />
            <Agregar texto="＋ o" aria="Agregar una condición alternativa" titulo="Alcanza con una" secciones={deLaSalida} disabled={lleno} onElegir={agregar('o')} />
          </div>
        )}
    </div>
  );
}

/**
 * «＋ Condición» / «＋ y» / «＋ o»: el desplegable de condiciones por secciones, con cara de PLACEHOLDER
 * (punto 4). Ocupa lo que le dan: solo, el renglón; de a dos, la mitad cada uno.
 */
function Agregar({ texto, aria, titulo, secciones, disabled, onElegir, falta }: {
  texto: string; aria: string; titulo?: string; secciones: SeccionOpciones[]; disabled: boolean; onElegir: (v: string) => void;
  /** La condición todavía no pregunta nada: el placeholder va en ROJO (condición 4, «donde falta»). */
  falta?: boolean;
}) {
  return (
    <div title={titulo} style={{ flex: 1, minWidth: 0 }}>
      <Dropdown value="" secciones={secciones as DropdownGroup[]} onChange={onElegir} resetAfterSelect sinFlecha search
        disabled={disabled} ariaLabel={aria} menuAncho={340} menuAlto={420} width="100%"
        botonLabel={<span style={{ fontSize: 14.5, fontWeight: 600, color: disabled ? 'var(--faint)' : 'var(--primary)', fontFamily: SANS }}>{texto}</span>}
        buttonStyle={falta ? { ...PLACEHOLDER, borderColor: 'var(--bad)' } : PLACEHOLDER} />
    </div>
  );
}

/** El separador entre dos filas: «y» / «o», a la vista. Tocarlo cambia la unión de ESA fila. */
function Union({ union, busy, onCambiar }: { union: 'y' | 'o'; busy: boolean; onCambiar: (u: 'y' | 'o') => void }) {
  const otra = union === 'y' ? 'o' : 'y';
  return (
    <Separador>
      <button type="button" disabled={busy} onClick={() => onCambiar(otra)} title={`Cambiar a «${otra}»`} aria-label={`Se une con «${union}». Cambiar a «${otra}»`}
        style={{
          border: '1px solid var(--border-strong)', borderRadius: 999, padding: '2px 12px', fontSize: 12, fontWeight: 700, fontFamily: SANS,
          background: 'var(--surface-2)', color: 'var(--ink)', cursor: busy ? 'default' : 'pointer', lineHeight: 1.4,
        }}>{union}</button>
    </Separador>
  );
}

/** Una línea de lado a lado con algo en el medio (la unión entre dos filas). */
function Separador({ children }: { children: ReactNode }) {
  const linea: CSSProperties = { flex: 1, height: 1, background: 'var(--border)' };
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={linea} />{children}<span style={linea} /></div>;
}

/** ¿La condición tiene algo que elegir además de sí misma? (para no dibujar una fila vacía debajo). */
function tieneValor(def: DefCondicion | null, campo: string): boolean {
  if (!def) return false;
  if (def.valor.t === 'legado') return campo === 'etiqueta' || campo === 'etapa' || campo === 'antiguedad' || campo === 'pago';
  return def.valor.t !== 'ninguno';
}

/**
 * Una fila: la PREGUNTA (el desplegable grande, de ancho completo: punto 3, «más protagonismo el
 * principal») y su ✕; debajo, más chico y colgando, lo que pide.
 */
function FilaFrase({ fila, cat, secciones, busy, onCambiar, onQuitar }: {
  fila: FilaCondicion; cat: CatalogosCondicion; secciones: SeccionOpciones[]; busy: boolean;
  onCambiar: (f: FilaCondicion, apilar: boolean) => void;
  /** Ausente = es la única condición: sin tacho (se borra la tarjeta entera). */
  onQuitar?: () => void;
}) {
  const def = condicionPorId(fila.campo);
  const valorCampo = valorOpcion(String(fila.campo), !!fila.no && !!def?.negable);
  // Lo puesto que ya no se ofrece (una condición retirada, de otro ámbito o sin catálogo) lo dice el
  // BOTÓN: el desplegable de la casa no es un <select> y nada se escribe hasta elegir (cuarta tanda,
  // decisión 2, docs/hallazgos-chatbot.md).
  const enLista = secciones.some((s) => s.options.some((o) => o.value === valorCampo));
  const rotuloPuesto = def ? def.rotulo[fila.no && def.negable ? 1 : 0] : 'Condición desconocida';
  const elegirCampo = (v: string) => {
    const d = deValorOpcion(v);
    if (!d) return;
    // La misma condición, sólo negada o no: se conserva lo elegido. Otra condición: nace limpia, pero
    // CONSERVA su unión con la de arriba (cambiar la pregunta no cambia cómo se une).
    if (d.id === fila.campo) {
      const { no: _antes, ...resto } = fila;
      void _antes;
      onCambiar(d.no ? { ...resto, no: true } : resto, true);
      return;
    }
    const f = filaNueva(d.id, d.no);
    if (f) onCambiar(fila.union ? { ...f, union: fila.union } : f, true);
  };
  const incompleta = problemaDeFila(fila) != null;
  // ⚠️ CADA CONDICIÓN EN SU CONTENEDOR, con el tacho CHICO arriba a la derecha (10/10/2026, condición 3:
  // «lo mismo que hicimos en el CRON, que tenga un contenedor para toda esa condición, entonces el
  // botón de eliminar arriba a la derecha más chico, no al lado del desplegable»). El tacho cuelga de la
  // esquina para no robarle ancho a la pregunta, que sigue siendo el campo grande.
  return (
    <div data-condicion-fila style={{
      position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 12,
      border: `1px solid ${incompleta ? 'var(--bad)' : 'var(--border)'}`, background: 'var(--surface-2)',
    }}>
      {onQuitar && <BotonQuitar onClick={onQuitar} disabled={busy} aria="Quitar esta condición" />}
      <Dropdown value={valorCampo} secciones={secciones as DropdownGroup[]} search ariaLabel="Condición" disabled={busy}
        width="100%" menuAncho={340} menuAlto={420} onChange={elegirCampo} buttonStyle={botonGrande}
        botonLabel={enLista ? undefined : rotuloPuesto} />
      {tieneValor(def, String(fila.campo)) && (
        <div style={COLGANDO}>
          <Valor fila={fila} cat={cat} busy={busy} onCambiar={onCambiar} incompleta={incompleta} />
        </div>
      )}
      {def?.reuniones && <SelectorReuniones fila={fila} cat={cat} busy={busy} onCambiar={onCambiar} />}
    </div>
  );
}

/**
 * QUITAR UNA FILA (una condición, un caso): la papelera de la casa, ROJA (sexta tanda, general 9: «Cambia
 * el botón de BORRAR con ese ícono... Esto en TODOS lados. Y que siempre el ícono de borrar sea rojo»).
 * Hasta la segunda pasada era una ✕ gris, que se lee como «cerrar» y no como «borrar esta fila».
 *
 * Desde el 10/10/2026 (condición 3) es CHICA y cuelga de la ESQUINA de arriba a la derecha del contenedor
 * de la condición (`xs`): al lado del desplegable le robaba ancho a la pregunta y se confundía con el de
 * la tarjeta entera, que es el `md` de la cabecera del panel.
 */
function BotonQuitar({ onClick, disabled, aria }: { onClick: () => void; disabled: boolean; aria: string }) {
  return (
    <BotonBorrar talla="xs" onClick={onClick} disabled={disabled} title={aria}
      style={{ position: 'absolute', top: -9, right: -9, zIndex: 1, boxShadow: '0 1px 3px rgba(0,0,0,.12)' }} />
  );
}

/** Saca una clave de la fila (para volver a «cualquiera»): ausente, no vacía. */
function sin<K extends keyof FilaCondicion>(f: FilaCondicion, k: K): FilaCondicion {
  const copia = { ...f };
  delete copia[k];
  return copia;
}

/** El control del valor, según lo que la condición necesita. Todo con la cara SECUNDARIA (punto 3). */
function Valor({ fila, cat, busy, onCambiar, incompleta }: {
  fila: FilaCondicion; cat: CatalogosCondicion; busy: boolean; incompleta: boolean;
  onCambiar: (f: FilaCondicion, apilar: boolean) => void;
}) {
  const def = condicionPorId(fila.campo);
  if (!def) return null;
  const v = def.valor;
  // Lo que falta, en ROJO (10/10/2026, condición 4: «debe remarcarse con rojo para identificar donde falta»).
  const marco: CSSProperties | undefined = incompleta ? { borderColor: 'var(--bad)' } : undefined;
  const unidad = (t: string) => <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{t}</span>;

  if (v.t === 'legado') {
    if (fila.campo === 'etiqueta') {
      return (
        <SelectorEtiqueta value={fila.valor == null ? null : Number(fila.valor)} placeholder="Elige" width="100%" ariaLabel="Etiqueta" disabled={busy}
          onElegir={(e) => onCambiar({ ...fila, valor: e.id }, true)} />
      );
    }
    if (fila.campo === 'etapa') {
      const valor = fila.valor != null && fila.valor !== '' ? `${fila.funnel_id ?? ''}:${fila.valor}` : '';
      return (
        <SelectorDeLista niveles={arbolDeOpciones('etapa', cat)} valor={valor} nombrePuesto={String(fila.valor ?? '')} busy={busy} aria="Etapa" falta={incompleta}
          onElegir={(x) => { const [fid, ...k] = x.split(':'); onCambiar({ ...fila, valor: k.join(':'), funnel_id: fid ? Number(fid) : null }, true); }} />
      );
    }
    if (fila.campo === 'antiguedad') {
      return (
        <>
          <input type="number" min={1} step={1} value={Number(fila.valor) || ''} disabled={busy} aria-label="Horas"
            onChange={(e) => onCambiar({ ...fila, valor: Math.max(1, Math.round(Number(e.target.value) || 0)) }, false)}
            style={{ ...inpLienzo, width: 90, flex: 'none', ...marco }} />
          {unidad('h')}
        </>
      );
    }
    // «Pagó / No pagó» con la cuota N (cuarta tanda, punto 6). Vacía = como siempre (alguna vez pagó):
    // se borra la clave, no se guarda un 0 que el motor leería como «la cuota 0».
    if (fila.campo === 'pago') {
      return (
        <>
          {unidad('Cuota')}
          <input type="number" min={1} max={TOPE_CUOTA} step={1} value={cuotaDeFila(fila) ?? (fila.valor == null ? '' : String(fila.valor))}
            placeholder="Cualquiera" disabled={busy} aria-label="Número de cuota"
            onChange={(e) => {
              const t = e.target.value.trim();
              onCambiar(t === '' ? sin(fila, 'valor') : { ...fila, valor: Math.round(Number(t)) }, false);
            }}
            style={{ ...inpLienzo, width: 130, flex: 'none', ...marco }} />
        </>
      );
    }
    return null;
  }

  if (v.t === 'lista') {
    const valor = fila.valor == null ? '' : String(fila.valor);
    return (
      <SelectorDeLista niveles={arbolDeOpciones(v.catalogo, cat)} valor={valor} nombrePuesto={nombreDeValor(v.catalogo, valor, nombresCatalogoDe(cat))}
        busy={busy} aria={def.rotulo[0]} falta={incompleta} onElegir={(x) => onCambiar({ ...fila, valor: x }, true)} />
    );
  }

  if (v.t === 'texto') {
    return (
      <input type="text" value={String(fila.valor ?? '')} disabled={busy} aria-label={def.rotulo[0]} placeholder="Texto" maxLength={120}
        onChange={(e) => onCambiar({ ...fila, valor: e.target.value }, false)}
        style={{ ...inpLienzo, flex: 1, minWidth: 180, ...marco }} />
    );
  }

  if (v.t === 'numero') {
    const op = fila.op === 'menor_igual' ? 'menor_igual' : 'mayor_igual';
    return (
      <>
        {v.ref && (
          <SelectorDeLista niveles={arbolDeOpciones(v.ref, cat)} valor={fila.ref == null ? '' : String(fila.ref)}
            nombrePuesto={nombreDeValor(v.ref, String(fila.ref ?? ''), nombresCatalogoDe(cat))} busy={busy} aria="Curso"
            onElegir={(x) => onCambiar({ ...fila, ref: Number(x) }, true)} />
        )}
        <Dropdown value={op} width={64} ariaLabel="Operador" disabled={busy} search={false} buttonStyle={SECUNDARIO}
          options={[{ value: 'mayor_igual', label: SIMBOLO_OP.mayor_igual }, { value: 'menor_igual', label: SIMBOLO_OP.menor_igual }]}
          onChange={(x) => onCambiar({ ...fila, op: x === 'menor_igual' ? 'menor_igual' : 'mayor_igual' }, true)} />
        <input type="number" min={v.min} max={v.max} step={1} value={fila.valor == null ? '' : Number(fila.valor)} disabled={busy} aria-label="Número"
          onChange={(e) => { const n = e.target.value === '' ? null : Math.round(Number(e.target.value)); onCambiar({ ...fila, valor: n }, false); }}
          style={{ ...inpLienzo, width: 90, flex: 'none', ...marco }} />
        {v.unidad.trim() && unidad(v.unidad.trim())}
      </>
    );
  }
  return null;
}

/**
 * LAS ETAPAS DE REUNIÓN de la condición (cuarta tanda, punto 5): se eligen una o más, y ninguna es
 * «cualquier reunión». Las ofrece el CRM (las etapas marcadas como reunión, por embudo: un árbol si
 * hay varios); la tercera en adelante se ve apagada, porque la ficha no tiene dónde guardar su fecha.
 *
 * ⚠️ LO ELEGIDO QUE YA NO ESTÁ EN LA LISTA SE SIGUE NOMBRANDO (una etapa que el CRM dejó de marcar como
 * reunión): el botón dice lo puesto, y tocar otra cosa no lo borra.
 */
function SelectorReuniones({ fila, cat, busy, onCambiar }: {
  fila: FilaCondicion; cat: CatalogosCondicion; busy: boolean; onCambiar: (f: FilaCondicion, apilar: boolean) => void;
}) {
  const elegidas = fila.reuniones ?? [];
  const niveles = arbolDeOpciones('reunion', cat);
  const hay = niveles.some((n) => opcionesDelNivel(n).length > 0);
  const nombres = nombresCatalogoDe(cat);
  const tocar = (v: string) => {
    const nuevas = elegidas.includes(v) ? elegidas.filter((x) => x !== v) : [...elegidas, v].slice(0, TOPE_REUNIONES);
    onCambiar(nuevas.length ? { ...fila, reuniones: nuevas } : sin(fila, 'reuniones'), true);
  };
  const rotulo = elegidas.length
    ? [...new Set(elegidas.map((x) => nombreDeValor('reunion', x, nombres)))].join(', ')
    : 'Cualquier reunión';
  // Apagado mientras no llegó la lista, si no se pudo leer o si el CRM no marcó ninguna reunión: la
  // condición igual vale para cualquier reunión, que es lo que dice el botón.
  const motivo = cat.reuniones === undefined ? 'Cargando las reuniones' : cat.reuniones === null ? 'No se pudieron leer las reuniones'
    : !hay ? 'Ninguna etapa del CRM está marcada como reunión' : undefined;
  return (
    <div title={motivo} style={COLGANDO}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {esArbol(niveles)
          ? <Dropdown value="" secciones={niveles as DropdownGroup[]} varios={elegidas} onChange={tocar} width="100%" ariaLabel="Reuniones"
              disabled={busy || !hay} botonLabel={rotulo} buttonStyle={SECUNDARIO} />
          : <Dropdown value="" options={niveles.flatMap(opcionesDelNivel)} varios={elegidas} onChange={tocar} width="100%" ariaLabel="Reuniones"
              disabled={busy || !hay} botonLabel={rotulo} buttonStyle={SECUNDARIO} />}
      </div>
    </div>
  );
}

/** Todas las opciones de un nivel y de los de adentro. */
function opcionesDelNivel(n: NivelArbol): DropdownOption[] {
  return [...n.options, ...(n.grupos ?? []).flatMap(opcionesDelNivel)];
}

/**
 * Un desplegable de un catálogo, de ancho completo en su renglón y con la cara SECUNDARIA. Si el
 * catálogo tiene jerarquía, un ÁRBOL (`arbolDeOpciones`: primero el curso o el módulo, después lo de
 * adentro; buscar aplana); si no, plano. Lo puesto que no está en la lista lo dice el botón.
 */
function SelectorDeLista({ niveles, valor, nombrePuesto, busy, aria, onElegir, falta }: {
  niveles: NivelArbol[]; valor: string; nombrePuesto: string; busy: boolean; aria: string; onElegir: (v: string) => void;
  /** Falta elegir: el borde en rojo (condición 4). */
  falta?: boolean;
}) {
  const estilo: CSSProperties = falta ? { ...SECUNDARIO, border: '1px solid var(--bad)' } : SECUNDARIO;
  const todas = niveles.flatMap(opcionesDelNivel);
  const esta = !valor || todas.some((o) => o.value === valor);
  const botonLabel = esta ? undefined : nombrePuesto;
  return (
    <div style={{ flex: 1, minWidth: 180 }}>
      {esArbol(niveles)
        ? <Dropdown value={valor} secciones={niveles as DropdownGroup[]} placeholder="Elige" width="100%" ariaLabel={aria} disabled={busy} search onChange={onElegir} botonLabel={botonLabel} buttonStyle={estilo} />
        : <Dropdown value={valor} options={todas} placeholder="Elige" width="100%" ariaLabel={aria} disabled={busy} onChange={onElegir} botonLabel={botonLabel} buttonStyle={estilo} />}
    </div>
  );
}

// ── La condición que escucha las respuestas (sexta tanda, punto 12) ──────────────────

/**
 * «SI RESPONDE», COMO UNA CONDITION: cada CASO es una fila con la pregunta grande «Su respuesta trata
 * de» (la familia «Respuesta» del catálogo) y, colgando, su nombre y cuándo aplica —que es lo que lee
 * el clasificador—. Entre dos casos va «o» y no se cambia: el clasificador elige UNO, así que nunca
 * se cumplen dos a la vez. «＋ o» suma un caso con su «MaKo contesta». El «Si no» es lo que antes era
 * «Otra cosa» (MaKo se calla y te avisa, si nadie lo cambió).
 *
 * Tipear el nombre o el «cuándo» no apila (el Ctrl+Z del texto es del navegador); sumar o quitar un
 * caso, sí. El motor no cambia (`responderConGrafo`): lo que se edita acá es el mismo dato de siempre.
 */
export function EditorCondicionDeRespuesta({ r, busy }: { r: EdicionRespuesta; busy: boolean }) {
  const casos = r.casos;
  const setCaso = (k: number, p: Partial<CasoRespuesta>) => r.cambiarCasos(casos.map((c, j) => (j === k ? { ...c, ...p } : c)), false);
  const lleno = busy || casos.length >= TOPE_CASOS;
  // ⚠️ CON EL DISEÑO DE LA CONDICIÓN (10/10/2026: «el editable proximo de condición está vacío… esos que
  // no funcionan pareciera que son viejos, no tienen el diseño de condición que hicimos»). Cada caso es
  // una condición en su contenedor, con el tacho chico en la esquina; sin casos, la condición es
  // «Respondió» (cualquier respuesta), en su contenedor como cualquiera, y no una caja vacía con un «＋ o».
  const caja = (falta: boolean): CSSProperties => ({
    position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 12,
    border: `1px solid ${falta ? 'var(--bad)' : 'var(--border)'}`, background: 'var(--surface-2)',
  });
  const pregunta: CSSProperties = {
    ...botonGrande, display: 'flex', alignItems: 'center', boxSizing: 'border-box',
    border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS,
  };
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {casos.length === 0 && (
        <div style={caja(false)}>
          <div aria-label="Condición" style={pregunta}>
            <span style={{ flex: 1, minWidth: 0 }}>{rotuloSiNoDeRespuesta({ casos })}</span>
            {r.onVerSiNo && (
              <button type="button" onClick={r.onVerSiNo}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', fontFamily: SANS }}>Ver</button>
            )}
          </div>
        </div>
      )}
      {casos.map((c, k) => (
        <Fragment key={c.id}>
          {k > 0 && <Separador><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)', fontFamily: SANS }}>o</span></Separador>}
          <div style={caja(!c.titulo.trim() || !c.cuando.trim())}>
            {casos.length > 1 && <BotonQuitar onClick={() => r.onQuitarCaso(c.id)} disabled={busy} aria="Quitar este caso" />}
            <div aria-label="Condición" style={pregunta}>{ROTULO_RESPUESTA}</div>
            <div style={{ ...COLGANDO, flexDirection: 'column', alignItems: 'stretch' }}>
              <input value={c.titulo} maxLength={40} placeholder="Nombre del caso" disabled={busy} aria-label="Nombre del caso"
                onChange={(e) => setCaso(k, { titulo: e.target.value })}
                style={{ ...inpLienzo, fontWeight: 600, ...(c.titulo.trim() ? {} : { borderColor: 'var(--bad)' }) }} />
              <textarea value={c.cuando} rows={2} placeholder="Cuándo aplica" disabled={busy} aria-label="Cuándo aplica"
                onChange={(e) => setCaso(k, { cuando: e.target.value })}
                style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45, ...(c.cuando.trim() ? {} : { borderColor: 'var(--bad)' }) }} />
            </div>
          </div>
        </Fragment>
      ))}
      <button type="button" onClick={r.onAgregarCaso} disabled={lleno} aria-label="Agregar un caso"
        style={{ ...PLACEHOLDER, display: 'flex', alignItems: 'center', cursor: lleno ? 'default' : 'pointer', color: lleno ? 'var(--faint)' : 'var(--primary)', fontFamily: SANS, fontWeight: 600 }}>
        ＋ o
      </button>
      {casos.length > 0 && (
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{rotuloSiNoDeRespuesta({ casos })}</span>
          {r.onVerSiNo && (
            <button type="button" onClick={r.onVerSiNo}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--primary)', cursor: 'pointer', fontFamily: SANS }}>Ver</button>
          )}
        </div>
      )}
    </div>
  );
}

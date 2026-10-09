'use client';

// =============================================================================
// EditorCondicion — el editor de la tarjeta CONDITION del lienzo de /chatbot
// =============================================================================
// Pedido de Martín (09/10/2026, tercera tanda, punto 9): «Haz que el editable del condicional sea
// mucho más simple de entender, como el resto, no tan ancho que ocupe todo». Y el punto 10: todas las
// condiciones del negocio, por secciones, filtradas por el CRON (lib/condiciones-catalogo.ts).
//
// CUARTA TANDA (09/10/2026, mañana):
//   · Punto 7: «No entiendo el botón de "+Rama", es básicamente lo mismo que "+condición"... Eso
//     eliminalo. Y también me gustaba antes la opción de "+y" "+o", para que cumplan ambas o una de las
//     2». Sin «＋ Rama» y sin «Todas / Cualquiera»: una condición nueva es UNA pregunta con «Sí» y «Si
//     no», y cada fila nueva RECUERDA con qué se une a la de arriba (`FilaCondicion.union`). El
//     separador entre dos filas se ve («y» / «o») y se cambia tocándolo. Las condiciones de antes con
//     varias ramas se siguen dibujando (numeradas) y editando; sólo no se ofrece agregar otra.
//   · Punto 5: la familia de la reunión («Asistió / No asistió a la reunión», «Tiene reunión agendada»,
//     «Próxima reunión en») suma un selector de una o más etapas de REUNIÓN del kanban (vacío = cualquier
//     reunión). Las etapas salen de GET /api/chat-agent/condiciones (`reuniones`).
//   · Punto 6: «Pagó / No pagó» suma la cuota (vacío = como siempre): «No pagó la cuota 1».
//   · Punto 1 («editores sin aire»): el selector de la condición es un campo grande, de ancho completo.
//     Nada adentro lleva ancho propio: el único tope vive en el CONTENEDOR (AGENTS.md), que lo pone el
//     panel del lienzo.
//
// ⚠️ EL BUG DE «+y» QUE CREABA «+o» (tercera tanda) NO VUELVE: aquellos dos botones agregaban la fila Y
// cambiaban el modo de la rama ENTERA, así que el separador de TODAS las filas cambiaba con el último
// tocado. Ahora cada botón fija la unión de SU fila y de ninguna otra; la rama ya no tiene un modo que
// tocar (el `modo` guardado queda para las filas de antes que no dicen la suya).
//
// ⚠️ ESTE ARCHIVO NO GUARDA NADA (como FlujoLienzo): cada cambio sube por `cambiar`, y quitar una rama
// —que se lleva lo que colgaba de ella— por `onQuitarRama`, que hace el lienzo sobre el flujo entero.

import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { Dropdown, type DropdownGroup } from '../components/Dropdown';
import { SelectorEtiqueta } from '@/app/_components/etiquetas-cliente';
import { inpLienzo } from '@/app/_components/Lienzo';
import { TOPE_FILAS, unionDe, type FilaCondicion, type RamaCondicion } from '@/lib/flujo-grafo';
import {
  condicionPorId, seccionesDeCondiciones, opcionesDe, filaNueva, deValorOpcion, valorOpcion, problemaDeFila,
  nombreDeValor, nombresCatalogoDe, cuotaDeFila, SIMBOLO_OP, TOPE_CUOTA, TOPE_REUNIONES,
  type AmbitoDisparo, type CatalogosCondicion, type CursoCondicion, type DefCondicion, type ProductoCondicion,
  type ReunionesDeEmbudo, type SeccionOpciones,
} from '@/lib/condiciones-catalogo';

const SANS = "'Geist', sans-serif";

/** Las etapas de venta de UN producto (la forma de `SeccionEtapas` de FlujoLienzo). */
type EtapasDeProducto = { title: string; funnelId: number; options: Array<{ value: string; label: string }> };

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
   * @deprecated Cuarta tanda, punto 7: «＋ Rama" ... Eso eliminalo». El editor ya no lo dibuja; queda
   * opcional para que quien lo monta compile hasta que deje de pasarlo.
   */
  onAgregarRama?: () => void;
  /** Quitar una rama entera, con lo que colgaba de ella (al quitar su última fila). */
  onQuitarRama: (ramaId: string) => void;
  /** Los catálogos de la base (cursos, posts, campañas, reuniones). Ausente = los lee el editor solo. */
  catalogos?: CatalogosRemotos | null;
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

// ── El editor ─────────────────────────────────────────────────────────────────────

export function EditorCondicion({ paso, cambiar, ambito, etapas, productos, busy, onQuitarRama, catalogos }: EditorCondicionProps) {
  const leidos = useCatalogosCondicion();
  const remotos = catalogos !== undefined ? catalogos : leidos;
  const cat = catalogosDe({ etapas, productos, remotos });
  const ramas = paso.ramas ?? [];
  const setRama = (ri: number, r: RamaCondicion, apilar: boolean) => cambiar({ ramas: ramas.map((x, k) => (k === ri ? r : x)) }, apilar);
  const secciones = seccionesDeCondiciones(ambito, cat);
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
        />
      ))}
      {varias && <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--dim)' }}>Si no</div>}
    </div>
  );
}

function Rama({ rama, numero, secciones, cat, busy, onCambiar, onQuitarRama, puedeQuitarRama }: {
  rama: RamaCondicion; numero: number | null; secciones: SeccionOpciones[]; cat: CatalogosCondicion; busy: boolean;
  onCambiar: (r: RamaCondicion, apilar: boolean) => void; onQuitarRama: () => void; puedeQuitarRama: boolean;
}) {
  const filas = rama.filas ?? [];
  /** Agrega la fila elegida. `union`: con qué se une a la de arriba (la primera no se une a nada). */
  const agregar = (union: 'y' | 'o' | null) => (v: string) => {
    const d = deValorOpcion(v);
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
  const caja: CSSProperties = numero != null
    ? { border: '1px solid var(--border)', borderRadius: 10, padding: '10px 10px 9px', background: 'var(--surface)' }
    : {};
  return (
    <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {numero != null && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', fontFamily: SANS }}>{numero}</span>}
      {filas.map((f, fi) => (
        <Fragment key={fi}>
          {fi > 0 && <Union union={unionDe(rama, fi)} busy={busy} onCambiar={(u) => setFila(fi, { ...f, union: u }, true)} />}
          <FilaFrase fila={f} cat={cat} secciones={secciones} busy={busy}
            onCambiar={(nf, apilar) => setFila(fi, nf, apilar)}
            onQuitar={() => quitarFila(fi)} />
        </Fragment>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {filas.length === 0
          ? <Agregar texto="＋ Condición" aria="Agregar una condición" secciones={secciones} disabled={lleno} onElegir={agregar(null)} />
          : (
            <>
              <Agregar texto="＋ y" aria="Agregar una condición que se cumpla además" titulo="Se cumplen las dos" secciones={secciones} disabled={lleno} onElegir={agregar('y')} />
              <Agregar texto="＋ o" aria="Agregar una condición alternativa" titulo="Alcanza con una" secciones={secciones} disabled={lleno} onElegir={agregar('o')} />
            </>
          )}
      </div>
    </div>
  );
}

/**
 * «＋ Condición» / «＋ y» / «＋ o»: el desplegable de condiciones por secciones, con cara de botón. No
 * son los botoncitos de la tercera tanda («No me gustan los botones chiquitos»): se leen como botones.
 */
function Agregar({ texto, aria, titulo, secciones, disabled, onElegir }: {
  texto: string; aria: string; titulo?: string; secciones: SeccionOpciones[]; disabled: boolean; onElegir: (v: string) => void;
}) {
  return (
    <span title={titulo}>
      <Dropdown value="" secciones={secciones as DropdownGroup[]} onChange={onElegir} resetAfterSelect sinFlecha search
        disabled={disabled} ariaLabel={aria} menuAncho={340} menuAlto={420}
        botonLabel={<span style={{ fontSize: 13, fontWeight: 600, color: disabled ? 'var(--faint)' : 'var(--primary)', fontFamily: SANS }}>{texto}</span>}
        buttonStyle={{ padding: '6px 14px', borderRadius: 8, minHeight: 0, width: 'auto', border: '1px solid var(--border-strong)', background: 'var(--surface)' }} />
    </span>
  );
}

/** El separador entre dos filas: «y» / «o», a la vista. Tocarlo cambia la unión de ESA fila. */
function Union({ union, busy, onCambiar }: { union: 'y' | 'o'; busy: boolean; onCambiar: (u: 'y' | 'o') => void }) {
  const otra = union === 'y' ? 'o' : 'y';
  const linea: CSSProperties = { flex: 1, height: 1, background: 'var(--border)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={linea} />
      <button type="button" disabled={busy} onClick={() => onCambiar(otra)} title={`Cambiar a «${otra}»`} aria-label={`Se une con «${union}». Cambiar a «${otra}»`}
        style={{
          border: '1px solid var(--border-strong)', borderRadius: 999, padding: '2px 12px', fontSize: 12, fontWeight: 700, fontFamily: SANS,
          background: 'var(--surface-2)', color: 'var(--ink)', cursor: busy ? 'default' : 'pointer', lineHeight: 1.4,
        }}>{union}</button>
      <span style={linea} />
    </div>
  );
}

/** ¿La condición tiene algo que elegir además de sí misma? (para no dibujar una fila vacía debajo). */
function tieneValor(def: DefCondicion | null, campo: string): boolean {
  if (!def) return false;
  if (def.valor.t === 'legado') return campo === 'etiqueta' || campo === 'etapa' || campo === 'antiguedad' || campo === 'pago';
  return def.valor.t !== 'ninguno';
}

/** Una fila: el selector de la condición (grande, de ancho completo) y su ✕; debajo, lo que pide. */
function FilaFrase({ fila, cat, secciones, busy, onCambiar, onQuitar }: {
  fila: FilaCondicion; cat: CatalogosCondicion; secciones: SeccionOpciones[]; busy: boolean;
  onCambiar: (f: FilaCondicion, apilar: boolean) => void; onQuitar: () => void;
}) {
  const def = condicionPorId(fila.campo);
  const valorCampo = valorOpcion(String(fila.campo), !!fila.no && !!def?.negable);
  // Lo puesto que ya no se ofrece (una condición retirada, de otro ámbito o sin catálogo) lo dice el
  // BOTÓN, sin una sección «La que tiene puesta»: el desplegable de la casa no es un <select> y nada se
  // escribe hasta elegir (cuarta tanda, decisión 2, docs/hallazgos-chatbot.md).
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Dropdown value={valorCampo} secciones={secciones as DropdownGroup[]} search ariaLabel="Condición" disabled={busy}
            width="100%" menuAncho={340} menuAlto={420} onChange={elegirCampo}
            botonLabel={enLista ? undefined : rotuloPuesto} />
        </div>
        <button type="button" onClick={onQuitar} disabled={busy} title="Quitar" aria-label="Quitar esta condición"
          style={{ flex: 'none', background: 'none', border: 'none', color: 'var(--faint)', cursor: busy ? 'default' : 'pointer', fontSize: 14, padding: '6px 4px' }}>✕</button>
      </div>
      {tieneValor(def, String(fila.campo)) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Valor fila={fila} cat={cat} busy={busy} onCambiar={onCambiar} incompleta={incompleta} />
        </div>
      )}
      {def?.reuniones && <SelectorReuniones fila={fila} cat={cat} busy={busy} onCambiar={onCambiar} />}
    </div>
  );
}

/** Saca una clave de la fila (para volver a «cualquiera»): ausente, no vacía. */
function sin<K extends keyof FilaCondicion>(f: FilaCondicion, k: K): FilaCondicion {
  const copia = { ...f };
  delete copia[k];
  return copia;
}

/** El control del valor, según lo que la condición necesita. */
function Valor({ fila, cat, busy, onCambiar, incompleta }: {
  fila: FilaCondicion; cat: CatalogosCondicion; busy: boolean; incompleta: boolean;
  onCambiar: (f: FilaCondicion, apilar: boolean) => void;
}) {
  const def = condicionPorId(fila.campo);
  if (!def) return null;
  const v = def.valor;
  const marco: CSSProperties | undefined = incompleta ? { borderColor: 'var(--warn)' } : undefined;
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
        <SelectorDeLista secciones={opcionesDe('etapa', cat)} valor={valor} nombrePuesto={String(fila.valor ?? '')} busy={busy} aria="Etapa"
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
      <SelectorDeLista secciones={opcionesDe(v.catalogo, cat)} valor={valor} nombrePuesto={nombreDeValor(v.catalogo, valor, nombresCatalogoDe(cat))}
        busy={busy} aria={def.rotulo[0]} onElegir={(x) => onCambiar({ ...fila, valor: x }, true)} />
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
          <SelectorDeLista secciones={opcionesDe(v.ref, cat)} valor={fila.ref == null ? '' : String(fila.ref)}
            nombrePuesto={nombreDeValor(v.ref, String(fila.ref ?? ''), nombresCatalogoDe(cat))} busy={busy} aria="Curso"
            onElegir={(x) => onCambiar({ ...fila, ref: Number(x) }, true)} />
        )}
        <Dropdown value={op} width={64} ariaLabel="Operador" disabled={busy} search={false}
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
 * «cualquier reunión». Las ofrece el CRM (las etapas marcadas como reunión, por embudo); la tercera en
 * adelante se ve apagada, porque la ficha no tiene dónde guardar su fecha ni su asistencia.
 *
 * ⚠️ LO ELEGIDO QUE YA NO ESTÁ EN LA LISTA SE SIGUE NOMBRANDO (una etapa que el CRM dejó de marcar como
 * reunión): el botón dice lo puesto, y tocar otra cosa no lo borra.
 */
function SelectorReuniones({ fila, cat, busy, onCambiar }: {
  fila: FilaCondicion; cat: CatalogosCondicion; busy: boolean; onCambiar: (f: FilaCondicion, apilar: boolean) => void;
}) {
  const elegidas = fila.reuniones ?? [];
  const secciones = opcionesDe('reunion', cat).filter((s) => s.options.length > 0);
  const hay = secciones.length > 0;
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
  const porSecciones = secciones.length > 1 && secciones.every((s) => s.title);
  return (
    <div title={motivo} style={{ width: '100%' }}>
      {porSecciones
        ? <Dropdown value="" secciones={secciones as DropdownGroup[]} varios={elegidas} onChange={tocar} width="100%" ariaLabel="Reuniones"
            disabled={busy || !hay} botonLabel={rotulo} />
        : <Dropdown value="" options={secciones.flatMap((s) => s.options)} varios={elegidas} onChange={tocar} width="100%" ariaLabel="Reuniones"
            disabled={busy || !hay} botonLabel={rotulo} />}
    </div>
  );
}

/**
 * Un desplegable de un catálogo, de ancho completo en su renglón. Con varias secciones con título, por
 * secciones; si no, plano. Lo puesto que no está en la lista lo dice el botón (`nombrePuesto`).
 */
function SelectorDeLista({ secciones, valor, nombrePuesto, busy, aria, onElegir }: {
  secciones: SeccionOpciones[]; valor: string; nombrePuesto: string; busy: boolean; aria: string; onElegir: (v: string) => void;
}) {
  const lista = secciones.filter((s) => s.options.length > 0);
  const esta = !valor || lista.some((s) => s.options.some((o) => o.value === valor));
  const botonLabel = esta ? undefined : nombrePuesto;
  const porSecciones = lista.length > 1 && lista.every((s) => s.title);
  return (
    <div style={{ flex: 1, minWidth: 180 }}>
      {porSecciones
        ? <Dropdown value={valor} secciones={lista as DropdownGroup[]} placeholder="Elige" width="100%" ariaLabel={aria} disabled={busy} search onChange={onElegir} botonLabel={botonLabel} />
        : <Dropdown value={valor} options={lista.flatMap((s) => s.options)} placeholder="Elige" width="100%" ariaLabel={aria} disabled={busy} onChange={onElegir} botonLabel={botonLabel} />}
    </div>
  );
}

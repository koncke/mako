'use client';

// =============================================================================
// EditorCondicion — el editor de la tarjeta CONDITION del lienzo de /chatbot
// =============================================================================
// Pedido de Martín (09/10/2026, punto 9): «Haz que el editable del condicional sea mucho más simple
// de entender, como el resto, no tan ancho que ocupe todo... No me gustan los botones chiquitos de
// "+y" "+o"... Cuando le dí a "+y" siempre se crea solo "+o"... No tiene el botón de "+condición"
// con la existencia de "y, o"». Y el punto 10: todas las condiciones del negocio, por secciones,
// filtradas por el CRON (lib/condiciones-catalogo.ts).
//
// LA FORMA: una rama = filas que se leen como frases, «[condición ▾] [valor]» y su ✕. Un «＋ Condición»
// claro que ES el desplegable por secciones (elegir la condición agrega la fila: no nace ninguna fila
// «Agendó» de relleno, que era de donde salían las filas repetidas de la captura). Con dos o más
// filas, un «Todas / Cualquiera» visible arriba de la rama. «＋ Rama» para otra salida, y el «Si no».
// Mide hasta 560 px: el panel llega a ~720 y una frase no necesita más.
//
// ⚠️ EL BUG DE «+y» QUE CREABA «+o»: había DOS botones que agregaban la fila y además cambiaban el
// modo de la rama ENTERA (`+ y` → todas, `+ o` → cualquiera). Tocar «+ y» en una rama que ya era
// «cualquiera» la daba vuelta, y el separador «o»/«y» de TODAS las filas cambiaba con el último
// botón tocado. Agregar y elegir el modo son dos decisiones: acá son dos controles.
//
// ⚠️ ESTE ARCHIVO NO GUARDA NADA (como FlujoLienzo): cada cambio sube por `cambiar`, y agregar o
// quitar una rama —que crea un puerto o se lleva lo que colgaba de él— por `onAgregarRama` /
// `onQuitarRama`, que hace el lienzo sobre el flujo entero.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown, type DropdownGroup } from '../components/Dropdown';
import { SelectorEtiqueta } from '@/app/_components/etiquetas-cliente';
import { inpLienzo } from '@/app/_components/Lienzo';
import { TOPE_FILAS, TOPE_RAMAS, type FilaCondicion, type RamaCondicion } from '@/lib/flujo-grafo';
import {
  condicionPorId, seccionesDeCondiciones, opcionesDe, filaNueva, deValorOpcion, valorOpcion, problemaDeFila,
  nombreDeValor, nombresCatalogoDe, SIMBOLO_OP,
  type AmbitoDisparo, type CatalogosCondicion, type CursoCondicion, type ProductoCondicion, type SeccionOpciones,
} from '@/lib/condiciones-catalogo';

const SANS = "'Geist', sans-serif";
/** El ancho del editor: una frase, no la franja entera del panel. */
const ANCHO = 560;

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
  /** «＋ Rama»: una salida más (la crea el lienzo, que conoce el flujo entero). */
  onAgregarRama: () => void;
  /** Quitar una rama entera, con lo que colgaba de ella (al quitar su última fila). */
  onQuitarRama: (ramaId: string) => void;
  /** Los catálogos de la base (cursos, posts, campañas). Ausente = los lee el editor solo. */
  catalogos?: CatalogosRemotos | null;
};

/** Lo que trae GET /api/chat-agent/condiciones. */
export type CatalogosRemotos = { cursos: CursoCondicion[]; posts: Array<{ id: number; titulo: string }>; campanas: string[] };

// ── Los catálogos de la base, leídos UNA vez por página ───────────────────────────
// «No pude leer» es un tercer estado (AGENTS.md): con el GET caído, las condiciones que los
// necesitan NO se ofrecen (no hay con qué completarlas), pero una fila ya puesta se sigue dibujando.

let enVuelo: Promise<CatalogosRemotos | null> | null = null;

function leerCatalogos(): Promise<CatalogosRemotos | null> {
  enVuelo ??= fetch('/api/chat-agent/condiciones', { signal: AbortSignal.timeout(35_000) })
    .then(async (r) => {
      const j = await r.json().catch(() => null) as ({ ok?: boolean } & Partial<CatalogosRemotos>) | null;
      if (!r.ok || !j?.ok) throw new Error('catálogos');
      return { cursos: j.cursos ?? [], posts: j.posts ?? [], campanas: j.campanas ?? [] };
    })
    .catch(() => { enVuelo = null; return null; });
  return enVuelo;
}

/**
 * Los catálogos de las condiciones (cursos, módulos, clases, posts, campañas). Lo usa este editor y
 * lo usan el lienzo y «Probar» para que la TARJETA diga el nombre de lo elegido
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
  return { etapas: p.etapas, productos: p.productos, cursos: p.remotos?.cursos, posts: p.remotos?.posts, campanas: p.remotos?.campanas };
}

// ── El editor ─────────────────────────────────────────────────────────────────────

export function EditorCondicion({ paso, cambiar, ambito, etapas, productos, busy, onAgregarRama, onQuitarRama, catalogos }: EditorCondicionProps) {
  const leidos = useCatalogosCondicion();
  const remotos = catalogos !== undefined ? catalogos : leidos;
  const cat = catalogosDe({ etapas, productos, remotos });
  const ramas = paso.ramas ?? [];
  const setRama = (ri: number, r: RamaCondicion, apilar: boolean) => cambiar({ ramas: ramas.map((x, k) => (k === ri ? r : x)) }, apilar);
  const secciones = seccionesDeCondiciones(ambito, cat);

  return (
    <div style={{ maxWidth: ANCHO, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ramas.map((r, ri) => (
        <Rama key={r.id} rama={r} numero={ramas.length > 1 ? ri + 1 : null} secciones={secciones} cat={cat} busy={busy}
          onCambiar={(nr, apilar) => setRama(ri, nr, apilar)}
          // La última fila de una rama se lleva la rama (y lo que colgaba de ella), salvo que sea la
          // ÚNICA rama: una condición sin ramas no se puede publicar. Ahí la fila se vacía.
          onQuitarRama={() => onQuitarRama(r.id)}
          puedeQuitarRama={ramas.length > 1}
        />
      ))}
      <div>
        <BotonTexto disabled={busy || ramas.length >= TOPE_RAMAS} onClick={onAgregarRama}>＋ Rama</BotonTexto>
      </div>
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--dim)' }}>Si no</div>
    </div>
  );
}

function Rama({ rama, numero, secciones, cat, busy, onCambiar, onQuitarRama, puedeQuitarRama }: {
  rama: RamaCondicion; numero: number | null; secciones: SeccionOpciones[]; cat: CatalogosCondicion; busy: boolean;
  onCambiar: (r: RamaCondicion, apilar: boolean) => void; onQuitarRama: () => void; puedeQuitarRama: boolean;
}) {
  const filas = rama.filas ?? [];
  const agregar = (v: string) => {
    const d = deValorOpcion(v);
    const f = d ? filaNueva(d.id, d.no) : null;
    if (f) onCambiar({ ...rama, filas: [...filas, f] }, true);
  };
  const quitarFila = (fi: number) => {
    if (filas.length > 1) onCambiar({ ...rama, filas: filas.filter((_, k) => k !== fi) }, true);
    else if (puedeQuitarRama) onQuitarRama();
    else onCambiar({ ...rama, filas: [] }, true);
  };
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 10px 9px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {(numero != null || filas.length > 1) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24 }}>
          {numero != null && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', fontFamily: SANS }}>{numero}</span>}
          {filas.length > 1 && (
            <TodasCualquiera modo={rama.modo} busy={busy} onCambiar={(modo) => onCambiar({ ...rama, modo }, true)} />
          )}
        </div>
      )}
      {filas.map((f, fi) => (
        <FilaFrase key={fi} fila={f} cat={cat} secciones={secciones} busy={busy}
          onCambiar={(nf, apilar) => onCambiar({ ...rama, filas: filas.map((x, k) => (k === fi ? nf : x)) }, apilar)}
          onQuitar={() => quitarFila(fi)} />
      ))}
      {!filas.length && <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Sin condiciones</div>}
      <div>
        <Dropdown value="" secciones={secciones as DropdownGroup[]} onChange={agregar} resetAfterSelect sinFlecha search
          disabled={busy || filas.length >= TOPE_FILAS} ariaLabel="Agregar una condición" menuAncho={320} menuAlto={420}
          botonLabel={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', fontFamily: SANS }}>＋ Condición</span>}
          buttonStyle={{ border: 'none', background: 'none', padding: 0, minHeight: 0, width: 'auto' }} />
      </div>
    </div>
  );
}

/** Y / O de la rama, a la vista: dos botones, el elegido marcado. */
function TodasCualquiera({ modo, busy, onCambiar }: { modo: RamaCondicion['modo']; busy: boolean; onCambiar: (m: RamaCondicion['modo']) => void }) {
  const boton = (m: RamaCondicion['modo'], texto: string, titulo: string) => {
    const activo = modo === m;
    return (
      <button type="button" disabled={busy} aria-pressed={activo} title={titulo} onClick={() => !activo && onCambiar(m)}
        style={{
          border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, fontFamily: SANS,
          background: activo ? 'var(--surface)' : 'transparent', color: activo ? 'var(--ink)' : 'var(--dim)',
          boxShadow: activo ? '0 0 0 1px var(--border)' : 'none', cursor: busy || activo ? 'default' : 'pointer',
        }}>{texto}</button>
    );
  };
  return (
    <div role="group" aria-label="Cuántas condiciones" style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 8, background: 'var(--surface-2)' }}>
      {boton('todas', 'Todas', 'Se cumplen todas')}
      {boton('cualquiera', 'Cualquiera', 'Alcanza con una')}
    </div>
  );
}

/** Una fila: «[condición ▾] [valor]» y su ✕. */
function FilaFrase({ fila, cat, secciones, busy, onCambiar, onQuitar }: {
  fila: FilaCondicion; cat: CatalogosCondicion; secciones: SeccionOpciones[]; busy: boolean;
  onCambiar: (f: FilaCondicion, apilar: boolean) => void; onQuitar: () => void;
}) {
  const def = condicionPorId(fila.campo);
  const valorCampo = valorOpcion(String(fila.campo), !!fila.no && !!def?.negable);
  // El valor puesto entra SIEMPRE a las opciones (AGENTS.md: un <select> cuyo valor no está entre
  // sus opciones muestra otra cosa y el primer clic lo pisa): una condición de otro ámbito, o una
  // que ya no se ofrece por falta de catálogo, se sigue viendo como lo que es.
  const seccionesCampo: SeccionOpciones[] = secciones.some((s) => s.options.some((o) => o.value === valorCampo))
    ? secciones
    : [{ title: 'La que tiene puesta', options: [{ value: valorCampo, label: def ? def.rotulo[fila.no && def.negable ? 1 : 0] : 'Condición desconocida' }] }, ...secciones];
  const elegirCampo = (v: string) => {
    const d = deValorOpcion(v);
    if (!d) return;
    // La misma condición, sólo negada o no: se conserva lo elegido. Otra condición: nace limpia.
    if (d.id === fila.campo) {
      const { no: _antes, ...resto } = fila;
      void _antes;
      onCambiar(d.no ? { ...resto, no: true } : resto, true);
      return;
    }
    const f = filaNueva(d.id, d.no);
    if (f) onCambiar(f, true);
  };
  const incompleta = problemaDeFila(fila) != null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Dropdown value={valorCampo} secciones={seccionesCampo as DropdownGroup[]} search ariaLabel="Condición" disabled={busy}
        width={def?.valor.t === 'ninguno' ? 300 : 220} menuAncho={320} menuAlto={420} onChange={elegirCampo} />
      <Valor fila={fila} cat={cat} busy={busy} onCambiar={onCambiar} incompleta={incompleta} />
      <button type="button" onClick={onQuitar} disabled={busy} title="Quitar" aria-label="Quitar esta condición"
        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', cursor: busy ? 'default' : 'pointer', fontSize: 13, padding: '4px 2px' }}>✕</button>
    </div>
  );
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

  if (v.t === 'legado') {
    if (fila.campo === 'etiqueta') {
      return (
        <SelectorEtiqueta value={fila.valor == null ? null : Number(fila.valor)} placeholder="Elige" width={170} ariaLabel="Etiqueta" disabled={busy}
          onElegir={(e) => onCambiar({ ...fila, valor: e.id }, true)} />
      );
    }
    if (fila.campo === 'etapa') {
      const valor = fila.valor != null && fila.valor !== '' ? `${fila.funnel_id ?? ''}:${fila.valor}` : '';
      return (
        <SelectorDeLista secciones={opcionesDe('etapa', cat)} valor={valor} nombrePuesto={String(fila.valor ?? '')} busy={busy} ancho={170} aria="Etapa"
          onElegir={(x) => { const [fid, ...k] = x.split(':'); onCambiar({ ...fila, valor: k.join(':'), funnel_id: fid ? Number(fid) : null }, true); }} />
      );
    }
    if (fila.campo === 'antiguedad') {
      return (
        <>
          <input type="number" min={1} step={1} value={Number(fila.valor) || ''} disabled={busy} aria-label="Horas"
            onChange={(e) => onCambiar({ ...fila, valor: Math.max(1, Math.round(Number(e.target.value) || 0)) }, false)}
            style={{ ...inpLienzo, width: 72, flex: 'none', ...marco }} />
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>h</span>
        </>
      );
    }
    return null;
  }

  if (v.t === 'lista') {
    const valor = fila.valor == null ? '' : String(fila.valor);
    return (
      <SelectorDeLista secciones={opcionesDe(v.catalogo, cat)} valor={valor} nombrePuesto={nombreDeValor(v.catalogo, valor, nombresCatalogoDe(cat))}
        busy={busy} ancho={210} aria={def.rotulo[0]} onElegir={(x) => onCambiar({ ...fila, valor: x }, true)} />
    );
  }

  if (v.t === 'texto') {
    return (
      <input type="text" value={String(fila.valor ?? '')} disabled={busy} aria-label={def.rotulo[0]} placeholder="Texto" maxLength={120}
        onChange={(e) => onCambiar({ ...fila, valor: e.target.value }, false)}
        style={{ ...inpLienzo, width: 190, flex: 'none', ...marco }} />
    );
  }

  if (v.t === 'numero') {
    const op = fila.op === 'menor_igual' ? 'menor_igual' : 'mayor_igual';
    return (
      <>
        {v.ref && (
          <SelectorDeLista secciones={opcionesDe(v.ref, cat)} valor={fila.ref == null ? '' : String(fila.ref)}
            nombrePuesto={nombreDeValor(v.ref, String(fila.ref ?? ''), nombresCatalogoDe(cat))} busy={busy} ancho={170} aria="Curso"
            onElegir={(x) => onCambiar({ ...fila, ref: Number(x) }, true)} />
        )}
        <Dropdown value={op} width={58} ariaLabel="Operador" disabled={busy} search={false}
          options={[{ value: 'mayor_igual', label: SIMBOLO_OP.mayor_igual }, { value: 'menor_igual', label: SIMBOLO_OP.menor_igual }]}
          onChange={(x) => onCambiar({ ...fila, op: x === 'menor_igual' ? 'menor_igual' : 'mayor_igual' }, true)} />
        <input type="number" min={v.min} max={v.max} step={1} value={fila.valor == null ? '' : Number(fila.valor)} disabled={busy} aria-label="Número"
          onChange={(e) => { const n = e.target.value === '' ? null : Math.round(Number(e.target.value)); onCambiar({ ...fila, valor: n }, false); }}
          style={{ ...inpLienzo, width: 72, flex: 'none', ...marco }} />
        {v.unidad.trim() && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{v.unidad.trim()}</span>}
      </>
    );
  }
  return null;
}

/** Un desplegable de un catálogo. Con varias secciones con título, por secciones; si no, plano. */
function SelectorDeLista({ secciones, valor, nombrePuesto, busy, ancho, aria, onElegir }: {
  secciones: SeccionOpciones[]; valor: string; nombrePuesto: string; busy: boolean; ancho: number; aria: string; onElegir: (v: string) => void;
}) {
  const conTitulo = secciones.filter((s) => s.options.length > 0);
  const esta = !valor || conTitulo.some((s) => s.options.some((o) => o.value === valor));
  const lista: SeccionOpciones[] = esta ? conTitulo : [{ title: 'La que tiene puesta', options: [{ value: valor, label: nombrePuesto }] }, ...conTitulo];
  const porSecciones = lista.length > 1 && lista.every((s) => s.title);
  if (porSecciones) {
    return <Dropdown value={valor} secciones={lista as DropdownGroup[]} placeholder="Elige" width={ancho} ariaLabel={aria} disabled={busy} search onChange={onElegir} />;
  }
  return <Dropdown value={valor} options={lista.flatMap((s) => s.options)} placeholder="Elige" width={ancho} ariaLabel={aria} disabled={busy} onChange={onElegir} />;
}

function BotonTexto({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, fontFamily: SANS, color: disabled ? 'var(--faint)' : 'var(--primary)', cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}

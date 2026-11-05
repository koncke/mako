'use client';

// =============================================================================
// BloqueVentaVista — la cuenta regresiva, la prueba social y la barra de escasez en el editor (5/11/2026)
// =============================================================================
// Black November de Leila. El molde es FormularioVista: la forma pública (bloques-venta.ts) dibujada INERTE, una barra con
// «Editar» y el tacho, y un panel flotante que edita los atributos. Lo que el panel deja escribir es SÓLO el dato del negocio:
// la fecha de cierre, quién compró, cuántos quedan. Sin él, el bloque no sale en la página (render.ts), y la barra lo dice.
// Lo que no se normaliza mientras se escribe (como en el formulario): el saneo recorta al guardar; acá se guarda lo escrito.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, Flotante, Icono, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { htmlDeArbol } from '@/lib/editor-landing/grafico-svg';
import { NODO } from '@/lib/editor-landing/doc';
import { tzWorkspaceAction } from '@/app/crm/lead-view/tz-workspace';
import {
  MENSAJE_VENCIDA, TITULO_CUENTA, TOPES_VENTA, UNIDAD_ESCASEZ, attrsCuentaRegresiva, attrsEscasez, faltaPara, horaLocalDe,
  instanteDeHoraLocal, itemsCompletos, attrsPruebaSocial, specCuentaRegresiva, specEscasez, specPruebaSocial, textoEscasez, type ItemPrueba,
} from '@/lib/editor-landing/bloques-venta';

const CSS_VENTA: string = [
  '.gmx-venta{display:flex;flex-direction:column;gap:6px;padding:4px}',
  '.gmx-venta-fila{display:flex;align-items:center;gap:6px}',
  '.gmx-venta-fila .gmx-campo{flex:1 1 auto;min-width:0}',
  '.gmx-venta-item{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--gmx-borde);border-radius:8px;background:var(--gmx-fondo-2)}',
].join('\n');

const NOMBRE: Record<string, { titulo: string; icono: string }> = {
  [NODO.cuentaRegresiva]: { titulo: 'Cuenta regresiva', icono: 'cronometro' },
  [NODO.pruebaSocial]: { titulo: 'Prueba social', icono: 'usuarios' },
  [NODO.escasez]: { titulo: 'Escasez', icono: 'fuego' },
};

/**
 * La zona del NEGOCIO (`mako.timezone`), la misma que usa la API: la hora de cierre es la del negocio, no la de la computadora
 * de quien edita (un super admin mirando a un cliente estaría en otra). Hasta que llega, la fecha no se puede cambiar: elegirla
 * con otra zona correría el cierre unas horas sin que nadie lo vea. `null` = todavía no; 'error' = no se pudo leer.
 */
function useZonaDelNegocio(): string | null | 'error' {
  const [zona, setZona] = useState<string | null | 'error'>(null);
  useEffect(() => {
    let vivo = true;
    tzWorkspaceAction().then((z) => { if (vivo) setZona(z || 'error'); }).catch(() => { if (vivo) setZona('error'); });
    return () => { vivo = false; };
  }, []);
  return zona;
}

/** Lo que dice la barra: si sale en la página, y si no, qué le falta. */
function estadoDe(tipo: string, attrs: unknown, ahoraMs: number): string {
  if (tipo === NODO.cuentaRegresiva) {
    const a = attrsCuentaRegresiva(attrs);
    if (!a.hasta) return 'Sin fecha: no se muestra';
    const f = faltaPara(a.hasta, ahoraMs);
    return f.vencida ? 'Ya terminó' : f.dias ? `Faltan ${f.dias} ${f.dias === 1 ? 'día' : 'días'}` : `Faltan ${f.horas} h ${f.minutos} min`;
  }
  if (tipo === NODO.pruebaSocial) {
    const n = itemsCompletos(attrsPruebaSocial(attrs)).length;
    return n ? `${n} ${n === 1 ? 'compra' : 'compras'}` : 'Vacía: no se muestra';
  }
  return textoEscasez(attrsEscasez(attrs)) ?? 'Sin números: no se muestra';
}

export function BloqueVentaVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, updateAttributes } = props;
  const ctx = useEditorLanding();
  const tipo = node.type.name;
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const html = useMemo(() => {
    const spec = tipo === NODO.cuentaRegresiva ? specCuentaRegresiva(node.attrs) : tipo === NODO.pruebaSocial ? specPruebaSocial(node.attrs, { modo: 'editor' }) : specEscasez(node.attrs);
    return htmlDeArbol(spec);
  }, [node.attrs, tipo]);
  const activo = (selected || !!ancla) && editor.isEditable;
  const n = NOMBRE[tipo] ?? NOMBRE[NODO.escasez];
  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar, `${n.titulo}: eliminado`);
  };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      <style href="gmx-venta" precedence="medium">{CSS_VENTA}</style>
      {activo && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title={`Editar ${n.titulo.toLowerCase()}`} aria-expanded={!!ancla} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => setAncla(ancla ? null : e.currentTarget)}>
            <Icono nombre={n.icono} /><span>{n.titulo}</span>
          </button>
          <span className="gmx-nv-etq">{estadoDe(tipo, node.attrs, Date.now())}</span>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label={`Eliminar ${n.titulo.toLowerCase()}`} onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      <div className="gmx-nv-marco" inert dangerouslySetInnerHTML={{ __html: html }} />
      {ancla && (
        <Flotante ancla={ancla} onCerrar={() => setAncla(null)} etiqueta={n.titulo} ancho={tipo === NODO.pruebaSocial ? 420 : 340}>
          <div className="gmx-venta">
            {tipo === NODO.cuentaRegresiva && <PanelCuenta attrs={node.attrs} poner={updateAttributes} />}
            {tipo === NODO.pruebaSocial && <PanelPrueba attrs={node.attrs} poner={updateAttributes} />}
            {tipo === NODO.escasez && <PanelEscasez attrs={node.attrs} poner={updateAttributes} />}
          </div>
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

type PropsPanel = { attrs: Record<string, unknown>; poner: (a: Record<string, unknown>) => void };
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function PanelCuenta({ attrs, poner }: PropsPanel) {
  const a = attrsCuentaRegresiva(attrs);
  const delNegocio = useZonaDelNegocio();
  const zona = typeof delNegocio === 'string' && delNegocio !== 'error' ? delNegocio : null;
  return (
    <>
      <span className="gmx-rotulo">Termina</span>
      <input className="gmx-campo" type="datetime-local" value={a.hasta ? horaLocalDe(a.hasta, zona ?? a.zona) : ''} aria-label="Fecha y hora de cierre"
        disabled={!zona} onChange={(e) => { if (zona) poner({ hasta: instanteDeHoraLocal(e.target.value, zona), zona }); }} />
      <span className="gmx-nota">
        {delNegocio === 'error' ? 'No pude leer la zona de tu negocio: recarga la página para poner la fecha.'
          : zona ? `Hora de tu negocio (${zona}). Cuenta hasta esa fecha para todos y al terminar no vuelve a empezar.` : 'Leyendo la zona de tu negocio…'}
      </span>
      <span className="gmx-rotulo">Título</span>
      <input className="gmx-campo" value={str(attrs.titulo)} maxLength={TOPES_VENTA.titulo} placeholder={TITULO_CUENTA} aria-label="Título"
        onChange={(e) => poner({ titulo: e.target.value })} />
      <span className="gmx-rotulo">Al terminar</span>
      <div className="gmx-venta-fila">
        <button type="button" className="gmx-chip" aria-pressed={a.alVencer === 'mensaje'} onMouseDown={(e) => e.preventDefault()} onClick={() => poner({ alVencer: 'mensaje' })}>Mostrar un mensaje</button>
        <button type="button" className="gmx-chip" aria-pressed={a.alVencer === 'ocultar'} onMouseDown={(e) => e.preventDefault()} onClick={() => poner({ alVencer: 'ocultar' })}>Ocultarla</button>
      </div>
      {a.alVencer === 'mensaje' && (
        <input className="gmx-campo" value={str(attrs.mensaje)} maxLength={TOPES_VENTA.mensaje} placeholder={MENSAJE_VENCIDA} aria-label="Mensaje al terminar"
          onChange={(e) => poner({ mensaje: e.target.value })} />
      )}
    </>
  );
}

function PanelPrueba({ attrs, poner }: PropsPanel) {
  const items: ItemPrueba[] = (Array.isArray(attrs.items) ? attrs.items : []).map((x) => {
    const i = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return { nombre: str(i.nombre), detalle: str(i.detalle), lugar: str(i.lugar), fecha: typeof i.fecha === 'string' && i.fecha ? i.fecha : null };
  });
  const cambiar = (k: number, c: Partial<ItemPrueba>) => poner({ items: items.map((it, j) => (j === k ? { ...it, ...c } : it)) });
  return (
    <>
      <span className="gmx-nota">Sólo compras reales, de clientes que te dejaron mostrarlas. Sin ninguna, no aparece.</span>
      {items.map((it, k) => (
        <div key={k} className="gmx-venta-item">
          <div className="gmx-venta-fila">
            <input className="gmx-campo" value={it.nombre} maxLength={TOPES_VENTA.nombre} placeholder="Nombre" aria-label={`Nombre ${k + 1}`} onChange={(e) => cambiar(k, { nombre: e.target.value })} />
            <input className="gmx-campo" value={it.lugar} maxLength={TOPES_VENTA.lugar} placeholder="De dónde (opcional)" aria-label={`De dónde ${k + 1}`} onChange={(e) => cambiar(k, { lugar: e.target.value })} />
            <button type="button" className="gmx-btn" title="Quitar" aria-label={`Quitar ${k + 1}`} onMouseDown={(e) => e.preventDefault()} onClick={() => poner({ items: items.filter((_, j) => j !== k) })}>
              <IconoBorrar size={15} />
            </button>
          </div>
          <div className="gmx-venta-fila">
            <input className="gmx-campo" value={it.detalle} maxLength={TOPES_VENTA.detalle} placeholder="compró el Plan Black" aria-label={`Qué hizo ${k + 1}`} onChange={(e) => cambiar(k, { detalle: e.target.value })} />
            <input className="gmx-campo" type="date" value={it.fecha ?? ''} aria-label={`Cuándo ${k + 1}`} style={{ flex: '0 0 9.5em' }} onChange={(e) => cambiar(k, { fecha: e.target.value || null })} />
          </div>
        </div>
      ))}
      <button type="button" className="gmx-chip" style={{ alignSelf: 'flex-start' }} disabled={items.length >= TOPES_VENTA.items}
        onMouseDown={(e) => e.preventDefault()} onClick={() => poner({ items: [...items, { nombre: '', detalle: '', lugar: '', fecha: null }] })}>
        <Icono nombre="mas" tam={14} /><span>Agregar</span>
      </button>
    </>
  );
}

function PanelEscasez({ attrs, poner }: PropsPanel) {
  const numero = (v: string) => (v.trim() === '' ? null : Number(v));
  const valor = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
  const a = attrsEscasez(attrs);
  const mal = attrs.quedan != null && attrs.total != null && a.quedan == null;
  return (
    <>
      <span className="gmx-rotulo">Título (opcional)</span>
      <input className="gmx-campo" value={str(attrs.titulo)} maxLength={TOPES_VENTA.titulo} placeholder="Cupos de Black November" aria-label="Título"
        onChange={(e) => poner({ titulo: e.target.value })} />
      <div className="gmx-venta-fila">
        <label className="gmx-rotulo" style={{ margin: 0 }}>Quedan
          <input className={`gmx-campo${mal ? ' gmx-campo-error' : ''}`} type="number" min={0} max={TOPES_VENTA.total} value={valor(attrs.quedan)} onChange={(e) => poner({ quedan: numero(e.target.value) })} />
        </label>
        <label className="gmx-rotulo" style={{ margin: 0 }}>De
          <input className="gmx-campo" type="number" min={1} max={TOPES_VENTA.total} value={valor(attrs.total)} onChange={(e) => poner({ total: numero(e.target.value) })} />
        </label>
        <label className="gmx-rotulo" style={{ margin: 0 }}>Qué
          <input className="gmx-campo" value={str(attrs.unidad)} maxLength={TOPES_VENTA.unidad} placeholder={UNIDAD_ESCASEZ} onChange={(e) => poner({ unidad: e.target.value })} />
        </label>
      </div>
      <span className="gmx-nota">{mal ? 'No pueden quedar más de los que hay.' : 'Actualízalo cuando vendas: no baja solo.'}</span>
    </>
  );
}

export default BloqueVentaVista;

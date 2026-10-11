'use client';

// =============================================================================
// FormularioVista — el bloque «Formulario» en el editor y su editor de campos
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» Gamma tiene un bloque Formulario nativo (help 17237438);
// el de MaKo es un `<form>` real que el Pixel del workspace reconoce, así que lo que
// alguien deja en una landing PUBLICADA entra al CRM (D4). La vista previa del editor
// no carga el Pixel: el panel lo dice en una línea.
//
// La vista es la forma pública (specFormulario, paquete A) dibujada INERTE: lo que se
// ve en el editor es lo que se publica, y un clic en la vista elige el bloque en vez
// de escribir en un campo. El panel edita los atributos: campos (tipo de TIPOS_CAMPO,
// etiqueta, obligatorio, opciones, orden), texto del botón, mensaje de éxito y
// «Redirigir a» (con el mismo selector de destino que un enlace).
//
// Lo que no se normaliza mientras se escribe, a propósito: el saneo del server
// (attrsFormulario) recorta espacios, pone la etiqueta por default y pasa a «texto» un
// campo de opciones con menos de dos. Aplicado en cada tecla, no se podría escribir un
// espacio al final de una palabra ni armar las opciones de a una. Acá se guarda lo que
// se escribe; lo que el saneo cambiaría se evita en el lugar: un campo que pasa a
// «Opciones» nace con dos, y no se puede bajar de dos. Los tipos únicos (nombre,
// correo, teléfono: el Pixel lee UNO de cada uno) no se ofrecen dos veces.
// PEDIDO al paquete G1: `formulario` → `ReactNodeViewRenderer(FormularioVista)`.
// =============================================================================

import { useMemo, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import {
  EstilosG2, FilaMenu, Flotante, Icono, MenuFilas, SelectorDestino, describirDestino, eliminarBloqueConDeshacer, noRobaFoco, seccionesDe,
} from '../BarraFormato';
import { ETIQUETA_CAMPO, specFormulario } from '@/lib/editor-landing/especificacion';
import { htmlDeArbol } from '@/lib/editor-landing/grafico-svg';
import { TIPOS_CAMPO, TOPES, nuevoId, type CampoFormulario, type TipoCampo } from '@/lib/editor-landing/doc';

const TIPO: Record<TipoCampo, { nombre: string; icono: string }> = {
  nombre: { nombre: 'Nombre', icono: 'usuario' },
  email: { nombre: 'Correo electrónico', icono: 'mail' },
  telefono: { nombre: 'Teléfono', icono: 'telefono' },
  empresa: { nombre: 'Empresa', icono: 'negocio' },
  texto: { nombre: 'Respuesta corta', icono: 'chat-texto' },
  textoLargo: { nombre: 'Respuesta larga', icono: 'notas' },
  opciones: { nombre: 'Opciones', icono: 'check' },
};
/** Los tipos que van una sola vez por formulario (el Pixel lee un valor de cada uno: especificacion.ts). */
const UNICOS: ReadonlySet<TipoCampo> = new Set<TipoCampo>(['nombre', 'email', 'telefono']);
const MAX_OPCIONES = 12;

const CSS_FORM: string = [
  '.gmx-form{display:flex;flex-direction:column;gap:6px;padding:4px}',
  '.gmx-form-campo{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--gmx-borde);border-radius:8px;background:var(--gmx-fondo-2)}',
  '.gmx-form-fila{display:flex;align-items:center;gap:4px}',
  '.gmx-form-fila .gmx-campo{flex:1 1 auto;min-width:0}',
  '.gmx-form-opciones{display:flex;flex-direction:column;gap:4px;padding-left:10px;border-left:2px solid var(--gmx-borde)}',
].join('\n');

type PanelForm = { tipo: 'editar' | 'redirigir' | 'tipoCampo'; ancla: HTMLElement; campo?: number };

/** Los campos tal como están guardados (sin normalizar: ver la cabecera). */
function camposDe(raw: unknown): CampoFormulario[] {
  return (Array.isArray(raw) ? raw : []).map((c): CampoFormulario => {
    const o = (c && typeof c === 'object' ? c : {}) as Partial<CampoFormulario>;
    return {
      id: typeof o.id === 'string' ? o.id : '',
      tipo: (TIPOS_CAMPO as readonly string[]).includes(String(o.tipo)) ? (o.tipo as TipoCampo) : 'texto',
      etiqueta: typeof o.etiqueta === 'string' ? o.etiqueta : '',
      requerido: !!o.requerido,
      opciones: Array.isArray(o.opciones) ? o.opciones.map(String) : [],
    };
  });
}

export function FormularioVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, updateAttributes } = props;
  const ctx = useEditorLanding();
  const [panel, setPanel] = useState<PanelForm | null>(null);
  const [anclaEditor, setAnclaEditor] = useState<HTMLElement | null>(null);
  const html = useMemo(() => htmlDeArbol(specFormulario(node.attrs, { modo: 'editor' })), [node.attrs]);
  const campos = camposDe(node.attrs.campos);
  const activo = (selected || !!panel) && editor.isEditable;
  const secciones = useMemo(() => (panel ? seccionesDe(editor) : []), [panel, editor]);
  const paginas = useMemo(() => ctx.paginas.map((p) => ({ id: p.id, titulo: p.titulo || 'Página' })), [ctx.paginas]);
  const redirigir = typeof node.attrs.redirigir === 'string' && node.attrs.redirigir ? node.attrs.redirigir : null;

  // Un campo sin id (no debería pasar: lo pone quien inserta) recibe uno al escribir, no al dibujar:
  // generarlo en cada render cambiaría la `key` y el campo perdería el foco con cada letra.
  const ponerCampos = (nuevos: CampoFormulario[]) => updateAttributes({ campos: nuevos.map((c) => (c.id ? c : { ...c, id: nuevoId('c') })) });
  const cambiarCampo = (i: number, cambio: Partial<CampoFormulario>) => ponerCampos(campos.map((c, k) => (k === i ? { ...c, ...cambio } : c)));
  const cambiarTipo = (i: number, tipo: TipoCampo) => {
    const c = campos[i];
    const etiqueta = !c.etiqueta || c.etiqueta === ETIQUETA_CAMPO[c.tipo] ? ETIQUETA_CAMPO[tipo] : c.etiqueta;
    const opciones = tipo === 'opciones' ? (c.opciones.length >= 2 ? c.opciones : ['Opción 1', 'Opción 2']) : [];
    cambiarCampo(i, { tipo, etiqueta, opciones });
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= campos.length) return;
    const nuevos = campos.slice();
    [nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]];
    ponerCampos(nuevos);
  };
  const agregarCampo = () => {
    if (campos.length >= TOPES.camposFormulario) return;
    ponerCampos([...campos, { id: nuevoId('c'), tipo: 'texto', etiqueta: '', requerido: false, opciones: [] }]);
  };
  const usado = (tipo: TipoCampo, menos: number) => UNICOS.has(tipo) && campos.some((c, k) => k !== menos && c.tipo === tipo);

  const abrirEditor = (el: HTMLElement) => { setAnclaEditor(el); setPanel({ tipo: 'editar', ancla: el }); };
  const cerrarTodo = () => { setPanel(null); };
  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar, 'Formulario eliminado');
  };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      <style href="gmx-form" precedence="medium">{CSS_FORM}</style>
      {activo && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title="Editar formulario" aria-expanded={!!panel} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => (panel ? cerrarTodo() : abrirEditor(e.currentTarget))}>
            <Icono nombre="formulario" /><span>Editar formulario</span>
          </button>
          <span className="gmx-nv-etq">{campos.length === 1 ? '1 campo' : campos.length + ' campos'}</span>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label="Eliminar formulario" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      <div className="gmx-nv-marco" inert dangerouslySetInnerHTML={{ __html: html }} />

      {panel && anclaEditor && (
        <Flotante ancla={anclaEditor} onCerrar={cerrarTodo} etiqueta="Formulario" ancho={400}>
          <div className="gmx-form">
            <span className="gmx-nota">Los datos entran a tu CRM cuando la landing esté publicada.</span>
            <span className="gmx-rotulo">Campos</span>
            {campos.map((c, i) => (
              <div key={c.id || 'k' + i} className="gmx-form-campo">
                <div className="gmx-form-fila">
                  <button type="button" className="gmx-chip" title="Tipo de campo" onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => setPanel({ tipo: 'tipoCampo', ancla: e.currentTarget, campo: i })}>
                    <Icono nombre={TIPO[c.tipo].icono} tam={14} /><span>{TIPO[c.tipo].nombre}</span><Icono nombre="chevron-abajo" tam={12} />
                  </button>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="gmx-chip" aria-pressed={c.requerido} title="Obligatorio" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => cambiarCampo(i, { requerido: !c.requerido })}>Obligatorio</button>
                  <button type="button" className="gmx-btn" title="Subir" aria-label="Subir" disabled={i === 0} onMouseDown={(e) => e.preventDefault()} onClick={() => mover(i, -1)}>
                    <Icono nombre="chevron-arriba" tam={14} />
                  </button>
                  <button type="button" className="gmx-btn" title="Bajar" aria-label="Bajar" disabled={i === campos.length - 1} onMouseDown={(e) => e.preventDefault()} onClick={() => mover(i, 1)}>
                    <Icono nombre="chevron-abajo" tam={14} />
                  </button>
                  <button type="button" className="gmx-btn" title="Eliminar campo" aria-label="Eliminar campo" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => ponerCampos(campos.filter((_, k) => k !== i))}>
                    <IconoBorrar size={15} />
                  </button>
                </div>
                <input className="gmx-campo" value={c.etiqueta} maxLength={120} placeholder={ETIQUETA_CAMPO[c.tipo]} aria-label="Etiqueta"
                  onChange={(e) => cambiarCampo(i, { etiqueta: e.target.value })} />
                {c.tipo === 'opciones' && (
                  <div className="gmx-form-opciones">
                    {c.opciones.map((op, k) => (
                      <div key={k} className="gmx-form-fila">
                        <input className="gmx-campo" value={op} maxLength={120} aria-label={'Opción ' + (k + 1)}
                          onChange={(e) => cambiarCampo(i, { opciones: c.opciones.map((x, m) => (m === k ? e.target.value : x)) })} />
                        <button type="button" className="gmx-btn" title="Eliminar opción" aria-label="Eliminar opción" disabled={c.opciones.length <= 2}
                          onMouseDown={(e) => e.preventDefault()} onClick={() => cambiarCampo(i, { opciones: c.opciones.filter((_, m) => m !== k) })}>
                          <IconoBorrar size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="gmx-chip" style={{ alignSelf: 'flex-start' }} disabled={c.opciones.length >= MAX_OPCIONES}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => cambiarCampo(i, { opciones: [...c.opciones, 'Opción ' + (c.opciones.length + 1)] })}>
                      <Icono nombre="mas" tam={14} /><span>Agregar opción</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="gmx-chip" style={{ alignSelf: 'flex-start' }} disabled={campos.length >= TOPES.camposFormulario}
              onMouseDown={(e) => e.preventDefault()} onClick={agregarCampo}>
              <Icono nombre="mas" tam={14} /><span>Agregar campo</span>
            </button>
            <span className="gmx-rotulo">Texto del botón</span>
            <input className="gmx-campo" value={typeof node.attrs.boton === 'string' ? node.attrs.boton : ''} maxLength={60} placeholder="Enviar" aria-label="Texto del botón"
              onChange={(e) => updateAttributes({ boton: e.target.value })} />
            <span className="gmx-rotulo">Mensaje de éxito</span>
            <input className="gmx-campo" value={typeof node.attrs.exito === 'string' ? node.attrs.exito : ''} maxLength={200} placeholder="¡Listo! Recibimos tus datos." aria-label="Mensaje de éxito"
              onChange={(e) => updateAttributes({ exito: e.target.value })} />
            <span className="gmx-rotulo">Redirigir a</span>
            <button type="button" className="gmx-chip" style={{ alignSelf: 'stretch', justifyContent: 'flex-start' }} onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => setPanel({ tipo: 'redirigir', ancla: e.currentTarget })}>
              <Icono nombre="enlace" tam={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{redirigir ? describirDestino(redirigir, secciones, paginas) : 'Mostrar el mensaje'}</span>
            </button>
          </div>
        </Flotante>
      )}
      {panel?.tipo === 'tipoCampo' && panel.campo != null && campos[panel.campo] && (
        <Flotante ancla={panel.ancla} onCerrar={() => setPanel({ tipo: 'editar', ancla: anclaEditor ?? panel.ancla })} etiqueta="Tipo de campo" ancho={230}>
          <MenuFilas etiqueta="Tipo de campo">
            {TIPOS_CAMPO.map((t) => (
              <FilaMenu key={t} nombre={TIPO[t].nombre} icono={<Icono nombre={TIPO[t].icono} />} activo={campos[panel.campo!].tipo === t ? true : undefined}
                apagado={usado(t, panel.campo!)} titulo={usado(t, panel.campo!) ? 'Ya hay uno' : undefined}
                onClick={() => { cambiarTipo(panel.campo!, t); setPanel({ tipo: 'editar', ancla: anclaEditor ?? panel.ancla }); }} />
            ))}
          </MenuFilas>
        </Flotante>
      )}
      {panel?.tipo === 'redirigir' && (
        <Flotante ancla={panel.ancla} onCerrar={() => setPanel({ tipo: 'editar', ancla: anclaEditor ?? panel.ancla })} etiqueta="Redirigir a" ancho={300}>
          <SelectorDestino
            valor={redirigir}
            conNuevaPestana={false}
            textoQuitar="Mostrar el mensaje"
            onElegir={(href) => { updateAttributes({ redirigir: href === '#' ? null : href }); setPanel({ tipo: 'editar', ancla: anclaEditor ?? panel.ancla }); }}
            onQuitar={() => { updateAttributes({ redirigir: null }); setPanel({ tipo: 'editar', ancla: anclaEditor ?? panel.ancla }); }}
          />
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

export default FormularioVista;

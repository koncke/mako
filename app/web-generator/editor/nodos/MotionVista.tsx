'use client';

// =============================================================================
// MotionVista — el bloque «Motion graphic» en el editor de la landing
// =============================================================================
// Un titular, una cifra, un testimonio o una oferta que entran animados: las plantillas de lib/motion, las MISMAS del
// Video Editor. El dibujo es el árbol de lib/editor-landing/motion.ts (`arbolMotion`) —el mismo que sale publicado— y
// el panel edita sus atributos: la plantilla, los textos y números de esa plantilla con sus rótulos, el tono, la
// fuente, los tres colores, «Con fondo» y el formato.
//
// Copiado de GraficoVista (el «Editar gráfico» de Gamma): la barrita arriba del bloque —acá también al pasar el
// mouse, con una demora al salir para poder llegar a ella— y el panel flotante (`Flotante`, la pila de modales
// anidada). Los controles son los de la casa (`gmx-campo`, `gmx-chip`, `gmx-hex`, `Interruptor`, `FilaMenu`): nada
// de select nativo.
//
// Cómo escribe: cada cambio es UNA transacción (`updateAttributes`), así Ctrl+Z lo deshace y el autoguardado lo
// guarda como cualquier edición. Los textos se guardan COMO SE ESCRIBEN (sin `maxLength`: nunca se corta un texto);
// el dibujo pasa por el saneo NO estricto del motor, que achica la letra para que entre, y si algo no se pudo usar
// (un texto más largo que el tope duro, un color que no es #rrggbb) el panel lo dice abajo. Los números y los colores
// se escriben en un borrador local mientras no son válidos («-», «1,», «#ff»).
//
// Con el panel abierto el bloque se ve QUIETO en su estado final (se lee mientras se escribe); «Reproducir» lo vuelve
// a animar desde cero (remonta el HTML: sacar y volver a poner la animación la reinicia).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, FilaMenu, Flotante, Icono, Interruptor, MenuFilas, eliminarBloqueConDeshacer, noRobaFoco } from '../BarraFormato';
import { htmlDeArbol } from '@/lib/editor-landing/grafico-svg';
import {
  FORMATOS_MOTION, ROTULO_FORMATO, arbolMotion, cambiarPlantilla, familiasDeMotion, normalizarAttrsMotion,
  type AttrsMotion,
} from '@/lib/editor-landing/motion';
import { PLANTILLAS, camposDe } from '@/lib/motion/plantillas';
import { PLANTILLAS_MOTION, type CampoMotion, type IdPlantilla, type ValorCampo } from '@/lib/motion/tipos';
import { cargarFuentesMotion } from '@/lib/motion/fuentes';
import { colorDeRelleno, type Tema } from '@/lib/editor-landing/temas';
import { esHex } from '@/lib/editor-landing/doc';

const CSS_MO: string = [
  '.gmx-mo{display:flex;flex-direction:column;gap:2px;padding:4px}',
  '.gmx-mo-chips{display:flex;flex-wrap:wrap;gap:4px}',
  '.gmx-mo-colores{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
  '.gmx-mo-colores .gmx-hex{padding:0}',
  '.gmx-mo-colores .gmx-campo{min-width:0;padding:0 6px}',
  '.gmx-mo textarea.gmx-campo{min-height:56px}',
].join('\n');

/** Los colores del tema de la landing, para el motion graphic: el de la sección, el del título y el de acento. */
function coloresDelTema(t: Tema): Record<string, string> {
  const out: Record<string, string> = {};
  const fondo = colorDeRelleno(t.tarjeta.fondo);
  const texto = colorDeRelleno(t.colores.titulo);
  if (esHex(fondo)) out.colorFondo = fondo.toLowerCase();
  if (esHex(texto)) out.colorTexto = texto.toLowerCase();
  if (esHex(t.colores.acento)) out.colorAcento = t.colores.acento.toLowerCase();
  return out;
}

/** Los valores guardados en el nodo, sólo los que tienen forma de valor (texto, número o sí/no). */
function valoresGuardados(raw: unknown): Record<string, ValorCampo> {
  const out: Record<string, ValorCampo> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  return out;
}

export function MotionVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, updateAttributes } = props;
  const ctx = useEditorLanding();
  const [panel, setPanel] = useState<{ tipo: 'editar' | 'plantilla'; ancla: HTMLElement } | null>(null);
  const [encima, setEncima] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const [reproducir, setReproducir] = useState(false);
  const salir = useRef<ReturnType<typeof setTimeout> | null>(null);

  const norm = useMemo(() => normalizarAttrsMotion(node.attrs), [node.attrs]);
  const m = norm.attrs;
  // Lo GUARDADO tal cual (lo que se escribió), para los campos: un texto que el dibujo no pudo usar se sigue viendo.
  const guardados = useMemo(() => valoresGuardados(node.attrs.valores), [node.attrs.valores]);
  const quieto = panel?.tipo === 'editar' && !reproducir;
  const html = useMemo(() => htmlDeArbol(arbolMotion(node.attrs, { quieto })), [node.attrs, quieto]);
  const familias = useMemo(() => familiasDeMotion(node.attrs).join('|'), [node.attrs]);
  useEffect(() => { if (familias) void cargarFuentesMotion(familias.split('|')); }, [familias]);
  useEffect(() => () => { if (salir.current) clearTimeout(salir.current); }, []);

  const editable = editor.isEditable;
  const activo = (selected || !!panel) && editable;
  const conBarra = (activo || encima) && editable;

  const poner = (cambio: Partial<AttrsMotion>) => {
    setReproducir(false);
    updateAttributes({ plantilla: m.plantilla, valores: { ...m.valores, ...guardados }, formato: m.formato, ...cambio });
  };
  const ponerValor = (clave: string, v: ValorCampo) => poner({ valores: { ...m.valores, ...guardados, [clave]: v } });
  const elegirPlantilla = (p: IdPlantilla) => { setReproducir(false); updateAttributes(cambiarPlantilla(m, p)); };
  const replay = () => { setReproducir(true); setVuelta((v) => v + 1); };
  const eliminar = () => {
    const pos = getPos();
    if (typeof pos === 'number') eliminarBloqueConDeshacer(editor, pos, ctx.avisar, 'Motion graphic eliminado');
  };
  const entrar = () => { if (salir.current) clearTimeout(salir.current); setEncima(true); };
  const irse = () => { if (salir.current) clearTimeout(salir.current); salir.current = setTimeout(() => setEncima(false), 300); };

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined} onMouseEnter={entrar} onMouseLeave={irse}>
      <EstilosG2 />
      <style href="gmx-mo" precedence="medium">{CSS_MO}</style>
      {conBarra && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title="Editar el motion graphic" aria-expanded={panel?.tipo === 'editar'} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setPanel((p) => (p?.tipo === 'editar' ? null : { tipo: 'editar', ancla: el })); }}>
            <Icono nombre="lapiz" /><span>Editar</span>
          </button>
          <button type="button" className="gmx-btn" title="Elegir la plantilla" aria-expanded={panel?.tipo === 'plantilla'} onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { const el = e.currentTarget; setPanel((p) => (p?.tipo === 'plantilla' ? null : { tipo: 'plantilla', ancla: el })); }}>
            <span>{PLANTILLAS[m.plantilla].nombre}</span><Icono nombre="chevron-abajo" tam={12} />
          </button>
          <button type="button" className="gmx-btn" title="Reproducir la animación" onMouseDown={(e) => e.preventDefault()} onClick={replay}>
            <Icono nombre="play" /><span>Reproducir</span>
          </button>
          <span className="gmx-nv-sep" />
          <button type="button" className="gmx-btn" title="Eliminar" aria-label="Eliminar motion graphic" onMouseDown={(e) => e.preventDefault()} onClick={eliminar}>
            <IconoBorrar size={16} />
          </button>
        </div>
      )}
      <div key={vuelta} className="gmx-nv-marco" dangerouslySetInnerHTML={{ __html: html }} />

      {panel?.tipo === 'plantilla' && (
        <Flotante ancla={panel.ancla} onCerrar={() => setPanel(null)} etiqueta="Plantilla" ancho={260}>
          <MenuFilas etiqueta="Plantilla">
            {PLANTILLAS_MOTION.map((p) => (
              <FilaMenu key={p} nombre={PLANTILLAS[p].nombre} titulo={PLANTILLAS[p].para} activo={m.plantilla === p ? true : undefined}
                onClick={() => { elegirPlantilla(p); setPanel(null); }} />
            ))}
          </MenuFilas>
        </Flotante>
      )}
      {panel?.tipo === 'editar' && (
        <Flotante ancla={panel.ancla} onCerrar={() => { setPanel(null); setReproducir(false); }} etiqueta="Editar el motion graphic" ancho={380}>
          <PanelMotion m={m} guardados={guardados} descartes={norm.descartes} tema={ctx.tema}
            onPlantilla={elegirPlantilla} onValor={ponerValor} onPoner={poner} onReproducir={replay} />
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

export default MotionVista;

function PanelMotion({ m, guardados, descartes, tema, onPlantilla, onValor, onPoner, onReproducir }: {
  m: AttrsMotion;
  guardados: Record<string, ValorCampo>;
  descartes: string[];
  tema: Tema;
  onPlantilla: (p: IdPlantilla) => void;
  onValor: (clave: string, v: ValorCampo) => void;
  onPoner: (c: Partial<AttrsMotion>) => void;
  onReproducir: () => void;
}) {
  // Lo que se está escribiendo y todavía no es un número o un color válido («-», «1,», «#ff»), por campo.
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const campos = camposDe(m.plantilla);
  const propias = new Set(PLANTILLAS[m.plantilla].campos.map((c) => c.clave));
  const deTema = coloresDelTema(tema);
  const crudo = (k: string): unknown => (k in guardados ? guardados[k] : m.valores[k]);
  const soltar = (k: string) => setBorrador((b) => { const n = { ...b }; delete n[k]; return n; });

  const campo = (c: CampoMotion) => {
    switch (c.tipo) {
      case 'texto': {
        const v = typeof crudo(c.clave) === 'string' ? (crudo(c.clave) as string) : '';
        const largo = c.clave === 'datos' || c.max > 100;
        return (
          <label key={c.clave}>
            <span className="gmx-rotulo">{c.rotulo}</span>
            {largo
              ? <textarea className="gmx-campo" rows={c.clave === 'datos' ? 4 : 2} value={v} placeholder={c.porDefecto} onChange={(e) => onValor(c.clave, e.target.value)} />
              : <input className="gmx-campo" value={v} placeholder={c.porDefecto} onChange={(e) => onValor(c.clave, e.target.value)} />}
          </label>
        );
      }
      case 'numero': {
        const v = crudo(c.clave);
        return (
          <label key={c.clave}>
            <span className="gmx-rotulo">{c.rotulo}</span>
            <input className="gmx-campo" inputMode="decimal" value={borrador[c.clave] ?? String(typeof v === 'number' ? v : '')}
              onChange={(e) => {
                const t = e.target.value;
                setBorrador((b) => ({ ...b, [c.clave]: t }));
                const n = Number(t.replace(/\s/g, '').replace(',', '.'));
                if (t.trim() !== '' && Number.isFinite(n)) onValor(c.clave, n);
              }}
              onBlur={() => soltar(c.clave)} />
          </label>
        );
      }
      case 'color': return <Color key={c.clave} rotulo={c.rotulo} clave={c.clave} valor={String(crudo(c.clave) ?? c.porDefecto)} borrador={borrador} setBorrador={setBorrador} soltar={soltar} onValor={onValor} />;
      case 'opcion': {
        const v = crudo(c.clave);
        return (
          <div key={c.clave}>
            <span className="gmx-rotulo">{c.rotulo}</span>
            <div className="gmx-mo-chips" role="group" aria-label={c.rotulo}>
              {c.opciones.map((o) => (
                <button key={o.valor} type="button" className="gmx-chip" aria-pressed={v === o.valor} onMouseDown={(e) => e.preventDefault()} onClick={() => onValor(c.clave, o.valor)}
                  style={c.clave === 'fuente' ? { fontFamily: `"${o.valor}", sans-serif` } : undefined}>
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
        );
      }
      case 'si-no': return <Interruptor key={c.clave} nombre={c.rotulo} valor={crudo(c.clave) === true} onCambio={(b) => onValor(c.clave, b)} />;
    }
  };

  const comunes = campos.filter((c) => !propias.has(c.clave));
  const colores = comunes.filter((c) => c.tipo === 'color');
  const resto = comunes.filter((c) => c.tipo !== 'color');
  return (
    <div className="gmx-mo">
      <span className="gmx-rotulo">Plantilla</span>
      <div className="gmx-mo-chips" role="group" aria-label="Plantilla">
        {PLANTILLAS_MOTION.map((p) => (
          <button key={p} type="button" className="gmx-chip" aria-pressed={m.plantilla === p} title={PLANTILLAS[p].para} onMouseDown={(e) => e.preventDefault()} onClick={() => onPlantilla(p)}>
            {PLANTILLAS[p].nombre}
          </button>
        ))}
      </div>
      {campos.filter((c) => propias.has(c.clave)).map(campo)}
      {resto.filter((c) => c.tipo === 'opcion').map(campo)}
      <span className="gmx-rotulo">Colores</span>
      <div className="gmx-mo-colores">
        {colores.map((c) => <Color key={c.clave} rotulo={c.rotulo} clave={c.clave} valor={String(crudo(c.clave) ?? (c.tipo === 'color' ? c.porDefecto : ''))} borrador={borrador} setBorrador={setBorrador} soltar={soltar} onValor={onValor} />)}
      </div>
      {Object.keys(deTema).length > 0 && (
        <div style={{ display: 'flex', marginTop: 6 }}>
          <button type="button" className="gmx-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => onPoner({ valores: { ...m.valores, ...guardados, ...deTema } })}>
            <Icono nombre="paleta" tam={14} /><span>Usar los colores del tema</span>
          </button>
        </div>
      )}
      {resto.filter((c) => c.tipo !== 'opcion').map(campo)}
      <span className="gmx-rotulo">Formato</span>
      <div className="gmx-mo-chips" role="group" aria-label="Formato">
        {FORMATOS_MOTION.map((f) => (
          <button key={f} type="button" className="gmx-chip" aria-pressed={m.formato === f} onMouseDown={(e) => e.preventDefault()} onClick={() => onPoner({ formato: f })}>
            {ROTULO_FORMATO[f]} · {f}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <button type="button" className="gmx-chip" onMouseDown={(e) => e.preventDefault()} onClick={onReproducir}>
          <Icono nombre="play" tam={14} /><span>Reproducir</span>
        </button>
      </div>
      {descartes.length > 0 && (
        <div className="gmx-error" role="status">
          {descartes.slice(0, 4).map((d) => <div key={d}>{d}: se muestra el de la plantilla.</div>)}
        </div>
      )}
    </div>
  );
}

function Color({ rotulo, clave, valor, borrador, setBorrador, soltar, onValor }: {
  rotulo: string;
  clave: string;
  valor: string;
  borrador: Record<string, string>;
  setBorrador: (f: (b: Record<string, string>) => Record<string, string>) => void;
  soltar: (k: string) => void;
  onValor: (clave: string, v: ValorCampo) => void;
}) {
  const hex = esHex(valor) ? valor.toLowerCase() : '#000000';
  return (
    <label>
      <span className="gmx-rotulo">{rotulo}</span>
      <span className="gmx-hex">
        <input type="color" value={hex} aria-label={rotulo} onChange={(e) => { soltar(clave); onValor(clave, e.target.value.toLowerCase()); }} />
        <input className="gmx-campo" value={borrador[clave] ?? hex} maxLength={7} aria-label={rotulo + ' (hex)'}
          onChange={(e) => {
            const v = e.target.value.trim().toLowerCase();
            setBorrador((b) => ({ ...b, [clave]: v }));
            if (esHex(v)) onValor(clave, v);
          }}
          onBlur={() => soltar(clave)} />
      </span>
    </label>
  );
}

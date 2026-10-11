'use client';

// =============================================================================
// DialogoConfiguracion — «Configuración de la página» de Gamma
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Copia del modal de Gamma
// (gamma-ui.md §5.12.7): navegación a la izquierda y el formulario a la derecha. De lo que lista
// Gamma, lo que tiene sentido en una landing:
//   · Secciones: «Animaciones» (la entrada de las secciones al hacer scroll en la página
//     publicada: `config.pagina.animaciones`), y el ancho y la alineación de contenido de TODAS
//     las secciones de la página a la vez («Ancho de la diapositiva» y «Alineación de
//     contenido» de Gamma). Si las secciones no coinciden, no hay ninguna opción marcada.
//   · Fondo: la imagen de fondo de la página (`config.pagina.fondoImagen`, detrás de las
//     secciones; la pinta `.gm-fondo[data-imagen]`).
//
// El ancho y la alineación son atributos de cada sección (doc.ts), así que «todas» es UNA
// transacción de TipTap que reescribe cada tarjeta de la página abierta: Ctrl+Z lo deshace
// entero, y una sección nueva nace con el default (como en Gamma, donde la configuración de la
// página aplica a lo que existe).
//
// Lo que NO se copia de Gamma, y por qué:
//   · Formato y relación de aspecto (16:9, 4:3, Carta…): una landing es fluida por definición.
//   · Tamaño de fuente base y «Adapta el contenido»: lo decide el tema (escala) en css.ts.
//   · «CSS de la página»: código libre en una página pública (decisión D4: no).
//   · «Encabezados y pies de página» de presentación: el pie de un sitio está en Publicar.
// =============================================================================

import { useState } from 'react';
import { useEditorState } from '@tiptap/react';
import { NODO, type AttrsTarjeta } from '@/lib/editor-landing/doc';
import { attrsTarjeta } from '@/lib/editor-landing/especificacion';
import { useEditorLanding } from '../contexto';
import { Campo, CampoImagen, EstilosGmp, FilaAjuste, Icono, Interruptor, ModalGma, Segmentado, useConfigViva, useFijo, type OpcionSeg } from './piezas-gma';

type Seccion = 'secciones' | 'fondo';

const ANCHOS: OpcionSeg<AttrsTarjeta['ancho']>[] = [
  { valor: 'angosto', texto: 'Angosto' },
  { valor: 'normal', texto: 'Predeterminado' },
  { valor: 'amplio', texto: 'Amplio' },
  { valor: 'completo', texto: 'Completo' },
];
const ALINEACIONES: OpcionSeg<AttrsTarjeta['alineacion']>[] = [
  { valor: 'arriba', texto: 'Arriba' },
  { valor: 'centro', texto: 'Centro' },
  { valor: 'abajo', texto: 'Abajo' },
];

const CSS_CONFIGURACION = [
  '.gmp-conf{display:grid;grid-template-columns:180px minmax(0,1fr);height:100%;margin:0 -24px -20px}',
  '.gmp-conf-nav{display:grid;align-content:start;gap:2px;padding:8px 12px;border-right:1px solid var(--gmp-borde)}',
  '.gmp-conf-nav button{display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--gmp-titulo);font-size:14px;font-weight:600;text-align:left;cursor:pointer}',
  '.gmp-conf-nav button:hover{background:var(--gmp-hover)}',
  '.gmp-conf-nav button[aria-current="true"]{background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',
  '.gmp-conf-form{padding:12px 20px 24px;overflow-y:auto;min-height:0}',
  '@media (max-width:600px){.gmp-conf{grid-template-columns:minmax(0,1fr)}.gmp-conf-nav{display:flex;border-right:0;border-bottom:1px solid var(--gmp-borde)}}',
].join('\n');

/** El valor común de un atributo en todas las secciones de la página, o null si difieren (o no hay). */
function comun<T extends string>(valores: readonly T[]): T | null {
  if (!valores.length) return null;
  return valores.every((v) => v === valores[0]) ? valores[0] : null;
}

export function DialogoConfiguracion({ onCerrar }: { onCerrar?: () => void } = {}) {
  const { dialogo } = useEditorLanding();
  if (dialogo !== 'configuracion') return null;
  return <DialogoConfiguracionAbierto onCerrar={onCerrar} />;
}

function DialogoConfiguracionAbierto({ onCerrar }: { onCerrar?: () => void }) {
  const { editor, setDialogo } = useEditorLanding();
  const { config, cambiar } = useConfigViva();
  const cerrar = useFijo(() => (onCerrar ? onCerrar() : setDialogo(null)));
  const [seccion, setSeccion] = useState<Seccion>('secciones');

  // El ancho y la alineación de cada sección de la página abierta (en vivo).
  const todas = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const anchos: AttrsTarjeta['ancho'][] = [];
      const alineaciones: AttrsTarjeta['alineacion'][] = [];
      e.state.doc.forEach((n) => {
        if (n.type.name !== NODO.tarjeta) return;
        const a = attrsTarjeta(n.attrs);
        anchos.push(a.ancho);
        alineaciones.push(a.alineacion);
      });
      return { ancho: comun(anchos), alineacion: comun(alineaciones), cuantas: anchos.length };
    },
  });

  /** Escribe `cambios` en TODAS las secciones de la página, en una transacción. */
  const aTodas = (cambios: Partial<AttrsTarjeta>) => {
    editor?.commands.command(({ tr, state }) => {
      state.doc.forEach((n, pos) => {
        if (n.type.name === NODO.tarjeta) tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...cambios });
      });
      return true;
    });
  };

  return (
    <ModalGma titulo="Configuración de la página" icono={<Icono nombre="engrane" tam={22} style={{ color: 'var(--gmp-titulo)' }} />}
      onCerrar={cerrar} ancho={760} alto="min(80vh, 560px)"
      pie={<><span style={{ flex: 1 }} /><button type="button" className="gmp-btn gmp-btn-primario" onClick={cerrar}>Listo</button></>}>
      <EstilosGmp extra={{ href: 'gmp-configuracion', css: CSS_CONFIGURACION }} />
      <div className="gmp-conf">
        <nav className="gmp-conf-nav" aria-label="Configuración de la página">
          <button type="button" aria-current={seccion === 'secciones'} onClick={() => setSeccion('secciones')}><Icono nombre="secciones" tam={16} />Secciones</button>
          <button type="button" aria-current={seccion === 'fondo'} onClick={() => setSeccion('fondo')}><Icono nombre="fondo" tam={16} />Fondo</button>
        </nav>
        <div className="gmp-conf-form">
          {seccion === 'secciones' ? (
            <>
              <FilaAjuste titulo="Animaciones">
                <Interruptor etiqueta="Animaciones" activo={config.pagina.animaciones}
                  onCambiar={(v) => cambiar((c) => ({ ...c, pagina: { ...c.pagina, animaciones: v } }))} />
              </FilaAjuste>
              <hr className="gmp-sep" />
              <Campo etiqueta="Ancho de las secciones">
                <Segmentado etiqueta="Ancho de las secciones" ancho valor={todas?.ancho ?? null} opciones={ANCHOS} onCambiar={(v) => aTodas({ ancho: v })} />
              </Campo>
              <Campo etiqueta="Alineación de contenido">
                <Segmentado etiqueta="Alineación de contenido" ancho valor={todas?.alineacion ?? null} opciones={ALINEACIONES} onCambiar={(v) => aTodas({ alineacion: v })} />
              </Campo>
            </>
          ) : (
            <CampoImagen etiqueta="Imagen de fondo" valor={config.pagina.fondoImagen} ancho={200} proporcion="16 / 9"
              onCambiar={(u) => cambiar((c) => ({ ...c, pagina: { ...c.pagina, fondoImagen: u } }))} />
          )}
        </div>
      </div>
    </ModalGma>
  );
}

export default DialogoConfiguracion;

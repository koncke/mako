'use client';

// =============================================================================
// DialogoCompartir — el panel «Compartir» que se abre debajo del botón azul de la barra (copiado de Canva)
// =============================================================================
// Pedido de Martín (24/10/2026), textual: «Te pedí que "Compartir" y "publicar" sean un solo botón, azul y que diga
// "compartir"... Con el desplegable de la vista previa y las otras opciones, claro... Y mejora el diseño del pop-up de
// "Compartir y exportar" fijate como lo hacen otras apps, porque hay mucho texto y botones juntos, no se entiende...».
//
// La referencia es el panel «Compartir» de Canva (canva.com/help/share-via-link-or-email, mirado el 24/10/2026): se abre
// DEBAJO del botón Compartir de la barra (no es un modal en el medio), arriba el enlace con UN botón grande («Copiar
// enlace») y abajo una fila de atajos con ícono y nombre (Descargar, Presentar, Enlace de vista pública…). Elegir uno que
// tiene opciones (Descargar) cambia el panel por el suyo con «←», sin abrir otro modal encima.
//
// Lo que había antes (un modal de 640 px con pestañas Compartir/Exportar, «Publicar en el sitio…», tres bloques con
// título y explicación, «Quién puede editar» y tres botones al pie) se fue entero. Lo que queda, de arriba abajo:
//   · el enlace público con «Copiar enlace»; si no está publicada, una línea y el botón «Publicar» (abre Publicar, que es
//     donde se elige la dirección); si hay cambios sin publicar, una línea con «Actualizar»;
//   · los atajos: Descargar (la vista de exportar, acá adentro), Vista previa (el borrador en otra pestaña), Enlace privado
//     (su vista, acá adentro: copiar y regenerar) y Presentar.
// «Quién puede editar» no se dibuja: no hay invitados a una landing (la edita el equipo del negocio, con sus roles).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { useEditorLanding } from '../contexto';
import { Flotante, Ico, type Ancla } from '../MenuDocumento';
import { CuerpoExportar } from './DialogoExportar';
import { EstilosGmp, Giro, copiarTexto, pedir, useConfirmaGma, useFijo } from './piezas-gma';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const CSS_COMPARTIR = [
  '.gmp-cp{width:360px;max-width:calc(100vw - 24px);max-height:min(80vh,640px);overflow-y:auto;padding:16px;border-radius:14px;' +
    'background:var(--gmp-fondo);box-shadow:0 12px 32px rgba(0,0,0,.16),0 0 0 .8px var(--gmp-borde)}',
  '.gmp-cp-cab{display:flex;align-items:center;gap:6px;margin:-4px -6px 12px -4px}',
  '.gmp-cp-tit{flex:1;min-width:0;margin:0;font-size:15px;font-weight:700;color:var(--gmp-tinta)}',
  '.gmp-cp-rot{display:block;margin:0 0 6px;font-size:12.5px;font-weight:600;color:var(--gmp-tenue)}',
  '.gmp-cp-url{display:block;height:36px;line-height:34px;padding:0 12px;margin-bottom:8px;border:1px solid var(--gmp-borde);border-radius:8px;' +
    'background:var(--gmp-suave);color:var(--gmp-tinta);font-size:13.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
  '.gmp-cp-nota{margin:0 0 10px;font-size:13.5px;color:var(--gmp-texto)}',
  '.gmp-cp-cambios{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:var(--gmp-texto)}',
  '.gmp-cp-cambios::before{content:"";width:7px;height:7px;flex:none;border-radius:50%;background:var(--gmp-azul-linea)}',
  '.gmp-cp-cambios span{flex:1}',
  '.gmp-cp-atajos{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:16px;padding-top:14px;border-top:1px solid var(--gmp-borde)}',
  '.gmp-cp-atajo{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 2px;border:0;border-radius:10px;background:transparent;' +
    'color:var(--gmp-tinta);font-size:12px;font-weight:500;line-height:1.2;text-align:center;cursor:pointer}',
  '.gmp-cp-atajo:hover{background:var(--gmp-suave)}',
  '.gmp-cp-circ{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:var(--gmp-suave);color:var(--gmp-tinta)}',
  '.gmp-cp-atajo:hover .gmp-cp-circ{background:var(--gmp-hover)}',
  '.gmp-cp-fila{display:flex;gap:8px}',
  '.gmp-cp-fila .gmp-btn{flex:1}',
].join('\n');

type Vista = 'inicio' | 'descargar' | 'privado';

export function DialogoCompartir({ onCerrar, ancla = null, onVistaPrevia }: {
  onCerrar?: () => void;
  /** El botón azul «Compartir» de la barra: el panel se abre debajo, alineado a su borde derecho (Canva). */
  ancla?: Ancla | null;
  /** Abre el borrador en otra pestaña (lo arma el editor: guarda antes y pide el link privado). */
  onVistaPrevia?: () => void;
} = {}) {
  const { dialogo } = useEditorLanding();
  if (dialogo !== 'compartir') return null;
  return <PanelCompartir onCerrar={onCerrar} ancla={ancla} onVistaPrevia={onVistaPrevia} />;
}

function PanelCompartir({ onCerrar, ancla, onVistaPrevia }: { onCerrar?: () => void; ancla: Ancla | null; onVistaPrevia?: () => void }) {
  const { docId, urlPublica, cambiosSinPublicar, setDialogo, avisar } = useEditorLanding();
  const { confirmar, nodoConfirma } = useConfirmaGma();
  const cerrar = useFijo(() => (onCerrar ? onCerrar() : setDialogo(null)));
  const [vista, setVista] = useState<Vista>('inicio');
  const [privado, setPrivado] = useState<string | null>(null);
  const [cargandoPrivado, setCargandoPrivado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copiarPublico = async () => {
    if (urlPublica && (await copiarTexto(urlPublica))) avisar('Enlace copiado');
  };

  /** Pide el link privado (y lo crea si no había) y lo copia. Si el navegador no deja copiar después de esperar, queda a la vista con su botón. */
  const copiarPrivado = async (regenerar = false) => {
    if (regenerar) {
      const ok = await confirmar({ titulo: 'Regenerar enlace', texto: 'El enlace anterior deja de funcionar.', boton: 'Regenerar', peligro: false });
      if (!ok) return;
    }
    setCargandoPrivado(true);
    setError(null);
    const r = await pedir<'vistaPrevia'>({ accion: 'vistaPrevia', id: docId, regenerar });
    setCargandoPrivado(false);
    if (!r.ok) { setError(r.error); return; }
    setPrivado(r.url);
    if (await copiarTexto(r.url)) avisar(regenerar ? 'Enlace regenerado' : 'Enlace copiado');
  };

  const cabecera = (titulo: string, volver: boolean) => (
    <div className="gmp-cp-cab">
      {volver && (
        <button type="button" className="gmp-x" aria-label="Volver" onClick={() => { setVista('inicio'); setError(null); }}>
          <Ico n="flecha-izquierda" t={18} />
        </button>
      )}
      <h2 className="gmp-cp-tit">{titulo}</h2>
      <button type="button" className="gmp-x" aria-label="Cerrar" onClick={cerrar}><Ico n="cerrar" t={18} /></button>
    </div>
  );

  const atajo = (icono: string, texto: string, onClick: () => void) => (
    <button type="button" className="gmp-cp-atajo" onClick={onClick}>
      <span className="gmp-cp-circ"><Ico n={icono} t={20} /></span>
      {texto}
    </button>
  );

  let cuerpo: ReactNode;
  if (vista === 'descargar') {
    cuerpo = <>{cabecera('Descargar', true)}<CuerpoExportar /></>;
  } else if (vista === 'privado') {
    cuerpo = (
      <>
        {cabecera('Enlace privado', true)}
        <p className="gmp-cp-nota">Muestra lo guardado, sin publicar.</p>
        {privado && <span className="gmp-cp-url" title={privado}>{privado.replace(/^https?:\/\//, '')}</span>}
        <div className="gmp-cp-fila">
          <button type="button" className="gmp-btn gmp-btn-primario gmp-btn-ancho" disabled={cargandoPrivado}
            onClick={() => void (privado ? copiarTexto(privado).then((ok) => { if (ok) avisar('Enlace copiado'); }) : copiarPrivado())}>
            {cargandoPrivado ? <Giro chico /> : <Ico n="copiar" t={16} />}Copiar enlace
          </button>
          <button type="button" className="gmp-btn gmp-btn-contorno gmp-btn-ancho" disabled={cargandoPrivado} onClick={() => void copiarPrivado(true)}>
            Regenerar
          </button>
        </div>
        {error && <p className="gmp-error" role="alert">{error}<ReportarASoporte /></p>}
      </>
    );
  } else {
    cuerpo = (
      <>
        {cabecera('Compartir', false)}
        <span className="gmp-cp-rot">Enlace público</span>
        {urlPublica ? (
          <>
            <span className="gmp-cp-url" title={urlPublica}>{urlPublica.replace(/^https?:\/\//, '')}</span>
            <button type="button" className="gmp-btn gmp-btn-primario gmp-btn-ancho" onClick={() => void copiarPublico()}>
              <Ico n="copiar" t={16} />Copiar enlace
            </button>
            {cambiosSinPublicar && (
              <div className="gmp-cp-cambios">
                <span>Tienes cambios sin publicar</span>
                <button type="button" className="gmp-btn gmp-btn-secundario gmp-btn-chico" onClick={() => setDialogo('publicar')}>Actualizar</button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="gmp-cp-nota">Todavía no está publicada.</p>
            <button type="button" className="gmp-btn gmp-btn-primario gmp-btn-ancho" onClick={() => setDialogo('publicar')}>
              <Ico n="globo" t={16} />Publicar
            </button>
          </>
        )}
        <div className="gmp-cp-atajos">
          {atajo('descargar', 'Descargar', () => setVista('descargar'))}
          {atajo('ojo', 'Vista previa', () => { cerrar(); onVistaPrevia?.(); })}
          {atajo('enlace', 'Enlace privado', () => setVista('privado'))}
          {atajo('presentar', 'Presentar', () => setDialogo('presentar'))}
        </div>
      </>
    );
  }

  return (
    <Flotante ancla={ancla} onCerrar={cerrar} alinear="fin" rol="dialog" etiqueta="Compartir" className="gmp gmp-cp">
      <EstilosGmp extra={{ href: 'gmp-compartir', css: CSS_COMPARTIR }} />
      {cuerpo}
      {nodoConfirma}
    </Flotante>
  );
}

export default DialogoCompartir;

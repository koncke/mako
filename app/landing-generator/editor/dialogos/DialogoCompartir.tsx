'use client';

// =============================================================================
// DialogoCompartir — el modal «Compartir» de Gamma (pestañas Compartir · Exportar)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Copia del modal de Gamma
// (gamma-ui.md §6.1): título «Compartir {título}», las pestañas en píldora con la activa en azul
// claro, el botón «Publicar en el sitio…» a la derecha del título, y el pie con «Ver análisis» y
// [Listo].
//
// Pestaña Compartir:
//   · El enlace público (si está publicada) con «Copiar enlace»; si no, «Esta página aún no se
//     ha publicado» y el camino a Publicar.
//   · El enlace PRIVADO al borrador (`{accion:'vistaPrevia'}`): lo guardado, sin publicar, sin
//     Pixel y `noindex`. «Regenerar» revoca el anterior (el server pisa el token): quien tenía
//     el viejo deja de entrar, por eso pregunta antes.
//   · Quién puede editar: el equipo del workspace, en una línea.
// Pestaña Exportar: `CuerpoExportar` (DialogoExportar.tsx).
//
// Lo que NO se copia de Gamma, y por qué:
//   · «Colaborar» (invitar por correo, permisos por persona): el editor lo usa el equipo del
//     workspace con los roles de MaKo; no hay invitados externos a una landing.
//   · «Insertar» (copiar el iframe): `X-Frame-Options: DENY` es de toda la app (D4).
//   · Acceso general «cualquiera con el enlace puede editar/comentar»: el link público sólo se ve.
// =============================================================================

import { useState } from 'react';
import { useEditorLanding } from '../contexto';
import { CuerpoExportar } from './DialogoExportar';
import { EstilosGmp, Giro, Icono, ModalGma, Pestanas, copiarTexto, pedir, useConfirmaGma, useFijo } from './piezas-gma';

const CSS_COMPARTIR = [
  '.gmp-comp-bloque{display:grid;gap:8px;padding:14px 0;border-bottom:1px solid var(--gmp-borde)}',
  '.gmp-comp-bloque:last-child{border-bottom:0}',
  '.gmp-comp-tit{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--gmp-tinta)}',
  '.gmp-comp-fila{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.gmp-comp-url{flex:1;min-width:180px;display:flex;align-items:center;height:36px;padding:0 12px;border:1px solid var(--gmp-borde);border-radius:6px;background:var(--gmp-suave);color:var(--gmp-tinta);font-size:13.5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
  '.gmp-comp-persona{display:flex;align-items:center;gap:10px}',
  '.gmp-comp-avatar{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',
  '.gmp-comp-rol{margin-left:auto;font-size:13px;color:var(--gmp-tenue)}',
].join('\n');

type Pestana = 'compartir' | 'exportar';

export function DialogoCompartir({ onCerrar }: { onCerrar?: () => void } = {}) {
  const { dialogo } = useEditorLanding();
  if (dialogo !== 'compartir') return null;
  return <DialogoCompartirAbierto onCerrar={onCerrar} />;
}

function DialogoCompartirAbierto({ onCerrar }: { onCerrar?: () => void }) {
  const { docId, titulo, urlPublica, setDialogo, avisar } = useEditorLanding();
  const { confirmar, nodoConfirma } = useConfirmaGma();
  const cerrar = useFijo(() => (onCerrar ? onCerrar() : setDialogo(null)));
  const [pestana, setPestana] = useState<Pestana>('compartir');
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

  return (
    <ModalGma
      titulo={`Compartir ${titulo || 'landing'}`}
      icono={<Icono nombre="compartir" tam={22} style={{ color: 'var(--gmp-titulo)' }} />}
      onCerrar={cerrar}
      ancho={640}
      alto="min(88vh, 720px)"
      cabecera={(
        <button type="button" className="gmp-btn gmp-btn-contorno" onClick={() => setDialogo('publicar')}>
          <Icono nombre="globo" tam={14} />Publicar en el sitio…
        </button>
      )}
      pie={(
        <>
          <button type="button" className="gmp-btn gmp-btn-fantasma" onClick={() => setDialogo('analitica')}><Icono nombre="grafico" tam={15} />Ver análisis</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="gmp-btn gmp-btn-primario" onClick={cerrar}>Listo</button>
        </>
      )}>
      <EstilosGmp extra={{ href: 'gmp-compartir', css: CSS_COMPARTIR }} />
      <div style={{ marginBottom: 6 }}>
        <Pestanas etiqueta="Compartir" valor={pestana} onCambiar={setPestana}
          opciones={[{ valor: 'compartir', texto: 'Compartir', icono: 'globo' }, { valor: 'exportar', texto: 'Exportar', icono: 'descargar' }]} />
      </div>

      {pestana === 'exportar' ? <div style={{ paddingTop: 10 }}><CuerpoExportar /></div> : (
        <>
          <div className="gmp-comp-bloque">
            <div className="gmp-comp-tit"><Icono nombre="globo" tam={16} />Enlace público</div>
            {urlPublica ? (
              <div className="gmp-comp-fila">
                <span className="gmp-comp-url" title={urlPublica}>{urlPublica.replace(/^https?:\/\//, '')}</span>
                <button type="button" className="gmp-btn gmp-btn-secundario" onClick={() => void copiarPublico()}><Icono nombre="copiar" tam={14} />Copiar enlace</button>
              </div>
            ) : (
              <div className="gmp-comp-fila">
                <span className="gmp-ayuda" style={{ flex: 1 }}>Esta página aún no se ha publicado</span>
                <button type="button" className="gmp-btn gmp-btn-primario gmp-btn-chico" onClick={() => setDialogo('publicar')}>Publicar</button>
              </div>
            )}
          </div>

          <div className="gmp-comp-bloque">
            <div className="gmp-comp-tit"><Icono nombre="enlace" tam={16} />Vista previa privada</div>
            <div className="gmp-comp-fila">
              {privado ? <span className="gmp-comp-url" title={privado}>{privado.replace(/^https?:\/\//, '')}</span> : <span className="gmp-ayuda" style={{ flex: 1 }}>Lo guardado, sin publicar.</span>}
              <button type="button" className="gmp-btn gmp-btn-secundario" disabled={cargandoPrivado}
                onClick={() => void (privado ? copiarTexto(privado).then((ok) => { if (ok) avisar('Enlace copiado'); }) : copiarPrivado())}>
                {cargandoPrivado ? <Giro chico /> : <Icono nombre="copiar" tam={14} />}Copiar enlace privado
              </button>
              <button type="button" className="gmp-btn gmp-btn-fantasma gmp-btn-chico" disabled={cargandoPrivado} onClick={() => void copiarPrivado(true)}>
                <Icono nombre="restablecer" tam={14} />Regenerar
              </button>
            </div>
            {error && <p className="gmp-error" role="alert">{error}</p>}
          </div>

          <div className="gmp-comp-bloque">
            <div className="gmp-comp-tit"><Icono nombre="usuarios" tam={16} />Quién puede editar</div>
            <div className="gmp-comp-persona">
              <span className="gmp-comp-avatar"><Icono nombre="usuarios" tam={16} /></span>
              <span className="gmp-fila-tit">Miembros del espacio de trabajo</span>
              <span className="gmp-comp-rol">Pueden editar</span>
            </div>
          </div>
        </>
      )}
      {nodoConfirma}
    </ModalGma>
  );
}

export default DialogoCompartir;

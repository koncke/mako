'use client';

// =============================================================================
// CriterioPanel — el criterio de compromisos que MaKo aplica a cada reunión
// =============================================================================
// Un textarea y un botón. Lo que hace caro a este panel no es la pantalla: es que
// hasta hoy el criterio NO SE PODÍA CARGAR desde ningún lado (ver criterio-actions.ts).
//
// El texto que se dibuja es corto a propósito. El porqué de cada regla vive en el
// criterio mismo, que es justamente lo que se edita acá.
//
// En el molde de Settings desde el 25/10/2026 (copiado de Linear, docs/settings/referencia.md): el panel es el CUERPO de la
// tarjeta «Criterio de reuniones» de la página General (que pone el título); se fue el párrafo que explicaba la pantalla. Es
// el único dato de Settings con «Guardar»: un texto de hasta 24.000 caracteres no se guarda a cada salida del campo.

import { useEffect, useRef, useState } from 'react';
import { getCriterioAction, saveCriterioAction } from './criterio-actions';
import { CuerpoGrupo } from '@/app/_ui/Ajustes';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const MONO = "'Geist Mono', monospace";

export function CriterioPanel() {
  const [texto, setTexto] = useState('');
  const [tope, setTope] = useState(24000);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  // Lo guardado, para saber si hay cambios sin guardar. Un botón que se puede apretar
  // sobre un texto idéntico al guardado no dice nada de si hay algo por hacer.
  const guardado = useRef('');

  useEffect(() => {
    let vivo = true;
    getCriterioAction()
      .then((d) => { if (!vivo) return; setTexto(d.texto); guardado.current = d.texto; setTope(d.tope); })
      .catch(() => { if (vivo) setAviso('No pude leer el criterio.'); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  const sucio = texto !== guardado.current;

  async function guardar() {
    setGuardando(true);
    setAviso('');
    const r = await saveCriterioAction(texto).catch(() => ({ ok: false, error: 'No se pudo guardar.' }));
    setGuardando(false);
    if (!r.ok) { setAviso(r.error || 'No se pudo guardar.'); return; }
    guardado.current = texto;
    setAviso('Guardado');
  }

  if (cargando) return <CuerpoGrupo><p className="aj-texto" style={{ margin: 0 }}>Cargando…</p></CuerpoGrupo>;

  return (
    <CuerpoGrupo>
      <textarea
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAviso(''); }}
        spellCheck={false}
        aria-label="Criterio de reuniones"
        placeholder="Qué cuenta como compromiso, qué no, y con qué reglas."
        className="aj-campo"
        style={{ height: 'auto', minHeight: 360, resize: 'vertical', padding: 12, background: 'var(--surface-2)', fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6 }}
      />
      <div className="aj-acciones" style={{ marginTop: 12 }}>
        <button type="button" className="aj-boton" onClick={guardar} disabled={guardando || !sucio}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <span style={{ fontSize: 12, color: texto.length > tope ? 'var(--bad)' : 'var(--faint)', fontFamily: MONO }}>
          {texto.length.toLocaleString('es')} / {tope.toLocaleString('es')}
        </span>
        {aviso === 'Guardado' && <span role="status" style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>Guardado</span>}
        {aviso && aviso !== 'Guardado' && <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{aviso}<ReportarASoporte /></span>}
      </div>
    </CuerpoGrupo>
  );
}

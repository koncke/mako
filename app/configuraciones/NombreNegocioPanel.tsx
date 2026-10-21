'use client';

// =============================================================================
// NombreNegocioPanel — el nombre del negocio, editable por su admin (21/10/2026)
// =============================================================================
// Florencia (ws21) no podía cambiarlo en ningún lado (lib/nombre-negocio.ts). Lo guarda negocio-actions.ts; sin ser admin
// se ve y no se edita (la acción lo corta igual).

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/app/_ui/Button';
import { TextField } from '@/app/_ui/Field';
import { GrupoAjustes, CuerpoGrupo } from '@/app/_ui/Ajustes';
import { NOMBRE_NEGOCIO_MAX } from '@/lib/nombre-negocio';
import { guardarNombreNegocioAction, nombreDelNegocioAction } from './negocio-actions';

export function NombreNegocioPanel() {
  const [guardado, setGuardado] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let vivo = true;
    nombreDelNegocioAction().then((r) => {
      if (!vivo) return;
      setGuardado(r.nombre ?? '');
      setNombre(r.nombre ?? '');
      setPuedeEditar(r.puedeEditar);
    }).catch(() => { if (vivo) setGuardado(''); });
    return () => { vivo = false; };
  }, []);

  const guardar = () => {
    setAviso(null);
    start(async () => {
      const r = await guardarNombreNegocioAction(nombre);
      if (r.ok) { setGuardado(r.nombre); setNombre(r.nombre); setAviso({ ok: true, texto: 'Nombre guardado' }); }
      else setAviso({ ok: false, texto: r.error });
    });
  };

  const cambio = guardado != null && nombre.trim() !== guardado;
  return (
    <GrupoAjustes titulo="Nombre del negocio" descripcion="El que ven tu equipo, tus clientes y MaKo.">
      <CuerpoGrupo>
        <TextField label="Nombre del negocio" value={nombre} maxLength={NOMBRE_NEGOCIO_MAX} placeholder={guardado == null ? 'Cargando…' : ''}
          onChange={(e) => setNombre(e.target.value)} disabled={guardado == null || !puedeEditar || pending}
          onKeyDown={(e) => { if (e.key === 'Enter' && cambio && !pending) guardar(); }} />
        {puedeEditar && (
          <div style={{ marginTop: 10 }}>
            <Button variant="primary" onClick={guardar} disabled={!cambio || pending} loading={pending}>Guardar</Button>
          </div>
        )}
        {!puedeEditar && guardado != null && <p className="aj-texto" style={{ margin: '8px 0 0' }}>Lo cambia quien administra el negocio.</p>}
        {aviso && <p className="aj-texto" role="status" style={{ margin: '8px 0 0', color: aviso.ok ? 'var(--good)' : 'var(--bad)' }}>{aviso.texto}</p>}
      </CuerpoGrupo>
    </GrupoAjustes>
  );
}

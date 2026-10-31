'use client';

// =============================================================================
// NombresModal — «Nombres de tus leads»: cómo los saluda MaKo, y qué palabra no es un nombre (31/10/2026)
// =============================================================================
// Leila (30/10) guarda «Kun Fabiola Pedraza»: que «Kun» es un lugar sólo lo sabe ella. Se listan las primeras palabras que se repiten, con un
// ejemplo de cómo sale el saludo, y se marca. Lo que ya se salta solo (MX, PERÚ) se dice, no se pregunta. No toca ningún lead: el nombre sigue
// como está guardado, cambia cómo se saluda. Reglas: lib/nombre-partes.ts.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { Modal, Switch } from '@/app/_ui';
import { BarraCargando } from '@/app/_ui/CargandoMako';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { ResumenNombres } from '@/lib/nombre-partes';
import { leerNombresAction, marcarPalabraAction } from './nombres-actions';
import { miles } from './traer-seleccion';

const SANS = "'Geist', sans-serif";
const nota: CSSProperties = { margin: 0, fontSize: 13.5, color: 'var(--dim)', fontFamily: SANS, lineHeight: 1.45 };

export function NombresModal({ onCerrar }: { onCerrar: () => void }) {
  const [r, setR] = useState<ResumenNombres | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void leerNombresAction().then((x) => { if (vivo) { if (x.ok) setR(x.resumen); else setErr(x.error); } })
      .catch(() => { if (vivo) setErr('No pude leer los nombres.'); });
    return () => { vivo = false; };
  }, []);

  const marcar = (palabra: string, noEs: boolean) => {
    setMarcando(palabra); setErr(null);
    void marcarPalabraAction(palabra, noEs).then((x) => { if (x.ok) setR(x.resumen); else setErr(x.error); })
      .catch(() => setErr('No pude guardarlo.')).finally(() => setMarcando(null));
  };

  return (
    <Modal titulo="Nombres de tus leads" ancho={600} onCerrar={onCerrar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: SANS }}>
        {err && <p role="alert" style={{ ...nota, color: 'var(--bad)' }}>{err}<ReportarASoporte /></p>}
        {!r && !err && <BarraCargando que="los nombres" />}
        {r && (
          <>
            <p style={nota}>
              {r.sinNombre > 0
                ? `De ${miles(r.total)} leads, a ${miles(r.sinNombre)} no se les puede saber el nombre: su mensaje sale sin nombre.`
                : `Los ${miles(r.total)} leads tienen un nombre para saludar.`}
            </p>
            {r.repetidas.length === 0 && <p style={nota}>No hay palabras que se repitan al principio de los nombres.</p>}
            {r.repetidas.length > 0 && (
              <>
                <p style={{ ...nota, fontWeight: 600, color: 'var(--ink)' }}>Marca la que no sea un nombre</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {r.repetidas.map((p) => (
                    <div key={p.palabra} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 2px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.palabra} <span style={{ fontWeight: 400, color: 'var(--faint)' }}>· {miles(p.n)}</span></div>
                        <div style={{ fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.ejemploDe} → {p.ejemploA ? `Hola ${p.ejemploA}` : 'sin nombre'}
                        </div>
                      </div>
                      {p.automatica
                        ? <span style={{ flex: 'none', fontSize: 12.5, color: 'var(--faint)' }}>Se salta sola</span>
                        : <Switch checked={p.noEs} disabled={marcando != null} onChange={(v: boolean) => marcar(p.palabra, v)} label="No es un nombre" />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

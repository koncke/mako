'use client';

// =============================================================================
// ConfigClarity — el paso opcional que va ANTES de copiar el Pixel
// =============================================================================
// Clarity no es una integración aparte para el cliente: es una casilla que
// enciende antes de instalar. Por eso vive dentro del modal del Pixel y no en su
// propia tarjeta — una tarjeta suelta obliga a instalar dos veces y a entender
// que son dos cosas, cuando en la práctica es el mismo <script>.
//
// Y va PRIMERO por una razón concreta: el bloque de Clarity se arma cuando se
// genera el código. Si lo conecta después de pegarlo, el código que tiene puesto
// no lo trae y hay que volver a pegarlo. Poniéndolo antes, se pega una vez.
//
// El texto explica PARA QUÉ sirve, no qué es. «Microsoft Clarity» no le dice nada
// a quien vende cursos; «ver el video de lo que hizo cada persona» sí.

import { useState } from 'react';
import { Button, Input } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';

export function ConfigClarity({ conectado, onListo }: { conectado: boolean; onListo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [token, setToken] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const guardar = async () => {
    setGuardando(true); setErr(null);
    try {
      const r = await fetch('/api/integraciones/credencial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicio: 'clarity',
          valores: { CLARITY_PROJECT_ID: projectId, CLARITY_API_TOKEN: token },
        }),
      }).then((x) => x.json());
      if (!r?.ok) { setErr(r?.error ?? 'No se pudo guardar'); return; }
      setAbierto(false);
      // ⚠️ El código de arriba se REGENERA. El bloque de Clarity se arma en el
      // server con el id recién guardado, así que sin recargar el snippet que la
      // persona copiaría es el de antes — sin Clarity, y sin nada que lo diga.
      onListo();
    } catch { setErr('No se pudo guardar'); }
    finally { setGuardando(false); }
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 13, background: 'var(--surface-2)', padding: '15px 17px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        <span aria-hidden style={{
          flex: 'none', width: 26, height: 26, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: conectado ? 'var(--good)' : 'var(--surface)', border: `1px solid ${conectado ? 'var(--good)' : 'var(--border-strong)'}`,
          color: conectado ? '#fff' : 'var(--dim)',
        }}>
          {conectado ? <Icon name="check" size={14} /> : <Icon name="video" size={14} />}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>
            Grabaciones y mapas de calor <span style={{ fontWeight: 500, color: 'var(--faint)' }}>· opcional</span>
          </div>
          {/* Para QUÉ sirve, no qué es. «Microsoft Clarity» no le dice nada a
              quien vende cursos; «ver el video de lo que hizo cada persona», sí. */}
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.55 }}>
            {conectado
              ? <>Está activo. En la ficha de cada lead vas a ver un botón para <b>mirar la grabación de lo que hizo</b> en tu página antes de dejarte sus datos.</>
              : <>Podemos sumar <b>Microsoft Clarity</b> al mismo código: graba en video lo que hace cada visitante y dibuja dónde hacen clic y hasta dónde bajan.
                 Después, desde la ficha de un lead, abrís <b>su</b> grabación. Es gratis y sin límite de visitas.</>}
          </div>
          {!conectado && !abierto && (
            <div style={{ marginTop: 10 }}>
              <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>Activarlo</Button>
              <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--faint)' }}>o seguí sin esto: el Pixel mide igual.</span>
            </div>
          )}
          {abierto && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>
                Creá un proyecto gratis en <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>clarity.microsoft.com</a> y pegá acá los dos datos.
                El <b>ID del proyecto</b> está en Settings → Overview. El <b>token</b>, en Settings → Data Export.
              </div>
              <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="ID del proyecto (ej.: abc123xyz)" />
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de Data Export" type="password" />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button variant="primary" size="sm" onClick={() => void guardar()} loading={guardando} disabled={!projectId.trim()}>
                  Guardar y sumarlo al código
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setAbierto(false)}>Cancelar</Button>
              </div>
              {/* El token es opcional: sin él funcionan las grabaciones y los
                  mapas —que es el 90% del valor— y solo se pierde el resumen de
                  números dentro de MaKo. Exigirlo frenaría a quien no lo encuentra. */}
              <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                Si no encontrás el token, dejalo vacío: las grabaciones funcionan igual.
              </div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

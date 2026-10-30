'use client';

// =============================================================================
// LineasWhatsApp — la tarjeta de WhatsApp de /integraciones: las líneas por QR y «Agregar línea» (29/10/2026)
// =============================================================================
// Martín: «En Integraciones falta el logo de WhatsApp para que aparezca eso también, con el QR obvio, con las múltiples líneas,
// claro». Las líneas son las del NO oficial (Evolution, `evolution_instancias`): cada una con su número y su estado, y «Agregar
// línea» abre EL MISMO QR de /whatsapp y de Automations (`EvolutionConnect` con `nueva`). No hay otra conexión.
//
// ⚠️ EL ESTADO SE MIDE, NO SE LEE DE LA FILA: la fila de una línea miente en las dos direcciones (app/api/whatsapp/evolution, GET).
//    Se pregunta línea por línea (`?linea=`), y lo que nadie midió se dice como tal («sin comprobar»), nunca como un verde.
// ⚠️ LA LÍNEA DE MaKo (la del grupo, `deMaKo`) no es una línea del negocio: no se lista.
// ⚠️ `soloLectura` (el teléfono): la lista sin «Agregar línea». El QR no se escanea con el mismo teléfono que lo muestra.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Button } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { EvolutionConnect } from '@/app/whatsapp/EvolutionConnect';
import { numeroLegible, textoDeEstado, type MedidaLinea } from '@/lib/lineas-whatsapp-tarjeta';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type LineaApi = { linea: string; rotulo: string; numero: string | null; estado: string; esDefault: boolean; deMaKo?: boolean };
type Medida = MedidaLinea;
export type LineaVista = LineaApi & { medida: Medida };

async function leer(url: string): Promise<{ ok?: boolean; lineas?: LineaApi[]; estado?: string; confirmado?: boolean } | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    return (await r.json()) as { ok?: boolean; lineas?: LineaApi[]; estado?: string; confirmado?: boolean };
  } catch { return null; }
}

export default function LineasWhatsApp({ soloLectura = false, onCambio }: { soloLectura?: boolean; onCambio?: () => void }) {
  const [lineas, setLineas] = useState<LineaVista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await leer('/api/whatsapp/evolution');
    if (!r?.ok || !Array.isArray(r.lineas)) { setError('No pude leer tus líneas de WhatsApp.'); return; }
    setError(null);
    const propias = r.lineas.filter((l) => !l.deMaKo);
    setLineas(propias.map((l) => ({ ...l, medida: null })));
    // Cada línea, medida (el sondeo de la ruta contesta en ~250 ms; con Evolution colgado, 4 s y «sin comprobar»).
    await Promise.all(propias.map(async (l) => {
      const e = await leer(`/api/whatsapp/evolution?linea=${encodeURIComponent(l.linea)}`);
      const medida: Medida = e?.ok && typeof e.estado === 'string' ? { estado: e.estado, confirmado: e.confirmado === true } : { estado: l.estado, confirmado: false };
      setLineas((xs) => (xs ? xs.map((x) => (x.linea === l.linea ? { ...x, medida } : x)) : xs));
    }));
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const caja: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' };

  return (
    <div data-lineas-whatsapp="" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SANS }}>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
        Puedes conectar varias líneas: por ejemplo, una por setter. Cada una se vincula con su QR, desde WhatsApp › Dispositivos vinculados.
      </span>

      {error && <span role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}<ReportarASoporte /></span>}
      {lineas === null && !error && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Cargando tus líneas…</span>}
      {lineas && lineas.length === 0 && !agregando && (
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>Todavía no hay ninguna línea conectada.</span>
      )}

      {lineas && lineas.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lineas.map((l) => {
            const e = textoDeEstado(l);
            const numero = numeroLegible(l.numero);
            return (
              <li key={l.linea} data-linea={l.linea} style={caja}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, flex: 'none', background: e.tono === 'good' ? 'var(--good)' : e.tono === 'warn' ? 'var(--warn)' : 'var(--border-strong)' }} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                    {l.rotulo}{l.esDefault && lineas.length > 1 ? ' · la de por defecto' : ''}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {numero && <span style={{ fontFamily: MONO }}>{numero} · </span>}{e.texto}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!soloLectura && (agregando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* EL MISMO QR de /whatsapp (`nueva`): la línea nace al pedirlo, y el tope del plan lo dice ese panel. */}
          <EvolutionConnect key="nueva-linea" nueva inline panelVisible
            onLineaCreada={() => { setAgregando(false); void cargar(); onCambio?.(); }} />
          <Button size="sm" variant="secondary" onClick={() => setAgregando(false)}>Cancelar</Button>
        </div>
      ) : (
        <Button size="sm" variant={lineas && lineas.length ? 'secondary' : 'primary'} data-agregar-linea="" onClick={() => setAgregando(true)}>
          {lineas && lineas.length ? 'Agregar otra línea' : 'Agregar línea'}
        </Button>
      ))}
    </div>
  );
}

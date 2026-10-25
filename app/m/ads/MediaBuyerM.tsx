'use client';

// =============================================================================
// /m/ads — el Media Buyer en el teléfono, con la estructura de AdAmigo (25/10/2026)
// =============================================================================
// El teléfono DESTILA la computadora (memoria «mako-mobile»): las MISMAS piezas (app/ads-manager/Autopilot.tsx), en una
// columna. Arriba «Te preparé N acciones nuevas para hoy», las alertas de Protect, «Hoy · Hechas», cada acción con su
// Qué · Por qué · Impacto esperado y «Aplicar» a lo ancho, al alcance del pulgar, y al final la cuenta del mes.
// Lo que en el teléfono no entra (el lienzo, la Biblioteca, los agentes) queda en la computadora. «Preguntar» abre el chat
// de MaKo del teléfono. Lo que escribe es lo de la computadora: POST /api/media-buyer (lib/media-buyer/ejecutar.ts).
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { useToastM } from '@/app/m/_ui';
import type { ConfigMediaBuyer, Decision, MetasDelMes } from '@/lib/media-buyer/tipos';
import type { Alerta } from '@/lib/media-buyer/protect';
import { productoDeAccion } from '@/lib/media-buyer/productos';
import { AlertasProtect, CabeceraHoy, Nada, PanelCuenta, TarjetaAccion } from '@/app/ads-manager/Autopilot';
import { hace } from '@/app/ads-manager/mb-modelo';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; ultimaCorridaInfo?: Record<string, unknown> | null; existeTabla: boolean };

async function api(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; ajuste?: string | null }> {
  try {
    const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Sin conexión.' };
  }
}

export function MediaBuyerM({ config, decisiones, puedeOperar, metas, productoDe }: {
  config: Config;
  decisiones: Decision[];
  puedeOperar: boolean;
  metas: MetasDelMes | null;
  productoDe: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToastM();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [ver, setVer] = useState<'hoy' | 'hechas'>('hoy');

  const hoy = useMemo(() => decisiones.filter((d) => d.estado === 'abierta' || d.estado === 'bloqueada' || d.estado === 'fallida'), [decisiones]);
  const hechas = useMemo(() => decisiones.filter((d) => d.estado === 'aplicada' || d.estado === 'deshecha')
    .sort((a, b) => ((b.aplicadaAt ?? '') < (a.aplicadaAt ?? '') ? -1 : 1)), [decisiones]);
  const aplicadasHoy = hechas.filter((d) => d.aplicadaAt && new Date(d.aplicadaAt).toDateString() === new Date().toDateString()).length;
  const alertas = useMemo(() => {
    const a = (config.ultimaCorridaInfo as { alertas?: unknown } | null | undefined)?.alertas;
    return Array.isArray(a) ? (a as Alerta[]).filter((x) => x && typeof x.titulo === 'string') : [];
  }, [config.ultimaCorridaInfo]);

  const accion = useCallback(async (d: Decision, body: Record<string, unknown>, ok: string) => {
    setOcupada(d.id);
    const r = await api({ ...body, id: d.id });
    setOcupada(null);
    if (r.ok) toast(r.ajuste ? `${ok}. ${r.ajuste}` : ok);
    else toast(r.error ?? 'No se pudo.', { error: true });
    router.refresh();
    return r.ok;
  }, [router, toast]);

  const lista = ver === 'hoy' ? hoy : hechas;
  return (
    <div className="aa aa-m">
      <CabeceraHoy pendientes={hoy.length} aplicadasHoy={aplicadasHoy} ajustesHref="/ads-manager/ajustes"
        actualizado={config.ultimaCorrida ? `Miré tu cuenta ${hace(config.ultimaCorrida)}` : 'Todavía no miré tu cuenta'}
        alertasGraves={alertas.filter((a) => a.gravedad === 'alta').length} />
      {!config.encendido && <Nada>El Media Buyer está apagado. Préndelo desde la computadora.</Nada>}
      {!puedeOperar && <Nada>Estás mirando otro negocio: para aplicar, entra con el tuyo.</Nada>}
      <AlertasProtect alertas={alertas} onPreguntar={() => router.push('/m/mako')} />
      <nav className="aa-sub" role="tablist" aria-label="Acciones">
        <button type="button" role="tab" aria-selected={ver === 'hoy'} onClick={() => setVer('hoy')}>Hoy{hoy.length > 0 && <small>{hoy.length}</small>}</button>
        <button type="button" role="tab" aria-selected={ver === 'hechas'} onClick={() => setVer('hechas')}>Hechas{hechas.length > 0 && <small>{hechas.length}</small>}</button>
      </nav>
      {lista.length === 0
        ? <Nada>{ver === 'hoy' ? 'Nada para aprobar hoy.' : 'Todavía no apliqué nada.'}</Nada>
        : (
          <div className="aa-lista" style={{ marginTop: 14 }}>
            {lista.map((d) => (
              <TarjetaAccion key={d.id} d={d} kpi={config.kpi} producto={productoDeAccion(productoDe, d)} ocupada={ocupada === d.id}
                encendido={config.encendido && puedeOperar} ajustesHref="/ads-manager/ajustes"
                onAplicar={(extra) => accion(d, { op: 'lanzar', ...extra }, d.tipo.startsWith('variaciones') ? 'Anuncios creados' : 'Aplicada')}
                onBorrar={() => void accion(d, { op: 'descartar' }, 'Descartada')}
                onPreguntar={() => router.push('/m/mako')}
                onDeshacer={() => void accion(d, { op: 'deshacer' }, 'Deshecha')}
                onReabrir={() => void accion(d, { op: 'reabrir' }, 'Abierta otra vez')}
                onCalificar={(n) => void accion(d, { op: 'calificar', estrellas: n }, 'Gracias')}
                onHooksAVideo={(elegidas) => void accion(d, { op: 'hooks_a_video', elegidas }, 'En Video Generator')} />
            ))}
          </div>
        )}
      {metas && <div style={{ marginTop: 18 }}><PanelCuenta metas={metas} kpi={config.kpi} objetivo={config.objetivo} productos={[]} /></div>}
    </div>
  );
}

'use client';

// =============================================================================
// /m/ads — el Media Buyer en el teléfono: la captura 04 de AdAmigo en una columna (25/10/2026 noche)
// =============================================================================
// El teléfono DESTILA la computadora (memoria «mako-mobile»): el MISMO árbol (app/ads-manager/Arbol.tsx), con la línea a la
// izquierda y las tarjetas una debajo de la otra. Arriba, la caja para pedirle algo a MaKo (abre su chat del teléfono); al
// tocar una tarjeta, su detalle en la hoja de MaKo Mobile (la tarjeta entera, con el porqué y sus botones). Lo que en el
// teléfono no entra (Campañas, la Biblioteca, los agentes) queda en la computadora.
// Lo que escribe es lo de la computadora: POST /api/media-buyer (lib/media-buyer/ejecutar.ts).
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { SheetM, useToastM } from '@/app/m/_ui';
import { Criatura } from '@/app/_components/Criatura';
import { MiFoto } from '@/app/admin/operaciones/MiFoto';
import type { ConfigMediaBuyer, Decision } from '@/lib/media-buyer/tipos';
import { productoDeAccion } from '@/lib/media-buyer/productos';
import { ArbolDeHoy } from '@/app/ads-manager/Arbol';
import { TarjetaAccion } from '@/app/ads-manager/Autopilot';
import { aplicablesEnLote, deHoy, resultadoAplicar, type ResultadoAplicar } from '@/app/ads-manager/mb-modelo';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; ultimaCorridaInfo?: Record<string, unknown> | null; existeTabla: boolean };

async function api(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; ajuste?: string | null; confirmar?: string }> {
  try {
    const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Sin conexión.' };
  }
}

export function MediaBuyerM({ config, decisiones, puedeOperar, productoDe }: {
  config: Config;
  decisiones: Decision[];
  puedeOperar: boolean;
  productoDe: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToastM();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aplicandoTodas, setAplicandoTodas] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const hoy = useMemo(() => deHoy(decisiones), [decisiones]);
  const detalle = abierta ? decisiones.find((d) => d.id === abierta) ?? null : null;
  const producto = (d: Decision) => productoDeAccion(productoDe, d);
  const puede = config.encendido && puedeOperar;

  const accion = useCallback(async (d: Decision, body: Record<string, unknown>, ok: string): Promise<ResultadoAplicar> => {
    setOcupada(d.id);
    const r = await api({ ...body, id: d.id });
    setOcupada(null);
    // Una baja de 80% o más vuelve como «confírmalo»: la pregunta la hace la tarjeta (sin aviso ni recarga).
    const res = resultadoAplicar(r);
    if (typeof res === 'object') return res;
    if (r.ok) toast(r.ajuste ? `${ok}. ${r.ajuste}` : ok);
    else toast(r.error ?? 'No se pudo.', { error: true });
    router.refresh();
    return r.ok;
  }, [router, toast]);
  const aplicar = (d: Decision, extra: Record<string, unknown> = {}) => accion(d, { op: 'lanzar', ...extra }, d.tipo.startsWith('variaciones') ? 'Anuncios creados' : 'Aplicado');
  const aplicarTodas = async () => {
    setAplicandoTodas(true);
    const avisos: string[] = [];
    for (const d of aplicablesEnLote(hoy)) {
      const r = await api({ op: 'lanzar', id: d.id });
      if (r.ok && r.ajuste) avisos.push(`«${d.entidadNombre}»: ${r.ajuste}`);
      if (!r.ok) avisos.push(`«${d.entidadNombre}»: ${r.error ?? 'no se pudo'}`);
    }
    setAplicandoTodas(false);
    toast(avisos.length ? avisos.join(' · ') : 'Cambios aplicados', avisos.length ? { error: true } : undefined);
    router.refresh();
  };

  return (
    <div className="aa aa-m">
      <button type="button" className="aa-orden-m" onClick={() => router.push('/m/mako')}><MiFoto size={30} /><span>Pídele algo a MaKo</span></button>
      {hoy.length
        ? <ArbolDeHoy decisiones={hoy} productoDe={producto} kpi={config.kpi} ocupada={ocupada} encendido={puede}
            avatar={<Criatura nombre="MaKo" size={18} estrella />} aplicandoTodas={aplicandoTodas}
            onAbrir={(d) => setAbierta(d.id)} onAplicar={(d) => void aplicar(d)} onAplicarTodas={() => void aplicarTodas()} />
        : (
          <section className="aa-nuevo">
            <Criatura nombre="MaKo" size={40} estrella />
            <h1>Hoy no hay cambios</h1>
            <p>{!config.encendido ? 'Estoy apagado: préndeme desde la computadora.' : 'Todo anda dentro de tu objetivo. Vuelvo a mirar mañana.'}</p>
          </section>
        )}
      {!puedeOperar && <p className="aa-m-nota">Estás mirando otro negocio: para aplicar, entra con el tuyo.</p>}
      <SheetM abierto={!!detalle} onCerrar={() => setAbierta(null)} titulo={detalle?.entidadNombre ?? ''} snap="alto" id="cambio">
        {detalle && (
          <div className="aa aa-hoja">
            <TarjetaAccion d={detalle} kpi={config.kpi} producto={producto(detalle)} ocupada={ocupada === detalle.id} encendido={puede}
              ajustesHref="/ads-manager/ajustes"
              onAplicar={async (extra) => { const r = await aplicar(detalle, extra); if (r === true) setAbierta(null); return r; }}
              onBorrar={() => { void accion(detalle, { op: 'descartar' }, 'Descartado'); setAbierta(null); }}
              onPreguntar={() => router.push('/m/mako')}
              onDeshacer={() => void accion(detalle, { op: 'deshacer' }, 'Deshecho')}
              onReabrir={() => void accion(detalle, { op: 'reabrir' }, 'Abierto otra vez')}
              onCalificar={(n) => void accion(detalle, { op: 'calificar', estrellas: n }, 'Gracias')}
              onHooksAVideo={(elegidas) => void accion(detalle, { op: 'hooks_a_video', elegidas }, 'En Video Generator')} />
          </div>
        )}
      </SheetM>
    </div>
  );
}

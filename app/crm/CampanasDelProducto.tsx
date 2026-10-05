'use client';

// =============================================================================
// CampanasDelProducto — qué campañas y conjuntos de Meta entran a ESTE producto
// =============================================================================
// Vive adentro de la tarjeta de «Lead entrante» del pop-up del embudo, debajo de
// «¿cómo entra tu gente?». Pedido de Martín (05/10/2026): «la configuración de la
// primera etapa en todo funnel de "Leads entrantes", que se pueda tener un
// desplegable o algo para seleccionar las campañas que deberían caer allí».
//
// CADA CAMBIO ES UNA OPERACIÓN, no un «Guardar», igual que el resto del pop-up: elegir
// una campaña la asigna en el momento y la ✕ la saca. «¿Cómo entra tu gente?» sí tiene
// su botón, porque es una DECLARACIÓN de varias casillas que se piensa junta; una
// campaña se asigna sola.
//
// Lo que hace con los leads lo decide lib/campana-funnel.ts, y lo que NO hace está
// dicho ahí: no MUEVE a un lead que ya existe.
// =============================================================================

import { useEffect, useState } from 'react';
import { Confirm, Spinner, SANS } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { asignadasDe, type CampanaAsignada } from '@/lib/campana-config';
import {
  campanasDelProductoAction, asignarCampanaAction, quitarCampanaAction,
  type EstadoCampanas,
} from './campanas-actions';

/** Lo que dice Meta de cada estado, en una palabra. Lo que no está acá se muestra
 *  tal cual, en minúscula: inventarle una traducción a un estado nuevo es peor. */
const ESTADO: Record<string, string> = {
  ACTIVE: 'Activa', PAUSED: 'Pausada', CAMPAIGN_PAUSED: 'Campaña pausada', ADSET_PAUSED: 'Conjunto pausado',
  IN_PROCESS: 'En proceso', WITH_ISSUES: 'Con problemas', PENDING_REVIEW: 'En revisión', DISAPPROVED: 'Rechazada',
  PREAPPROVED: 'Preaprobada', PENDING_BILLING_INFO: 'Falta el pago',
};
const estadoTxt = (e: string) => ESTADO[e] ?? e.toLowerCase().replace(/_/g, ' ');

/** Archivada o borrada no trae leads nuevos: asignarla no haría nada, así que no se
 *  ofrece. Si YA estaba asignada se sigue mostrando, para poder sacarla. */
const MUERTA = new Set(['ARCHIVED', 'DELETED']);

type Pide = { item: { tipo: 'campana' | 'conjunto'; id: string; nombre: string; campanaId?: string }; desde: string };

export function CampanasDelProducto({ funnelId, nombreProducto }: {
  /** El embudo de este pop-up. `null` = el del negocio. */
  funnelId: number | null;
  nombreProducto: string;
}) {
  const [estado, setEstado] = useState<EstadoCampanas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [pide, setPide] = useState<Pide | null>(null);

  useEffect(() => {
    let vivo = true;
    campanasDelProductoAction().then((r) => {
      if (!vivo) return;
      if (r.ok) setEstado(r); else setError(r.error);
    }).catch(() => { if (vivo) setError('No se pudo leer'); });
    return () => { vivo = false; };
  }, []);

  // ⚠️ El giro, no un «Cargando…» escrito: un texto no dice que algo está pasando, dice
  // que algo dice que está pasando (AGENTS.md).
  if (!estado && !error) return <div style={{ padding: '14px 0 4px' }}><Spinner size={16} /></div>;
  if (!estado) return <p style={{ margin: '14px 0 0', fontSize: 12.5, color: 'var(--bad)' }}>{error}</p>;

  const mias = asignadasDe(estado.asignadas, funnelId);
  const nombreDe = (id: number | null) => estado.productos.find((p) => p.id === id)?.nombre ?? 'otro producto';
  const enOtro = new Map(estado.asignadas.filter((a) => a.funnelId !== funnelId).map((a) => [a.id, a.funnelId]));
  const vivaEnMeta = new Set([...estado.campanas.map((c) => c.id), ...estado.conjuntos.map((c) => c.id)]);
  const campanaPorId = new Map(estado.campanas.map((c) => [c.id, c]));

  const aplicar = async (fn: () => Promise<{ ok: true; asignadas: CampanaAsignada[] } | { ok: false; error: string }>) => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await fn();
      if (r.ok) setEstado({ ...estado, asignadas: r.asignadas }); else setError(r.error);
    } catch {
      setError('No se pudo guardar');
    }
    setTrabajando(false);
  };

  const asignar = (item: Pide['item']) => void aplicar(() => asignarCampanaAction(funnelId, item));
  const quitar = (id: string) => void aplicar(() => quitarCampanaAction(id));

  // ── Las opciones: cada campaña y, debajo, sus conjuntos ───────────────────
  // Lista plana con búsqueda (el Dropdown la prende sola pasando las 8) y no secciones
  // de dos niveles: con dos o tres campañas, entrar a una sección es un clic de más para
  // no ahorrar nada. El nombre de la campaña viaja en `buscar` de cada conjunto, así que
  // buscar la campaña trae también sus conjuntos.
  const opciones: DropdownOption[] = [];
  const valorDe = new Map<string, Pide['item']>();
  const orden = (a: { estado: string; nombre: string }, b: { estado: string; nombre: string }) =>
    Number(b.estado === 'ACTIVE') - Number(a.estado === 'ACTIVE') || a.nombre.localeCompare(b.nombre, 'es');
  for (const c of [...estado.campanas].filter((c) => !MUERTA.has(c.estado)).sort(orden)) {
    const otro = enOtro.get(c.id);
    if (!mias.some((m) => m.id === c.id)) {
      opciones.push({
        value: c.id, label: c.nombre || c.id,
        sub: otro !== undefined ? `Campaña · está en ${nombreDe(otro)}` : `Campaña · ${estadoTxt(c.estado)}`,
      });
      valorDe.set(c.id, { tipo: 'campana', id: c.id, nombre: c.nombre });
    }
    for (const s of estado.conjuntos.filter((s) => s.campanaId === c.id && !MUERTA.has(s.estado)).sort(orden)) {
      if (mias.some((m) => m.id === s.id)) continue;
      const otroS = enOtro.get(s.id);
      opciones.push({
        value: s.id, label: `↳ ${s.nombre || s.id}`, buscar: c.nombre,
        sub: otroS !== undefined ? `Conjunto · está en ${nombreDe(otroS)}` : `Conjunto · ${estadoTxt(s.estado)}`,
      });
      valorDe.set(s.id, { tipo: 'conjunto', id: s.id, nombre: s.nombre, campanaId: c.id });
    }
  }

  const elegir = (v: string) => {
    const item = valorDe.get(v);
    if (!item) return;
    const otro = enOtro.get(item.id);
    // ⚠️ SACARLA DE OTRO PRODUCTO PREGUNTA. Asignar una campaña libre no le cambia nada a
    // nadie; moverla cambia a qué tablero entran los leads de OTRO producto desde ahora,
    // y eso no se nota hasta que falta un lead allá.
    if (otro !== undefined) setPide({ item, desde: nombreDe(otro) });
    else asignar(item);
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <span style={{ display: 'block', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
        Campañas de Meta
      </span>

      {mias.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {mias.map((a) => {
            const viva = vivaEnMeta.has(a.id) || estado.metaError != null;
            const st = a.tipo === 'campana' ? campanaPorId.get(a.id)?.estado : estado.conjuntos.find((s) => s.id === a.id)?.estado;
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 13px',
                paddingLeft: a.tipo === 'conjunto' ? 30 : 13,
                borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)',
              }}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.tipo === 'conjunto' ? '↳ ' : ''}{a.nombre}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: viva ? 'var(--dim)' : 'var(--warn)', marginTop: 1 }}>
                    {/* «Ya no está en Meta» sólo si Meta CONTESTÓ y no la trajo. Con Meta
                        caído no se sabe, y afirmarlo mandaría a borrar algo que está bien. */}
                    {a.tipo === 'campana' ? 'Campaña' : 'Conjunto'}
                    {!viva ? ' · ya no está en Meta' : st ? ` · ${estadoTxt(st)}` : ''}
                  </span>
                </span>
                <button type="button" className="mk-icon-btn" data-tone="dim" disabled={trabajando}
                  onClick={() => quitar(a.id)}
                  title={`Quitar «${a.nombre}»`} aria-label={`Quitar «${a.nombre}»`}
                  style={{ width: 28, height: 28, flex: 'none', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {estado.metaError === 'sin-meta' ? (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)' }}>
          <Link href="/integraciones" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conecta Meta</Link> para elegir campañas.
        </p>
      ) : estado.metaError ? (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--warn)' }}>{estado.metaError}</p>
      ) : opciones.length === 0 ? (
        /* Una frase y no un desplegable vacío: un control sin opciones se lee como roto. */
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--faint)' }}>
          {estado.campanas.length ? 'Ya asignaste todas.' : 'Esta cuenta no tiene campañas.'}
        </p>
      ) : (
        <Dropdown
          value="" resetAfterSelect disabled={trabajando}
          placeholder="Agregar campaña o conjunto"
          ariaLabel={`Agregar una campaña o un conjunto a ${nombreProducto}`}
          width="100%"
          options={opciones}
          onChange={elegir} />
      )}

      {error && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--bad)' }}>{error}</p>}

      {pide && (
        <Confirm
          title={`¿Pasar «${pide.item.nombre}» a ${nombreProducto}?`}
          message={`Sus leads nuevos dejan de entrar a ${pide.desde}.`}
          confirmLabel="Pasar" tone="primary"
          onConfirm={() => { const it = pide.item; setPide(null); asignar(it); }}
          onCancel={() => setPide(null)} />
      )}
    </div>
  );
}

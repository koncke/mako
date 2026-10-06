'use client';

// =============================================================================
// AsignarProducto — el PASO 2: qué producto vende esta página
// =============================================================================
// Pedido de MARTÍN el 06/10/2026, textual: «Tiene que ser otro paso en la
// configuración del pixel asignar PRODUCTO, ponlo como segundo paso… Y no solo se
// debería poder seleccionar 1 producto, si quiero puedo seleccionar más de 1.»
//
// ⚠️ ANTES VIVÍA ADENTRO DEL PASO 1, como un desplegable debajo del selector de
// página, y la razón escrita era buena: «es una propiedad de esa página igual que
// su proyecto de Clarity». Lo que ese razonamiento no mide es la JERARQUÍA — a
// qué CRM entran los leads no es un detalle de la página, es la decisión que
// define para qué sirve el Pixel en ella. Colgado de un desplegable al pie del
// paso 1, se leía como opcional; y cuando el workspace tenía un solo producto no
// se dibujaba nada, así que nadie sabía que la pregunta existía.
//
// ⚠️ Y EL PASO SE DIBUJA SIEMPRE, también con un solo producto. Un paso numerado
// que no muestra nada deja un hueco en la numeración, que se lee como una pantalla
// rota; y con un producto solo, lo que hay que decir no es nada: es DÓNDE se
// crean los demás. Es la regla de la casa sobre los estados vacíos — una frase,
// qué falta y dónde se arregla.

import { useEffect, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Checkbox } from '@/app/_ui';
import { mismaPagina } from '@/lib/landing-paginas';
import type { LandingConfig } from '@/lib/landing-config';
import type { ProductoAsignable } from '@/lib/landing-funnel';
import { getLandingsAction, getProductosAction, guardarLandingAction } from './landing-config-actions';

export function AsignarProducto({ elegida }: { elegida: string | null }) {
  const [productos, setProductos] = useState<ProductoAsignable[]>([]);
  const [landings, setLandings] = useState<LandingConfig[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void Promise.all([getProductosAction().catch(() => []), getLandingsAction().catch(() => [])])
      .then(([p, l]) => { if (vivo) { setProductos(p); setLandings(l); } })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  const cfg = landings.find((l) => mismaPagina(l.url, elegida)) ?? null;
  const elegidos = cfg?.funnelIds ?? [];

  // ⚠️ EL VALOR GUARDADO ENTRA A LA LISTA AUNQUE EL EMBUDO YA NO SE PUEDA ELEGIR.
  // Un producto archivado no se ofrece (`productosAsignables` filtra por activo),
  // y si no se dibujara, su casilla no existiría: la persona no vería que está
  // asignado y el primer guardado de cualquier otra casilla lo borraría sin que
  // nadie lo toque. Se muestra marcado y diciendo qué le pasa.
  const huerfanos = elegidos.filter((id) => !productos.some((p) => p.id === id));

  const guardar = async (ids: number[]) => {
    if (!elegida) return;
    setOcupado(true); setErr(null);
    // La lista VACÍA es lo que DESASIGNA (ausente sería «no los toques», ver
    // `conLanding`). Por eso se manda siempre la lista entera y no un delta.
    const r = await guardarLandingAction(elegida, { funnelIds: ids });
    setOcupado(false);
    if (!r.ok) { setErr(r.error); return; }
    setLandings(r.landings);
  };

  const alternar = (id: number, marcado: boolean) => {
    const ids = marcado ? [...elegidos, id] : elegidos.filter((x) => x !== id);
    void guardar(ids);
  };

  if (cargando) {
    return <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>Buscando tus productos…</div>;
  }

  // Un solo producto (o ninguno): no hay nada que elegir y sí algo que decir.
  if (productos.filter((p) => !p.esDefault).length === 0 && !huerfanos.length) {
    const unico = productos.find((p) => p.esDefault) ?? productos[0] ?? null;
    return (
      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, maxWidth: '64ch' }}>
        {unico
          ? <>Sus leads entran a <strong style={{ color: 'var(--ink)' }}>{unico.nombre}</strong>, que es el único producto que tienes.</>
          : <>Sus leads entran al CRM de tu negocio.</>}
        {' '}Si vendes más de uno, <Link href="/crm" style={{ color: 'var(--primary)', fontWeight: 600 }}>créalos en tu CRM</Link> y vuelve aquí a marcarlos.
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 11, lineHeight: 1.55, maxWidth: '64ch' }}>
        Los leads de esta página entran al CRM de los productos que marques. Si marcas varios, la misma
        persona aparece en el tablero de cada uno.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {productos.map((pr) => (
          <Checkbox
            key={pr.id}
            checked={elegidos.includes(pr.id)}
            onChange={(v) => alternar(pr.id, v)}
            disabled={ocupado}
            label={pr.nombre}
            hint={pr.esDefault ? 'El CRM de tu negocio' : undefined}
          />
        ))}
        {huerfanos.map((id) => (
          <Checkbox
            key={id}
            checked
            onChange={(v) => alternar(id, v)}
            disabled={ocupado}
            label="Producto archivado"
            hint="Sus leads entran al CRM de tu negocio. Destíldalo para sacarlo."
          />
        ))}
      </div>

      {/* Sin ninguna marcada no falta nada: se dice DÓNDE caen, que es la pregunta
          que la persona tiene en la cabeza mirando las casillas vacías. */}
      {elegidos.length === 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 10, lineHeight: 1.5 }}>
          Sin marcar ninguno, sus leads entran al CRM de tu negocio.
        </div>
      )}

      {err && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}

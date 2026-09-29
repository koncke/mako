'use client';

// =============================================================================
// MakoConfirmGate — los cambios del CRM automático, SIN interrumpir
// =============================================================================
// Al entrar al CRM, si MaKo hizo cambios automáticos, acá se listan para
// confirmarlos o deshacerlos. (Fuente: mako_confirmaciones.)
//
// ⚠️ ESTO ERA UN MODAL BLOQUEANTE Y NO CERRABLE (25/09). Tapaba el CRM entero al
// entrar y no dejaba pasar hasta resolver todo. Mauricio: «me meto al CRM y me
// pregunta un chorro de cosas… quiero nomás cambiar este… y ya lo abandono».
// Pedido, textual: «no significa que desaparezca, pero no quiero que interrumpa».
//
// Ahora es una tarjeta anclada abajo a la derecha, PLEGADA por defecto: se ve el
// número, no tapa nada y se abre cuando él quiere. No se puede esconder del todo
// —el contador queda—, porque son cambios que alguien tiene que revisar.
//
// ⚠️ Y LISTA LO DEL PRODUCTO QUE SE ESTÁ MIRANDO, no lo del workspace. Hasta el
// 30/09/2026 filtraba sólo por `estado = 'pendiente'`, así que los cambios de un producto
// se veían parado en cualquier otro: «me sigue apareciendo el mensaje de "MaKo movió 3
// leads" por más que estoy parado en otro funnel/producto». El corte vive en el SERVER
// (mako-confirm-actions → listPendientes), y acá sólo se decide QUÉ pedir: ver alcanceDe.
//
// Y menos texto. Antes cada ítem traía cuatro líneas: la regla interna («T1»),
// «MaKo ya lo aplicó — confirma o deshaz» (que repetía lo que dicen los botones)
// y la descripción de la automatización escrita para quien la programó («R2 del
// 2026-09-23 sin marcar → buscar grabación en Fathom: si aparece asistió →
// Facturando…»). Queda lo que hace falta para decidir: QUÉ lead, QUÉ cambió y los
// dos botones. El porqué sigue estando, a un toque, para cuando algo no cierre.

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { listConfirmacionesAction, resolverConfirmacionAction, type AlcanceConfirmaciones } from '../crm/mako-confirm-actions';
import { esVistaSinChrome } from './PublicRouteGate';
import type { MakoConfirmacion, ConfOpcion, CambioCampo } from '@/lib/mako-confirmaciones';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const btnBase: CSSProperties = { padding: '7px 13px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, border: '1px solid transparent' };

/**
 * El cambio en una línea. El «antes» solo entra cuando dice algo: casi siempre es
 * «Sin marcar», o sea el hueco que la automatización vino a llenar, y ponerlo
 * duplicaba el largo de la línea sin agregar nada.
 */
function lineaDeCambio(ch: CambioCampo): string {
  const antes = (ch.antes ?? '').trim();
  const despues = (ch.despues ?? '—').trim();
  const valor = antes && antes.toLowerCase() !== 'sin marcar' ? `${antes} → ${despues}` : despues;
  return `${ch.campo}: ${valor}`;
}

function ItemCard({ c, busy, bloqueado, error, onResolve }: { c: MakoConfirmacion; busy: boolean; bloqueado: boolean; error: boolean; onResolve: (id: number, decision: string) => void }) {
  const [verPorque, setVerPorque] = useState(false);
  const opBtn = (o: ConfOpcion): CSSProperties => o.tone === 'danger'
    ? { ...btnBase, background: 'var(--bad-bg)', color: 'var(--bad)', borderColor: 'var(--bad)' }
    : o.tone === 'primary'
      ? { ...btnBase, background: 'var(--primary)', color: '#fff' }
      : { ...btnBase, background: 'var(--surface)', color: 'var(--dim)', borderColor: 'var(--border-strong)' };
  const off = bloqueado ? 0.5 : 1;
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '13px 0 0', opacity: bloqueado && !busy ? 0.55 : 1 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
        {c.titulo}
        {/* Un cambio que MaKo NO aplicó todavía espera una decisión, no una
            confirmación: sin esta marca los dos casos se ven igual. */}
        {!c.aplicado && <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 600, color: 'var(--warn)' }}>sin aplicar</span>}
      </div>
      {c.cambios.length > 0 && (
        <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>
          {c.cambios.map((ch, i) => <div key={i}>{lineaDeCambio(ch)}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        {c.aplicado && (
          <button disabled={bloqueado} onClick={() => onResolve(c.id, 'confirmar')} style={{ ...btnBase, background: 'var(--good-bg)', color: 'var(--good)', borderColor: 'var(--good)', opacity: off }}>Confirmar</button>
        )}
        {(c.opciones ?? []).map((o) => (
          <button key={o.key} disabled={bloqueado} onClick={() => onResolve(c.id, `op:${o.key}`)} style={{ ...opBtn(o), opacity: off }}>{o.label}</button>
        ))}
        {c.aplicado && (
          <button disabled={bloqueado} onClick={() => onResolve(c.id, 'rechazar')} style={{ ...btnBase, background: 'transparent', color: 'var(--bad)', borderColor: 'var(--border-strong)', opacity: off }}>Deshacer</button>
        )}
        {c.detalle && (
          <button type="button" aria-expanded={verPorque} onClick={() => setVerPorque((v) => !v)}
            style={{ marginLeft: 'auto', padding: '7px 4px', background: 'none', border: 'none', color: 'var(--faint)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            {verPorque ? 'Ocultar' : '¿Por qué?'}
          </button>
        )}
        {busy && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Aplicando…</span>}
        {error && <span style={{ fontSize: 12, color: 'var(--bad)', fontWeight: 600 }}>No se pudo, reintenta</span>}
      </div>
      {verPorque && c.detalle && (
        <p style={{ margin: '9px 0 0', fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, marginRight: 6 }}>{c.regla}</span>
          {c.detalle}
        </p>
      )}
    </div>
  );
}

/**
 * Qué confirmaciones le toca pedir a ESTA pantalla.
 *
 * ⚠️ EL PRODUCTO VIAJA EN EL QUERY STRING, NO EN EL PATHNAME. El selector del tablero
 * navega con `router.push(f?.esDefault ? '/crm' : '/crm?funnel=' + v)` (el `onChange` del
 * desplegable de productos, en `app/crm/CrmToolbar.tsx`), así que con
 * `usePathname()` solo no hay forma de saber qué producto se está mirando: es el mismo
 * `/crm` para los tres. De ahí el `useSearchParams()`.
 *
 * Y el pathname sigue decidiendo OTRA cosa: si hay un tablero de producto a la vista.
 * La tarjeta vive en todo `/crm*`, y `/crm/[id]`, `/crm/revisar` y `/crm/new` no llevan
 * `?funnel=` — ahí «sin parámetro» NO significa «el producto del negocio», significa que
 * no se está mirando ningún producto (en la ficha de un lead el funnel que importa es el
 * DEL LEAD, y `getFunnelDeLead` es todavía un stub). En esas pantallas se muestra todo:
 * la tarjeta no puede desaparecer, son cambios que alguien tiene que revisar.
 */
function alcanceDe(pathname: string | null, funnel: string | null): AlcanceConfirmaciones {
  if (pathname !== '/crm') return 'todo';
  const n = Number(funnel);
  return { funnel: Number.isInteger(n) && n > 0 ? n : null };
}

function Tarjeta() {
  const pathname = usePathname();
  // Cruda a propósito: la valida el server contra los funnels del workspace (ver
  // listConfirmacionesAction). Acá sólo hace falta que dispare el efecto al cambiar.
  const funnelParam = useSearchParams().get('funnel');
  const router = useRouter();
  // El resumen del lead vive bajo /crm pero se abre desde WhatsApp, en el
  // celular y con la reunión por empezar: no es lugar para esto. Ver esVistaSinChrome.
  const enCrm = (pathname?.startsWith('/crm') ?? false) && !esVistaSinChrome(pathname);
  const [items, setItems] = useState<MakoConfirmacion[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<number | null>(null);
  const [cargado, setCargado] = useState(false);
  // Plegada por defecto: entrar al CRM no puede empezar con una lista de deberes.
  const [abierta, setAbierta] = useState(false);

  // ⚠️ `funnelParam` VA EN LAS DEPS. El selector de producto navega SOFT: cambia el query
  // y NO el pathname, así que con `[enCrm, pathname]` el efecto no se volvía a disparar y
  // quedaba en pantalla la lista del producto anterior — que es la mitad del síntoma que
  // Martín reporta («me sigue apareciendo el mensaje por más que estoy parado en otro
  // funnel/producto»). La otra mitad era que el server no filtraba.
  useEffect(() => {
    if (!enCrm) return;
    let vivo = true;
    // La lista del producto anterior se va ANTES de pedir la nueva: mientras la action
    // viaja, «MaKo movió 3 leads» sobre el tablero del producto 2 sigue siendo mentira,
    // aunque dure 200 ms.
    setItems([]);
    listConfirmacionesAction(alcanceDe(pathname, funnelParam))
      .then((r) => { if (vivo) { setItems(r); setCargado(true); } })
      .catch(() => { if (vivo) setCargado(true); });
    return () => { vivo = false; };
  }, [enCrm, pathname, funnelParam]);

  const resolver = useCallback(async (id: number, decision: string) => {
    if (busy !== null) return; // una resolución a la vez
    setBusy(id);
    setErr((e) => (e === id ? null : e));
    const r = await resolverConfirmacionAction(id, decision).catch(() => ({ ok: false as const }));
    setBusy(null);
    if (r.ok) {
      setItems((xs) => xs.filter((x) => x.id !== id));
      router.refresh();
    } else {
      setErr(id);
    }
  }, [router, busy]);

  if (!enCrm || !cargado || items.length === 0) return null;

  const cuantos = `${items.length} ${items.length === 1 ? 'lead' : 'leads'}`;
  const marco: CSSProperties = {
    position: 'fixed', right: 20, bottom: 20, zIndex: 65, fontFamily: SANS,
    width: abierta ? 'min(380px, calc(100vw - 32px))' : 'auto',
    background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14,
    boxShadow: '0 14px 40px rgba(18,21,27,.22)', overflow: 'hidden',
  };

  // Plegada: solo el número. Es un aviso, no una tarea que empieza sola.
  if (!abierta) {
    return (
      <button type="button" aria-expanded={false} onClick={() => setAbierta(true)}
        style={{ ...marco, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}>
        <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>Mk</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>MaKo movió {cuantos}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>Revisar</span>
      </button>
    );
  }

  return (
    <section aria-label={`MaKo movió ${cuantos}`} style={{ ...marco, display: 'flex', flexDirection: 'column', maxHeight: 'min(520px, calc(100vh - 40px))' }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderBottom: '1px solid var(--border)' }}>
        <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>Mk</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>MaKo movió {cuantos}</span>
        <button type="button" onClick={() => setAbierta(false)} aria-label="Plegar"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, padding: 4 }}>Después</button>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0 15px 15px' }}>
        {items.map((c) => <ItemCard key={c.id} c={c} busy={busy === c.id} bloqueado={busy !== null} error={err === c.id} onResolve={resolver} />)}
      </div>
    </section>
  );
}

/**
 * El `<Suspense>` es por `useSearchParams()`: sin un boundary, Next corta el prerender de
 * cualquier ruta estática con «useSearchParams() should be wrapped in a suspense boundary».
 * Hoy el layout ya lo envuelve (`app/layout.tsx:145`), pero eso es una propiedad de DONDE
 * está montado y no de este archivo: el día que alguien lo mueve, el build se rompe en otra
 * pantalla. `fallback={null}` porque la tarjeta plegada no reserva lugar.
 */
export function MakoConfirmGate() {
  return (
    <Suspense fallback={null}>
      <Tarjeta />
    </Suspense>
  );
}

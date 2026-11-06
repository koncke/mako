'use client';

// =============================================================================
// CuentasDePago — varias cuentas de Stripe o de Mercado Pago en un negocio (22/10/2026)
// =============================================================================
// Va abajo de la clave de la principal en el modal de Stripe / Mercado Pago (ServicioConfigForm). Cada cuenta con su
// nombre (el que se elige en «Vincular cobro» y en el link de la ficha), si cobra, y sus acciones: cambiarle el nombre,
// volver a conectarla, desconectarla. «Conectar otra cuenta» pide un nombre y su clave; la conexión es la misma que la
// de la principal (lib/cobros-conexion.ts). Ruta: /api/integraciones/cuentas. Ninguna clave vuelve al navegador.
//
// Y CALENDLY Y CAL.COM (fase B, 23/10/2026), con la misma lista: cada cuenta lee su agenda con su token (o su API key)
// y firma sus reservas con su secreto. Sin el secreto, sus reservas no entran: la fila lo pide ahí mismo.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CtaPasarAPro } from '../_components/CtaPasarAPro';
import { TOPE_ALIAS, type ProveedorAgendaConCuentas, type ProveedorConCuentas } from '@/lib/cuentas-integracion';

type Proveedor = ProveedorConCuentas | ProveedorAgendaConCuentas;

type Cuenta = { id: string; cuenta: string; nombre: string; principal: boolean; conectada: boolean; conAviso: boolean };

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const caja: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };
const boton: CSSProperties = { padding: '6px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12, fontWeight: 500, cursor: 'pointer' };
const input: CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13 };

const NOMBRE: Record<Proveedor, string> = { stripe: 'Stripe', mercadopago: 'Mercado Pago', creem: 'Creem', calendly: 'Calendly', calcom: 'Cal.com' };
const CLAVE: Record<Proveedor, string> = {
  stripe: 'Clave secreta (sk_live_…)', mercadopago: 'Access token (APP_USR-…)', creem: 'Clave de API (creem_…)', calendly: 'Personal access token', calcom: 'API key (cal_live_…)',
};
/**
 * El secreto del aviso de una cuenta de más, por proveedor (el de la principal se pega en la tarjeta de arriba).
 * ⚠️ Creem NO va acá A PROPÓSITO (31/10/2026), igual que Stripe: su secreto lo registra y lo guarda MaKo por API
 * (`asegurarWebhookCreem`), no se pega a mano. Pedirlo sería pedir un dato que la API ya entrega.
 */
const SECRETO: Partial<Record<Proveedor, string>> = {
  mercadopago: 'Clave secreta del aviso', calendly: 'Signing key del webhook', calcom: 'Contraseña del webhook',
};

async function pedir(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; mensaje?: string; aviso?: string | null; completa?: boolean; cuentas?: Cuenta[]; nadaGuardado?: boolean; tope?: number; planes?: string }> {
  try {
    const r = await fetch('/api/integraciones/cuentas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch {
    return { ok: false, error: 'No se pudo. Revisa tu conexión y prueba de nuevo.' };
  }
}

export default function CuentasDePago({ proveedor, onCambio }: {
  proveedor: Proveedor;
  /** Cambió la principal (se desconectó o se conectó): el formulario de arriba recarga sus campos. */
  onCambio?: () => void;
}) {
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; planes?: string | null } | null>(null);
  const [editando, setEditando] = useState<{ cuenta: string; nombre: string } | null>(null);
  const [nueva, setNueva] = useState<{ nombre: string; clave: string } | null>(null);
  const [aDesconectar, setADesconectar] = useState<Cuenta | null>(null);
  const [secretos, setSecretos] = useState<Record<string, string>>({});
  const nombre = NOMBRE[proveedor];
  const esAgenda = proveedor === 'calendly' || proveedor === 'calcom';
  const origen = typeof window === 'undefined' ? '' : window.location.origin;
  /** Lo que dice una fila: si cobra (o lee su agenda) y qué le falta. */
  const estado = (c: Cuenta): { ok: boolean; texto: string } => {
    if (!esAgenda) return c.conectada ? { ok: true, texto: 'Cobra' } : { ok: false, texto: 'Le falta el aviso de pagos' };
    if (!c.conectada) return { ok: false, texto: proveedor === 'calendly' ? 'Le falta su token' : 'Le falta su API key' };
    return c.conAviso ? { ok: true, texto: 'Lee su agenda' } : { ok: false, texto: 'Sin el aviso: no entran sus reservas' };
  };

  const cargar = useCallback(() => {
    fetch(`/api/integraciones/cuentas?servicio=${proveedor}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) { setCuentas(j.cuentas as Cuenta[]); setError(null); } else setError(j.error ?? 'No pude leer tus cuentas.'); })
      .catch(() => setError('No pude leer tus cuentas. Revisa tu conexión.'));
  }, [proveedor]);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (cuenta: string, body: Record<string, unknown>, avisarArriba = false) => {
    setOcupada(cuenta); setMsg(null);
    const j = await pedir({ servicio: proveedor, ...body });
    setOcupada(null);
    if (Array.isArray(j.cuentas)) setCuentas(j.cuentas);
    // El tope del plan (402): el cartel corto y «Pasar a Pro».
    if (!j.ok) { setMsg({ ok: false, text: j.error ?? 'No se pudo.', planes: j.tope ? (j.planes ?? null) : null }); return false; }
    if (j.aviso) setMsg({ ok: false, text: j.aviso });
    else if (j.mensaje) setMsg({ ok: j.completa !== false, text: j.mensaje });
    if (avisarArriba) onCambio?.();
    return true;
  };

  if (error) return <div style={{ ...caja, padding: '11px 13px', fontSize: 12.5, color: 'var(--bad)' }}>{error}</div>;
  if (!cuentas) return null;
  // Sin la principal conectada, la tarjeta de arriba es el camino: esto aparece cuando ya hay una.
  if (!cuentas.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Tus cuentas de {nombre}</div>

      {cuentas.map((c) => (
        <div key={c.id} style={{ ...caja, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {editando?.cuenta === c.cuenta ? (
            <form style={{ display: 'flex', gap: 6 }} onSubmit={(e) => {
              e.preventDefault();
              void accion(c.cuenta, { action: 'renombrar', cuenta: c.cuenta, nombre: editando.nombre }).then((ok) => { if (ok) setEditando(null); });
            }}>
              <input autoFocus value={editando.nombre} maxLength={TOPE_ALIAS} aria-label="Nombre de la cuenta" style={input}
                onChange={(e) => setEditando({ cuenta: c.cuenta, nombre: e.target.value })} />
              <button type="submit" disabled={ocupada === c.cuenta} style={boton}>{ocupada === c.cuenta ? 'Guardando…' : 'Guardar'}</button>
              <button type="button" onClick={() => setEditando(null)} style={boton}>Cancelar</button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: estado(c).ok ? 'var(--good)' : 'var(--warn)', flex: 'none' }} aria-hidden />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{c.nombre}</span>
              {c.principal && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)' }}>PRINCIPAL</span>}
              <span style={{ fontSize: 12, color: estado(c).ok ? 'var(--dim)' : 'var(--warn)' }}>{estado(c).texto}</span>
              <span style={{ flex: 1 }} />
              <button type="button" style={boton} onClick={() => setEditando({ cuenta: c.cuenta, nombre: c.nombre })}>Cambiar nombre</button>
              {!esAgenda && !c.conectada && (
                <button type="button" style={boton} disabled={ocupada === c.cuenta} onClick={() => void accion(c.cuenta, { action: 'reconectar', cuenta: c.cuenta })}>
                  {ocupada === c.cuenta ? 'Conectando…' : '↻ Volver a conectar'}
                </button>
              )}
              <button type="button" style={{ ...boton, color: 'var(--bad)' }} disabled={ocupada === c.cuenta} onClick={() => setADesconectar(c)}>Desconectar</button>
            </div>
          )}
          {/* Una cuenta de más sin su aviso (el de la principal se pega en la tarjeta de arriba). Mercado Pago: sus
              suscripciones no renuevan en el CRM. Calendly y Cal.com: sus reservas no se pueden verificar y no entran.
              La dirección es la misma para todas las cuentas (el aviso dice de cuál es). */}
          {(proveedor === 'mercadopago' ? c.conectada : esAgenda) && !c.principal && !c.conAviso && editando?.cuenta !== c.cuenta && (
            <form style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onSubmit={(e) => {
              e.preventDefault();
              void accion(c.cuenta, { action: 'aviso', cuenta: c.cuenta, secreto: secretos[c.cuenta] ?? '' }).then((ok) => { if (ok) setSecretos((x) => ({ ...x, [c.cuenta]: '' })); });
            }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                {proveedor === 'mercadopago' && <>Para sus suscripciones: en su aplicación de Mercado Pago → Webhooks, pega <code style={{ fontFamily: MONO }}>{origen}/api/webhooks/mercadopago</code> y su clave secreta aquí.</>}
                {proveedor === 'calendly' && <>Para que entren sus reservas, pega aquí la signing key del aviso de esta cuenta.</>}
                {proveedor === 'calcom' && <>Para que entren sus reservas: en Cal.com → Settings → Developer → Webhooks, pega <code style={{ fontFamily: MONO }}>{origen}/api/webhooks/calcom</code> y una contraseña; la misma, aquí.</>}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="password" autoComplete="off" value={secretos[c.cuenta] ?? ''} placeholder={SECRETO[proveedor]} aria-label={SECRETO[proveedor]} style={{ ...input, fontFamily: MONO }}
                  onChange={(e) => setSecretos((x) => ({ ...x, [c.cuenta]: e.target.value }))} />
                <button type="submit" disabled={ocupada === c.cuenta || !(secretos[c.cuenta] ?? '').trim()} style={boton}>Guardar</button>
              </div>
            </form>
          )}
        </div>
      ))}

      {nueva ? (
        <form style={{ ...caja, padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 8 }} onSubmit={(e) => {
          e.preventDefault();
          void accion('nueva', { action: 'conectar', nombre: nueva.nombre, clave: nueva.clave }, true).then((ok) => { if (ok) setNueva(null); });
        }}>
          <input autoFocus value={nueva.nombre} maxLength={TOPE_ALIAS} placeholder={`Nombre (ej.: ${nombre} de la tienda)`} aria-label="Nombre de la cuenta" style={input}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          <input type="password" autoComplete="off" value={nueva.clave} placeholder={CLAVE[proveedor]} aria-label={CLAVE[proveedor]} style={{ ...input, fontFamily: MONO }}
            onChange={(e) => setNueva({ ...nueva, clave: e.target.value })} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" disabled={ocupada === 'nueva' || !nueva.clave.trim()} style={{ ...boton, color: 'var(--ink)', fontWeight: 600 }}>
              {ocupada === 'nueva' ? 'Conectando…' : 'Conectar'}
            </button>
            <button type="button" onClick={() => setNueva(null)} style={boton}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setNueva({ nombre: '', clave: '' }); setMsg(null); }} style={{ ...boton, alignSelf: 'flex-start' }}>
          + Conectar otra cuenta de {nombre}
        </button>
      )}

      {msg && (
        <div style={{ fontSize: 12.5, color: msg.ok ? 'var(--good)' : 'var(--bad)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{msg.text}</span>
          {/* El tope de cuentas de cobro: al cliente de una agencia se le dice a quién pedírselo (6/11/2026, #494), no se le vende. */}
          {msg.planes && <CtaPasarAPro><a href={msg.planes} style={{ ...boton, color: 'var(--primary)', textDecoration: 'none' }}>Pasar a Pro</a></CtaPasarAPro>}
        </div>
      )}

      {aDesconectar && (
        <ConfirmDialog
          zIndex={310}
          tone="danger"
          title={`¿Desconectar «${aDesconectar.nombre}»?`}
          message={esAgenda
            ? <>MaKo deja de leer su agenda y de recibir sus reservas. <b>Tus otras cuentas siguen igual.</b></>
            : <>MaKo deja de enterarse de sus pagos y no crea links con ella. Lo que ya cobra en {nombre} sigue cobrando allá. <b>Tus otras cuentas siguen igual.</b></>}
          confirmLabel="Desconectar"
          onCancel={() => setADesconectar(null)}
          onConfirm={() => { const c = aDesconectar; setADesconectar(null); void accion(c.cuenta, { action: 'desconectar', cuenta: c.cuenta }, c.principal); }}
        />
      )}
    </div>
  );
}

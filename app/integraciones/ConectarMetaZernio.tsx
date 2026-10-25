'use client';

// =============================================================================
// ConectarMetaZernio — «Conectar con Facebook»: Meta entero por la Zernio del negocio, desde el modal de Meta (25/10/2026)
// =============================================================================
// Martín, 25/10: «implementa zernio y depreca la conexión con API de Meta». Antes se pegaba el token de un usuario del sistema
// con 8 permisos; desde ahora el negocio toca UN botón (la ventana de Zernio, la misma pieza `useConectarViaZernio` que usan
// el Media Buyer, Automations y Chats) y MaKo guarda la conexión, la cuenta publicitaria y el píxel (lib/meta-conexion-zernio.ts).
// Con varias cuentas o píxeles, la persona elige acá.
//
// Va arriba del formulario de Meta (ServicioConfigForm) y SÓLO con Zernio activo para el negocio (`estado.activo`): antes de
// la prueba en la cuenta de MaKo, sólo el negocio de la plataforma lo ve. Le avisa al formulario (`onEstado`) para que esconda
// el token de Meta cuando no hace falta.
// Se carga A DEMANDA (`next/dynamic`): los demás servicios no la traen.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Button } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { EstadoConexion, useConectarViaZernio } from '@/app/_components/ConectarViaZernio';

const SANS = "'Geist', sans-serif";
const caja: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };
const select: CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5,
};

type Cuenta = { id: string; nombre: string | null; estado: number | null };
type Pixel = { id: string; nombre: string | null; activo: boolean };
export type EstadoMetaZernio = {
  activo: boolean; conexion: string | null; cuentas: Cuenta[]; pixeles: Pixel[]; cuenta: string | null; pixel: string | null; error: string | null;
};

async function pedir(init?: RequestInit): Promise<{ estado?: EstadoMetaZernio; error?: string }> {
  try {
    const r = await fetch('/api/integraciones/meta-zernio', { cache: 'no-store', ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; estado?: EstadoMetaZernio; error?: string; conflictos?: string[] } | null;
    if (!j) return { error: 'No pude leer tu conexión de Facebook.' };
    if (!j.ok) return { error: j.error ?? 'No pude leer tu conexión de Facebook.' };
    if (j.conflictos?.length) return { estado: j.estado, error: j.conflictos.join(' ') };
    return { estado: j.estado };
  } catch {
    return { error: 'No pude hablar con MaKo. Revisa tu conexión.' };
  }
}

export default function ConectarMetaZernio({ onEstado }: { onEstado?: (e: { activo: boolean; conectada: boolean }) => void }) {
  const [estado, setEstado] = useState<EstadoMetaZernio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const aplicar = useCallback((r: { estado?: EstadoMetaZernio; error?: string }) => {
    if (r.estado) setEstado(r.estado);
    setError(r.error ?? r.estado?.error ?? null);
  }, []);

  const leer = useCallback(async () => aplicar(await pedir()), [aplicar]);
  useEffect(() => { void leer(); }, [leer]);
  useEffect(() => {
    if (estado) onEstado?.({ activo: estado.activo, conectada: !!estado.conexion && !!estado.cuenta });
  }, [estado, onEstado]);

  // Quedó conectada la ventana: MaKo guarda la conexión y lo que se puede elegir solo.
  const z = useConectarViaZernio({
    volver: '/integraciones?abrir=meta',
    onConectado: (_conexiones, nueva) => {
      setGuardando(true);
      void pedir({ method: 'POST', body: JSON.stringify({ action: 'guardar', accountId: nueva.accountId }) })
        .then(aplicar).finally(() => setGuardando(false));
    },
  });

  const elegir = async (campo: 'cuenta' | 'pixel', valor: string) => {
    if (!valor) return;
    setGuardando(true);
    aplicar(await pedir({ method: 'POST', body: JSON.stringify({ action: 'elegir', [campo]: valor }) }));
    setGuardando(false);
  };

  if (!estado?.activo) return null;
  const conectada = !!estado.conexion;
  const cuenta = estado.cuentas.find((c) => c.id === estado.cuenta);

  return (
    <div data-conectar-meta-zernio style={{ ...caja, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, flex: 'none', background: conectada && cuenta ? 'var(--good)' : conectada ? 'var(--warn)' : 'var(--border-strong)' }} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
            {conectada ? (cuenta ? `Conectada · ${cuenta.nombre ?? cuenta.id}` : 'Conectada: elige tu cuenta publicitaria') : 'Conecta tu cuenta de Meta'}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
            {conectada ? 'Métricas, leads, anuncios y conversiones, con tu Zernio.' : 'Un clic, sin pegar tokens: se abre la ventana de Facebook.'}
          </span>
        </span>
        <Button size="sm" variant={conectada ? 'secondary' : 'primary'} loading={z.fase === 'abriendo' || guardando} disabled={z.fase === 'abriendo' || guardando}
          data-conectar-zernio="metaads" onClick={() => z.conectar('metaads', { reconectarId: conectada ? estado.conexion : null })}>
          {conectada ? 'Volver a conectar' : 'Conectar con Facebook'}
        </Button>
      </div>

      {conectada && estado.cuentas.length > 1 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: 'var(--dim)' }}>
          Cuenta publicitaria
          <select style={select} value={estado.cuenta ?? ''} disabled={guardando} onChange={(e) => void elegir('cuenta', e.target.value)}>
            {!estado.cuenta && <option value="">Elige una cuenta…</option>}
            {estado.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre ? `${c.nombre} (${c.id})` : c.id}</option>)}
          </select>
        </label>
      )}

      {conectada && estado.pixeles.length > 1 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: 'var(--dim)' }}>
          Píxel
          <select style={select} value={estado.pixel ?? ''} disabled={guardando} onChange={(e) => void elegir('pixel', e.target.value)}>
            {!estado.pixel && <option value="">Elige un píxel…</option>}
            {estado.pixeles.map((p) => <option key={p.id} value={p.id}>{p.nombre ? `${p.nombre} (${p.id})` : p.id}</option>)}
          </select>
        </label>
      )}

      {conectada && estado.pixeles.length === 0 && !error && (
        <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--dim)' }}>
          Tu conexión no ve ningún píxel. Si tienes uno, pega su número abajo y, si los eventos no llegan, el token del píxel.
        </span>
      )}

      {error && <span role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}<ReportarASoporte /></span>}
      <EstadoConexion z={z} />
      {z.modal}
    </div>
  );
}

'use client';

// =============================================================================
// <PedirAvisos> — al entrar a MaKo, pide los avisos en ESTE dispositivo hasta que estén (13/11/2026)
// =============================================================================
// Los avisos del negocio ya no dependen de WhatsApp (el número de MaKo quedó baneado): caen en el hilo del grupo de la app y suenan como push. Sin una
// suscripción en `push_suscripciones` el push no tiene a quién, y había 0. Las reglas y el porqué, en lib/pedir-avisos-reglas.ts.
//
// Lo monta el layout con sesión propia y sin mirar la cuenta de otro (el permiso del teléfono es de cada persona). En la computadora va en la esquina de
// avisos; en el teléfono, sobre la barra de abajo. Con el navegador ya suscripto no dibuja nada: vuelve a atar la fila a quien entró (`asegurarRegistro`).
//
// ⚠️ `activarAvisos()` ES LO PRIMERO DEL `onClick`: Safari pierde el gesto en el primer `await` y contesta `denied` solo (lib/push-cliente.ts).
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { Button, ButtonLink } from '@/app/_ui';
import { activarAvisos, asegurarRegistro, esAppInstalada, estadoSuscripcion, probar, type EstadoAvisos } from '@/lib/push-cliente';
import { CLAVE_POSPUESTO, POSPONER_MS, TEXTOS_PEDIR_AVISOS as T, quePedir } from '@/lib/pedir-avisos-reglas';
import { RUTA_APP } from '@/lib/app-tiendas';
import { comoDesbloquear, toastDeActivar } from '@/app/m/cuenta/cuenta-ui';
import { useRutaInterna, useVistaMovil } from './VistaMovil';

const SANS = "'Geist', sans-serif";

const leerPospuesto = (): string | null => { try { return window.localStorage.getItem(CLAVE_POSPUESTO); } catch { return null; } };
const posponer = (): void => { try { window.localStorage.setItem(CLAVE_POSPUESTO, String(Date.now() + POSPONER_MS)); } catch { /* sin almacenamiento: vuelve a pedir en la próxima carga */ } };
const esIOS = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (/Macintosh/i.test(navigator.userAgent || '') && (navigator.maxTouchPoints ?? 0) > 1);

export function PedirAvisos() {
  const movil = useVistaMovil();
  const ruta = useRutaInterna();
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [hasta, setHasta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  // Bloqueado en el toque: queda cómo destrabarlo, sin un botón que no puede hacer nada. En la próxima carga el estado ya es `bloqueado` y no se pide.
  const [bloqueado, setBloqueado] = useState(false);

  // El estado es del navegador: se lee al montar y al volver a la pestaña (pudo activarlos en otra, o en los ajustes del teléfono).
  useEffect(() => {
    let vivo = true;
    let atada = false;
    const leer = () => {
      if (document.visibilityState === 'hidden') return;
      setHasta(leerPospuesto());
      estadoSuscripcion().then((e) => {
        if (!vivo) return;
        setEstado(e);
        // Ya suscripto: la fila del server se vuelve a atar a quien entró (una vez por carga). En /m ya lo hace su shell, y repetirlo es un upsert.
        if (e === 'activo' && !atada) { atada = true; void asegurarRegistro().catch(() => false); }
      }).catch(() => { if (vivo) setEstado('no-soportado'); });
    };
    leer();
    document.addEventListener('visibilitychange', leer);
    return () => { vivo = false; document.removeEventListener('visibilitychange', leer); };
  }, []);

  // ⚠️ Primera línea del handler: el permiso se pide DENTRO del toque.
  const activar = () => {
    const pedido = activarAvisos();
    setOcupado(true);
    setNota(null);
    void pedido.then(async (r) => {
      if (r.ok) {
        setListo(true);
        // La prueba, de una: que lo vea llegar (como el paso del onboarding). Si no llega, igual quedó activo.
        await probar().catch(() => null);
        window.setTimeout(() => { setListo(false); setEstado('activo'); }, 2500);
        return;
      }
      if (r.estado === 'bloqueado') { setBloqueado(true); setNota(comoDesbloquear(esIOS(), esAppInstalada())); }
      else if (r.estado === 'apagado') setNota('Sin el permiso no te llegan.');
      else if (r.estado === 'instalar-primero' || r.estado === 'no-soportado') setEstado(r.estado);
      else setNota(toastDeActivar(r.estado));
    }).catch(() => setNota(toastDeActivar('error'))).finally(() => setOcupado(false));
  };

  const luego = () => { posponer(); setHasta(leerPospuesto() ?? String(Date.now() + POSPONER_MS)); };

  const pedido = listo ? 'activar' : quePedir({ estado, ruta, hasta, ahora: Date.now() });
  if (pedido === 'nada') return null;

  const caja: CSSProperties = movil
    ? {
      position: 'fixed', zIndex: 41, left: 12, right: 12,
      bottom: 'calc(var(--m-tabbar, 56px) + env(safe-area-inset-bottom, 0px) + 12px)',
    }
    : { width: 300 };

  return (
    <div role="region" aria-label={T.titulo} style={{
      ...caja, pointerEvents: 'auto', fontFamily: SANS, display: 'flex', flexDirection: 'column', gap: 10, padding: 16,
      background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 16, boxShadow: '0 14px 40px rgba(18,21,27,.22)',
    }}>
      {listo ? (
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{T.listos}</span>
      ) : (
        <>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--ink)' }}>{T.titulo}</span>
          <span style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--dim)' }}>{pedido === 'instalar' ? T.instalarLinea : T.linea}</span>
          {nota && <span role="status" style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--warn, var(--dim))' }}>{nota}</span>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {bloqueado ? null : pedido === 'instalar'
              ? <ButtonLink href={RUTA_APP} variant="primary" size="lg" full>{T.instalar}</ButtonLink>
              : <Button variant="primary" size="lg" full loading={ocupado} disabled={ocupado} onClick={activar}>{ocupado ? T.activando : T.activar}</Button>}
            <button type="button" onClick={luego} style={{ border: 0, background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: '10px 6px', whiteSpace: 'nowrap', marginLeft: bloqueado ? 'auto' : undefined }}>{bloqueado ? T.entendido : T.luego}</button>
          </div>
        </>
      )}
    </div>
  );
}

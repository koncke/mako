'use client';

// =============================================================================
// ImpersonationBanner — barra fija cuando un admin está "viendo como" cliente
// =============================================================================
// Aparece arriba de todo con el nombre del cliente y un botón para salir. Se
// alimenta de /api/auth/me (impersonando + clienteNombre).

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PanelAgencia } from './PanelAgencia';
import { WS_PARAM } from '@/lib/ws-tab';

const MONO = "'Geist Mono', monospace";

export function ImpersonationBanner() {
  const pathname = usePathname() || '';
  const sp = useSearchParams();
  // El `?ws=` es parte de la identidad de lo que se está mirando: sin él en las
  // dependencias, cambiar de cliente en la misma pestaña dejaba el nombre viejo
  // en el cartel mientras los datos de abajo ya eran de otro.
  const wsUrl = sp.get(WS_PARAM) ?? '';
  const [cliente, setCliente] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me').then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.impersonando) setCliente(j.clienteNombre as string); else if (alive) setCliente(null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname, wsUrl]);

  // Prende el hueco que la barra ocupa, por atributo en <html>. Va por atributo
  // y no por un padding en el layout porque la barra aparece y desaparece sin
  // que el layout se vuelva a montar.
  //
  // ⚠️ ARRIBA del `if (!cliente) return null`. Puesto abajo, este hook solo se
  // llamaba en los renders donde había cliente: React lo cuenta y tira el error
  // #310 («más hooks que en el render anterior»), que en producción viene
  // minificado y rompe la PANTALLA ENTERA — no la barra. Lo encontró la
  // verificación, que dejó de ver hasta la sidebar.
  useEffect(() => {
    if (!cliente) return;
    document.documentElement.setAttribute('data-barra-agencia', '1');
    return () => document.documentElement.removeAttribute('data-barra-agencia');
  }, [cliente]);

  if (!cliente) return null;

  /**
   * Salir de la vista del cliente.
   *
   * Si el contexto vino por la URL (lo normal desde que se entra en pestaña
   * nueva), salir es simplemente irse a una URL SIN `?ws=` — no hay nada que
   * borrar, y sobre todo no hay que tocar nada global: las OTRAS pestañas están
   * mirando otros clientes y no tienen por qué enterarse.
   *
   * El DELETE queda solo para el caso viejo, cuando el contexto venía de la
   * cookie del navegador. Ahí sí hay estado compartido que limpiar.
   */
  const salir = async () => {
    if (wsUrl) { window.location.href = '/admin'; return; }
    setSaliendo(true);
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' });
      window.location.href = '/admin';
    } catch { setSaliendo(false); }
  };

  return (
    <div style={{
      // FIJA y de ancho completo, por encima de la barra lateral. Antes era
      // `sticky` adentro de la columna derecha: chocaba con la sidebar por la
      // izquierda y, al scrollear, el contenido le pasaba por debajo. Ahora el
      // documento se corre `--barra-agencia` hacia abajo (ver globals.css), así
      // que ocupa su lugar en vez de robarlo.
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 18px', background: '#14161B', color: '#F3F0E7',
      borderBottom: '1px solid rgba(200,135,12,.4)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent-soft)', flex: 'none' }} />
      <span style={{ fontSize: 13.5 }}>
        Estás viendo el dashboard de <b style={{ fontWeight: 700 }}>{cliente}</b> como administrador.
      </span>
      {/* Los controles de la agencia sobre este cliente: traer datos de Mau y
          resetear. Van acá porque es la única barra presente en TODAS las
          pantallas, incluido el onboarding bloqueante. */}
      <div style={{ marginLeft: 'auto' }}><PanelAgencia cliente={cliente} /></div>
      <button type="button" onClick={salir} disabled={saliendo}
        style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
          padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)', background: 'transparent',
          color: '#F3F0E7', cursor: saliendo ? 'default' : 'pointer', opacity: saliendo ? 0.6 : 1 }}>
        {saliendo ? 'Saliendo…' : 'Salir de la vista'}
      </button>
    </div>
  );
}

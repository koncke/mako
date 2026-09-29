'use client';

// =============================================================================
// CRM automático (tarea #5) — el estado y el POST. La FILA la dibuja el kebab.
// =============================================================================
// Lee y cambia el interruptor POR WORKSPACE del CRM automático (MaKo mueve leads
// solo). Solo lo ve el admin del workspace: /api/crm-auto responde 403 al resto y
// `on` se queda en null, así que la fila no se dibuja.
//
// ⚠️ ESTO ERA UN PILL EN EL HEADER y desde el 29/09/2026 es una fila del menú de
// los tres puntos. Pedido de Martín: «elimina el chip de "CRM automático: ON" y
// ponlo como opción en los tres puntos, y en lugar de que diga "ON" que esté el
// típico botón de encendido que se desplaza hacia un lado». Por eso acá quedó solo
// el estado: el layout de la fila vive donde viven las otras filas del menú
// (app/crm/CrmToolbar.tsx), que es lo único que hace que se vean iguales.
//
// ⚠️ ESCONDER LA FILA NO PROTEGE NADA, y está bien: el que decide es el server
// (app/api/crm-auto/route.ts, rol !== 'admin' → 403) y el flag es fail-closed
// (lib/envio-flags.ts). La fila se esconde porque para un no-admin es ruido, no
// porque sea una defensa.
// =============================================================================

import { useEffect, useRef, useState } from 'react';

export type CrmAuto = {
  /** null = todavía no se sabe, o el server dijo 403 (no es admin): no se dibuja nada. */
  on: boolean | null;
  /** hay un POST en vuelo: el interruptor va deshabilitado. */
  busy: boolean;
  err: string | null;
  toggle: () => void;
};

export function useCrmAuto(): CrmAuto {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ⚠️ EL GUARD DE VUELO VA EN UN REF, NO EN `busy`. El pill tenía `if (busy) return`
  // y el Switch de app/_ui solo expone `disabled`: entre el click y el re-render que
  // pinta ese `disabled` hay una ventana, y dos clicks rápidos mandaban DOS POST —
  // o sea, prender y apagar de nuevo. El ref se escribe en el mismo tick del click.
  const enVuelo = useRef(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch('/api/crm-auto');
        const j = await r.json();
        if (vivo && j.ok) setOn(Boolean(j.habilitado));
        // 403 = no es admin: el interruptor es config admin-only, sin ruido.
      } catch { /* sin interruptor */ }
    })();
    return () => { vivo = false; };
  }, []);

  const toggle = () => {
    if (enVuelo.current || on == null) return;
    enVuelo.current = true;
    setBusy(true); setErr(null);
    void (async () => {
      try {
        const r = await fetch('/api/crm-auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: !on }) });
        const j = await r.json();
        if (j.ok) setOn(Boolean(j.habilitado));
        else setErr(j.error || 'No se pudo cambiar');
      } catch {
        // Corto a propósito: el error ocupa el renglón de la explicación, que en un
        // menú de 306 px no da para «prueba de nuevo» — y volver a hacer clic es
        // justamente lo único que se puede hacer.
        setErr('Sin conexión');
      } finally {
        enVuelo.current = false;
        setBusy(false);
      }
    })();
  };

  return { on, busy, err, toggle };
}

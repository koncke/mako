'use client';

// =============================================================================
// «Reportar a Soporte» — EL botón de todo aviso de error de la app (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «en toda la app, SIEMPRE que sale un error, en donde sea, debe aparecer el botón de "Reportar a
// Soporte" y que cuando lo apreten se mande automático un mensaje aquí [la Ticketera] reportando solo lo que pasó». Un solo
// componente para toda la app, y tests/reportar-a-soporte.test.ts lo exige adentro de cada `role="alert"`:
//   · `<ReportarASoporte />` a secas, como ÚLTIMO hijo del aviso: reporta lo que dice el aviso (su texto, sin el de sus
//     botones). Si el aviso está vacío o no es un error (`role` no es «alert»), no se dibuja: hay avisos que están siempre
//     montados y se llenan cuando algo falla.
//   · `<ReportarASoporte error="…" />` donde el error no es un `role="alert"` (el Toast, ErrorState).
// Al tocarlo manda el ticket solo (lib/soporte-reporte.ts → /api/soporte/reportar) y dice «Lo mandamos al equipo».
//
// ⚠️ SÓLO LO QUE PASÓ: el texto del aviso, la pantalla, el último botón que tocó la persona, la hora. Nunca la pantalla
//    entera. Lo sanea acá y otra vez el servidor (sin claves, sin emails ni teléfonos); de quién es, lo dice la sesión.
// ⚠️ SIN CSS NI IMPORTS PESADOS: lo importan ~180 archivos y varios los cargan tests en node.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ROTULO_MANDADO, ROTULO_REPORTAR, RUTA_REPORTAR, TOPE_ACCION, TOPE_ERROR, limpio } from '@/lib/soporte-reporte';

// ── El último botón que tocó la persona: «lo que hacía» cuando salió el error ─────────────────────────────────────────
// Se escucha en la fase de captura, una sola vez para toda la página. Vale 2 minutos: después ya no es «lo que hacía».
// ⚠️ SÓLO BOTONES DE VERDAD, Y NO LOS DE UNA FILA (la revisión de privacidad, 23/10/2026): una tarjeta de lead o de
//    conversación es un `[role=button]` o un botón dentro de una fila, y su texto es el nombre y la vista previa del mensaje.
//    Tampoco cuenta el propio «Reportar a Soporte» (el del toast del editor de video está fuera de `[data-soporte]`).
let ultima: { texto: string; at: number } | null = null;
const VIGENCIA_ACCION_MS = 120_000;
const FILA = 'li[role], tr, [role="row"], [role="listitem"], [role="option"], [role="gridcell"], [data-lead], [data-sonner-toast]';
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.('button, input[type="submit"], input[type="button"]');
    if (!b || b.closest('[data-soporte]') || b.closest(FILA)) return;
    const texto = (b.getAttribute('aria-label') || (b as HTMLElement).innerText || (b as HTMLInputElement).value || '').trim();
    if (texto && texto.length <= TOPE_ACCION && texto !== ROTULO_REPORTAR) ultima = { texto, at: Date.now() };
  }, true);
}
const accionReciente = (): string | undefined => (ultima && Date.now() - ultima.at < VIGENCIA_ACCION_MS ? ultima.texto : undefined);

/** El texto que se ve en un aviso, sin el de sus botones y links (Reintentar, Cerrar) ni el de este botón. */
export function textoDelAviso(aviso: Element): string {
  const partes: string[] = [];
  const recorrer = (n: Node) => {
    if (n.nodeType === 3) { partes.push(n.textContent ?? ''); return; }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    if (el.matches('button, a, [data-soporte], [aria-hidden="true"], script, style')) return;
    el.childNodes.forEach(recorrer);
  };
  aviso.childNodes.forEach(recorrer);
  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

export type ResultadoReporte = { ok: true; id: number; yaExistia: boolean } | { ok: false; error: string };

/** Manda el reporte. Lo usa el botón y lo que no puede tener uno (el aviso de un editor que se dibuja con su propia librería). */
export async function reportarASoporte({ error, accion }: { error: string; accion?: string }): Promise<ResultadoReporte> {
  const cuerpo = {
    error: limpio(error, TOPE_ERROR),
    accion: limpio(accion ?? accionReciente() ?? '', TOPE_ACCION) || undefined,
    ruta: `${window.location.pathname}${window.location.search}`,
    hora: new Date().toISOString(),
    zona: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })(),
    navegador: navigator.userAgent,
    pantalla: `${window.innerWidth}x${window.innerHeight}`,
    idioma: navigator.language,
  };
  try {
    const r = await fetch(RUTA_REPORTAR, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = (await r.json().catch(() => null)) as ResultadoReporte | null;
    if (j && 'ok' in j) return j;
    return { ok: false, error: 'No salió. Vuelve a tocar en un rato.' };
  } catch {
    return { ok: false, error: 'No salió: revisa tu conexión y vuelve a tocar.' };
  }
}

const S_BOTON: CSSProperties = {
  display: 'inline', marginLeft: 8, padding: 0, border: 0, background: 'none', color: 'inherit', font: 'inherit',
  fontSize: '0.92em', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', whiteSpace: 'nowrap',
};
const S_NOTA: CSSProperties = { display: 'inline', marginLeft: 8, fontSize: '0.92em', fontWeight: 600, whiteSpace: 'nowrap' };

/**
 * El botón. Sin `error`, reporta el aviso que lo contiene (su padre, con `role="alert"`). `accion` nombra lo que hacía, si
 * quien lo pone lo sabe mejor que «el último botón que tocó».
 */
export function ReportarASoporte({ error, accion, style }: { error?: string; accion?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [delAviso, setDelAviso] = useState('');
  const [estado, setEstado] = useState<{ k: 'listo' } | { k: 'mandando' } | { k: 'mandado'; id: number } | { k: 'fallo'; texto: string }>({ k: 'listo' });

  // El aviso que lo contiene: se mira lo que dice y si es un error, y se sigue mirando (hay avisos que se llenan después).
  useEffect(() => {
    if (error !== undefined) return;
    // En una lista (<ul role="alert">) el botón va en su propio <li>: el aviso es el de arriba.
    const padre = ref.current?.parentElement;
    const aviso = padre?.tagName === 'LI' && padre.parentElement?.getAttribute('role') === 'alert' ? padre.parentElement : padre;
    if (!aviso) return;
    const mirar = () => setDelAviso(aviso.getAttribute('role') === 'alert' ? textoDelAviso(aviso) : '');
    mirar();
    const obs = new MutationObserver(mirar);
    obs.observe(aviso, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['role'] });
    return () => obs.disconnect();
  }, [error]);

  const texto = (error ?? delAviso).trim();
  // Un error nuevo en el mismo aviso se puede reportar de nuevo.
  useEffect(() => { setEstado({ k: 'listo' }); }, [texto]);

  const mandar = async () => {
    if (estado.k === 'mandando' || !texto) return;
    setEstado({ k: 'mandando' });
    const r = await reportarASoporte({ error: texto, accion });
    setEstado(r.ok ? { k: 'mandado', id: r.id } : { k: 'fallo', texto: r.error });
  };

  return (
    <span ref={ref} data-soporte="" style={texto ? undefined : { display: 'none' }}>
      {estado.k === 'mandado' ? (
        <span role="status" style={S_NOTA}>{ROTULO_MANDADO} · ticket #{estado.id}</span>
      ) : (
        <>
          <button type="button" style={{ ...S_BOTON, ...style }} onClick={() => void mandar()} disabled={estado.k === 'mandando'}
            title="Le manda al equipo lo que pasó: la pantalla, el error y la hora">
            {estado.k === 'mandando' ? 'Mandando…' : ROTULO_REPORTAR}
          </button>
          {estado.k === 'fallo' && <span role="status" style={S_NOTA}>{estado.texto}</span>}
        </>
      )}
    </span>
  );
}

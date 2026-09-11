'use client';

// =============================================================================
// AlertaVozMaKo — la alerta GIGANTE cuando la voz de MaKo se cae
// =============================================================================
// 11/09/2026. La línea de WhatsApp de MaKo estuvo nueve días muerta y nadie se enteró: el
// mail del vigilante no le llegaba a nadie y el panel de /agencia hay que abrirlo. Martín:
// «sería bueno que haya una alerta gigante en admin cuando eso pase». Va arriba de TODAS las
// pantallas de admin, que es donde se mira sin tener que ir a buscarla.
//
// Dos colores y nada más:
//   · ROJA con la caída MEDIDA (`caida`). Manda a reconectar.
//   · ÁMBAR si hace más de media hora que no se puede comprobar (`sinConfirmar`: Evolution
//     caído, key rechazada). NO manda a re-escanear: re-escanear una línea sana la tumba.
// Un «no pude comprobarlo» de un minuto no pinta nada: una alerta que aparece por un timeout
// enseña a ignorarla. Y tampoco APAGA la que había: no es una medición de que volvió.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Alerta = { tipo: 'caida' | 'sin_confirmar'; instancia: string; desde: string | null; status: number };

/** Alto fijo: el hueco que abre en la página lo declara globals.css ([data-alerta-voz]). */
const ALTO = 64;

/** Lo avisa CanalMaKoPanel cuando conecta la línea o muda la voz: la alerta vuelve a medir ya. */
export const EVENTO_VOZ_CAMBIO = 'mako:voz-cambio';

function hace(desde: string): string {
  const min = Math.max(1, Math.round((Date.now() - Date.parse(desde)) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  return `${Math.floor(h / 24)} días`;
}

/** Qué pasa, dicho según lo que contestó Evolution. Nunca el mensaje crudo en inglés. */
function textoSinConfirmar(status: number): string {
  if (status === 401 || status === 403) return 'Evolution rechaza la EVOLUTION_API_KEY: revísala. No re-escanees el QR.';
  if (status > 0) return `Evolution contesta con error HTTP ${status}. No re-escanees el QR: revisa el servidor de Evolution.`;
  return 'No hubo respuesta al comprobar la línea (Evolution o la base de datos). No re-escanees el QR.';
}

const unaLinea = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;

export function AlertaVozMaKo() {
  const pathname = usePathname() || '';
  const [alerta, setAlerta] = useState<Alerta | null>(null);

  useEffect(() => {
    let vivo = true;
    const cargar = (fresco = false) => {
      // Una pestaña en segundo plano no pregunta: cada pedido termina en una consulta real a
      // WhatsApp, y Martín trabaja con una pestaña por cliente. Al volver a la pestaña, sí.
      if (document.visibilityState === 'hidden') return;
      fetch(`/api/admin/voz-alerta${fresco ? '?fresco=1' : ''}`)
        .then((r) => r.json())
        .then((j) => {
          // Sin una respuesta válida no se afirma nada: queda lo último que se midió.
          if (!vivo || !j?.ok) return;
          const tipo = j.caida ? 'caida' : j.sinConfirmar ? 'sin_confirmar' : null;
          // ⚠️ «No pude comprobar» sin alerta NO apaga la que había. Apagaba la roja en todas las
          // pestañas por un timeout de 4 s (segunda revisión del 11/09/2026).
          if (!tipo && j.medido === false) return;
          setAlerta(tipo ? { tipo, instancia: String(j.instancia ?? ''), desde: j.desde ?? null, status: Number(j.status ?? 0) } : null);
        })
        .catch(() => {});
    };
    const alVolver = () => cargar();
    const alCambiar = () => cargar(true);
    cargar();
    // Cada minuto: la alerta tiene que aparecer sin recargar, y desaparecer sola al reconectar.
    const t = setInterval(cargar, 60_000);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener(EVENTO_VOZ_CAMBIO, alCambiar);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener(EVENTO_VOZ_CAMBIO, alCambiar);
    };
  }, []);

  // Abre su hueco por atributo en <html>, el mismo mecanismo que la barra de agencia.
  // ⚠️ ARRIBA del `return null`: un hook que solo corre en algunos renders rompe la pantalla
  // entera con el error #310 (ver ImpersonationBanner).
  useEffect(() => {
    if (!alerta) return;
    document.documentElement.setAttribute('data-alerta-voz', '1');
    return () => document.documentElement.removeAttribute('data-alerta-voz');
  }, [alerta]);

  if (!alerta) return null;
  const roja = alerta.tipo === 'caida';
  const fondo = roja ? '#C0271D' : '#9A5B00';
  // En /agencia el panel de la línea ya está en la pantalla: un link que recarga la página
  // tiraría el QR que se está escaneando.
  const enAgencia = pathname.startsWith('/agencia');

  return (
    <div role="alert" style={{
      position: 'fixed', left: 0, right: 0, height: ALTO,
      // Debajo de la barra de agencia si está prendida: `--barra-agencia` ya suma esta alerta.
      top: `calc(var(--barra-agencia) - ${ALTO}px)`,
      // ⚠️ POR DEBAJO de los modales y wizards a pantalla completa (z ≥ 60). Por encima les
      // tapaba el encabezado y el botón de cerrar (revisión del 11/09/2026); al cerrarlos, la
      // alerta sigue ahí.
      zIndex: 55,
      display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px',
      background: fondo, color: '#fff', boxShadow: '0 2px 14px rgba(0,0,0,.28)',
    }}>
      <style>{'@keyframes mako-alerta-voz{0%,100%{opacity:1}50%{opacity:.3}}'}</style>
      <span aria-hidden style={{ fontSize: 26, animation: roja ? 'mako-alerta-voz 1.2s infinite' : undefined }}>{roja ? '🚨' : '⚠️'}</span>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ fontWeight: 700, fontSize: 16, ...unaLinea }}>
          {roja ? 'MaKo no puede hablar por WhatsApp' : 'No puedo comprobar si MaKo puede hablar por WhatsApp'}
          {alerta.desde ? ` · hace ${hace(alerta.desde)}` : ''}
        </div>
        <div style={{ fontSize: 13, opacity: 0.92, ...unaLinea }}>
          {roja
            ? `La línea ${alerta.instancia} se desconectó: no entran ni salen mensajes, los clientes le escriben a una pared y los avisos se pierden.`
            : textoSinConfirmar(alerta.status)}
        </div>
      </div>
      {enAgencia ? (
        <span style={{ flex: 'none', fontSize: 13, fontWeight: 600, opacity: 0.95 }}>
          {roja ? 'Reconéctala desde el panel de la línea' : 'Estado en el panel de la línea'}
        </span>
      ) : (
        <a href="/agencia?canal=1" style={{
          flex: 'none', padding: '10px 18px', borderRadius: 10, background: '#fff', color: fondo,
          fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}>
          {roja ? 'Reconectar ahora' : 'Ver estado'}
        </a>
      )}
    </div>
  );
}

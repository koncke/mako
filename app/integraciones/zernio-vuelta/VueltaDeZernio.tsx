'use client';

// La landing de la ventana del login de Zernio (ver page.tsx). Le manda el resultado a la pantalla que la abrió y se cierra.
//
// Por DOS caminos, porque uno solo se rompe: `window.opener.postMessage` (el de siempre) y un `BroadcastChannel` del mismo origen.
// Las redes que ponen `Cross-Origin-Opener-Policy` (Meta puede hacerlo en su pantalla de login) cortan el vínculo con la ventana
// y `window.opener` llega en null: sin el canal la pantalla no se enteraría hasta el próximo sondeo. Los dos llevan una PISTA:
// quien los recibe igual mide con el servidor.

import { useEffect, useState } from 'react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { CANAL_VENTANA, TIPO_MENSAJE_VENTANA, esFlujoValido, retornoDeZernio, textoDeErrorDeRetorno, type MensajeVentana } from '@/lib/zernio-redes';

type Estado = { tipo: 'ok' | 'error'; texto: string };

export default function VueltaDeZernio() {
  const [estado, setEstado] = useState<Estado | null>(null);
  // `?ws=` con el que llegó (un admin de plataforma mirando un cliente): sin él «Volver» lo dejaba en SU negocio.
  const [volverAMako, setVolverAMako] = useState('/integraciones?abrir=zernio');
  useEffect(() => {
    const ws = new URLSearchParams(window.location.search).get('ws');
    if (ws && /^\d{1,10}$/.test(ws)) setVolverAMako(`/integraciones?abrir=zernio&ws=${ws}`);
  }, []);

  useEffect(() => {
    const r = retornoDeZernio(window.location.search);
    // El `f` es el id del flujo (el clic) que abrió esta ventana: la pantalla sólo mira los avisos del suyo.
    const f = new URLSearchParams(window.location.search).get('f');
    const mensaje: MensajeVentana = {
      tipo: TIPO_MENSAJE_VENTANA, conectado: r.conectado, accountId: r.accountId, error: r.error, mensaje: r.mensaje, flujo: esFlujoValido(f) ? f : null,
    };
    try {
      if (window.opener && !window.opener.closed) window.opener.postMessage(mensaje, window.location.origin);
    } catch { /* el vínculo se cortó: queda el canal */ }
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const canal = new BroadcastChannel(CANAL_VENTANA);
        canal.postMessage(mensaje);
        canal.close();
      }
    } catch { /* sin canal: la pantalla mide igual cada pocos segundos */ }

    if (r.error) setEstado({ tipo: 'error', texto: textoDeErrorDeRetorno(r.error, r.mensaje) });
    else setEstado({ tipo: 'ok', texto: 'Listo. Ya puedes cerrar esta ventana.' });
    // Se cierra sola (`window.close` sólo anda en una ventana que abrió un script, y esta lo es). Con un error se queda unos segundos
    // más: la persona tiene que alcanzar a leer qué pasó.
    const t = setTimeout(() => { try { window.close(); } catch { /* queda el aviso */ } }, r.error ? 6000 : 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", textAlign: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', maxWidth: 360 }}>
        {estado?.tipo === 'error'
          ? <span role="alert" style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--bad)' }}>{estado.texto}<ReportarASoporte /></span>
          : <span role="status" style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--ink)' }}>{estado?.texto ?? 'Un momento…'}</span>}
        <a href={volverAMako} style={{ fontSize: 13, color: 'var(--primary)' }}>Volver a MaKo</a>
      </div>
    </main>
  );
}

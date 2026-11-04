'use client';

// =============================================================================
// TarjetaAvisos — el paso obligatorio del onboarding: los avisos en el teléfono
// =============================================================================
// Martín, 3/11/2026: los avisos pasan a la app, y sin el teléfono activado no le llega nada. Pregunta una cosa según el dispositivo (`pasoDeAvisos`):
//   · en la computadora: el QR del link único (`/app`), y espera sola. Quien escanea instala MaKo, entra y sigue este paso en el teléfono; la computadora lo ve y avanza;
//   · en el teléfono: el botón. ⚠️ `activarAvisos()` es lo PRIMERO del `onClick`: el permiso se pide dentro del toque (lib/push-cliente.ts);
//   · en un iPhone sin la app agregada a inicio: los pasos, porque en una pestaña de Safari no existe Web Push;
//   · con el permiso bloqueado: cómo destrabarlo, sin un botón que no puede hacer nada;
//   · en un navegador que no los recibe: la única salida, «Mi teléfono no puede».
//
// El estado no se recuerda: la pantalla le pregunta al server cada pocos segundos (`onRevisar`) y al volver a la pestaña.
// =============================================================================

import { useEffect, useState } from 'react';
import { Button } from '@/app/_ui';
import { activarAvisos, asegurarRegistro, esAppInstalada, estadoSuscripcion, probar, type EstadoAvisos } from '@/lib/push-cliente';
import { esTelefonoPorUA, pasoDeAvisos } from '@/lib/avisos-telefono-reglas';
import { RUTA_APP, TIENDAS } from '@/lib/app-tiendas';
import { comoDesbloquear, pasosInstalar, toastDeActivar } from '@/app/m/cuenta/cuenta-ui';

const CADA_MS = 4000;

export function TarjetaAvisos({ qr, onRevisar, onSinSoporte }: { qr: string | null; onRevisar: () => void; onSinSoporte: () => void }) {
  const [telefono, setTelefono] = useState<boolean | null>(null);
  const [ios, setIos] = useState(false);
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Lo del dispositivo se lee después de montar: el server no sabe qué teléfono es.
  useEffect(() => {
    const ua = navigator.userAgent || '';
    setTelefono(esTelefonoPorUA(ua, navigator.maxTouchPoints ?? 0));
    setIos(/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1));
    const leer = () => { estadoSuscripcion().then(setEstado).catch(() => setEstado('no-soportado')); };
    leer();
    const alVolver = () => { if (document.visibilityState === 'visible') { leer(); onRevisar(); } };
    document.addEventListener('visibilitychange', alVolver);
    const t = window.setInterval(onRevisar, CADA_MS);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [onRevisar]);

  const paso = pasoDeAvisos({ telefono, estado });

  // Este navegador ya está suscripto y el server no lo sabe: se registra sin pedir nada.
  useEffect(() => {
    if (paso !== 'registrando') return;
    void asegurarRegistro().then(() => onRevisar());
  }, [paso, onRevisar]);

  // ⚠️ Primera línea del handler: el permiso se pide DENTRO del toque.
  const activar = () => {
    const pedido = activarAvisos();
    setOcupado(true);
    setAviso(null);
    void pedido.then(async (r) => {
      if (r.ok) {
        setEstado('activo');
        // La prueba, de una: que lo vea llegar. Si no llega igual queda activo: el paso mide la suscripción.
        await probar().catch(() => null);
        onRevisar();
        return;
      }
      if (r.estado === 'bloqueado' || r.estado === 'instalar-primero' || r.estado === 'no-soportado' || r.estado === 'apagado') setEstado(r.estado);
      if (r.estado === 'apagado') setAviso('Sin el permiso no te llegan los avisos.');
      else if (r.estado !== 'bloqueado' && r.estado !== 'instalar-primero' && r.estado !== 'no-soportado') setAviso(toastDeActivar(r.estado));
    }).catch(() => setAviso('No se pudo activar.')).finally(() => setOcupado(false));
  };

  return (
    <div className="arr-tarjeta">
      {paso === 'qr' && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- el QR viene armado del server, como en /perfil/instalar */}
          {qr && <img src={qr} alt="QR para abrir MaKo en tu teléfono" width={168} height={168} style={{ borderRadius: 8, alignSelf: 'center' }} />}
          <span className="arr-tarjeta__titulo">Escanéalo con tu teléfono</span>
          <span className="arr-tarjeta__nota">Instala MaKo, entra con tu cuenta y activa los avisos. Sigo solo cuando estén.</span>
        </>
      )}
      {paso === 'activar' && (
        <Button variant="primary" size="sm" loading={ocupado} disabled={ocupado} onClick={activar}>Activar avisos</Button>
      )}
      {(paso === 'registrando' || paso === 'revisando') && <span className="arr-tarjeta__nota">Revisando tu teléfono…</span>}
      {paso === 'instalar-ios' && (
        TIENDAS.ios.publicada ? (
          <>
            <span className="arr-tarjeta__titulo">En iPhone, primero instala MaKo</span>
            <a className="arr-link arr-link--principal" href={RUTA_APP}>Instalar MaKo</a>
            <span className="arr-tarjeta__nota">Entra con tu cuenta y sigues aquí.</span>
          </>
        ) : (
          <>
            <span className="arr-tarjeta__titulo">En iPhone, primero agrega MaKo a inicio</span>
            <ol className="arr-etapas">
              {pasosInstalar(true).map((p, i) => <li key={p.frase} className="arr-etapa"><span className="arr-etapa__n">{i + 1}</span>{p.frase}</li>)}
            </ol>
            <span className="arr-tarjeta__nota">Entra con tu cuenta y sigues aquí.</span>
          </>
        )
      )}
      {paso === 'bloqueado' && (
        <>
          <span className="arr-tarjeta__titulo">Los avisos están bloqueados</span>
          <span className="arr-tarjeta__nota">{comoDesbloquear(ios, esAppInstalada())}</span>
          <Button variant="secondary" size="sm" onClick={() => { void estadoSuscripcion().then(setEstado).catch(() => {}); onRevisar(); }}>Ya los activé</Button>
        </>
      )}
      {paso === 'no-soportado' && (
        <>
          <span className="arr-tarjeta__titulo">Este navegador no recibe avisos</span>
          <span className="arr-tarjeta__nota">Abre MaKo en Chrome. Si tu teléfono no puede, los ves adentro de MaKo.</span>
          <Button variant="secondary" size="sm" onClick={onSinSoporte}>Mi teléfono no puede</Button>
        </>
      )}
      {aviso && <span className="arr-tarjeta__nota">{aviso}</span>}
    </div>
  );
}

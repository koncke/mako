'use client';

// =============================================================================
// GuiaApp — lo que ve quien abre /app y todavía no hay tienda a la que mandarlo
// =============================================================================
// En un teléfono, los pasos de su sistema para dejar MaKo en la pantalla de inicio, y el botón de Chrome si dejó el aviso. En una computadora, el QR.
// ⚠️ Un iPad moderno se presenta como una Mac: el server le da el QR, y recién acá se sabe que es táctil.
// =============================================================================

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from '@/app/_ui/Link';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { destinoDeLaApp, type DestinoApp } from '@/lib/app-tiendas';
import { pedirInstalacion, puedeOfrecerInstalacion, suscribirInstalacion } from '@/lib/movil-instalar';
import { pasosInstalar } from '@/app/m/cuenta/cuenta-ui';

const CSS = `
.gapp { min-height: 100dvh; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 32px 16px; background: var(--bg, var(--surface)); color: var(--ink); text-align: center; }
.gapp__caja { width: min(420px, 100%); display: flex; flex-direction: column; align-items: center; gap: 16px; }
.gapp__titulo { margin: 0; font-size: 24px; font-weight: 650; }
.gapp__nota { margin: 0; font-size: 15px; line-height: 1.45; color: var(--dim); }
.gapp__qr { width: min(240px, 70vw); height: auto; border-radius: 12px; background: #fff; padding: 8px; box-sizing: border-box; }
.gapp__pasos { width: 100%; margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; text-align: left; }
.gapp__paso { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border); font-size: 15px; }
.gapp__n { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--border); font-size: 14px; font-weight: 600; }
.gapp__boton { width: 100%; min-height: 44px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; border: 0; background: var(--ink); color: var(--surface); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; text-decoration: none; }
.gapp__link { font-size: 15px; color: var(--dim); text-decoration: underline; }
`;

export function GuiaApp({ inicial, qr }: { inicial: DestinoApp; qr: string | null }) {
  const [destino, setDestino] = useState<DestinoApp>(inicial);
  const puedePedir = useSyncExternalStore(suscribirInstalacion, puedeOfrecerInstalacion, () => false);

  useEffect(() => {
    if (inicial.tipo !== 'qr' || !/Macintosh/i.test(navigator.userAgent) || (navigator.maxTouchPoints ?? 0) <= 1) return;
    const d = destinoDeLaApp('ios');
    if (d.tipo === 'tienda') window.location.replace(d.url);
    else setDestino(d);
  }, [inicial.tipo]);

  return (
    <main className="gapp">
      <style>{CSS}</style>
      <MakoLogo size={40} />
      <div className="gapp__caja">
        {destino.tipo === 'qr' ? (
          <>
            <h1 className="gapp__titulo">MaKo en tu teléfono</h1>
            {/* eslint-disable-next-line @next/next/no-img-element -- el QR viene armado del server, como en /perfil/instalar */}
            {qr && <img className="gapp__qr" src={qr} alt="QR para instalar MaKo en tu teléfono" width={240} height={240} />}
            <p className="gapp__nota">Escanéalo con la cámara de tu teléfono.</p>
          </>
        ) : destino.tipo === 'guia' ? (
          <>
            <h1 className="gapp__titulo">Instala MaKo</h1>
            {destino.plataforma === 'android' && puedePedir && (
              <button type="button" className="gapp__boton" onClick={() => void pedirInstalacion()}>Instalar MaKo</button>
            )}
            <ol className="gapp__pasos">
              {pasosInstalar(destino.plataforma === 'ios').map((p, i) => (
                <li key={p.frase} className="gapp__paso"><span className="gapp__n" aria-hidden>{i + 1}</span>{p.frase}</li>
              ))}
            </ol>
            <Link className="gapp__link" href="/inicio">Entrar a MaKo</Link>
          </>
        ) : null}
      </div>
    </main>
  );
}

'use client';

// =============================================================================
// Lead Magnet Generator — «MaKo te propone» (6/11/2026)
// =============================================================================
// Arriba de las plantillas de «Nuevo lead magnet» (el hueco `arribaDePlantillas` de PantallaCrear): MaKo propone hasta 3 lead
// magnets desde la oferta del negocio y lo que hace su competencia en Competitors Spy, con la IA del NEGOCIO
// (lib/lead-magnets/proponer.ts). Se pide con un botón (cuesta la IA del negocio): al entrar no se gasta nada, y se ve la última
// propuesta guardada. «Armar este» crea la pieza con su plantilla y su nombre, como una tarjeta de la galería.
// Lo que falta para proponer (la oferta, su IA) se dice con el lugar donde se arregla: Offer, o «Tus cuentas de IA» ahí mismo; y si
// la IA del negocio falló (cuota, saturada), sus salidas (`ErrorIA`).
// =============================================================================

import { useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { Button } from '@/app/_ui/Button';
import Link from '@/app/_ui/Link';
import ErrorIA from '@/app/_components/ErrorIA';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { plantillaLeadMagnet } from '@/lib/lead-magnets/plantillas';
import { ROTULO_FUENTE, type PropuestaLM } from '@/lib/lead-magnets/propuesta';
import { pedirLeadMagnet } from './cliente';

// «Tus cuentas de IA» ahí mismo (sin salir de la tab), como la apertura de MaKo. Entra con `next/dynamic`: trae CSS.
const ModalCuentasIA = dynamic(() => import('@/app/_chat/ModalCuentasIA'), { ssr: false, loading: () => null });

type Error = { texto: string; falta?: 'oferta' | 'ia' };

export function PropuestasMaKo({ propuestas, onPropuestas, onArmar }: {
  /** Lo que propuso MaKo. Vive en la pantalla de arriba: «Nuevo» se desmonta al abrir otra cosa, y lo que se pagó no se pierde. */
  propuestas: PropuestaLM[];
  onPropuestas: (p: PropuestaLM[]) => void;
  /** Crea la pieza (la misma acción que una tarjeta de la galería). Un texto de vuelta es el error. */
  onArmar: (plantilla: string, nombre: string) => Promise<string | null>;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  const [armando, setArmando] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vacio, setVacio] = useState(false);
  const [conectando, setConectando] = useState(false);

  const proponer = async () => {
    if (pidiendo) return;
    setPidiendo(true); setError(null); setAviso(null); setVacio(false);
    const r = await pedirLeadMagnet<{ propuestas: PropuestaLM[]; aviso: string | null }>({ accion: 'proponer' }, { timeoutMs: 95_000 });
    setPidiendo(false);
    if (!r.ok) { setError({ texto: r.error, ...(r.falta === 'oferta' || r.falta === 'ia' ? { falta: r.falta } : {}) }); return; }
    if (r.aviso) setAviso(r.aviso);
    // Sin ninguna que valga, la anterior queda (el server tampoco la pisa) y se dice.
    if (!r.propuestas.length) { setVacio(true); return; }
    onPropuestas(r.propuestas);
  };

  const armar = async (p: PropuestaLM) => {
    if (armando) return;
    setArmando(p.nombre); setError(null);
    const e = await onArmar(p.plantilla, p.nombre);
    setArmando(null);
    if (e) setError({ texto: e });
  };

  return (
    // Con el título de una sección de plantillas (`cr-plantillas__titulo`): se lee como una sección más de «Nuevo».
    <section className="cr-plantillas lmg-propone" aria-label="MaKo te propone">
      <div className="lmg-propone__cab">
        <div>
          <h2 className="cr-plantillas__titulo">MaKo te propone</h2>
          <p className="lmg-propone__sub">Desde tu oferta y lo que hace tu competencia.</p>
        </div>
        <Button variant="secondary" size="sm" loading={pidiendo} onClick={() => void proponer()}>
          {propuestas.length ? 'Proponer otros' : 'Proponer'}
        </Button>
      </div>
      {pidiendo && <p className="lmg-aviso" role="status">MaKo está leyendo tu oferta y tu competencia. Puede tardar hasta un minuto.</p>}
      {error && (
        <p className="lmg-error" role="alert">
          {error.texto}
          {error.falta === 'oferta' && <Link href="/offer">Ir a Offer</Link>}
          {error.falta === 'ia' && <Button variant="secondary" size="sm" onClick={() => setConectando(true)}>Conectar mi IA</Button>}
          <ReportarASoporte />
        </p>
      )}
      {/* La IA del negocio falló (cuota, saturada, una key vencida): las salidas para destrabarla, ahí mismo. */}
      {error && !error.falta && <ErrorIA error={error.texto} soloSalida onConectada={() => setError(null)} />}
      {conectando && typeof document !== 'undefined' && createPortal(<ModalCuentasIA onCerrar={() => { setConectando(false); setError(null); }} />, document.body)}
      {aviso && <p className="lmg-aviso" role="status">{aviso}</p>}
      {vacio && <p className="lmg-aviso" role="status">Esta vez no salió ninguno que valga la pena. Prueba de nuevo, o arma uno con una plantilla.</p>}
      {propuestas.length > 0 && (
        <ul className="lmg-propone__lista">
          {propuestas.map((p) => {
            const pl = plantillaLeadMagnet(p.plantilla);
            return (
              <li key={`${p.plantilla}:${p.nombre}`} className="lmg-propone__fila">
                <div className="lmg-propone__texto">
                  <p className="lmg-propone__nombre">{p.nombre}</p>
                  <p className="lmg-propone__porque">{p.porQue}</p>
                  <p className="lmg-propone__meta">{pl ? `${pl.emoji} ${pl.nombre}` : null} · {ROTULO_FUENTE[p.fuente]}</p>
                </div>
                <Button variant="secondary" size="sm" loading={armando === p.nombre} disabled={!!armando && armando !== p.nombre} onClick={() => void armar(p)}>Armar este</Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

'use client';

// =============================================================================
// Lead Magnet Generator — la pantalla (5/11/2026)
// =============================================================================
// La pantalla de Create (app/_crear/PantallaCrear.tsx): el chat de MaKo a la izquierda, con la «←» a la lista de lead magnets
// del negocio, y «Nuevo lead magnet» con las plantillas. Una plantilla crea la pieza en su herramienta y lleva ahí (Copywriting
// o el Web Generator): esta tab no es un editor. Un lead magnet abierto muestra qué le falta para llegarle a un lead: su link
// público y la página donde lo piden. El porqué y la fuente del diseño: docs/investigacion-lead-magnets.md.
// =============================================================================

import './lead-magnets.css';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { PantallaCrear, type PlantillaCrear, type ProyectoCrear } from '@/app/_crear/PantallaCrear';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { rotuloDeEjemplo } from '@/app/_crear/ejemplo';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { plantillaLeadMagnet } from '@/lib/lead-magnets/plantillas';
import {
  EJEMPLOS_LEAD_MAGNET, RUTA_TAB, plantillasParaCrear, proyectosDe, type LeadMagnetVista,
} from './reglas';
import { DetalleLeadMagnet, type LandingVista } from './DetalleLeadMagnet';
import { pedirLeadMagnet } from './cliente';

export function LeadMagnets({ lista, error, actual, landingPieza, landingCaptura }: {
  lista: LeadMagnetVista[];
  error: string | null;
  actual: string | null;
  landingPieza: LandingVista | null;
  landingCaptura: LandingVista | null;
}) {
  const router = useRouter();
  const [ejemplo, setEjemplo] = useState<string | null>(null);
  const [errorEjemplo, setErrorEjemplo] = useState<string | null>(null);
  const [usandoEjemplo, setUsandoEjemplo] = useState(false);
  const plantillas = useMemo(() => plantillasParaCrear(), []);
  const abierto = actual ? lista.find((x) => x.id === actual) ?? null : null;

  const proyectos: ProyectoCrear[] = useMemo(() => proyectosDe(lista).map((p) => ({
    ...p,
    menu: [{
      rotulo: 'Quitar de la lista', peligro: true,
      confirmar: `¿Quitar «${p.nombre}» de tus lead magnets? Su página sigue donde está.`,
      hacer: async () => {
        const r = await pedirLeadMagnet({ accion: 'quitar', id: p.id });
        if (r.ok) router.replace(RUTA_TAB);
        router.refresh();
      },
    }],
  })), [lista, router]);

  const usar = useCallback(async (pl: PlantillaCrear): Promise<string | null> => {
    const r = await pedirLeadMagnet<{ ruta: string; aviso: string | null }>({ accion: 'armar', plantilla: pl.id });
    if (!r.ok) return r.error;
    if (r.aviso) return r.aviso;
    router.push(r.ruta);
    return null;
  }, [router]);

  const pl = ejemplo ? plantillaLeadMagnet(ejemplo) : null;
  return (
    <>
      <PantallaCrear
        tab="Lead Magnet"
        nuevo="Nuevo lead magnet"
        proyectos={error ? [] : proyectos}
        errorProyectos={error}
        onReintentar={() => router.refresh()}
        actual={abierto?.id ?? null}
        plantillas={plantillas}
        onPlantilla={usar}
        onVerEjemplo={(p) => setEjemplo(p.id)}
        ejemplos={EJEMPLOS_LEAD_MAGNET}
      >
        {abierto ? <DetalleLeadMagnet key={abierto.id} lm={abierto} landingPieza={landingPieza} landingCaptura={landingCaptura} esPrimero={lista[0]?.id === abierto.id} /> : null}
      </PantallaCrear>
      {pl && (
        <Modal titulo={pl.ejemplo.titulo} onCerrar={() => { setEjemplo(null); setErrorEjemplo(null); }} ancho={640}
          pie={(
            <>
              <Button variant="secondary" onClick={() => { setEjemplo(null); setErrorEjemplo(null); }}>Cerrar</Button>
              <Button variant="primary" loading={usandoEjemplo} onClick={async () => {
                setUsandoEjemplo(true);
                setErrorEjemplo(null);
                const e = await usar({ id: pl.id, nombre: pl.nombre });
                setUsandoEjemplo(false);
                if (e) setErrorEjemplo(e); else setEjemplo(null);
              }}>Usar esta estructura</Button>
            </>
          )}>
          <p className="lmg-cinta">{rotuloDeEjemplo(pl.ejemplo.negocio)}</p>
          {errorEjemplo && <p className="lmg-error" role="alert">{errorEjemplo}<ReportarASoporte /></p>}
          <div className="lmg-ejemplo">
            {pl.ejemplo.partes.map((parte) => (
              <section key={parte.titulo}>
                <h3>{parte.titulo}</h3>
                {parte.texto.split('\n').map((l, i) => <p key={i}>{l}</p>)}
              </section>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

'use client';

// =============================================================================
// AvataresM — «Avatars» de AI Avatar en el teléfono: la grilla de retratos y la hoja «Crear un look»
// =============================================================================
// Ver ./page.tsx. Los looks en camino se preguntan solos cada 6 s (`estadoLookAction`, como escritorio) y al
// terminar se relee la página. La hoja de crear se abre sola si se llegó con `?plantilla=` (el «Usar» de Templates).
// =============================================================================

import { useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import Link, { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { crearLookAction, estadoLookAction, type InicioOut, type LookCard } from '@/app/ai-avatar/actions';
import { SONDEO_MS } from '@/app/ai-avatar/filmar';
import { avisarPuente } from '@/app/video-generator/avisar-puente';
import { PLANTILLAS_AVATAR } from '@/lib/ai-avatar/plantillas';
import { ComputadoraM, PieFijoM, PieM, SeccionM, SheetM, VacioM, useConexion, useToastM } from '@/app/m/_ui';
import { ErrorLineaM } from '../../_creacion/escritor';
import { PortadaM } from '../piezas';

type Inicio = Extract<InicioOut, { ok: true }>;

export function AvataresM({ inicio, plantillaInicial }: { inicio: Inicio; plantillaInicial?: string }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [looks, setLooks] = useState<LookCard[]>(inicio.looks);
  const [hoja, setHoja] = useState(!!plantillaInicial);
  const [fotoId, setFotoId] = useState(inicio.fotos[0]?.id ?? '');
  const [plantillaId, setPlantillaId] = useState(plantillaInicial ?? '');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  // Lo que llega del server (al refrescar) manda: los looks nuevos que la pantalla sumó ya están ahí.
  useEffect(() => { setLooks(inicio.looks); }, [inicio.looks]);

  // Los looks en camino se preguntan solos, y se le avisa al puente que hay trabajo.
  const clave = looks.filter((l) => l.estado === 'generando').map((l) => l.id).join(',');
  useEffect(() => {
    if (!clave) return;
    const t = setInterval(async () => {
      avisarPuente();
      let cambio = false;
      for (const id of clave.split(',')) {
        const r = await estadoLookAction(id).catch(() => null);
        if (r?.ok && r.look.estado !== 'generando') {
          cambio = true;
          setLooks((xs) => xs.map((x) => (x.id === id ? r.look : x)));
        }
      }
      if (cambio) router.refresh();
    }, SONDEO_MS);
    return () => clearInterval(t);
  }, [clave, router]);

  const crear = async () => {
    if (enviando) return;
    setAviso(''); setEnviando(true);
    try {
      const r = await crearLookAction({ plantillaId, fotoId });
      if (!r.ok) { setAviso(r.error); return; }
      avisarPuente();
      setLooks((xs) => [r.look, ...xs]);
      setHoja(false);
      toast('Creando el look');
    } catch {
      setAviso('No se pudo pedir el look. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setEnviando(false);
    }
  };

  const enCurso = looks.filter((l) => l.estado !== 'listo');
  const vacio = inicio.avatares.length === 0 && enCurso.length === 0;

  return (
    <>
      {vacio ? (
        <VacioM frase="Todavía no tienes avatares." />
      ) : (
        <SeccionM titulo="Tus avatares">
          <div className="m-ai-avatar-grilla">
            {enCurso.map((l) => (
              <div key={l.id} className="m-ai-avatar-retrato m-ai-avatar-retrato--curso">
                <div className="m-ai-avatar-toma__vacia">
                  {l.estado === 'generando' ? <span className="mk-spin" aria-label="Creando" /> : <span>{l.error || 'No salió'}</span>}
                </div>
                <span className="m-ai-avatar-retrato__pie">{l.estado === 'generando' ? `Creando «${l.nombre}»` : l.nombre}</span>
              </div>
            ))}
            {inicio.avatares.map((a) => (
              <Link key={a.id} className="m-ai-avatar-retrato" href={`/m/ai-avatar?avatar=${encodeURIComponent(a.id)}`}
                aria-label={`Crear un video con ${a.lugar || 'este avatar'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" loading="lazy" />
                <span className="m-ai-avatar-retrato__pie">{a.lugar || (a.origen === 'anuncio' ? 'De un anuncio' : 'Look')}</span>
              </Link>
            ))}
          </div>
        </SeccionM>
      )}

      <PieFijoM>
        <Button variant="primary" size="lg" full icon={<Icon name="plus" size={18} />} disabled={!enLinea}
          onClick={() => { setAviso(''); setHoja(true); }}>
          Crear un look
        </Button>
      </PieFijoM>

      <SheetM
        id="crear-look"
        abierto={hoja}
        onCerrar={() => setHoja(false)}
        titulo="Crear un look"
        snap="alto"
        ocupado={enviando}
        rotuloCerrar="Cerrar"
        pie={(
          <PieM consecuencia={inicio.puente.puede ? 'Tu foto en esa escena. Las imágenes no gastan créditos de Flow.' : inicio.puente.motivo}>
            <Button variant="primary" size="lg" full loading={enviando}
              disabled={!inicio.puente.puede || !fotoId || !plantillaId || !enLinea} onClick={() => void crear()}>
              Crear look
            </Button>
          </PieM>
        )}
      >
        <SeccionM titulo="Tu foto">
          {inicio.fotos.length === 0 ? (
            <ComputadoraM que="Subir tu foto, en Video Generator" />
          ) : (
            <div className="m-ai-avatar-fotos" data-m-sin-pull>
              {inicio.fotos.map((f) => (
                <button key={f.id} type="button" className="m-ai-avatar-foto" aria-pressed={fotoId === f.id}
                  aria-label="Tu foto" onClick={() => setFotoId(f.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </SeccionM>
        <SeccionM titulo="El tema">
          <div className="m-ai-avatar-grilla">
            {PLANTILLAS_AVATAR.map((p) => (
              <button key={p.id} type="button" className="m-ai-avatar-tema" aria-pressed={plantillaId === p.id}
                onClick={() => setPlantillaId(p.id)}>
                <PortadaM p={p} />
                <span className="m-ai-avatar-tema__nombre">{p.nombre}</span>
              </button>
            ))}
          </div>
        </SeccionM>
        {aviso && <ErrorLineaM>{aviso}</ErrorLineaM>}
      </SheetM>
    </>
  );
}

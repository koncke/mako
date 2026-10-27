'use client';

// =============================================================================
// El estudio de video — el ANUNCIO NUEVO, en una sola pantalla (27/10/2026)
// =============================================================================
// Copiado de la pantalla de crear de ARCADS: el guion en su campo, el «actor» de una biblioteca (acá, el FORMATO con su
// video de ejemplo), la «situation» (acá, el LUGAR) y un solo botón. La regla que decide qué dice y si responde vive en
// ./composer.ts (puro, con test); esta pantalla sólo la dibuja.
//
// Lo que se fue del recorrido viejo, y por qué: el catálogo a pantalla completa, «Así se verá tu anuncio» (el ejemplo ahora
// es la tarjeta misma) y «¿Cuál de tus guiones…?» eran tres pantallas para tres decisiones que se toman mirándolas juntas.
// =============================================================================

import { useMemo, useState } from 'react';
import { Alert, Button } from '@/app/_ui';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import Link, { useRouter } from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { puestasOfrecidas, puestaPorId, type Puesta } from '@/lib/puestas-data';
import type { GuionDisponible } from '../guiones-datos';
import type { PlanGuardado, EstadoContextoVideo } from '../video-datos';
import { generarPlanAction } from '../actions';
import { CargarGuiones } from '../CargarGuiones';
import { rutaSeccion, lugarSeccion } from '@/lib/secciones-negocio';
import { LUGAR_MAKO, estadoDelComposer, lugarValido, lugaresPara, planExistente } from './composer';
import { DetalleFormato, DetalleGuion, TarjetaFormato } from './piezas';

/** El valor del renglón «Pegar un guion» del desplegable: no es un guion, abre el modal de cargar. */
const PEGAR = '__pegar';

export function Composer({ guiones, historial, contexto, puenteAnda, extensionVieja, avisos, onCreado, onAbrir }: {
  guiones: GuionDisponible[];
  historial: PlanGuardado[];
  contexto: EstadoContextoVideo | null;
  puenteAnda: boolean;
  extensionVieja: boolean;
  /** Los avisos del navegador (extensión vieja, puente caído): arriba de todo, que es donde bloquean. */
  avisos?: React.ReactNode;
  onCreado: (item: PlanGuardado, historial: PlanGuardado[]) => void;
  onAbrir: (id: string) => void;
}) {
  const router = useRouter();
  const PUESTAS = useMemo(() => puestasOfrecidas(), []);
  const [guionId, setGuionId] = useState('');
  const [puestaId, setPuestaId] = useState('');
  const [lugar, setLugar] = useState<string>(LUGAR_MAKO);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [verGuion, setVerGuion] = useState<GuionDisponible | null>(null);
  const [verFormato, setVerFormato] = useState<Puesta | null>(null);

  const guion = guiones.find((g) => g.id === guionId) ?? null;
  const puesta = puestaPorId(puestaId) ?? null;
  const lugares = lugaresPara(puesta);
  const existente = planExistente(historial, guion?.id, puesta?.id);
  const estado = estadoDelComposer({ guion, puesta, existente, puenteAnda, extensionVieja });

  const elegirFormato = (id: string) => {
    setPuestaId(id);
    // Un lugar que no sirve con la cámara del formato nuevo vuelve a «Que lo elija MaKo».
    setLugar((l) => lugarValido(puestaPorId(id), l));
  };

  const opcionesGuion: DropdownOption[] = [
    ...guiones.map((g) => ({
      value: g.id,
      label: g.angulo || 'Sin título',
      sub: g.yaUsado ? 'Generado' : g.conPlan ? 'Borrador' : g.primeraLinea,
    })),
    { value: PEGAR, label: 'Pegar un guion', icono: 'agregar', crear: true },
  ];

  const generar = async () => {
    if (!estado.puede || busy) return;
    if (estado.abre) { onAbrir(estado.abre); return; }
    if (!guion || !puesta) return;
    setBusy(true); setError(null);
    try {
      const out = await generarPlanAction({ puestaId: puesta.id, guionId: guion.id, guionTexto: guion.texto, adaptarVoz: false, lugar });
      if (!out.ok) { setError(out.error); return; }
      onCreado(out.item, out.historial);
    } catch {
      setError('No llegó respuesta. No se perdió nada: vuelve a intentarlo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vgs-composer">
      <div className="vgs-composer__cuerpo">
        <h1 className="vgs-titulo">Nuevo anuncio</h1>
        {avisos}
        {contexto && !contexto.tieneFotos && (
          <Alert tono="warn">
            Sube una foto tuya en <Link href={rutaSeccion('persona')}>{lugarSeccion('persona')}</Link>: es la cara de tu avatar en cada toma.
          </Alert>
        )}

        {/* ── 1. El guion ── */}
        <section className="vgs-seccion" aria-labelledby="vgs-guion">
          <div className="vgs-seccion__cab">
            <h2 id="vgs-guion" className="vgs-seccion__titulo">Guion</h2>
            {guion && <button type="button" className="vgs-link" onClick={() => setVerGuion(guion)}>Abrir el guion</button>}
          </div>
          {guiones.length === 0 ? (
            <div className="vgs-vacio">
              <span>Todavía no tienes guiones.</span>
              <span className="vgs-vacio__acciones">
                <Link href="/ads-writer" className="vgs-link">Escribir uno en Ads Writer</Link>
                <button type="button" className="vgs-link" onClick={() => setCargando(true)}>Pegar uno</button>
              </span>
            </div>
          ) : (
            <>
              <Dropdown
                value={guionId}
                options={opcionesGuion}
                placeholder="Elige uno de tus guiones"
                width="100%"
                ariaLabel="Elegir el guion"
                onChange={(v) => { if (v === PEGAR) setCargando(true); else setGuionId(v); }}
              />
              {/* El campo del guion, como el de Arcads: lo que se va a decir, a la vista y sin rótulos. */}
              {guion && <p className="vgs-guion">{guion.hablado}</p>}
            </>
          )}
        </section>

        {/* ── 2. El formato (la biblioteca de actores de Arcads: se elige viéndolo) ── */}
        <section className="vgs-seccion" aria-labelledby="vgs-formato">
          <div className="vgs-seccion__cab"><h2 id="vgs-formato" className="vgs-seccion__titulo">Formato</h2></div>
          <div className="vgs-formatos">
            {PUESTAS.map((p) => (
              <TarjetaFormato key={p.id} puesta={p} elegida={p.id === puestaId} onElegir={() => elegirFormato(p.id)} onVer={() => setVerFormato(p)} />
            ))}
          </div>
        </section>

        {/* ── 3. El lugar (la «situation» de Arcads): sólo los que sirven con la cámara del formato ── */}
        {puesta && (
          <section className="vgs-seccion" aria-labelledby="vgs-lugar">
            <div className="vgs-seccion__cab"><h2 id="vgs-lugar" className="vgs-seccion__titulo">Dónde se graba</h2></div>
            <div className="vgs-chips" role="radiogroup" aria-labelledby="vgs-lugar">
              {[{ id: LUGAR_MAKO, nombre: 'Que lo elija MaKo', descripcion: 'MaKo lo elige leyendo tu guion.' }, ...lugares].map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={lugar === l.id} className="vgs-chip" title={l.descripcion} onClick={() => setLugar(l.id)}>
                  {l.id === LUGAR_MAKO && <Icon name="mako" size={13} />}
                  {l.nombre}
                </button>
              ))}
            </div>
          </section>
        )}
        {error && <Alert tono="bad">{error}</Alert>}
      </div>

      {/* El pie: el único botón, con su consecuencia pegada y ANTES del clic. */}
      <div className="vgs-pie">
        <span className="vgs-pie__consecuencia" data-aviso={estado.desborda || undefined}>{estado.consecuencia}</span>
        <Button variant="mako" size="lg" data-esquina-ocupada disabled={!estado.puede || busy} loading={busy}
          icon={<Icon name={estado.abre ? 'chevron' : 'ia'} size={16} />} onClick={() => void generar()}>
          {estado.boton}
        </Button>
      </div>

      {cargando && <CargarGuiones onCerrar={() => setCargando(false)} onCargado={() => { setCargando(false); router.refresh(); }} />}
      {verGuion && (
        <DetalleGuion guion={verGuion} puesta={puesta} onCerrar={() => setVerGuion(null)} onEditado={() => router.refresh()} />
      )}
      {verFormato && (
        <DetalleFormato puesta={verFormato} onCerrar={() => setVerFormato(null)}
          onUsar={verFormato.id === puestaId ? undefined : () => { elegirFormato(verFormato.id); setVerFormato(null); }} />
      )}
    </div>
  );
}

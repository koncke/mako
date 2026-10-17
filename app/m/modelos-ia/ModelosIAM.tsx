'use client';

// =============================================================================
// AI Models en el teléfono: las tareas por grupo, y la lista de opciones de cada una (Ajustes de iOS)
// =============================================================================
// Lo mismo que la computadora: elegir un modelo guarda en el acto; «Volver al default» cuando está editada; y la
// sugerencia del audit (pasar de Claude a uno barato) con su «Aplicar». Las marcas PII y «editado», las de escritorio.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/app/_components/icons';
import { haptico } from '@/lib/haptico';
import { CHAT_OPTS, STT_OPTS, nombreCorto, refDeOpcion, refKey, type Item, type Ref } from '@/app/modelos-ia/opciones';
import { ErrorM, FilaM, ListaM, PildoraM, SeccionM, SheetM, SkeletonFilas, VacioM, useToastM } from '@/app/m/_ui';

const RUTA = '/api/admin/modelos';

export function ModelosIAM({ leido }: { leido: number }) {
  const toast = useToastM();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const j = (await (await fetch(RUTA, { signal: AbortSignal.timeout(30_000) })).json()) as { ok: boolean; error?: string; modelos?: Item[] };
      if (!j.ok) { setError(j.error ?? 'No se pudieron leer los modelos.'); return; }
      setItems(j.modelos ?? []);
    } catch {
      setError('No se pudieron leer los modelos. Revisa tu conexión.');
    }
  }, []);
  // `leido` cambia con cada pasada del server (tirar hacia abajo): se vuelve a pedir.
  useEffect(() => { void cargar(); }, [cargar, leido]);

  /** Guarda un modelo (o vuelve al default con `null`), igual que `guardar` de ModelosIA.tsx. */
  const guardar = async (feature: string, ref: Ref | null) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const body = ref ? { feature, provider: ref.provider, model: ref.model } : { feature, reset: true };
      const j = (await (await fetch(RUTA, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
      })).json()) as { ok: boolean; error?: string; modelos?: Item[] };
      if (!j.ok || !j.modelos) { haptico('error'); toast(j.error ?? 'No se pudo guardar'); return; }
      setItems(j.modelos);
      haptico('success'); toast(ref ? 'Modelo cambiado' : 'Volvió al default');
    } catch {
      haptico('error'); toast('No se pudo guardar');
    } finally { setOcupado(false); }
  };

  if (error) return <ErrorM frase={error} onReintentar={() => { void cargar(); }} />;
  if (!items) return <SkeletonFilas />;
  if (!items.length) return <VacioM frase="No hay tareas de IA para configurar." />;

  const grupos = [...new Set(items.map((i) => i.grupo))];
  const it = abierta ? items.find((x) => x.feature === abierta) ?? null : null;
  const sugerencia = it?.recomendado && it.recomendado.provider !== 'anthropic' && it.actual.provider === 'anthropic' ? it.recomendado : null;
  return (
    <>
      {grupos.map((g) => (
        <SeccionM key={g} titulo={g}>
          <ListaM>
            {items.filter((x) => x.grupo === g).map((x) => (
              <FilaM key={x.feature} titulo={x.label} segunda={nombreCorto(x.actual)} onClick={() => setAbierta(x.feature)}
                pill={x.pii ? <PildoraM tono="warn">PII</PildoraM> : x.overrideado ? <PildoraM tono="info">editado</PildoraM> : undefined} />
            ))}
          </ListaM>
        </SeccionM>
      ))}
      <SheetM id="modelo" abierto={it != null} onCerrar={() => setAbierta(null)} titulo={it?.label ?? ''} snap="alto" ocupado={ocupado}>
        {it && (
          <>
            <p className="m-modelos-ia-feature">{it.feature}{it.nota ? ` · ${it.nota}` : ''}</p>
            {sugerencia && (
              <ListaM>
                <FilaM navegacion icono="idea" titulo="Sugerencia del audit" segunda={nombreCorto(sugerencia)}
                  riel={<span className="m-modelos-ia-aplicar">Aplicar</span>} chevron={false}
                  onClick={() => { void guardar(it.feature, sugerencia); }} />
              </ListaM>
            )}
            <ListaM>
              {(it.grupo === 'STT' ? STT_OPTS : CHAT_OPTS).map((o) => {
                const elegida = o.value === refKey(it.actual);
                return (
                  <FilaM key={o.value} titulo={o.label} segunda={o.sub} chevron={false} deshabilitada={ocupado}
                    riel={elegida ? <span className="m-modelos-ia-tilde" aria-label="Elegido"><Icon name="check" size={20} /></span> : undefined}
                    onClick={() => { const r = refDeOpcion(o.value); if (r && !elegida) void guardar(it.feature, r); }} />
                );
              })}
            </ListaM>
            {it.overrideado && (
              <button type="button" className="m-modelos-ia-default" disabled={ocupado} onClick={() => { void guardar(it.feature, null); }}>
                Volver al default ({nombreCorto(it.def)})
              </button>
            )}
          </>
        )}
      </SheetM>
    </>
  );
}

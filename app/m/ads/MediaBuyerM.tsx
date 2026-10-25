'use client';

// =============================================================================
// /m/ads — el Media Buyer en el teléfono, copiado del de Madgicx · AI Marketer (academy-11.png, academy-12.png)
// =============================================================================
// Martín, 25/10/2026, sobre la primera versión: «Copiala tal cual a la interfaz de madgicx». El teléfono de Madgicx tiene
// la tarjeta del saludo y debajo las recomendaciones en tarjetas (baldosa + título); las que sólo se resuelven en la
// computadora quedan con «Only available on desktop». Nada más: ni interruptor ni pestañas. Lo que MaKo agrega y Madgicx
// no tiene, dicho acá: «Lo que hizo MaKo» debajo (lo hecho, con su «Deshacer» en la hoja), y que el piloto automático, el
// interruptor y los topes viven en la tuerca de la computadora. Los colores, los de MaKo (app/ads-manager/mb-paleta.css).
// Lo que escribe es lo de la computadora: POST /api/media-buyer (lib/media-buyer/ejecutar.ts, con sus topes).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Criatura } from '@/app/_components/Criatura';
import { FilaM, ListaM, PieM, PildoraM, SeccionM, SegmentadoM, SheetM, useToastM } from '@/app/m/_ui';
import type { ConfigMediaBuyer, Decision } from '@/lib/media-buyer/tipos';
import { ICONO_TIPO, NIVEL, NOMBRE_TACTICA, hace, monto, pestanaDe, queSeHizo, saludo, verboLanzar, type Pestana } from '@/app/ads-manager/mb-modelo';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; existeTabla: boolean };

async function api(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; ajuste?: string | null }> {
  try {
    const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Sin conexión.' };
  }
}

export function MediaBuyerM({ nombre, config, decisiones, puedeOperar }: {
  nombre: string;
  config: Config;
  decisiones: Decision[];
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const toast = useToastM();
  const [abierta, setAbiertaCruda] = useState<Decision | null>(null);
  // El detalle en dos pestañas, como «Stats» y «Storyline» del teléfono de Madgicx (telefono-detalle-*.png).
  const [vista, setVista] = useState<'numeros' | 'porque'>('numeros');
  const setAbierta = useCallback((d: Decision | null) => { setVista('numeros'); setAbiertaCruda(d); }, []);
  const [ocupada, setOcupada] = useState(false);
  const [hora, setHora] = useState(12);
  useEffect(() => { setHora(new Date().getHours()); }, []);

  const grupos = useMemo(() => {
    const g: Record<Pestana, Decision[]> = { abiertas: [], hechas: [], descartadas: [] };
    for (const d of decisiones) g[pestanaDe(d.estado)].push(d);
    return g;
  }, [decisiones]);
  const n = grupos.abiertas.length;

  const hacer = useCallback(async (d: Decision, op: string, ok: string) => {
    setOcupada(true);
    const r = await api({ op, id: d.id });
    setOcupada(false);
    if (r.ok) { toast(r.ajuste ? `${ok}. ${r.ajuste}` : ok); setAbierta(null); }
    else toast(r.error ?? 'No se pudo.', { error: true });
    router.refresh();
  }, [router, toast, setAbierta]);

  return (
    <div className="mbm">
      {/* La tarjeta del saludo (academy-11.png): la mascota y cuántas recomendaciones hay. */}
      <section className="mbm-saludo">
        <span className="mbm-mascota" aria-hidden><Criatura nombre="MaKo" size={48} estrella /></span>
        <p>{saludo(hora)}, {nombre}: {n === 0 ? 'hoy no hay recomendaciones' : <>hay <b>{n}</b> {n === 1 ? 'recomendación' : 'recomendaciones'}</>} para ti.</p>
      </section>

      {!config.encendido && <p className="mbm-aviso">El Media Buyer está apagado. Préndelo en la computadora.</p>}
      {config.encendido && n === 0 && <p className="mbm-aviso">{config.ultimaCorrida ? 'Vuelvo a mirar tu cuenta mañana.' : 'Todavía no miré tu cuenta.'}</p>}

      {/* Las recomendaciones en tarjetas (academy-11/12.png): baldosa y título. Se desliza a la derecha para lanzar y a la
          izquierda para descartar; tocarla abre la hoja. Las variaciones se eligen en la computadora (academy-12: «Only
          available on desktop»). */}
      <div className="mbm-lista">
        {grupos.abiertas.map((d) => {
          const soloCompu = d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook';
          const lanzable = puedeOperar && config.encendido && !soloCompu;
          return (
            <FilaM key={d.id} titulo={d.titulo}
              pill={soloCompu ? <PildoraM>Sólo en la computadora</PildoraM> : d.estado === 'fallida' ? <PildoraM tono="bad">No se pudo</PildoraM> : d.estado === 'bloqueada' ? <PildoraM tono="warn">Frenada por un tope</PildoraM> : undefined}
              leading={<span className="mbm-baldosa" aria-hidden>{ICONO_TIPO[d.tipo]}</span>}
              onClick={() => setAbierta(d)}
              swipeDerecha={lanzable ? { rotulo: verboLanzar(d), icono: 'check', tono: 'mako', onAccion: () => void hacer(d, 'lanzar', 'Lanzado') } : undefined}
              swipeIzquierda={puedeOperar ? { rotulo: 'Descartar', icono: 'trash', tono: 'neutro', onAccion: () => void hacer(d, 'descartar', 'Descartada') } : undefined} />
          );
        })}
      </div>

      {grupos.hechas.length > 0 && (
        <SeccionM titulo="Lo que hizo MaKo">
          <div className="mbm-lista">
            {grupos.hechas.slice(0, 10).map((d) => (
              <FilaM key={d.id} titulo={d.titulo} segunda={`${queSeHizo(d)} · ${hace(d.aplicadaAt)}`}
                pill={d.estado === 'deshecha' ? <PildoraM>Deshecha</PildoraM> : <PildoraM tono="good">{d.origen === 'piloto' ? 'Piloto automático' : 'Hecha'}</PildoraM>}
                leading={<span className="mbm-baldosa" aria-hidden>{ICONO_TIPO[d.tipo]}</span>}
                onClick={() => setAbierta(d)} />
            ))}
          </div>
        </SeccionM>
      )}

      <SheetM abierto={!!abierta} onCerrar={() => setAbierta(null)} titulo={abierta ? NOMBRE_TACTICA[abierta.tactica] : ''} snap="alto" ocupado={ocupada} id="decision"
        pie={abierta && (
          <PieM consecuencia={abierta.error ?? abierta.nota ?? undefined}>
            {pestanaDe(abierta.estado) === 'abiertas' && puedeOperar && <>
              <Button variant="primary" size="lg" full loading={ocupada} disabled={!config.encendido} onClick={() => void hacer(abierta, 'lanzar', 'Lanzado')}>{verboLanzar(abierta)}</Button>
              <Button variant="tertiary" size="lg" full disabled={ocupada} onClick={() => void hacer(abierta, 'descartar', 'Descartada')}>Descartar</Button>
            </>}
            {abierta.estado === 'aplicada' && puedeOperar && <Button variant="secondary" size="lg" full loading={ocupada} onClick={() => void hacer(abierta, 'deshacer', 'Deshecho')}>Deshacer</Button>}
            {(abierta.estado === 'descartada' || abierta.estado === 'vencida') && puedeOperar && <Button variant="secondary" size="lg" full loading={ocupada} onClick={() => void hacer(abierta, 'reabrir', 'Abierta otra vez')}>Volver a abrir</Button>}
          </PieM>
        )}>
        {abierta && (
          <div className="mbm-hoja">
            <h3 className="mbm-hoja-tit">{abierta.titulo}</h3>
            <p className="mbm-titular" data-tono={abierta.tipo === 'subir_presupuesto' || abierta.tipo === 'activar' ? 'bien' : abierta.tipo.startsWith('variaciones') ? 'mako' : 'mal'}>{abierta.titular}</p>
            <SegmentadoM etiqueta="Detalle" valor={vista} onCambio={setVista} opciones={[{ id: 'numeros', label: 'Números' }, { id: 'porque', label: 'Por qué' }]} />
            {vista === 'numeros' ? <>
            <ListaM etiqueta="Lo que cambia">
              {abierta.campanaNombre && <FilaM titulo="Campaña" segunda={abierta.campanaNombre} />}
              <FilaM titulo={NIVEL[abierta.nivel]} segunda={abierta.entidadNombre} />
              {(abierta.antes.presupuesto != null || abierta.despues.presupuesto != null) && (
                <FilaM titulo="Presupuesto diario" segunda={`${monto(abierta.antes.presupuesto, abierta.moneda)} → ${monto(abierta.despues.presupuesto, abierta.moneda)}`} />
              )}
              {abierta.despues.estado && <FilaM titulo="Estado" segunda={`${abierta.antes.estado === 'PAUSED' ? 'Pausado' : 'Activo'} → ${abierta.despues.estado === 'PAUSED' ? 'Pausado' : 'Activo'}`} />}
            </ListaM>
            {abierta.variaciones?.length ? (
              <ListaM etiqueta="Variaciones">
                {abierta.variaciones.map((v) => <FilaM key={v.id} titulo={v.gancho ?? v.textoPrincipal.slice(0, 60)} segunda={v.textoPrincipal} pill={v.elegida ? <PildoraM tono="good">Elegida</PildoraM> : undefined} />)}
              </ListaM>
            ) : (
              <ListaM etiqueta="Los números">
                {abierta.numeros.map((x, i) => <FilaM key={i} titulo={x.condicion} segunda={x.porQue} riel={<b>{x.valor}</b>} />)}
              </ListaM>
            )}
            </> : <ul className="mbm-porque">{abierta.porque.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          </div>
        )}
      </SheetM>

    </div>
  );
}

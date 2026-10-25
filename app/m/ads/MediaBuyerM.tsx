'use client';

// =============================================================================
// /m/ads — el Media Buyer en el teléfono: la pantalla
// =============================================================================
// Copiado del teléfono de Madgicx · AI Marketer (academy-11.png, academy-12.png):
//   · arriba, la tarjeta del saludo: la criatura de MaKo y «N decisiones para ti»;
//   · el piloto automático, con su interruptor (lo que hace la tarjeta «Percent of account automation»);
//   · Abiertas · Hechas · Descartadas;
//   · cada decisión es una fila con su baldosa. Se desliza a la derecha para lanzar («Swipe to Launch») y a la izquierda
//     para descartar («Dismiss Task»); tocarla abre la hoja con lo que cambia, los números y el porqué.
// Lo que escribe es lo de la computadora: POST /api/media-buyer (lib/media-buyer/ejecutar.ts, con sus topes).
// Las variaciones se eligen una por una: en el teléfono se lanzan con las que MaKo dejó marcadas.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Criatura } from '@/app/_components/Criatura';
import { FilaM, InterruptorM, ListaM, PieM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import type { ConfigMediaBuyer, Decision } from '@/lib/media-buyer/tipos';
import { ICONO_TIPO, NIVEL, NOMBRE_TACTICA, hace, monto, pestanaDe, porcentajeAutomatico, queSeHizo, verboLanzar, type Pestana } from '@/app/ads-manager/mb-modelo';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; existeTabla: boolean };

async function api(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; ajuste?: string | null }> {
  try {
    const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Sin conexión.' };
  }
}

export function MediaBuyerM({ nombre, config: inicial, decisiones, puedeOperar }: {
  nombre: string;
  config: Config;
  decisiones: Decision[];
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const toast = useToastM();
  const [config, setConfig] = useState(inicial);
  const [pestana, setPestana] = useState<Pestana>('abiertas');
  const [abierta, setAbierta] = useState<Decision | null>(null);
  const [ocupada, setOcupada] = useState(false);
  const [confirmarPiloto, setConfirmarPiloto] = useState(false);

  const grupos = useMemo(() => {
    const g: Record<Pestana, Decision[]> = { abiertas: [], hechas: [], descartadas: [] };
    for (const d of decisiones) g[pestanaDe(d.estado)].push(d);
    return g;
  }, [decisiones]);
  const n = grupos.abiertas.length;
  const automatico = porcentajeAutomatico(decisiones);
  const piloto = config.modo === 'piloto';

  const hacer = useCallback(async (d: Decision, op: string, ok: string) => {
    setOcupada(true);
    const r = await api({ op, id: d.id });
    setOcupada(false);
    if (r.ok) { toast(r.ajuste ? `${ok}. ${r.ajuste}` : ok); setAbierta(null); }
    else toast(r.error ?? 'No se pudo.', { error: true });
    router.refresh();
  }, [router, toast]);

  const cambiarModo = useCallback(async (modo: 'propone' | 'piloto') => {
    const r = await api({ op: 'config', cambio: { modo, ...(modo === 'piloto' ? { encendido: true } : {}) } });
    if (r.ok) setConfig((c) => ({ ...c, modo, ...(modo === 'piloto' ? { encendido: true } : {}) }));
    else toast(r.error ?? 'No se pudo.', { error: true });
  }, [toast]);

  return (
    <div className="mbm">
      <section className="mbm-saludo">
        <span className="mbm-mascota" aria-hidden><Criatura nombre="MaKo" size={44} estrella /></span>
        <p>Hola, {nombre}: <b>{n}</b> {n === 1 ? 'decisión' : 'decisiones'} para ti.</p>
      </section>

      <ListaM>
        <FilaM titulo="Piloto automático" segunda={piloto ? `Lanza solo · ${automatico}% de lo hecho` : 'Propone y tú apruebas'}
          leading={<span className="mbm-baldosa" aria-hidden>🤖</span>}
          control={<InterruptorM etiqueta="Piloto automático" activo={piloto} deshabilitado={!puedeOperar || !config.existeTabla}
            onCambio={(v) => { if (v) setConfirmarPiloto(true); else void cambiarModo('propone'); }} />} />
      </ListaM>

      {!config.encendido && <p className="mbm-aviso">El Media Buyer está apagado: no analiza ni lanza nada.</p>}

      <SegmentadoM etiqueta="Decisiones" valor={pestana} onCambio={setPestana} opciones={[
        { id: 'abiertas', label: 'Abiertas', n: grupos.abiertas.length || null },
        { id: 'hechas', label: 'Hechas' },
        { id: 'descartadas', label: 'Descartadas' },
      ]} />

      <SeccionM titulo={pestana === 'abiertas' ? 'Para lanzar' : pestana === 'hechas' ? 'Lo que hizo MaKo' : 'Descartadas'}>
        {grupos[pestana].length === 0 ? (
          <VacioM frase={pestana === 'abiertas' ? (config.ultimaCorrida ? 'Sin decisiones abiertas.' : 'MaKo todavía no miró tu cuenta.') : 'Nada por aquí.'} />
        ) : (
          <ListaM>
            {grupos[pestana].map((d) => {
              const lanzable = pestana === 'abiertas' && puedeOperar && config.encendido;
              return (
                <FilaM key={d.id} titulo={d.titulo}
                  segunda={pestana === 'hechas' ? `${queSeHizo(d)} · ${hace(d.aplicadaAt)}` : `${NOMBRE_TACTICA[d.tactica]} · ${hace(d.creada)}`}
                  pill={d.estado === 'fallida' ? <PildoraM tono="bad">No se pudo</PildoraM> : d.estado === 'bloqueada' ? <PildoraM tono="warn">Frenada por un tope</PildoraM>
                    : d.estado === 'aplicada' && d.origen === 'piloto' ? <PildoraM tono="info">Piloto automático</PildoraM> : d.estado === 'deshecha' ? <PildoraM>Deshecha</PildoraM> : undefined}
                  leading={<span className="mbm-baldosa" aria-hidden>{ICONO_TIPO[d.tipo]}</span>}
                  onClick={() => setAbierta(d)}
                  swipeDerecha={lanzable ? { rotulo: verboLanzar(d), icono: 'check', tono: 'mako', onAccion: () => void hacer(d, 'lanzar', 'Lanzado') } : undefined}
                  swipeIzquierda={pestana === 'abiertas' && puedeOperar ? { rotulo: 'Descartar', icono: 'trash', tono: 'neutro', onAccion: () => void hacer(d, 'descartar', 'Descartada') } : undefined} />
              );
            })}
          </ListaM>
        )}
      </SeccionM>

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
            <ul className="mbm-porque">{abierta.porque.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        )}
      </SheetM>

      <SheetM abierto={confirmarPiloto} onCerrar={() => setConfirmarPiloto(false)} titulo="Piloto automático" id="piloto"
        pie={<PieM consecuencia={`Sube como mucho ${config.subidaMaxPctDia}% por día. Todo queda en «Hechas» con su botón de deshacer.`}>
          <Button variant="primary" size="lg" full onClick={() => { setConfirmarPiloto(false); void cambiarModo('piloto'); }}>Prender piloto</Button>
          <Button variant="tertiary" size="lg" full onClick={() => setConfirmarPiloto(false)}>Cancelar</Button>
        </PieM>}>
        <p className="mbm-texto">MaKo lanza solo sus decisiones, una vez por día, dentro de tus topes.</p>
      </SheetM>
    </div>
  );
}

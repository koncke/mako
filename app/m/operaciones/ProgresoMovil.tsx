'use client';

// =============================================================================
// El Centro en el teléfono: Pedidos · Pushes · Áreas · Trabajos (15/10/2026)
// =============================================================================
// Las mismas pestañas que la computadora (app/admin/operaciones/CentroPestanas.tsx), destiladas: cada
// fila lleva tres cosas (título, una línea y su estado) y lo demás va en una hoja, como la lista de
// GitHub Actions en el teléfono. Sirve para MIRAR: no depende del cartero ni de la clave del teléfono.
// El color va en el punto de la píldora, nunca en el texto (app/m/_ui/LEEME.md).

import { useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import {
  ErrorM, FilaM, ListaM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, type TonoPildora,
} from '@/app/m/_ui';
import {
  GRUPOS_PEDIDO, PESTANAS_CENTRO, ROTULO_GRUPO, ROTULO_PEDIDO, ROTULO_PUSH, ROTULO_TIPO, duracion, grupoPedido, hace,
  pedidosDeLosPushes, pushDelCommit, type EstadoPedidoP, type EstadoPush, type Frente, type PedidoP, type PestanaCentro,
  type PushP,
} from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import { CentroMovil, type CarteroM, type PedidoM } from './CentroMovil';

const TONO_PEDIDO: Record<EstadoPedidoP, TonoPildora> = { pendiente: 'warn', en_curso: 'info', hecho: 'good' };
const TONO_PUSH: Record<EstadoPush, TonoPildora> = { listo: 'good', error: 'bad', construyendo: 'warn', en_cola: 'neutro', cancelado: 'neutro' };
/** Cuántos hechos se ven antes de «Ver todos»: en el teléfono la lista se lee, no se recorre. */
const HECHOS_VISIBLES = 12;

function diaDe(instante: number, ahora: number): 'Hoy' | 'Ayer' | 'Antes' {
  const dia = (t: number) => Math.floor((t - 3 * 3_600_000) / 86_400_000);
  const d = dia(ahora) - dia(instante);
  return d <= 0 ? 'Hoy' : d === 1 ? 'Ayer' : 'Antes';
}

function EnCursoM({ frentes, ahora }: { frentes: Frente[]; ahora: number }) {
  if (!frentes.length) return <VacioM frase="Nada se movió en las últimas 48 h." />;
  return (
    <>
      {(['Hoy', 'Ayer', 'Antes'] as const).map((g) => {
        const filas = frentes.filter((f) => diaDe(f.instante, ahora) === g);
        if (!filas.length) return null;
        return (
          <SeccionM key={g} titulo={`${g} · ${filas.length}`}>
            <ListaM etiqueta={g}>
              {filas.map((f) => (
                <FilaM
                  key={f.slug}
                  titulo={f.area}
                  segunda={<span className="m-operaciones-texto1">{`${f.chat} · ${ROTULO_TIPO[f.tipo] ?? f.tipo}: ${f.ultimo}`}</span>}
                  pill={f.pendientes ? <PildoraM tono="warn">{`${f.pendientes} sin empezar`}</PildoraM> : undefined}
                  riel={<span className="m-operaciones-hace">{hace(f.instante, ahora)}</span>}
                />
              ))}
            </ListaM>
          </SeccionM>
        );
      })}
    </>
  );
}

/** El camino en una línea: quién lo tomó y dónde está. */
function caminoM(p: PedidoP, ahora: number): string {
  if (p.estado === 'hecho') return `En producción · ${p.tomo ?? 'sin chat'}`;
  const ultimo = p.pasos[p.pasos.length - 1];
  if (!ultimo) return `Nadie lo tomó · pedido ${hace(p.instante, ahora)}`;
  return `${p.tomo ?? ultimo.chat} · ${ROTULO_TIPO[ultimo.tipo] ?? ultimo.tipo} ${hace(p.ultimo, ahora)}`;
}

function PedidosM({ pedidos, pushes, todos, ahora }: { pedidos: PedidoP[]; pushes: LecturaPushes; todos: boolean; ahora: number }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verHechos, setVerHechos] = useState(false);
  const lista = pushes.ok ? pushes.pushes : [];
  const elegido = pedidos.find((p) => p.id === abierto) ?? null;
  if (!pedidos.length) return <VacioM frase="Ningún pedido anotado en estos días." />;
  return (
    <>
      {GRUPOS_PEDIDO.map((g) => {
        const todas = pedidos.filter((p) => grupoPedido(p, ahora) === g);
        if (!todas.length) return null;
        if (g === 'ahora' || g === 'empezado') todas.sort((a, b) => b.ultimo - a.ultimo);
        const filas = g === 'terminado' && !verHechos ? todas.slice(0, HECHOS_VISIBLES) : todas;
        return (
          <SeccionM key={g} titulo={`${ROTULO_GRUPO[g]} · ${todas.length}`}>
            <ListaM etiqueta={ROTULO_GRUPO[g]}>
              {filas.map((p) => (
                <FilaM
                  key={p.id}
                  titulo={<span className="m-operaciones-texto1">{p.texto}</span>}
                  segunda={<span className="m-operaciones-texto1">{caminoM(p, ahora)}</span>}
                  pill={<PildoraM tono={TONO_PEDIDO[p.estado]}>{ROTULO_PEDIDO[p.estado]}</PildoraM>}
                  onClick={() => setAbierto(p.id)}
                />
              ))}
              {filas.length < todas.length && (
                <FilaM titulo={`Ver los ${todas.length} terminados`} onClick={() => setVerHechos(true)} />
              )}
            </ListaM>
          </SeccionM>
        );
      })}
      <p className="m-operaciones-nota">
        {todos ? 'Todos tus pedidos anotados.' : 'Últimos 14 días.'} Un pedido aparece cuando un chat lo anota: lo que pediste y nadie anotó todavía no está, tampoco en «Sin empezar».
      </p>
      <SheetM abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo="Pedido">
        {elegido && (
          <div className="m-operaciones-hoja">
            <div className="m-operaciones-estado">
              <PildoraM tono={TONO_PEDIDO[elegido.estado]}>{ROTULO_PEDIDO[elegido.estado]}</PildoraM>
              <p className="m-operaciones-motivo">{`${elegido.areas.join(', ')} · ${hace(elegido.instante, ahora)}`}</p>
            </div>
            <p className="m-operaciones-texto">{elegido.texto}</p>
            {elegido.junto > 0 && (
              <p className="m-operaciones-motivo">{`Anotado junto con ${elegido.junto} ${elegido.junto === 1 ? 'pedido más' : 'pedidos más'}: lo que sigue responde a todos.`}</p>
            )}
            {elegido.pasos.length === 0
              ? <p className="m-operaciones-motivo">Ningún chat lo anotó como empezado todavía.</p>
              : (
                <ol className="m-operaciones-pasos">
                  {elegido.pasos.map((st, i) => (
                    <li key={i}>
                      <span className="m-operaciones-paso-quien">{`${st.chat} · ${ROTULO_TIPO[st.tipo] ?? st.tipo} · ${hace(st.instante, ahora)}`}</span>
                      <span>{st.titulo}</span>
                      {st.commits.map((c) => {
                        const push = pushDelCommit(c.sha, lista);
                        return <code key={c.sha} className="m-operaciones-commit">{`${c.sha.slice(0, 9)} ${c.msg}${push ? ` · subió ${hace(push.creado, ahora)}` : ''}`}</code>;
                      })}
                    </li>
                  ))}
                  {elegido.estado === 'hecho' && (
                    <li>
                      <span className="m-operaciones-paso-quien">En producción</span>
                      <span>Está en la versión publicada.</span>
                    </li>
                  )}
                </ol>
              )}
          </div>
        )}
      </SheetM>
    </>
  );
}

function PushesM({ lectura, pedidos, ahora }: { lectura: LecturaPushes; pedidos: PedidoP[]; ahora: number }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const trae = useMemo(() => pedidosDeLosPushes(pedidos, lectura.ok ? lectura.pushes : []), [pedidos, lectura]);
  if (!lectura.ok) return <ErrorM frase={`No pude leer los pushes: ${lectura.motivo}`} />;
  if (!lectura.pushes.length) return <VacioM frase="Vercel no tiene pushes a producción." />;
  const elegido = lectura.pushes.find((p) => p.id === abierto) ?? null;
  return (
    <>
      <ListaM etiqueta="Pushes">
        {lectura.pushes.map((p: PushP) => (
          <FilaM
            key={p.id}
            titulo={<span className="m-operaciones-texto1">{p.mensaje}</span>}
            segunda={`${p.sha ?? 'sin commit'} · ${duracion(p.duracionMs)} · ${hace(p.creado, ahora)}`}
            pill={p.actual
              ? <PildoraM tono="info">En producción</PildoraM>
              : <PildoraM tono={TONO_PUSH[p.estado]}>{ROTULO_PUSH[p.estado]}</PildoraM>}
            onClick={() => setAbierto(p.id)}
          />
        ))}
      </ListaM>
      <SheetM abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo="Push">
        {elegido && (
          <div className="m-operaciones-hoja">
            <div className="m-operaciones-estado">
              <PildoraM tono={TONO_PUSH[elegido.estado]}>{ROTULO_PUSH[elegido.estado]}</PildoraM>
              <p className="m-operaciones-motivo">{`${elegido.sha ?? 'sin commit'} · ${duracion(elegido.duracionMs)} · ${elegido.cuenta ?? 'sin cuenta'}`}</p>
            </div>
            <p className="m-operaciones-texto">{elegido.mensaje}</p>
            {elegido.cuerpo && <p className="m-operaciones-texto m-operaciones-cuerpo">{elegido.cuerpo}</p>}
            {(trae.get(elegido.id) ?? []).map((x) => (
              <p key={x.id} className="m-operaciones-motivo">{`Trae tu pedido: ${x.texto.length > 160 ? `${x.texto.slice(0, 160)}…` : x.texto}`}</p>
            ))}
          </div>
        )}
      </SheetM>
    </>
  );
}

const ETIQUETA: Record<PestanaCentro, string> = { pedidos: 'Pedidos', pushes: 'Pushes', areas: 'Áreas', trabajos: 'Trabajos' };

export function CentroMovilPestanas({ inicial, frentes, pedidos, pushes, todos, ahora, cola, carteros, hayToken }: {
  inicial: PestanaCentro;
  frentes: Frente[];
  pedidos: PedidoP[];
  pushes: LecturaPushes;
  todos: boolean;
  ahora: number;
  /** La cola firmada y sus carteros; null si no se pudieron leer (Progreso se ve igual). */
  cola: PedidoM[] | null;
  carteros: CarteroM[] | null;
  hayToken: boolean;
}) {
  const [tab, setTab] = useState<PestanaCentro>(inicial);
  const router = useRouter();
  const abiertos = pedidos.filter((p) => p.estado !== 'hecho').length;
  const cambiar = (t: PestanaCentro) => {
    setTab(t);
    router.replace(t === 'pedidos' ? '/m/operaciones' : `/m/operaciones?tab=${t}`, { scroll: false });
  };
  return (
    <>
      <div className="m-operaciones-seg">
        <SegmentadoM<PestanaCentro>
          etiqueta="Vista del Centro"
          valor={tab}
          onCambio={cambiar}
          opciones={PESTANAS_CENTRO.map((id) => ({ id, label: ETIQUETA[id], n: id === 'pedidos' && abiertos ? abiertos : undefined }))}
        />
      </div>
      {tab === 'pedidos' && <PedidosM pedidos={pedidos} pushes={pushes} todos={todos} ahora={ahora} />}
      {tab === 'pushes' && <PushesM lectura={pushes} pedidos={pedidos} ahora={ahora} />}
      {tab === 'areas' && <EnCursoM frentes={frentes} ahora={ahora} />}
      {tab === 'trabajos' && (cola && carteros
        ? <CentroMovil pedidos={cola} carteros={carteros} hayToken={hayToken} ahora={ahora} />
        : <ErrorM frase="No pude leer la cola de trabajos." />)}
    </>
  );
}

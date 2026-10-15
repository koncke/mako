'use client';

// =============================================================================
// El Centro en el teléfono: En curso · Pedidos · Pushes · Trabajos (15/10/2026)
// =============================================================================
// Las mismas pestañas que la computadora (app/admin/operaciones/CentroPestanas.tsx), destiladas: cada
// fila lleva tres cosas (título, una línea y su estado) y lo demás va en una hoja, como la lista de
// GitHub Actions en el teléfono. Sirve para MIRAR: no depende del cartero ni de la clave del teléfono.
// El color va en el punto de la píldora, nunca en el texto (app/m/_ui/LEEME.md).

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import {
  ErrorM, FilaM, ListaM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, type TonoPildora,
} from '@/app/m/_ui';
import {
  PESTANAS_CENTRO, ROTULO_PEDIDO, ROTULO_PUSH, ROTULO_TIPO, duracion, hace, type EstadoPedidoP, type EstadoPush,
  type Frente, type PedidoP, type PestanaCentro, type PushP,
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
                  pill={f.pendientes ? <PildoraM tono="warn">{`${f.pendientes} ${f.pendientes === 1 ? 'pendiente' : 'pendientes'}`}</PildoraM> : undefined}
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

function PedidosM({ pedidos, todos, ahora }: { pedidos: PedidoP[]; todos: boolean; ahora: number }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verHechos, setVerHechos] = useState(false);
  const elegido = pedidos.find((p) => p.id === abierto) ?? null;
  if (!pedidos.length) return <VacioM frase="Ningún pedido anotado en estos días." />;
  return (
    <>
      {(['pendiente', 'en_curso', 'hecho'] as const).map((e) => {
        const todas = pedidos.filter((p) => p.estado === e);
        if (!todas.length) return null;
        const filas = e === 'hecho' && !verHechos ? todas.slice(0, HECHOS_VISIBLES) : todas;
        return (
          <SeccionM key={e} titulo={`${ROTULO_PEDIDO[e]} · ${todas.length}`}>
            <ListaM etiqueta={ROTULO_PEDIDO[e]}>
              {filas.map((p) => (
                <FilaM
                  key={p.id}
                  titulo={<span className="m-operaciones-texto1">{p.texto}</span>}
                  segunda={`${p.tomo ?? 'Sin tomar'} · ${hace(p.instante, ahora)}`}
                  pill={<PildoraM tono={TONO_PEDIDO[p.estado]}>{ROTULO_PEDIDO[p.estado]}</PildoraM>}
                  onClick={() => setAbierto(p.id)}
                />
              ))}
              {filas.length < todas.length && (
                <FilaM titulo={`Ver los ${todas.length} hechos`} onClick={() => setVerHechos(true)} />
              )}
            </ListaM>
          </SeccionM>
        );
      })}
      <p className="m-operaciones-nota">
        {todos ? 'Todos los pedidos anotados.' : 'Últimos 14 días.'} Un pedido aparece cuando un chat lo anota.
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
                  {elegido.pasos.map((s, i) => (
                    <li key={i}>
                      <span className="m-operaciones-paso-quien">{`${s.chat} · ${ROTULO_TIPO[s.tipo] ?? s.tipo} · ${hace(s.instante, ahora)}`}</span>
                      <span>{s.titulo}</span>
                      {s.commits.map((c) => <code key={c.sha} className="m-operaciones-commit">{`${c.sha.slice(0, 9)} ${c.msg}`}</code>)}
                    </li>
                  ))}
                </ol>
              )}
          </div>
        )}
      </SheetM>
    </>
  );
}

function PushesM({ lectura, ahora }: { lectura: LecturaPushes; ahora: number }) {
  const [abierto, setAbierto] = useState<string | null>(null);
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
          </div>
        )}
      </SheetM>
    </>
  );
}

const ETIQUETA: Record<PestanaCentro, string> = { curso: 'En curso', pedidos: 'Pedidos', pushes: 'Pushes', trabajos: 'Trabajos' };

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
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente').length;
  const cambiar = (t: PestanaCentro) => {
    setTab(t);
    router.replace(t === 'curso' ? '/m/operaciones' : `/m/operaciones?tab=${t}`, { scroll: false });
  };
  return (
    <>
      <div className="m-operaciones-seg">
        <SegmentadoM<PestanaCentro>
          etiqueta="Vista del Centro"
          valor={tab}
          onCambio={cambiar}
          opciones={PESTANAS_CENTRO.map((id) => ({ id, label: ETIQUETA[id], n: id === 'pedidos' && pendientes ? pendientes : undefined }))}
        />
      </div>
      {tab === 'curso' && <EnCursoM frentes={frentes} ahora={ahora} />}
      {tab === 'pedidos' && <PedidosM pedidos={pedidos} todos={todos} ahora={ahora} />}
      {tab === 'pushes' && <PushesM lectura={pushes} ahora={ahora} />}
      {tab === 'trabajos' && (cola && carteros
        ? <CentroMovil pedidos={cola} carteros={carteros} hayToken={hayToken} ahora={ahora} />
        : <ErrorM frase="No pude leer la cola de trabajos." />)}
    </>
  );
}

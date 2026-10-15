'use client';

// =============================================================================
// El Centro en el teléfono: la lista de pedidos, su detalle y los carteros (sólo para mirar)
// =============================================================================
// La anatomía es la de la lista de GitHub Actions en el teléfono: una fila por corrida con su
// estado, y lo demás al tocarla. Acá cada fila lleva tres cosas (el texto del pedido, a qué chat
// y cuándo —o por qué espera—, y la píldora del estado); el texto completo, el recorrido y el
// cierre van en la hoja. El color va en el punto de la píldora, nunca en el texto (app/m/_ui/LEEME.md).
//
// ⚠️ La hora relativa se calcula con el `ahora` del server, no con Date.now() en el render: el
// HTML del server y la hidratación tienen que decir lo mismo.

import { useMemo, useState } from 'react';
import { ROTULO, carteroVivo, type Cierre, type EstadoPedido } from '@/lib/operaciones-reglas';
import {
  ComputadoraM, FilaDatoM, FilaM, ListaM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM,
  horaCorta, type TonoPildora,
} from '@/app/m/_ui';

export type PedidoM = {
  id: string;
  creado: string;
  texto: string;
  estado: EstadoPedido;
  chat: string | null;
  cuenta: string | null;
  motivo: string | null;
  /** Por qué no salió todavía (sólo si está escrito): el cartero o el chat cerrado. */
  espera: string | null;
  tomado: string | null;
  entregado: string | null;
  cerrado: string | null;
  cierre: Cierre | null;
};

export type CarteroM = { cuenta: string; vistoAt: string | null; version: string | null; chats: number };

type Filtro = 'todos' | 'curso' | 'problema';

const TONO: Record<EstadoPedido, TonoPildora> = {
  escrito: 'neutro', tomado: 'info', entregado: 'good', hecho: 'good', comprobado: 'good',
  no_entregado: 'bad', incierto: 'warn', cancelado: 'neutro',
};
const EN_CURSO = new Set<EstadoPedido>(['escrito', 'tomado']);
const CON_PROBLEMA = new Set<EstadoPedido>(['no_entregado', 'incierto']);

/** «10:52» si es de hoy; «13/10 21:12» si no. */
function cuando(iso: string | null, ahora: number): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hoy = new Date(ahora);
  if (d.toDateString() === hoy.toDateString()) return horaCorta(d);
  return `${new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit' }).format(d)} ${horaCorta(d)}`;
}

/** «hace 20 s», «hace 4 min», «hace 2 h», «hace 3 días». */
function hace(iso: string | null, ahora: number): string {
  if (!iso) return 'nunca';
  const s = Math.max(0, Math.round((ahora - Date.parse(iso)) / 1000));
  if (!Number.isFinite(s)) return 'nunca';
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86_400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86_400)} días`;
}

const nombreCuenta = (c: string | null) => (c ? `Cuenta ${c.replace(/^claude/, '')}` : 'Sin cuenta');

export function CentroMovil({ pedidos, carteros, ahora }: { pedidos: PedidoM[]; carteros: CarteroM[]; ahora: number }) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);
  const problemas = useMemo(() => pedidos.filter((p) => CON_PROBLEMA.has(p.estado)).length, [pedidos]);
  const visibles = pedidos.filter((p) =>
    filtro === 'todos' ? true : filtro === 'curso' ? EN_CURSO.has(p.estado) : CON_PROBLEMA.has(p.estado));
  const elegido = pedidos.find((p) => p.id === abierto) ?? null;

  return (
    <>
      <SeccionM titulo="Pedidos">
        <SegmentadoM<Filtro>
          etiqueta="Qué pedidos"
          valor={filtro}
          onCambio={setFiltro}
          opciones={[
            { id: 'todos', label: 'Todos' },
            { id: 'curso', label: 'En curso' },
            { id: 'problema', label: 'Con problema', n: problemas || undefined },
          ]}
        />
        {visibles.length ? (
          <ListaM etiqueta="Pedidos">
            {visibles.map((p) => (
              <FilaM
                key={p.id}
                titulo={<span className="m-operaciones-texto1">{p.texto}</span>}
                segunda={p.espera ?? `${p.chat ?? 'Chat'} · ${cuando(p.creado, ahora)}`}
                pill={<PildoraM tono={TONO[p.estado]}>{ROTULO[p.estado]}</PildoraM>}
                onClick={() => setAbierto(p.id)}
              />
            ))}
          </ListaM>
        ) : (
          <VacioM frase={pedidos.length ? 'Nada con ese filtro.' : 'Todavía no hay pedidos.'} />
        )}
      </SeccionM>

      <SeccionM titulo="Carteros">
        {carteros.length ? (
          <ListaM etiqueta="Carteros">
            {carteros.map((k) => {
              const vivo = carteroVivo(k, ahora);
              return (
                <FilaM
                  key={k.cuenta}
                  icono="config"
                  titulo={nombreCuenta(k.cuenta)}
                  segunda={`Visto ${hace(k.vistoAt, ahora)} · ${k.chats} ${k.chats === 1 ? 'chat' : 'chats'}`}
                  pill={<PildoraM tono={vivo ? 'good' : 'bad'}>{vivo ? 'Andando' : 'Sin señal'}</PildoraM>}
                />
              );
            })}
          </ListaM>
        ) : (
          <VacioM frase="Ningún cartero instalado todavía." />
        )}
      </SeccionM>

      <ComputadoraM que="Mandar pedidos e instalar un cartero" />

      <SheetM abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo="Pedido">
        {elegido && (
          <div className="m-operaciones-hoja">
            <div className="m-operaciones-estado">
              <PildoraM tono={TONO[elegido.estado]}>{ROTULO[elegido.estado]}</PildoraM>
              {(elegido.espera || elegido.motivo) && <p className="m-operaciones-motivo">{elegido.espera ?? elegido.motivo}</p>}
            </div>
            <p className="m-operaciones-texto">{elegido.texto}</p>
            <ListaM etiqueta="Recorrido">
              <FilaDatoM k="Chat" v={elegido.chat ?? '—'} />
              <FilaDatoM k="Cuenta" v={nombreCuenta(elegido.cuenta)} />
              <FilaDatoM k="Firmado" v={cuando(elegido.creado, ahora)} />
              <FilaDatoM k="Tomado" v={cuando(elegido.tomado, ahora)} />
              <FilaDatoM k="Entregado" v={cuando(elegido.entregado, ahora)} />
              {elegido.cerrado && <FilaDatoM k="Cerrado" v={cuando(elegido.cerrado, ahora)} />}
            </ListaM>
            {elegido.cierre && (
              <dl className="m-operaciones-cierre">
                {([['Hecho', elegido.cierre.hecho], ['Decidido', elegido.cierre.decidido], ['Comprobado', elegido.cierre.comprobado],
                  ['Sigue', elegido.cierre.sigue], ['Prueba', elegido.cierre.prueba]] as const)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
              </dl>
            )}
          </div>
        )}
      </SheetM>
    </>
  );
}

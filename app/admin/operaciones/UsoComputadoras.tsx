'use client';

// =============================================================================
// «Computadoras» en el Uso del super admin: las PC conectadas de cada negocio, con «Desconectar» (22/10/2026)
// =============================================================================
// Martín: «el usuario debería poder abrir y ejecutar su Claude en varios dispositivos… Lo mismo en SuperAdmin. Y poder
// "Desconectar" dispositivos». Por negocio y por persona: el nombre del equipo, su sistema (desde la 0.4.0), si está en línea,
// cuándo se conectó y la última vez que se vio. «Desconectar» la revoca al instante (lib/ia-pc.ts → `desconectar`): su
// programa deja de recibir turnos con el próximo pedido.
// ⚠️ SE PIDE AL ABRIR, como la sección «API» (UsoCredito.tsx), y SIN IMPORTS DEL SERVIDOR: la usa el teléfono y la dibujan
//    los tests. La lectura y el «Desconectar» llegan por props (las acciones del Centro, useCentro.ts).

import { useEffect, useRef, useState } from 'react';
import { hace } from '@/lib/progreso-reglas';
import { detalleDeLaPc, type LecturaComputadoras, type PcDeNegocio } from '@/lib/ia-pc-reglas';

export type LeerComputadoras = () => Promise<LecturaComputadoras>;
export type DesconectarComputadora = (ws: number, id: number) => Promise<LecturaComputadoras>;

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });

function FilaPc({ pc, ahora, onDesconectar, ocupado }: { pc: PcDeNegocio; ahora: number; onDesconectar?: (pc: PcDeNegocio) => void; ocupado: boolean }) {
  const [seguro, setSeguro] = useState(false);
  const estado = pc.enLinea ? (pc.conClaude ? 'En línea' : 'Sin sesión de Claude') : pc.ultimoLatido ? `Sin conexión · ${hace(Date.parse(pc.ultimoLatido), ahora)}` : 'Esperando que se conecte';
  const detalle = detalleDeLaPc(pc, fechaCorta);
  return (
    <div className="co-uso__credito" data-pc={pc.id}>
      <div className="co-uso__fila">
        <span className="co-uso__nombre">{pc.nombre}</span>
        <span className={`co-uso__pct${pc.enLinea && pc.conClaude ? '' : ' co-uso__pct--sin'}`}>{estado}</span>
      </div>
      {detalle && <p className="co-uso__reinicio">{detalle}</p>}
      {onDesconectar && (seguro
        ? (
          <p className="co-uso__reinicio">
            ¿Desconectarla? Su chat deja de usarla.{' '}
            <button type="button" className="co-uso__interruptor" disabled={ocupado} onClick={() => onDesconectar(pc)}>{ocupado ? 'Desconectando…' : 'Desconectar'}</button>{' '}
            <button type="button" className="co-uso__interruptor" disabled={ocupado} onClick={() => setSeguro(false)}>Cancelar</button>
          </p>
        )
        : <button type="button" className="co-uso__interruptor" onClick={() => setSeguro(true)}>Desconectar</button>)}
    </div>
  );
}

/** Lo que se dibuja con una lectura en la mano (la sección y los tests). `null` = leyendo. */
export function VistaComputadoras({ lectura, ahora, onDesconectar, ocupado = null }: {
  lectura: LecturaComputadoras | null; ahora: number; onDesconectar?: (pc: PcDeNegocio) => void; ocupado?: number | null;
}) {
  // Por negocio y, adentro, por persona.
  const grupos = new Map<string, { negocio: string; ws: number; personas: Map<string, PcDeNegocio[]> }>();
  for (const pc of lectura?.ok ? lectura.pcs : []) {
    const g = grupos.get(String(pc.ws)) ?? { negocio: pc.negocio, ws: pc.ws, personas: new Map() };
    g.personas.set(pc.persona, [...(g.personas.get(pc.persona) ?? []), pc]);
    grupos.set(String(pc.ws), g);
  }
  return (
    <div className="co-uso__api" role="group" aria-label="Computadoras conectadas">
      <div className="co-uso__fila">
        <span className="co-uso__titulo">Computadoras</span>
        {lectura?.ok && <span className="co-uso__pct">{`${lectura.pcs.filter((p) => p.enLinea).length} de ${lectura.pcs.length} en línea`}</span>}
      </div>
      {!lectura && <p className="co-uso__reinicio">Leyendo las computadoras…</p>}
      {lectura && !lectura.ok && <p className="co-uso__reinicio">{lectura.error}</p>}
      {lectura?.ok && !lectura.pcs.length && <p className="co-uso__reinicio">Ningún negocio conectó una computadora.</p>}
      {[...grupos.values()].map((g) => (
        <div key={g.ws} role="group" aria-label={g.negocio}>
          <p className="co-uso__reinicio"><strong>{`${g.negocio} (ws${g.ws})`}</strong></p>
          {[...g.personas.entries()].map(([persona, pcs]) => (
            <div key={persona}>
              <p className="co-uso__reinicio">{persona}</p>
              {pcs.map((pc) => <FilaPc key={pc.id} pc={pc} ahora={ahora} onDesconectar={onDesconectar} ocupado={ocupado === pc.id} />)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** La sección: pide la lectura UNA vez al abrirse (la `leer` del primer dibujo, como UsoCredito.tsx). */
export function SeccionComputadoras({ leer, desconectar, ahora }: { leer: LeerComputadoras; desconectar?: DesconectarComputadora; ahora: number }) {
  const [lectura, setLectura] = useState<LecturaComputadoras | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const leerRef = useRef(leer);
  useEffect(() => {
    let vivo = true;
    leerRef.current()
      .then((l) => { if (vivo) setLectura(l); })
      .catch(() => { if (vivo) setLectura({ ok: false, error: 'No pude leer las computadoras: vuelve a intentarlo.' }); });
    return () => { vivo = false; };
  }, []);
  const onDesconectar = desconectar ? async (pc: PcDeNegocio) => {
    setOcupado(pc.id);
    setError(null);
    const r = await desconectar(pc.ws, pc.id).catch(() => null);
    if (r?.ok) setLectura(r);
    else setError(r && !r.ok ? r.error : 'No pude desconectarla: vuelve a intentarlo.');
    setOcupado(null);
  } : undefined;
  return (
    <>
      <VistaComputadoras lectura={lectura} ahora={ahora} onDesconectar={onDesconectar} ocupado={ocupado} />
      {error && <p className="co-uso__hacer" role="alert">{error}</p>}
    </>
  );
}

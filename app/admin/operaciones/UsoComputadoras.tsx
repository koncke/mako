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
import { agruparPorCuenta, type LecturaComputadoras, type PcDeNegocio } from '@/lib/ia-pc-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { CuentasYDispositivos } from '@/app/integraciones/CuentasYDispositivos';

export type LeerComputadoras = () => Promise<LecturaComputadoras>;
export type DesconectarComputadora = (ws: number, id: number) => Promise<LecturaComputadoras>;

/**
 * Lo que se dibuja con una lectura en la mano (la sección y los tests). `null` = leyendo. El MISMO dibujo que «Tus cuentas de
 * IA» del cliente (23/10/2026, Martín: «El MISMO sistema en SuperAdmin, idéntico, más lo suyo»), negocio por negocio: cada
 * cuenta, «Cuenta N» con su email ENTERO (el super admin lo ve) y su uso, y adentro sus dispositivos con dónde están y
 * «Desconectar». Lo suyo de más: las computadoras de TODOS los negocios (y el crédito de Claude, en UsoCredito.tsx).
 */
export function VistaComputadoras({ lectura, ahora, onDesconectar }: {
  lectura: LecturaComputadoras | null; ahora: number; onDesconectar?: (pc: PcDeNegocio) => Promise<unknown> | void; ocupado?: number | null;
}) {
  const negocios = new Map<number, { negocio: string; ws: number; pcs: PcDeNegocio[] }>();
  for (const pc of lectura?.ok ? lectura.pcs : []) {
    const g = negocios.get(pc.ws) ?? { negocio: pc.negocio, ws: pc.ws, pcs: [] };
    g.pcs.push(pc);
    negocios.set(pc.ws, g);
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
      {[...negocios.values()].map((g) => {
        const porId = new Map(g.pcs.map((pc) => [pc.id, pc]));
        const grupos = agruparPorCuenta(g.pcs.map((pc) => ({
          id: pc.id, nombre: pc.nombre, esMia: false, de: pc.persona, enLinea: pc.enLinea, ultimoLatido: pc.ultimoLatido,
          version: pc.version, sistema: pc.sistema, ubicacion: pc.ubicacion, conectadaAt: pc.conectadaAt, cuentas: pc.cuentas, persona: pc.persona,
        })), () => true);
        return (
          <div key={g.ws} className="tci" role="group" aria-label={g.negocio}>
            <h2 className="tci-titulo">{`${g.negocio} (ws${g.ws})`}</h2>
            <CuentasYDispositivos grupos={grupos} ahora={ahora}
              onDesconectar={onDesconectar ? (d) => { const pc = porId.get(d.id); return pc ? onDesconectar(pc) : undefined; } : undefined} />
          </div>
        );
      })}
    </div>
  );
}

/** La sección: pide la lectura UNA vez al abrirse (la `leer` del primer dibujo, como UsoCredito.tsx). */
export function SeccionComputadoras({ leer, desconectar, ahora }: { leer: LeerComputadoras; desconectar?: DesconectarComputadora; ahora: number }) {
  const [lectura, setLectura] = useState<LecturaComputadoras | null>(null);
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
    setError(null);
    const r = await desconectar(pc.ws, pc.id).catch(() => null);
    if (r?.ok) setLectura(r);
    else setError(r && !r.ok ? r.error : 'No pude desconectarla: vuelve a intentarlo.');
  } : undefined;
  return (
    <>
      <VistaComputadoras lectura={lectura} ahora={ahora} onDesconectar={onDesconectar} />
      {error && <p className="co-uso__hacer" role="alert">{error}<ReportarASoporte /></p>}
    </>
  );
}

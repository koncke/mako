'use client';

// =============================================================================
// Las computadoras de UN cliente, en su ficha (Clientes → su ficha → Equipo), con «Desconectar» (23/10/2026)
// =============================================================================
// Venían de «Computadoras» en el Uso del super admin, donde se listaban las de TODOS los negocios (22/10/2026, Martín: «Lo
// mismo en SuperAdmin. Y poder "Desconectar" dispositivos»). Al verlo en producción: «en mi SuperAdmin me aparece conectada
// la computadora de Mauricio, eso esta muy mal, no tiene nada que ver, estas cruzando workspace». Ese modal se llama «Tus
// cuentas de IA»: la máquina de un cliente, con su correo, su ciudad y un «Desconectar», se lee ahí como propia. El dato
// sigue sirviendo para el soporte, así que vino a donde ya se habla de ese cliente: su ficha, al lado de su equipo, que es
// de quien son las computadoras. Lo que costó: docs/hallazgos-operaciones.md («Las computadoras de los clientes…»).
//
// El dibujo es el MISMO de «Tus cuentas de IA» del cliente (CuentasYDispositivos.tsx): cada cuenta de Claude con sus
// dispositivos, dónde está cada uno y «Desconectar» (lib/ia-pc.ts → `desconectar`: lo revoca al instante, y su turno en curso
// vence). El super admin ve el email entero.
// ⚠️ SE PIDE AL ABRIR, y SIN IMPORTS DEL SERVIDOR: la dibujan los tests en node. La lectura y el «Desconectar» llegan por
//    props (AdminView.tsx). Su CSS (app/integraciones/tus-cuentas-ia.css) lo importa la página (app/customer-success/pantalla.tsx).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { agruparPorCuenta, type LecturaComputadoras, type PcDeNegocio } from '@/lib/ia-pc-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { BarraCargando } from '@/app/_ui/CargandoMako';
import { CuentasYDispositivos } from '@/app/integraciones/CuentasYDispositivos';

export type LeerComputadoras = (ws: number) => Promise<LecturaComputadoras>;
export type DesconectarComputadora = (ws: number, id: number) => Promise<LecturaComputadoras>;

/** Lo que se dibuja con una lectura en la mano (la sección y los tests). `null` = leyendo. Sólo las de ESTE negocio. */
export function VistaComputadoras({ ws, negocio, lectura, ahora, onDesconectar }: {
  ws: number; negocio: string; lectura: LecturaComputadoras | null; ahora: number; onDesconectar?: (pc: PcDeNegocio) => Promise<unknown> | void;
}) {
  // Por si la lectura trajera otra cosa: en la ficha de un negocio, sólo lo suyo.
  const pcs = lectura?.ok ? lectura.pcs.filter((pc) => pc.ws === ws) : [];
  const porId = new Map(pcs.map((pc) => [pc.id, pc]));
  const grupos = agruparPorCuenta(pcs.map((pc) => ({
    id: pc.id, nombre: pc.nombre, esMia: false, de: pc.persona, enLinea: pc.enLinea, ultimoLatido: pc.ultimoLatido,
    version: pc.version, sistema: pc.sistema, ubicacion: pc.ubicacion, conectadaAt: pc.conectadaAt, cuentas: pc.cuentas, persona: pc.persona,
  })), () => true);
  return (
    <section className="tci" aria-label={`Computadoras de ${negocio}`}>
      <div className="tci-cab">
        <h2 className="tci-titulo">Computadoras</h2>
        {lectura?.ok && pcs.length > 0 && <span className="tci-bajada">{`${pcs.filter((p) => p.enLinea).length} de ${pcs.length} en línea`}</span>}
      </div>
      {!lectura && <BarraCargando que={`las computadoras de ${negocio}`} />}
      {lectura && !lectura.ok && <p className="tci-nota" role="alert">{lectura.error}<ReportarASoporte /></p>}
      {lectura?.ok && !pcs.length && <p className="tci-vacio">{`Nadie de ${negocio} conectó una computadora.`}</p>}
      {pcs.length > 0 && (
        <CuentasYDispositivos grupos={grupos} ahora={ahora}
          onDesconectar={onDesconectar ? (d) => { const pc = porId.get(d.id); return pc ? onDesconectar(pc) : undefined; } : undefined} />
      )}
    </section>
  );
}

/** La sección de la ficha: pide la lectura de ESE negocio al abrirse, y vuelve a pedirla si la ficha pasa a otro. */
export function ComputadorasDelNegocio({ ws, negocio, leer, desconectar }: { ws: number; negocio: string; leer: LeerComputadoras; desconectar?: DesconectarComputadora }) {
  const [lectura, setLectura] = useState<LecturaComputadoras | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const leerRef = useRef(leer);
  leerRef.current = leer;
  useEffect(() => {
    let vivo = true;
    setLectura(null);
    setError(null);
    leerRef.current(ws)
      .then((l) => { if (vivo) { setLectura(l); setAhora(Date.now()); } })
      .catch(() => { if (vivo) setLectura({ ok: false, error: 'No pude leer las computadoras: vuelve a intentarlo.' }); });
    return () => { vivo = false; };
  }, [ws]);
  const onDesconectar = desconectar ? async (pc: PcDeNegocio) => {
    setError(null);
    const r = await desconectar(pc.ws, pc.id).catch(() => null);
    if (r?.ok) { setLectura(r); setAhora(Date.now()); } else setError(r && !r.ok ? r.error : 'No pude desconectarla: vuelve a intentarlo.');
  } : undefined;
  return (
    <>
      <VistaComputadoras ws={ws} negocio={negocio} lectura={lectura} ahora={ahora} onDesconectar={onDesconectar} />
      {error && <p className="tci-nota" role="alert">{error}<ReportarASoporte /></p>}
    </>
  );
}

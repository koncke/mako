'use client';

// =============================================================================
// «API» en el Uso: el crédito de API de cada plan Max, lo gastado y lo que queda (22/10/2026)
// =============================================================================
// Martín: «En USO de SuperAdmin quiero ver también el USO de la API, que como tenemos 4 cuentas de Claude x20, deberían ser
// 800 usd al mes...». Debajo de las cuentas del Uso: arriba el total («US$X de US$800 este mes»), y por cuenta lo gastado de
// sus US$200, lo que queda, cuándo se renueva y, si su crédito no está en MaKo, «Falta vincular» con lo que tiene que hacer.
// Las reglas y de dónde sale cada número, en lib/credito-api.ts.
//
// ⚠️ SE PIDE AL ABRIR, no con la página: es una lectura del registro de gasto que nadie necesita hasta mirar el Uso.
// ⚠️ SIN IMPORTS DEL SERVIDOR: la usa el teléfono y la dibujan los tests (renderToStaticMarkup); la lectura llega por
//    `leer` (la acción del Centro, useCentro.ts → leerCreditoApi). De lib/credito-api.ts, sólo los tipos.
// ⚠️ NUNCA UN NÚMERO INVENTADO: sin el registro, «No pude leer lo gastado»; sin saber si está vinculada, lo dice.

import { useEffect, useRef, useState } from 'react';
import { nombreDeLaCuenta } from '@/lib/centro-titulares';
import type { FilaCredito, LecturaCredito } from '@/lib/credito-api';
import type { CuentaUso } from './Uso';

export type LeerCredito = () => Promise<LecturaCredito>;

/** Lo que trae por mes cada plan Max 20x (lib/credito-api.ts → CREDITO_MENSUAL_USD; acá sin importarlo: es de la pantalla). */
const POR_PLAN = 200;
const AR = 'America/Argentina/Buenos_Aires';

/** «US$0,25», «US$800», «menos de US$0,01»: con la coma de Martín. */
export function usd(n: number): string {
  if (n > 0 && n < 0.01) return 'menos de US$0,01';
  const redondo = Math.abs(n - Math.round(n)) < 0.005;
  return `US$${n.toLocaleString('es-AR', { minimumFractionDigits: redondo ? 0 : 2, maximumFractionDigits: redondo ? 0 : 2 })}`;
}
const dia = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: AR, day: 'numeric', month: 'numeric' });

function FilaDeCredito({ f, nombre }: { f: FilaCredito; nombre: string }) {
  if (f.vinculada !== true) {
    return (
      <div className="co-uso__credito">
        <div className="co-uso__fila">
          <span className="co-uso__nombre">{nombre}</span>
          <span className={`co-uso__pct${f.vinculada === false ? ' co-uso__pct--falta' : ' co-uso__pct--sin'}`}>
            {f.vinculada === false ? 'Falta vincular' : 'No pude leerlo'}
          </span>
        </div>
        {f.vinculada === false && (
          <p className="co-uso__hacer">
            {f.vinculableDesde
              ? `Se puede desde el ${dia(f.vinculableDesde)} (7 días después de suscribirse)`
              : 'claude.ai → Configuración → Facturación → Créditos de API, y su clave a MaKo'}
          </p>
        )}
      </div>
    );
  }
  const gastado = f.gastadoUsd;
  const lleno = gastado == null ? 0 : Math.min(100, (gastado / POR_PLAN) * 100);
  const tono = lleno >= 90 ? 'mal' : lleno >= 75 ? 'ojo' : 'bien';
  return (
    <div className="co-uso__credito">
      <div className="co-uso__fila">
        <span className="co-uso__nombre">{nombre}</span>
        <span className={`co-uso__pct${gastado == null ? ' co-uso__pct--sin' : ''}`}>
          {gastado == null ? 'No pude leer lo gastado' : `${usd(gastado)} de ${usd(POR_PLAN)}`}
        </span>
      </div>
      <div className="co-uso__barra" aria-hidden><span className={`co-uso__lleno co-uso__lleno--${gastado == null ? 'apagado' : tono}`} style={{ width: `${lleno}%` }} /></div>
      <p className="co-uso__reinicio">
        {[
          gastado == null ? null : `Quedan ${usd(Math.max(0, POR_PLAN - gastado))}`,
          f.renueva ? `se renueva el ${dia(f.renueva)}` : 'se renueva con el cobro del plan',
        ].filter(Boolean).join(' · ')}
      </p>
      {f.delNegocio.length > 0 && (
        <p className="co-uso__reinicio">
          {`Incluye ${f.delNegocio.map((n) => `${usd(n.usd)} del negocio ${n.ws}`).join(' y ')}, que la usa como su Claude`}
        </p>
      )}
      {f.sinCreditoAt && <p className="co-uso__hacer">{`Anthropic dijo «sin crédito» el ${dia(f.sinCreditoAt)}`}</p>}
    </div>
  );
}

/** Lo que se dibuja con una lectura en la mano (lo usan la sección y los tests). `null` = leyendo. */
export function VistaCredito({ lectura, cuentas }: { lectura: LecturaCredito | null; cuentas: readonly CuentaUso[] }) {
  const nombre = (cuenta: string) => nombreDeLaCuenta(cuenta, cuentas.find((c) => c.cuenta === cuenta)?.titular);
  return (
    <div className="co-uso__api" role="group" aria-label="Crédito de la API">
      <div className="co-uso__fila">
        <span className="co-uso__titulo">API</span>
        {lectura?.ok && (
          <span className="co-uso__pct">
            {lectura.total.gastadoUsd == null ? 'Sin dato de lo gastado' : `${usd(lectura.total.gastadoUsd)} de ${usd(lectura.total.totalUsd)} este mes`}
          </span>
        )}
      </div>
      {!lectura && <p className="co-uso__reinicio">Leyendo el crédito…</p>}
      {lectura && !lectura.ok && <p className="co-uso__reinicio">{lectura.error}</p>}
      {lectura?.ok && (
        <>
          {lectura.total.vinculadas < lectura.filas.length && (
            <p className="co-uso__reinicio">
              {`${lectura.total.vinculadas} de ${lectura.filas.length} vinculadas: hoy rinden ${usd(lectura.total.rindeUsd)}`}
            </p>
          )}
          {lectura.filas.map((f) => <FilaDeCredito key={f.cuenta} f={f} nombre={nombre(f.cuenta)} />)}
          {lectura.negociosSinLeer && <p className="co-uso__hacer">No pude leer las claves de los negocios: lo que gasta uno con su crédito no está sumado.</p>}
          <p className="co-uso__reinicio">
            Lo gastado es lo que registra MaKo. El saldo real, en platform.claude.com → Billing: Anthropic no lo deja leer con estas claves.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * La sección «API» del desplegable del Uso: pide la lectura UNA vez, al montarse (o sea, al abrirlo).
 * ⚠️ `leer` llega nueva en cada redibujo (useCentro no la memoriza y el Centro se refresca cada pocos segundos): como
 *    dependencia del efecto, pediría la lectura en cada refresco. Se usa la del primer dibujo, en una ref.
 */
export function SeccionCredito({ leer, cuentas }: { leer: LeerCredito; cuentas: readonly CuentaUso[] }) {
  const [lectura, setLectura] = useState<LecturaCredito | null>(null);
  const leerRef = useRef(leer);
  useEffect(() => {
    let vivo = true;
    leerRef.current()
      .then((l) => { if (vivo) setLectura(l); })
      .catch(() => { if (vivo) setLectura({ ok: false, error: 'No pude leer el crédito: vuelve a intentarlo.' }); });
    return () => { vivo = false; };
  }, []);
  return <VistaCredito lectura={lectura} cuentas={cuentas} />;
}

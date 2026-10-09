'use client';

// =============================================================================
// SalidaWhatsApp — desde qué número sale, y «Vincular nuevo» ahí mismo
// =============================================================================
// Pedido de Martín (09/10/2026, cuarta tanda, punto 15), textual: «También falta la opción para
// elegir desde qué número sale ese mensaje, por si se tiene varios números vinculados, con el botón
// de vincular nuevo, y que se haga desde allí mismo...».
//
// ⚠️ EL NÚMERO ES DE LA AUTOMATIZACIÓN, NO DEL MENSAJE (`nutricion_secuencias.instance_name`). Un
// mensaje por un número y el siguiente por otro le escribe al lead desde dos WhatsApp distintos, y la
// respuesta vuelve por el número al que contestó (AGENTS.md, «Un negocio tiene VARIAS líneas»). Por
// eso el selector cambia el de la secuencia y LO DICE («Toda la automatización»). Es el MISMO dato que
// elige el CRON (SecuenciaPerfil): quien monta pasa el valor y el guardado (`onElegir`); este
// componente no escribe la secuencia por su cuenta — con dos escritores del mismo campo, el segundo
// pisa al primero con lo que tenía en memoria.
//
// ⚠️ «VINCULAR NUEVO» ES EL MISMO FLUJO DE /whatsapp, NO UNA COPIA: `EvolutionConnect` con `nueva`
// (el QR de una línea que nace al pedirlo), en un modal y sin salir de /chatbot. Si el modal se cierra
// sin escanear, el propio componente suelta la línea a medio nacer (su limpieza al desmontar). Al
// quedar vinculada, se elige para esta automatización.
//
// ⚠️ «NO PUDE LEER» NO ES «NO HAY NÚMEROS» (AGENTS.md): con la lista caída se dice eso y «Vincular
// nuevo» sigue a mano; no se dibuja un desplegable vacío que afirme que el negocio no tiene línea.

import { useCallback, useEffect, useState } from 'react';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { Modal } from '@/app/_ui';
import { EvolutionConnect } from '../whatsapp/EvolutionConnect';

/** Una línea del negocio, como la devuelve `/api/whatsapp/evolution/mensajes?lineas=1`. */
export type LineaWa = { linea: string; rotulo: string; estado: string; esDefault: boolean };

const RUTA_LINEAS = '/api/whatsapp/evolution/mensajes?lineas=1';
/** El valor del renglón «Vincular nuevo»: no es una línea y nunca se guarda. */
export const VINCULAR = '__vincular__';
/** El valor de «la de por default» (la secuencia guarda null). */
const POR_DEFAULT = '';

/**
 * Las opciones del desplegable. Pura y exportada para el test.
 *
 * ⚠️ LA LÍNEA GUARDADA ENTRA SIEMPRE, aunque ya no esté vinculada: un `value` que no está entre sus
 * opciones se dibuja como la primera y el primer clic la pisa (AGENTS.md, el `<select>` que borra
 * datos). Se nombra como lo que es.
 */
export function opcionesDeSalida(lineas: readonly LineaWa[], actual: string | null): DropdownOption[] {
  const porDefault = lineas.find((l) => l.esDefault) ?? lineas[0] ?? null;
  const color = (l: LineaWa) => (l.estado === 'conectado' ? 'var(--good)' : 'var(--warn)');
  const out: DropdownOption[] = [];
  if (porDefault) out.push({ value: POR_DEFAULT, label: porDefault.rotulo, color: color(porDefault) });
  for (const l of lineas) if (l !== porDefault) out.push({ value: l.linea, label: l.rotulo, color: color(l) });
  if (actual && !lineas.some((l) => l.linea === actual)) out.push({ value: actual, label: 'Un número que ya no está' });
  out.push({ value: VINCULAR, label: 'Vincular nuevo', crear: true });
  return out;
}

/** Qué opción se ve elegida: la de la secuencia, o la de por default (que se guarda como null). */
export function valorDeSalida(lineas: readonly LineaWa[], actual: string | null): string {
  if (!actual) return POR_DEFAULT;
  const porDefault = lineas.find((l) => l.esDefault) ?? lineas[0] ?? null;
  return porDefault && porDefault.linea === actual ? POR_DEFAULT : actual;
}

export function SalidaWhatsApp({ actual, onElegir, deshabilitado }: {
  /** La línea de la automatización (`instance_name`); null = la de por default. */
  actual: string | null;
  /** Guarda la línea de la automatización (el mismo guardado que el selector del CRON). */
  onElegir: (linea: string | null) => void | Promise<void>;
  deshabilitado?: boolean;
}) {
  const [lineas, setLineas] = useState<LineaWa[] | 'error' | null>(null);
  const [vinculando, setVinculando] = useState(false);

  const leer = useCallback(async () => {
    try {
      const r = await fetch(RUTA_LINEAS, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
      const j = await r.json() as { ok?: boolean; lineas?: LineaWa[] };
      setLineas(j?.ok && Array.isArray(j.lineas) ? j.lineas : 'error');
    } catch { setLineas('error'); }
  }, []);
  useEffect(() => { void leer(); }, [leer]);

  const lista = Array.isArray(lineas) ? lineas : [];
  const elegir = (v: string) => {
    if (v === VINCULAR) { setVinculando(true); return; }
    void onElegir(v || null);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {lineas === 'error' ? (
        <>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>No pude leer los números</span>
          <button type="button" onClick={() => setVinculando(true)} disabled={deshabilitado}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>Vincular nuevo</button>
        </>
      ) : (
        <Dropdown
          value={valorDeSalida(lista, actual)}
          options={opcionesDeSalida(lista, actual)}
          onChange={elegir}
          disabled={deshabilitado || lineas === null}
          ariaLabel="Número de WhatsApp por el que sale esta automatización"
          width={220}
          buttonStyle={{ padding: '6px 10px', fontSize: 12.5, borderRadius: 9 }}
        />
      )}
      {lista.length > 0 && (
        <span title="El número es de toda la automatización" style={{ fontSize: 11.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          Toda la automatización
        </span>
      )}
      {vinculando && (
        <Modal titulo="Vincular número" onCerrar={() => setVinculando(false)} ancho={440}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
            <EvolutionConnect key="nueva-linea" nueva inline panelVisible ocultarChip
              onLineaCreada={(linea) => {
                setVinculando(false);
                void leer().then(() => onElegir(linea));
              }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

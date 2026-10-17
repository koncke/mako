// =============================================================================
// Mandar un trabajo desde la caja de escribir — lo comparten la computadora y el teléfono
// =============================================================================
// Martín (15/10/2026): «NO es funcional, no puedo mandar un prompt por allí a mis otras cuentas». La caja vive
// abajo de cada conversación (app/admin/operaciones/Conversacion.tsx y app/m/operaciones/ChatsMovil.tsx), y las
// dos mandan por acá: un solo camino que firma, una sola regla de qué se firma.
//
// ⚠️ SIN 'use client' A PROPÓSITO: son hooks que sólo importan componentes de cliente, y así el teléfono los usa
// sin llevarse una pantalla de escritorio entera (AGENTS.md → MaKo Mobile).
// ⚠️ LA FIRMA NO SE TOCA: el texto se arma con `armarFirmable`, se firma en ESTE dispositivo con una clave que no
// se puede exportar, y el servidor lo guarda tal cual (docs/diseno-centro-de-operaciones.md §3.1). El cartero de
// la PC decide si la acepta.

import { useCallback, useEffect, useState } from 'react';
import { MAX_TEXTO, armarFirmable, nuevoPayload, type Alcance, type Esfuerzo, type Modelo } from '@/lib/operaciones-reglas';
import { encolarPedidoAction } from './acciones';
import { claveDelDispositivo, crearClaveDelDispositivo, firmar, type ClaveDispositivo } from './clave-dispositivo';

/** A quién va: la SESIÓN del chat (nunca su título: se repiten entre cuentas). */
export type DestinoTrabajo = { sesion: string; cuenta: string | null; titulo: string };

export type ResultadoMandar = { ok: true; id: string; creado: string } | { ok: false; error: string };
/** El modelo y el esfuerzo con los que tiene que correr el chat (null = «Automático»: no se tocan). Van firmados. */
export type ComoCorre = { modelo?: Modelo | null; esfuerzo?: Esfuerzo | null };

export function useFirma(sub: string) {
  // undefined = todavía no se leyó; null = este dispositivo no tiene clave.
  const [clave, setClave] = useState<ClaveDispositivo | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    claveDelDispositivo(sub).then((c) => { if (vivo) setClave(c); });
    return () => { vivo = false; };
  }, [sub]);

  const crear = useCallback(async (): Promise<ClaveDispositivo | null> => {
    try {
      const c = await crearClaveDelDispositivo(sub);
      setClave(c);
      return c;
    } catch {
      return null;
    }
  }, [sub]);

  const mandar = useCallback(async (d: DestinoTrabajo, texto: string, alcance: Alcance, como: ComoCorre = {}): Promise<ResultadoMandar> => {
    if (!clave) return { ok: false, error: 'Crea tu Token para comenzar a chatear' };
    if (!texto.trim()) return { ok: false, error: 'Escribe algo para mandarlo' };
    // Un tope en un texto que escribe una persona RECHAZA, no recorta (AGENTS.md).
    if (texto.length > MAX_TEXTO) return { ok: false, error: `Acórtalo a ${MAX_TEXTO} caracteres para mandarlo` };
    try {
      const payload = nuevoPayload({
        id: crypto.randomUUID(), texto, destino: d.sesion, cuenta: d.cuenta, titulo: d.titulo, alcance,
        modelo: como.modelo ?? null, esfuerzo: como.esfuerzo ?? null,
      }, Date.now());
      const firmado = armarFirmable(payload);
      const firma = await firmar(clave, firmado);
      const r = await encolarPedidoAction({ firmado, firma, clavePublica: clave.spki });
      return r.ok ? { ok: true, id: r.id, creado: payload.creado } : { ok: false, error: r.error };
    } catch (e) {
      return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pude firmarlo: vuelve a mandarlo' };
    }
  }, [clave]);

  return { clave, crear, mandar };
}

/** Copiar al portapapeles sin romper si el navegador no deja (http, permisos). */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

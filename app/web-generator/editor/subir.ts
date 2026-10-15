'use client';

// =============================================================================
// subir — lo que el editor de landings le manda al server: archivos y pedidos
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Gamma sube imágenes y
// videos desde cualquier bloque; acá eso es UNA función (`subirArchivo`), que reparte el
// contexto del editor (`CtxEditorLanding.subirArchivo`) y que reciben las extensiones de
// TipTap (`extensionesLanding({ subirArchivo, elegirImagen })`). Contrato de las rutas:
// lib/editor-landing/api-tipos.ts. Diseño: docs/diseno-editor-landing.md (D6).
//
// LA SUBIDA, en tres pasos (y por qué cada uno):
//   1. `firmar` → el server valida tipo y tamaño y devuelve una URL firmada para
//      `<ws>/subidas/<uuid>.<ext>`. El archivo NUNCA pasa por el server de Next: un route
//      handler o una server action topean el cuerpo (AGENTS.md, «tres topes del entorno»).
//   2. El NAVEGADOR sube directo al bucket con XMLHttpRequest, que es lo único que expone el
//      progreso de SUBIDA (`fetch` no: su ReadableStream es para la bajada, y una barra
//      alimentada por un fetch salta de 0 a 100). El pedido es el de `subirConProgreso`
//      (app/customer-success/curso/subir-video.ts), que se reusa en vez de copiarse: está
//      leído del `uploadToSignedUrl` de @supabase/storage-js y ya pagó sus trampas.
//   3. `registrar` → el server mira que el archivo exista y que sus MAGIC BYTES sean lo que
//      dice la extensión (un .png que es un HTML no entra), lo mueve a su lugar final y
//      devuelve la URL pública. Recién ahí el progreso llega a 100.
//
// ⚠️ EL TIPO SE CORRIGE ANTES DE SUBIR. Con FormData el tipo viaja en la parte del multipart,
// y un archivo sin `type` (pasa con algunos .webp y con lo que llega de ciertas apps) sale como
// application/octet-stream, que el bucket rebota. Se arma un File nuevo con el tipo que se
// declaró al firmar (el mismo que el server va a exigir al registrar).
//
// `elegirImagen` (el selector Subir · Buscar · Enlace · Biblioteca) es un hook: el componente
// del selector lo dibuja el armazón (SelectorImagen, paquete I2) con las props que devuelve
// `useSelectorImagen`, y la promesa se resuelve cuando la persona elige o cierra.
// =============================================================================

import { useCallback, useMemo, useRef, useState } from 'react';
import { subirConProgreso } from '@/app/customer-success/curso/subir-video';
import { TIPOS_IMAGEN, TIPOS_VIDEO, TOPE_IMAGEN_BYTES, TOPE_VIDEO_BYTES } from '@/lib/editor-landing/api-tipos';
import { pedirImagenes } from '../cliente';
import type { OpcionesImagen } from './contexto';

// Los pedidos a las rutas viven en ../cliente (una sola copia: había cuatro). Se re-exporta
// `pedirDocs` para quien ya lo importaba de acá.
export { pedirDocs } from '../cliente';

// ─────────────────────────────────────────────────────────────────────────────
// Subir un archivo
// ─────────────────────────────────────────────────────────────────────────────

const EXTENSIONES: Readonly<Record<string, string>> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm',
};

/**
 * El tipo con el que se sube: el que declara el navegador si es uno de los admitidos, y si no
 * viene (o viene genérico), el de la extensión. `null` = no se admite.
 */
export function tipoDeArchivo(f: { name: string; type: string }): string | null {
  const admitidos = [...TIPOS_IMAGEN, ...TIPOS_VIDEO] as readonly string[];
  if (admitidos.includes(f.type)) return f.type;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  return EXTENSIONES[ext] ?? null;
}

/** Por qué no se puede subir este archivo (texto corto), o null si se puede. */
export function motivoParaNoSubir(f: { name: string; type: string; size: number }): string | null {
  const tipo = tipoDeArchivo(f);
  if (!tipo) return 'Formato no admitido';
  const video = (TIPOS_VIDEO as readonly string[]).includes(tipo);
  const tope = video ? TOPE_VIDEO_BYTES : TOPE_IMAGEN_BYTES;
  if (f.size > tope) return `Pesa más de ${Math.round(tope / (1024 * 1024))} MB`;
  if (f.size <= 0) return 'El archivo está vacío';
  return null;
}

/**
 * Sube `f` al bucket público de la landing y devuelve su URL. `onProgreso` recibe el % REAL
 * que salió (0-99 mientras sube; 100 cuando el server lo registró). Tira un Error con un
 * texto corto si algo falla: quien llama lo muestra.
 */
export async function subirArchivo(f: File, onProgreso?: (pct: number) => void): Promise<string> {
  const motivo = motivoParaNoSubir(f);
  if (motivo) throw new Error(motivo);
  const tipo = tipoDeArchivo(f)!;
  onProgreso?.(0);

  const firma = await pedirImagenes({ accion: 'firmar', nombre: f.name, tipo, tamano: f.size });
  if (!firma.ok) throw new Error(firma.error);
  const path = typeof firma.path === 'string' ? firma.path : '';
  const signedUrl = typeof firma.signedUrl === 'string' ? firma.signedUrl : '';
  const apikey = typeof firma.apikey === 'string' ? firma.apikey : null;
  if (!path || !signedUrl) throw new Error('No se pudo preparar la subida');

  const archivo = f.type === tipo ? f : new File([f], f.name, { type: tipo });
  await subirConProgreso(signedUrl, archivo, apikey, (pct) => onProgreso?.(pct), 'PNG, JPG, WEBP, GIF, MP4 o WEBM').promesa;

  const reg = await pedirImagenes({ accion: 'registrar', path });
  if (!reg.ok) throw new Error(reg.error);
  const url = typeof reg.url === 'string' ? reg.url : '';
  if (!url) throw new Error('No se pudo registrar el archivo');
  onProgreso?.(100);
  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Elegir una imagen (el selector de I2)
// ─────────────────────────────────────────────────────────────────────────────

/** Las props de `SelectorImagen` (app/web-generator/editor/SelectorImagen.tsx, paquete I2). */
export type PropsSelectorImagen = {
  abierto: boolean;
  modo: 'imagen' | 'video';
  sugerencia: string;
  onElegir: (url: string) => void;
  onCerrar: () => void;
};

/**
 * El selector como promesa. `elegirImagen(op)` lo abre y resuelve con la URL elegida o `null`
 * si se cerró sin elegir. Si se pide otro mientras hay uno abierto, el anterior resuelve
 * `null` (nunca queda una promesa colgada para siempre).
 *
 * `onElegir` y `onCerrar` tienen identidad FIJA (AGENTS.md, «Todo <Modal> recibe un onCerrar
 * de identidad FIJA»: con una flecha nueva por render, el campo del selector pierde el foco en
 * cada tecla).
 */
export function useSelectorImagen(): { elegirImagen: (op?: OpcionesImagen) => Promise<string | null>; selector: PropsSelectorImagen } {
  const [estado, setEstado] = useState<{ abierto: boolean; modo: 'imagen' | 'video'; sugerencia: string }>({ abierto: false, modo: 'imagen', sugerencia: '' });
  const resolver = useRef<((url: string | null) => void) | null>(null);

  const terminar = useCallback((url: string | null) => {
    const r = resolver.current;
    resolver.current = null;
    setEstado((e) => (e.abierto ? { ...e, abierto: false } : e));
    r?.(url);
  }, []);

  const elegirImagen = useCallback((op?: OpcionesImagen) => {
    resolver.current?.(null);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
      setEstado({ abierto: true, modo: op?.modo ?? 'imagen', sugerencia: (op?.sugerencia ?? '').slice(0, 200) });
    });
  }, []);

  const onElegir = useCallback((url: string) => terminar(url), [terminar]);
  const onCerrar = useCallback(() => terminar(null), [terminar]);

  const selector = useMemo<PropsSelectorImagen>(
    () => ({ abierto: estado.abierto, modo: estado.modo, sugerencia: estado.sugerencia, onElegir, onCerrar }),
    [estado, onElegir, onCerrar],
  );
  return { elegirImagen, selector };
}

'use client';

// =============================================================================
// useLectorEnNavegador — leer una landing en el navegador desde una pantalla, con su aviso (tanda 6)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto de
// esa página.". Soluciona eso...». Lo llaman Analizar, Replicar e Importar desde URL cuando el server
// contesta que la página se lee en el navegador (`enNavegador`, lectura-tipos.ts).
//
//   const { leer, leyendo, aviso } = useLectorEnNavegador();
//   <button onClick={() => { void leer(url).then((r) => { if (r.ok) mandarAlServer(r.lectura); }); }}>
//   {aviso}
//
// ⚠️ `leer` SE LLAMA DIRECTO EN EL `onClick`, SIN `await` ANTES (lib/editor-landing/lector-navegador.ts):
//    la ventana se abre en el clic. Si el navegador la bloquea, `leer` devuelve `motivo: 'bloqueadas'` y
//    `aviso` pinta la flecha a la barra; no se abre nada.
// =============================================================================

import { useCallback, useState, type ReactNode } from 'react';
import { leerEnNavegador, type OpcionesLectura, type ResultadoLectura } from '@/lib/editor-landing/lector-navegador';
import { AvisoVentanasBloqueadas } from './AvisoVentanasBloqueadas';

/**
 * `inicial.bloqueadas` (tanda 7): la ventana que se abrió en el clic de Analizar o Replicar ya vino bloqueada
 * (`pedirConVentana`, lector-navegador.ts): el aviso con la flecha arranca a la vista, sin un clic más.
 */
export function useLectorEnNavegador(inicial: { bloqueadas?: boolean } = {}): {
  leer: (url: string, opciones?: OpcionesLectura) => Promise<ResultadoLectura>;
  leyendo: boolean;
  bloqueadas: boolean;
  aviso: ReactNode;
} {
  const [leyendo, setLeyendo] = useState(false);
  const [bloqueadas, setBloqueadas] = useState(inicial.bloqueadas === true);
  const leer = useCallback((url: string, opciones?: OpcionesLectura) => {
    // Primero la ventana (sincrónico, adentro de `leerEnNavegador`), después el estado.
    const p = leerEnNavegador(url, opciones);
    setBloqueadas(false);
    setLeyendo(true);
    return p.then((r) => {
      setLeyendo(false);
      if (!r.ok && r.motivo === 'bloqueadas') setBloqueadas(true);
      return r;
    });
  }, []);
  const aviso = <AvisoVentanasBloqueadas abierto={bloqueadas} onCerrar={() => setBloqueadas(false)} />;
  return { leer, leyendo, bloqueadas, aviso };
}

'use client';

// =============================================================================
// Qué versión de la extensión corre en ESTE navegador, y el aviso cuando quedó vieja
// =============================================================================
// Vive fuera de `PuentePanel.tsx` porque lo necesitan DOS pantallas y la segunda
// es la que importa.
//
// ⚠️ EL AVISO EXISTÍA Y NO SE VEÍA DONDE HACÍA FALTA. Estaba sólo en el panel del
// puente —la pantalla de conectar— y la falla ocurre en el WIZARD, que es donde
// alguien pasa una hora generando. El 31/08/2026 el dueño estuvo con la 0.16.0
// mientras producción servía la 0.17.0, apretó «actualizar» varias veces, y la
// única pantalla que se lo habría dicho era una que no estaba mirando.
//
// Un aviso que vive lejos de donde se paga la consecuencia es un aviso que no
// existe.

import { useEffect, useState } from 'react';
import { Alert } from '@/app/_ui';
import { EXTENSION_VERSION } from '@/lib/extension-version';
// El link al zip tiene un solo dueño y no es este archivo: definirlo acá sería
// una segunda constante con el mismo nombre esperando a que alguien cambie una.
import { EXTENSION_URL_ZIP } from '@/lib/extension-tienda';
// La comparación vive en su propio módulo, sin React: su GEMELA está en
// `extension/background.js` y hace falta un test que las corra a las dos.
import { esMasVieja } from '@/lib/version-comparar';

export { esMasVieja };

/**
 * ¿Está la extensión instalada en ESTE navegador, y cuál?
 *
 * Lo dice el atributo que su content script pone en `<html>` al cargar la página.
 * No se usa `externally_connectable` —que sería lo obvio— porque ese mecanismo
 * necesita el ID de la extensión, y el ID CAMBIA cuando se publica en la Chrome
 * Web Store: Google asigna el suyo. Por el DOM funciona igual instalada a mano o
 * desde la tienda.
 *
 * Devuelve la VERSIÓN y no un booleano: al arreglar un bug de la extensión, sin
 * el número no hay forma de saber si el cliente está corriendo el arreglo o la
 * versión vieja, y «sigue igual» se vuelve indistinguible de «no lo recargaste».
 * Se diagnosticó a ciegas tres veces antes de que el atributo lo trajera.
 */
export function useExtensionInstalada(): string | false | null {
  // null = todavía no se sabe. Importa: mostrar «no la tienes» durante un
  // instante a alguien que sí la tiene es peor que no mostrar nada.
  const [instalada, setInstalada] = useState<string | false | null>(null);

  useEffect(() => {
    const mirar = () => document.documentElement.getAttribute('data-mako-puente');
    const v = mirar();
    if (v) { setInstalada(v); return; }
    let n = 0;
    const t = window.setInterval(() => {
      const w = mirar();
      if (w) { setInstalada(w); window.clearInterval(t); return; }
      if (++n >= 6) { setInstalada(false); window.clearInterval(t); }
    }, 250);

    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      const w = mirar();
      if (w) setInstalada(w);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return instalada;
}

/**
 * El aviso de que la extensión quedó vieja. Se dibuja solo cuando lo está.
 *
 * ⚠️ EL TEXTO DICE QUE RECARGAR NO ALCANZA, y esa frase es el hallazgo entero.
 *
 * Una extensión instalada DESCOMPRIMIDA no se actualiza nunca: el botón ↻ de
 * `chrome://extensions` vuelve a leer LA MISMA CARPETA, no baja nada de ningún
 * lado. Si esa carpeta no cambió, recargar no puede cambiar nada — y desde afuera
 * se ve idéntico a un botón roto.
 *
 * Costó tres rondas. La primera se arregló haciendo que la extensión se
 * reiniciara sola, que era el diagnóstico correcto y el remedio incompleto:
 * `chrome.runtime.reload()` también vuelve a leer la misma carpeta vieja. Lo que
 * faltaba no era automatizar la recarga, era decir que hay que REEMPLAZAR LOS
 * ARCHIVOS.
 */
export function AvisoExtensionVieja({ instalada, compacto = false }: {
  instalada: string | false | null;
  /** En el wizard va como una franja fina: ahí no es la pantalla, es una alerta. */
  compacto?: boolean;
}) {
  if (typeof instalada !== 'string') return null;
  // Si la instalada va ADELANTE —la máquina de desarrollo, los minutos entre el
  // push y el deploy— no se dice nada: no hay nada que hacer.
  if (!esMasVieja(instalada, EXTENSION_VERSION)) return null;

  return (
    // El ancho vive ACÁ y no en un envoltorio del llamador: ese envoltorio se
    // dibujaba siempre, y en un contenedor `flex` con `gap` un hijo vacío no
    // cuesta 0 — cuesta el gap. Quien sabe si esto va a existir es este
    // componente, así que el ancho viaja con él.
    <div style={{ marginBottom: compacto ? 0 : 12, width: '100%', maxWidth: 900 }}>
      <Alert tono="warn" accion={{ label: 'Descargar la nueva', href: EXTENSION_URL_ZIP }}>
        <strong>Tu extensión quedó vieja.</strong> Tienes la <code>{instalada}</code> y la
        actual es la <code>{EXTENSION_VERSION}</code>. Descárgala y{' '}
        <strong>descomprímela encima de la misma carpeta</strong> desde la que la
        instalaste, reemplazando los archivos. Después de eso usa el botón de recargar
        (↻).{' '}
        <strong>Recargar sin reemplazar los archivos no hace nada</strong>: ese botón
        vuelve a leer la misma carpeta, no descarga nada.
      </Alert>
    </div>
  );
}

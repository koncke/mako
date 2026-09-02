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
// La comparación vive en su propio módulo, sin React: su GEMELA está en
// `extension/background.js` y hace falta un test que las corra a las dos.
import { esMasVieja } from '@/lib/version-comparar';

export { esMasVieja };

/**
 * ¿Esta instalación vino de la Chrome Web Store?
 *
 * Lo dice el segundo atributo que pone el content script, sacado de
 * `manifest.update_url` — que sólo existe en un paquete que empaquetó Google.
 *
 * ⚠️ AUSENTE NO ES «NO». Un `null` acá es ambiguo: puede ser un zip viejo, o una
 * instalación de tienda ANTERIOR a que este atributo existiera —que es justo la
 * gente a la que hoy le llega la 0.5.0—. Por eso quien lo consume trata el `null`
 * como «no sé» y NO como «no es de la tienda»: equivocarse hacia el otro lado
 * silencia el aviso a quien sí tiene que verlo.
 */
export function useExtensionDeLaTienda(): boolean | null {
  const [deLaTienda, setDeLaTienda] = useState<boolean | null>(null);
  useEffect(() => {
    const mirar = () => document.documentElement.getAttribute('data-mako-puente-tienda');
    const leer = () => {
      const v = mirar();
      setDeLaTienda(v === null ? null : v === '1');
    };
    leer();
    // El content script puede llegar después que React: se mira el atributo
    // cuando cambie, igual que hace el hook de al lado.
    const obs = new MutationObserver(leer);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mako-puente-tienda'] });
    return () => obs.disconnect();
  }, []);
  return deLaTienda;
}

/**
 * ¿La extensión de este navegador quedó vieja Y HAY ALGO QUE HACER?
 *
 * ⚠️ ES UNA SOLA PREGUNTA Y VIVE EN UN SOLO LUGAR, a propósito. Estaba escrita
 * dos veces —el early-return de `AvisoExtensionVieja` y el `extensionVieja` de
 * `VideoGeneratorApp`— y la segunda no sólo pinta el aviso: SUPRIME el del puente
 * («un aviso a la vez, del más bloqueante al menos»). O sea que arreglar sólo el
 * componente dejaba vivo el peor síntoma: a quien instaló desde la tienda se le
 * escondía para siempre el único aviso accionable que tenía.
 *
 * Las dos mitades:
 *  · va atrás de lo que sirve el zip — `esMasVieja`, ordenada y no una igualdad;
 *  · y NO vino de la tienda, porque ahí la actualiza Chrome y no la persona.
 */
export function useExtensionVieja(instalada: string | false | null): boolean {
  const deLaTienda = useExtensionDeLaTienda();
  if (typeof instalada !== 'string') return false;
  if (deLaTienda === true) return false;
  return esMasVieja(instalada, EXTENSION_VERSION);
}

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
  // ⚠️ La condición NO se escribe acá: sale de `useExtensionVieja`, que es la que
  // también consume `VideoGeneratorApp` para decidir si tapa el aviso del puente.
  // Escrita en los dos lugares, se separan — y la que se quedó vieja fue la que
  // decide qué NO se muestra, o sea la que nadie mira.
  const vieja = useExtensionVieja(instalada);
  if (typeof instalada !== 'string' || !vieja) return null;

  return (
    // El ancho vive ACÁ y no en un envoltorio del llamador: ese envoltorio se
    // dibujaba siempre, y en un contenedor `flex` con `gap` un hijo vacío no
    // cuesta 0 — cuesta el gap. Quien sabe si esto va a existir es este
    // componente, así que el ancho viaja con él.
    <div style={{ marginBottom: compacto ? 0 : 12, width: '100%', maxWidth: 900 }}>
      {/* ⚠️ LLEVA AL INSTRUCTIVO, no al zip. Y ya no dice «reemplaza los archivos»:
          esa instrucción tiene un paso que quien la ejecuta no puede verificar
          —cuál es «la misma carpeta»— y falló tres veces. Los pasos verificables
          viven en /extension/instalar, en UN solo lugar: escritos acá y allá se
          separan, como se separó todo lo demás que este repo escribió dos veces. */}
      <Alert tono="warn" accion={{ label: 'Ver cómo actualizar', href: '/extension/instalar' }}>
        <strong>Tu extensión quedó vieja.</strong> Tienes la <code>{instalada}</code> y la
        actual es la <code>{EXTENSION_VERSION}</code>. Son tres minutos: se quita la vieja
        y se carga la nueva.{' '}
        <strong>El botón ↻ de Chrome no alcanza</strong>: vuelve a leer la misma
        carpeta, no descarga nada.
      </Alert>
    </div>
  );
}

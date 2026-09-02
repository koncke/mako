'use client';

// =============================================================================
// El enlace: la página deja de ser una pantalla y pasa a ser un mensajero
// =============================================================================
// No dibuja nada. Existe para una sola cosa: cuando la extensión pide un token,
// acuñarlo con la sesión del usuario y devolvérselo.
//
// ⚠️ POR QUÉ ESTO NO SE PUDO MOVER AL POPUP, que es donde vive el resto de la
// configuración. Tres muros, cada uno alcanza solo:
//
//   1. No hay a qué llamar. `crearTokenPuente` guarda un sha256, así que ningún
//      endpoint puede devolver el token existente aunque quisiera, y su único
//      call site es esta action.
//   2. El transporte muere en `proxy.ts`: un fetch de extensión manda siempre
//      `Origin: chrome-extension://<id>`, que nunca coincide con el host → 403 a
//      todo POST. Y un GET que ROTA una credencial es una primitiva de CSRF:
//      cualquier `<img>` de cualquier sitio desconectaría al cliente.
//   3. Permitir `chrome-extension://` en el proxy no es opción mientras la
//      extensión se instale descomprimida: su id es distinto en CADA máquina, así
//      que la excepción tendría que ser para cualquier extensión.
//
// Lo que sí se mudó al popup es el DISPARO y el RESULTADO. Acá queda el acuñado,
// que es lo único que necesita la cookie de sesión.

import { useEffect, useRef } from 'react';
import { conectarPuenteAction } from './puente-actions';

export function PuenteEnlace(): null {
  const enVuelo = useRef(false);

  useEffect(() => {
    const pedir = async (ev: Event) => {
      const d = (ev as CustomEvent).detail ?? {};
      const id = String(d.id ?? '');
      // ⚠️ El `id` de correlación no es decorativo: los eventos son globales, así
      // que sin él dos pedidos en vuelo se resuelven con la respuesta del otro.
      // Es la misma razón que ya está escrita en `content.js`.
      if (!id) return;
      // Acuñar ROTA el token: dos pedidos simultáneos dejarían al segundo con una
      // credencial que el primero acaba de invalidar.
      if (enVuelo.current) return;
      enVuelo.current = true;
      try {
        // ⚠️ SIN `forzar`. Lo elegía el que dispara el evento —o sea cualquier
        // script de la página— y con eso se llevaba el token Y la desconexión del
        // navegador que estaba trabajando. Ahora el permiso lo emite el server
        // tras avisar de quién es la sesión que se va a pisar.
        const out = await conectarPuenteAction(String(d.etiqueta || 'Mi navegador'));
        window.dispatchEvent(new CustomEvent(
          out.ok ? 'MAKO_PUENTE_TOKEN' : 'MAKO_PUENTE_TOKEN_ERROR',
          {
            detail: out.ok
              ? { id, token: out.token, workspace: out.workspace, wsId: out.wsId }
              : { id, motivo: out.motivo, etiqueta: out.etiqueta ?? '' },
          },
        ));
      } catch (e) {
        // ⚠️ ANTES ESTO ADIVINABA «sesion» PARA CUALQUIER EXCEPCIÓN, y es el mismo
        // antipatrón que ya se arregló en `mako-puente.js` un archivo más allá:
        // «no pude hacer X» convertido en «este dato es falso».
        //
        // Medido el 02/09/2026: una clienta con la extensión al día, logueada y
        // con su pestaña abierta veía «Inicia sesión en MaKo y vuelve a intentar»
        // — o sea que la única pista que había sobre por qué no podía conectar era
        // una afirmación inventada acá. El error real no lo sabía nadie.
        //
        // Sólo UNA excepción habla de la sesión: el `redirect()` de Next, que
        // tira un error con `digest` empezando en NEXT_REDIRECT — eso sí es que
        // el server la mandó al login. Todo lo demás viaja con su mensaje.
        const digest = String((e as { digest?: unknown })?.digest ?? '');
        const esRedirect = digest.startsWith('NEXT_REDIRECT');
        const detalle = e instanceof Error ? e.message : String(e);
        // Al log del navegador también: es lo único que queda si la persona
        // cierra el popup antes de leer.
        console.error('[mako] no se pudo acuñar el token del puente:', e);
        window.dispatchEvent(new CustomEvent('MAKO_PUENTE_TOKEN_ERROR', {
          detail: esRedirect
            ? { id, motivo: 'sesion' }
            : { id, motivo: 'error', etiqueta: detalle.slice(0, 160) },
        }));
      } finally {
        enVuelo.current = false;
      }
    };

    window.addEventListener('MAKO_PUENTE_PIDO_TOKEN', pedir);
    // ⚠️ Y SE AVISA QUE ESTÁ MONTADO. El content script corre en `document_start`
    // —mucho antes que React— así que si la extensión pide el token al abrir la
    // pestaña, acá todavía no hay nadie escuchando. Este evento es lo que le
    // permite esperar en vez de fallar contra una página que iba a estar lista
    // medio segundo después.
    window.dispatchEvent(new CustomEvent('MAKO_PUENTE_ENLACE_LISTO'));
    return () => window.removeEventListener('MAKO_PUENTE_PIDO_TOKEN', pedir);
  }, []);

  return null;
}

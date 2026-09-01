// =============================================================================
// El apretón de manos con MaKo — corre en hola-mako.com
// =============================================================================
// Existe para que el usuario NO tenga que copiar y pegar un código.
//
// Todo por el DOM y no por `externally_connectable`: ese mecanismo necesita el
// ID de la extensión, y el ID CAMBIA al publicarse en la Chrome Web Store.
// Marcando el DOM funciona igual instalada a mano o desde la tienda.
//
// ⚠️ EL SENTIDO SE DIO VUELTA. Antes la PÁGINA empujaba el token cuando alguien
// apretaba «Conectar» en la web. Ahora el botón vive en el popup de la extensión
// —el dueño: «esto tiene que ir DENTRO del desplegable de la extensión»— así que
// el pedido nace del service worker y la página pasa a ser un MENSAJERO:
//
//   popup ─CONECTAR─▶ SW ─EMPAREJAR─▶ este script
//                                       │  MAKO_PUENTE_PIDO_TOKEN (evento)
//                                       ▼
//                                    la página (PuenteEnlace.tsx) acuña con la
//                                    sesión del usuario y contesta por evento
//
// El acuñado NO se puede mover acá: el token nace de una server action con la
// cookie de sesión, y un fetch de extensión muere en el chequeo de Origin del
// proxy. Lo que se mudó al popup es el DISPARO y el RESULTADO.

document.documentElement.setAttribute('data-mako-puente', chrome.runtime.getManifest().version);

/** Cuántos ms se espera a que la página conteste el pedido de token. */
const ESPERA_MS = 12000;

/**
 * Le pide un token a la página y contesta al service worker.
 *
 * El `id` de correlación no es decorativo: los eventos son globales, así que sin
 * él dos pedidos en vuelo se resuelven con la respuesta del otro. Es la misma
 * razón que ya está escrita en `content.js`.
 */
function pedirToken(forzar) {
  return new Promise((resolve) => {
    const id = `p${Date.now()}${Math.random()}`;
    let cerrado = false;

    const cerrar = (out) => {
      if (cerrado) return;
      cerrado = true;
      clearTimeout(reloj);
      window.removeEventListener('MAKO_PUENTE_TOKEN', alToken);
      window.removeEventListener('MAKO_PUENTE_TOKEN_ERROR', alError);
      resolve(out);
    };

    const alToken = (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.id !== id) return;
      const token = d.token;
      if (typeof token !== 'string' || !token.startsWith('flow_')) {
        cerrar({ ok: false, motivo: 'error' });
        return;
      }
      // Se guarda ACÁ y no en el service worker: es el único punto por el que
      // pasa el token, y guardarlo antes de contestar hace que el «ok» no pueda
      // ser más optimista que la realidad.
      // ⚠️ CAMBIAR DE CLIENTE TIENE QUE BORRAR LO APRENDIDO CON EL ANTERIOR.
      //
      // El respaldo de plantillas vive bajo UNA clave global (`plantillas`), sin
      // token ni workspace adentro. Antes esto pisaba solo el `token`, asi que el
      // navegador seguia con las plantillas del cliente anterior — y el latido
      // siguiente las subia al workspace nuevo: su projectId de Flow, el cuerpo
      // de su generacion y el mediaId de su cara terminaban guardados en la fila
      // de otro cliente, y de ahi bajaban al navegador real de ese otro.
      //
      // Es el caso normal del super-admin, que abre un cliente por pestaña.
      //
      // Se limpia SOLO cuando el token cambia: reconectar el mismo cliente no
      // puede costarle lo que ya habia aprendido, que es justo lo que evita
      // volver a pedirle que genere algo a mano.
      // ⚠️ SE COMPARA EL WORKSPACE, NO EL TOKEN — y la primera version comparaba
      // el token, que era un bug con cara de arreglo: `crearTokenPuente` acuña un
      // token NUEVO en cada conexion, asi que «el token cambio» era cierto hasta
      // reconectando el MISMO cliente, y con eso se le borraban las plantillas
      // que ya habia aprendido. El comentario decia lo contrario del codigo.
      const wsId = Number(d.wsId) || 0;
      chrome.storage.local.get(['wsId'], (previo) => {
        // Sin `wsId` no se borra nada: no saber de quien era es razon para
        // abstenerse, no para tirarle a alguien lo que le costo generar.
        const cambio = !!wsId && !!previo && !!previo.wsId && previo.wsId !== wsId;
        const guardar = () => chrome.storage.local.set(
          { token, wsId, workspaceNombre: String(d.workspace || '') },
          () => cerrar({ ok: true }),
        );
        if (!cambio) { guardar(); return; }
        // `firmaPlantillas` va con `plantillas` o el latido creeria que no cambio
        // nada y no volveria a subir las del cliente nuevo. `projectId` y
        // `ultimoRedirectMedio` son del proyecto de Flow del anterior.
        chrome.storage.local.remove(
          ['plantillas', 'firmaPlantillas', 'projectId', 'ultimoRedirectMedio'],
          guardar,
        );
      });
    };

    const alError = (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.id !== id) return;
      cerrar({ ok: false, motivo: String(d.motivo || 'error'), etiqueta: String(d.etiqueta || '') });
    };

    // ⚠️ Sin este corte, un `MAKO_PUENTE_PIDO_TOKEN` que nadie escucha —la
    // página todavía no hidrató, o es una ruta de MaKo que no monta el enlace—
    // deja al popup diciendo «Conectando…» para siempre. El timeout es lo que
    // convierte «no contestó» en una pantalla con salida.
    const reloj = setTimeout(() => cerrar({ ok: false, motivo: 'sesion' }), ESPERA_MS);

    window.addEventListener('MAKO_PUENTE_TOKEN', alToken);
    window.addEventListener('MAKO_PUENTE_TOKEN_ERROR', alError);
    window.dispatchEvent(new CustomEvent('MAKO_PUENTE_PIDO_TOKEN', {
      detail: { id, forzar: !!forzar, etiqueta: navegador() },
    }));
  });
}

/** Un nombre que la persona reconozca en «ya hay otro navegador conectado». */
function navegador() {
  const ua = navigator.userAgent;
  const cual = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
      : /Brave/.test(ua) ? 'Brave'
        : /Chrome\//.test(ua) ? 'Chrome'
          : 'Navegador';
  const so = /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'Mac'
      : /Linux/.test(ua) ? 'Linux'
        : '';
  return so ? `${cual} en ${so}` : cual;
}

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg && msg.tipo === 'EMPAREJAR') {
    // ⚠️ El script corre en `document_start`: si la página todavía no hidrató,
    // `PuenteEnlace` no existe y nadie escucha el pedido. Por eso se espera a que
    // el enlace avise que está montado, con el mismo tope que el pedido — y si no
    // avisa se intenta igual, porque una pestaña ya hidratada antes de que este
    // script escuchara no va a volver a avisar nunca.
    void esperarEnlace().then(() => pedirToken(msg.forzar)).then(responder);
    return true;
  }
  return false;
});

let enlaceListo = false;
window.addEventListener('MAKO_PUENTE_ENLACE_LISTO', () => { enlaceListo = true; });

function esperarEnlace() {
  if (enlaceListo || document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 4000);
    window.addEventListener('MAKO_PUENTE_ENLACE_LISTO', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

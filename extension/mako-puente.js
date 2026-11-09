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

const manifiesto = chrome.runtime.getManifest();
document.documentElement.setAttribute('data-mako-puente', manifiesto.version);

// ⚠️ Y DE DÓNDE VINO ESTA INSTALACIÓN, que decide qué se le puede pedir.
//
// `update_url` sólo lo pone la Chrome Web Store al empaquetar: si está, Chrome
// la actualiza sola y pedirle a la persona que «quite la vieja y cargue la
// nueva» es pedirle algo que no puede hacer —y que además rompería la
// actualización automática—.
//
// La página lo necesita porque compara contra la versión del ZIP, que va
// adelante de la tienda por diseño: cada versión pasa por revisión, así que sin
// este dato el aviso de «quedó vieja» se le prende PARA SIEMPRE a todo el que la
// instaló desde Google. El service worker ya razonaba así (`if (manifest.
// update_url) return` en background.js); lo que faltaba era decírselo a la web.
document.documentElement.setAttribute('data-mako-puente-tienda', manifiesto.update_url ? '1' : '0');
// Para que el worker no lo vuelva a correr en esta pestaña al instalarse o actualizarse (`reponerPuenteEnMako`, 25/10/2026).
globalThis.__makoPuenteCargado = true;

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
        // ⚠️ Y LA SONDA TAMBIEN. `sondaResultado` lleva el mediaId completo del
        // cliente anterior y urls firmadas suyas; `sondaSW` lleva el resultado de
        // pedirlas. Si no se borran, el proximo latido —que ya es del cliente
        // NUEVO— los sube a SU fila: datos de un cliente guardados en el
        // workspace de otro, por el mismo camino que ya se cerro para las
        // plantillas y por el mismo motivo.
        //
        // Es el caso normal del super-admin, que abre un cliente por pestana.
        chrome.storage.local.remove(
          [
            'plantillas', 'firmaPlantillas', 'projectId', 'ultimoRedirectMedio',
            'sondaResultado', 'sondaSW', 'sondaOk',
          ],
          guardar,
        );
      });
    };

    const alError = (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.id !== id) return;
      cerrar({ ok: false, motivo: String(d.motivo || 'error'), etiqueta: String(d.etiqueta || '') });
    };

    // ⚠️ EL TIMEOUT ES SU PROPIO MOTIVO, Y NO 'sesion'.
    //
    // Decía 'sesion', o sea que «nadie contestó» se convertía en la afirmación
    // «no iniciaste sesión» — sobre alguien que estaba logueada, mirando su
    // propio tablero, con la pestaña abierta. La reportó el dueño así: «Leila no
    // puede generar porque dice que MaKo no está conectado».
    //
    // Y la causa era otra: el enlace que contesta este pedido vivía adentro de
    // una vista de /video-generator, así que en cualquier otra pantalla de MaKo
    // no había nadie escuchando. El remedio de eso es RECARGAR la pestaña, que
    // no tiene nada que ver con iniciar sesión: mandarla a loguearse la manda a
    // arreglar algo que estaba bien.
    //
    // Es la regla de la casa: «no pude hacer X con este dato» no es «este dato es
    // falso», y un mensaje que sale solo no puede afirmar lo que no verificó.
    const reloj = setTimeout(() => cerrar({ ok: false, motivo: 'sin_enlace' }), ESPERA_MS);

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

// ── «Hay trabajo»: la pagina despierta al puente ────────────────────────────
// El sentido contrario al del emparejado. MaKo encola un trabajo y avisa en el
// acto, en vez de que la extension lo descubra en su proxima alarma — que es
// hasta medio minuto de loader sobre algo que ya estaba listo para empezar.
//
// Se ignora cualquier evento que no venga de esta misma pagina: `postMessage`
// lo puede disparar un iframe ajeno, y aunque lo unico que consigue es que el
// puente le pregunte a MaKo por trabajo suyo —con el token de este navegador y
// nada mas—, no hay razon para escuchar a un tercero.
//
// El estrangulador no es prolijidad: sin el, una pantalla que encola siete
// tomas de una manda siete avisos en el mismo tick. `ciclo()` ya es idempotente
// por `corriendo`, asi que serian seis mensajes al vacio.
let ultimoAviso = 0;

window.addEventListener('MAKO_PUENTE_HAY_TRABAJO', (ev) => {
  if (ev && ev.target !== window) return;
  const ahora = Date.now();
  if (ahora - ultimoAviso < 1500) return;
  ultimoAviso = ahora;
  try {
    chrome.runtime.sendMessage({ tipo: 'DESPERTAR' }, () => {
      // Leer `lastError` es lo que evita el «Unchecked runtime.lastError» en la
      // consola del cliente cuando el service worker todavia no desperto. No hay
      // nada que hacer con el error: el ciclo de la alarma lo cubre igual.
      void chrome.runtime.lastError;
    });
  } catch { /* la extension se recargo: la alarma lo cubre */ }
});

let enlaceListo = false;
window.addEventListener('MAKO_PUENTE_ENLACE_LISTO', () => { enlaceListo = true; });

function esperarEnlace() {
  // ⚠️ SIN `|| document.readyState === 'complete'`. Una página CARGADA no es una
  // página HIDRATADA: `complete` sólo dice que los recursos bajaron, y el enlace
  // lo monta React después. Con esa condición, en una pestaña ya cargada se
  // dejaba de esperar en el acto y se preguntaba al vacío.
  //
  // No se pierde nada: el `setTimeout(resolve, 4000)` de abajo ya cubre el caso
  // de una pestaña que se hidrató ANTES de que este script escuchara —esa no va a
  // volver a avisar nunca—. La diferencia es que ahora se le dan cuatro segundos
  // en vez de cero.
  if (enlaceListo) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 4000);
    window.addEventListener('MAKO_PUENTE_ENLACE_LISTO', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

// ── Las fichas de WhatsApp Web (24/10/2026, wa-fichas.js) ───────────────────
// La pantalla de MaKo (traer de un grupo) pide lo que el WhatsApp Web de esta persona ya guardó sobre los teléfonos de sus
// leads. Este script es el mensajero: pasa el pedido al service worker, que lo lleva a la pestaña de WhatsApp Web, y
// devuelve la respuesta por evento con el MISMO `id` (dos pedidos en vuelo no se pisan). Sólo de esta página, como el aviso
// de trabajo.
// ⚠️ UN PUENTE HUÉRFANO NO CONTESTA (25/10/2026). Al actualizar la extensión, el script viejo de esta pestaña sigue vivo pero
// sin la extensión detrás (`chrome.runtime.id` vacío): si contestaba «no encontré la extensión», le ganaba de mano al nuevo.
const huerfano = () => { try { return !chrome.runtime || !chrome.runtime.id; } catch { return true; } };
window.addEventListener('MAKO_WA_FICHAS_PIDO', (ev) => {
  if (!ev || ev.target !== window) return;
  if (huerfano()) return;
  const d = (ev.detail && typeof ev.detail === 'object') ? ev.detail : {};
  const id = typeof d.id === 'string' ? d.id : '';
  const telefonos = Array.isArray(d.telefonos) ? d.telefonos.filter((t) => typeof t === 'string').slice(0, 5000) : [];
  // Desde la 0.71.0: cada teléfono con el `@lid` del lead si MaKo lo sabe, y los nombres de los grupos de donde vinieron.
  const pedidos = Array.isArray(d.pedidos)
    ? d.pedidos.filter((p) => p && typeof p.telefono === 'string').slice(0, 5000).map((p) => ({ telefono: p.telefono, lid: typeof p.lid === 'string' ? p.lid : null }))
    : undefined;
  const grupos = Array.isArray(d.grupos) ? d.grupos.filter((g) => typeof g === 'string').slice(0, 20) : [];
  // Desde la 0.72.0: «Extraer» a la vista (la pestaña de WhatsApp al frente, el desplegable y su registro) con su título.
  const visible = d.visible === true;
  const titulo = typeof d.titulo === 'string' ? d.titulo.slice(0, 160) : undefined;
  const contestar = (r) => window.dispatchEvent(new CustomEvent('MAKO_WA_FICHAS', { detail: { id, ...(r || { ok: false, motivo: 'sin_respuesta' }) } }));
  try {
    chrome.runtime.sendMessage({ tipo: 'WA_FICHAS_PEDIDO', id, telefonos, pedidos, grupos, visible, titulo }, (r) => {
      if (chrome.runtime.lastError) { contestar({ ok: false, motivo: 'extension' }); return; }
      contestar(r);
    });
  } catch { contestar({ ok: false, motivo: 'extension' }); }
});

// Los perfiles, de a tandas (0.73.2): el pedido de la pantalla al worker; contesta por `MAKO_WA_FICHAS` con el mismo `id`.
window.addEventListener('MAKO_WA_PERFILES_PIDO', (ev) => {
  if (!ev || ev.target !== window || huerfano()) return;
  const d = (ev.detail && typeof ev.detail === 'object') ? ev.detail : {};
  const id = typeof d.id === 'string' ? d.id : '';
  const candidatos = Array.isArray(d.candidatos)
    ? d.candidatos.filter((c) => c && typeof c.telefono === 'string').slice(0, 20).map((c) => ({ telefono: c.telefono, nombre: typeof c.nombre === 'string' ? c.nombre.slice(0, 80) : null }))
    : [];
  const contestar = (r) => window.dispatchEvent(new CustomEvent('MAKO_WA_FICHAS', { detail: { id, ...(r || { ok: false, motivo: 'sin_respuesta' }) } }));
  try {
    chrome.runtime.sendMessage({
      tipo: 'WA_PERFILES_PEDIDO', id, grupo: typeof d.grupo === 'string' ? d.grupo.slice(0, 120) : '', candidatos,
      desde: typeof d.desde === 'number' ? d.desde : 0, total: typeof d.total === 'number' ? d.total : 0,
    }, (r) => {
      if (chrome.runtime.lastError) { contestar({ ok: false, motivo: 'extension' }); return; }
      contestar(r);
    });
  } catch { contestar({ ok: false, motivo: 'extension' }); }
});

// El avance que cuenta el worker («Abriendo WhatsApp Web…», «Buscando el grupo…»), a la pantalla, con el `id` del pedido.
// Y el «Parar» del desplegable (0.72.0): la pantalla deja de guardar.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.tipo === 'WA_FICHAS_PARAR') {
    window.dispatchEvent(new CustomEvent('MAKO_WA_PARAR', { detail: { id: msg.id } }));
    return false;
  }
  if (!msg || msg.tipo !== 'WA_FICHAS_AVANCE') return false;
  window.dispatchEvent(new CustomEvent('MAKO_WA_FICHAS_AVANCE', { detail: { id: msg.id, paso: msg.paso, texto: msg.texto } }));
  return false;
});

// Cómo sigue una extracción del lado de MaKo (guardando, el final), al registro del desplegable (0.72.0). Sólo números y
// textos cortos: los nombres de nadie salen de esta página.
window.addEventListener('MAKO_WA_EXTRACCION', (ev) => {
  if (!ev || ev.target !== window || huerfano()) return;
  const d = (ev.detail && typeof ev.detail === 'object') ? ev.detail : {};
  if (typeof d.id !== 'string') return;
  const m = { tipo: 'WA_EXTRACCION', id: d.id };
  for (const k of ['fase', 'estado', 'texto']) if (typeof d[k] === 'string') m[k] = d[k].slice(0, 400);
  for (const k of ['guardados', 'nombres', 'empresas', 'nuevos', 'total', 'perfiles']) if (typeof d[k] === 'number') m[k] = d[k];
  try { chrome.runtime.sendMessage(m, () => void chrome.runtime.lastError); } catch { /* nada */ }
});

// La pantalla vio una extensión vieja: el worker mira si su carpeta ya trae la nueva y, si sí, se recarga (0.71.1).
window.addEventListener('MAKO_EXTENSION_REVISAR', (ev) => {
  if (!ev || ev.target !== window || huerfano()) return;
  try { chrome.runtime.sendMessage({ tipo: 'REVISAR_CARPETA' }, () => void chrome.runtime.lastError); } catch { /* nada */ }
});

// «Ir a WhatsApp Web» (para iniciar la sesión): el worker pone esa pestaña al frente, o abre una.
window.addEventListener('MAKO_WA_ENFOCAR', (ev) => {
  if (!ev || ev.target !== window || huerfano()) return;
  try { chrome.runtime.sendMessage({ tipo: 'WA_ENFOCAR' }, () => void chrome.runtime.lastError); } catch { /* sin extensión: nada */ }
});

// ── «Capturar» desde «Sus páginas» de Spy (0.76.0, 4/11/2026) ─────────────────────────────────
// La pantalla pide abrir la página de un competidor a la vista (`MAKO_SPY_CAPTURAR_PIDO`); el worker la abre y la anota. Contesta
// por `MAKO_SPY_CAPTURA` con el mismo `id`. Cuando la persona la captura (tocando el ícono de MaKo en esa pestaña) o la cierra,
// el worker avisa y acá se le pasa a la pantalla (`MAKO_SPY_CAPTURA_TERMINO`). Sólo de esta página, como los demás pedidos.
window.addEventListener('MAKO_SPY_CAPTURAR_PIDO', (ev) => {
  if (!ev || ev.target !== window || huerfano()) return;
  const d = (ev.detail && typeof ev.detail === 'object') ? ev.detail : {};
  const id = typeof d.id === 'string' ? d.id : '';
  const contestar = (r) => window.dispatchEvent(new CustomEvent('MAKO_SPY_CAPTURA', { detail: { id, ...(r || { ok: false, motivo: 'sin_respuesta' }) } }));
  const competidorId = typeof d.competidorId === 'number' ? d.competidorId : NaN;
  const url = typeof d.url === 'string' ? d.url.slice(0, 2000) : '';
  try {
    chrome.runtime.sendMessage({ tipo: 'SPY_CAPTURAR', competidorId, url }, (r) => {
      if (chrome.runtime.lastError) { contestar({ ok: false, motivo: 'extension' }); return; }
      contestar(r);
    });
  } catch { contestar({ ok: false, motivo: 'extension' }); }
});
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.tipo !== 'SPY_CAPTURA_TERMINO') return false;
  window.dispatchEvent(new CustomEvent('MAKO_SPY_CAPTURA_TERMINO', {
    detail: { competidorId: msg.competidorId, url: msg.url, lista: msg.lista === true, cerrada: msg.cerrada === true },
  }));
  return false;
});

// ── «Replicar con la extensión» desde Replicar del Web Generator (0.79.0, 9/11/2026) ─────────────────
// La pantalla pide abrir la página a la vista (`MAKO_REPLICA_PIDO`, contesta `MAKO_REPLICA` con el mismo `id`). Cuando la
// persona toca el ícono de MaKo en esa pestaña, la extensión saca la foto y avisa (`MAKO_REPLICA_ESTADO`: leyendo, fallo,
// cerrada; `MAKO_REPLICA_LISTA` con la entrega). La pantalla la toma (`MAKO_REPLICA_TOMAR` → `MAKO_REPLICA_FOTO`) y, si era
// la página, la suelta (`MAKO_REPLICA_SOLTAR`: la pestaña se cierra); si era la verificación de un antibots, vuelve a ella
// (`MAKO_REPLICA_VOLVER`). Todo con su `id` o su `pedido`: dos pedidos en vuelo no se pisan. Sólo de esta página.
const textoCorto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
window.addEventListener('MAKO_REPLICA_PIDO', (ev) => {
  if (!ev || ev.target !== window || huerfano()) return;
  const d = (ev.detail && typeof ev.detail === 'object') ? ev.detail : {};
  const id = textoCorto(d.id, 80);
  const contestar = (r) => window.dispatchEvent(new CustomEvent('MAKO_REPLICA', { detail: { id, ...(r || { ok: false, motivo: 'sin_respuesta' }) } }));
  try {
    chrome.runtime.sendMessage({ tipo: 'REPLICA_ABRIR', pedido: id, url: textoCorto(d.url, 2000) }, (r) => {
      if (chrome.runtime.lastError) { contestar({ ok: false, motivo: 'extension' }); return; }
      contestar(r);
    });
  } catch { contestar({ ok: false, motivo: 'extension' }); }
});
// Pedidos que esperan una respuesta del worker con su `id` (tomar la foto, volver a la pestaña).
for (const [pide, tipo, contesta] of [['MAKO_REPLICA_TOMAR', 'REPLICA_TOMAR', 'MAKO_REPLICA_FOTO'], ['MAKO_REPLICA_VOLVER', 'REPLICA_VOLVER', 'MAKO_REPLICA_VUELTA']]) {
  window.addEventListener(pide, (ev) => {
    if (!ev || ev.target !== window || huerfano()) return;
    const d = (ev.detail && typeof ev.detail === 'object') ? ev.detail : {};
    const id = textoCorto(d.id, 80);
    const contestar = (r) => window.dispatchEvent(new CustomEvent(contesta, { detail: { id, ...(r || { ok: false, motivo: 'sin_respuesta' }) } }));
    try {
      chrome.runtime.sendMessage({ tipo, entrega: textoCorto(d.entrega, 80), pedido: textoCorto(d.pedido, 80) }, (r) => {
        if (chrome.runtime.lastError) { contestar({ ok: false, motivo: 'extension' }); return; }
        contestar(r);
      });
    } catch { contestar({ ok: false, motivo: 'extension' }); }
  });
}
// Sin respuesta que esperar: soltar la foto (se cierra la pestaña) y cancelar el pedido.
window.addEventListener('MAKO_REPLICA_SOLTAR', (ev) => {
  if (!ev || ev.target !== window || huerfano()) return;
  const d = (ev.detail && typeof ev.detail === 'object') ? ev.detail : {};
  try { chrome.runtime.sendMessage({ tipo: 'REPLICA_SOLTAR', entrega: textoCorto(d.entrega, 80) }, () => void chrome.runtime.lastError); } catch { /* nada */ }
});
window.addEventListener('MAKO_REPLICA_CANCELAR', (ev) => {
  if (!ev || ev.target !== window || huerfano()) return;
  const d = (ev.detail && typeof ev.detail === 'object') ? ev.detail : {};
  try { chrome.runtime.sendMessage({ tipo: 'REPLICA_CANCELAR', pedido: textoCorto(d.pedido, 80) }, () => void chrome.runtime.lastError); } catch { /* nada */ }
});
// Del worker a la pantalla. `REPLICA_LISTA` contesta si alguien la estaba esperando (`MAKO_REPLICA_RECIBIDA` con su pedido):
// si la persona se fue a otra pantalla, el worker abre Replicar en una pestaña nueva con la entrega.
chrome.runtime.onMessage.addListener((msg, _s, responder) => {
  if (msg && msg.tipo === 'REPLICA_ESTADO') {
    window.dispatchEvent(new CustomEvent('MAKO_REPLICA_ESTADO', {
      detail: { pedido: textoCorto(msg.pedido, 80), fase: textoCorto(msg.fase, 20), hecho: typeof msg.hecho === 'number' ? msg.hecho : 0, motivo: textoCorto(msg.motivo, 20) },
    }));
    return false;
  }
  if (!msg || msg.tipo !== 'REPLICA_LISTA') return false;
  const pedido = textoCorto(msg.pedido, 80);
  let listo = false;
  const fin = (recibida) => {
    if (listo) return;
    listo = true;
    clearTimeout(reloj);
    window.removeEventListener('MAKO_REPLICA_RECIBIDA', al);
    responder({ recibida });
  };
  const al = (ev) => { const d = (ev && ev.detail) || {}; if (d.pedido === pedido) fin(true); };
  window.addEventListener('MAKO_REPLICA_RECIBIDA', al);
  const reloj = setTimeout(() => fin(false), 1500);
  window.dispatchEvent(new CustomEvent('MAKO_REPLICA_LISTA', { detail: { pedido, entrega: textoCorto(msg.entrega, 80) } }));
  return true;
});

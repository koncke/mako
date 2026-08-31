// =============================================================================
// Los cuatro pasos, adentro del popup
// =============================================================================
// El orden de las condiciones ES el diseño: se pregunta de lo más bloqueante a
// lo menos, y gana la primera. Nunca se pintan dos problemas a la vez, porque
// arreglar el de abajo no sirve mientras el de arriba siga.
//
//   paso 1  Instalar          → NO vive acá. Es una tautología: el popup es una
//                               página de la extensión y no existe antes de
//                               instalarla. Ese aviso queda en la web.
//   paso 2  Conectar          → botón `Conectar`. El token lo acuña la PÁGINA de
//                               MaKo con la sesión del usuario; desde acá sale el
//                               disparo y vuelve el resultado.
//   paso 3  Abrir Google Flow → acá mejora: el popup VE la pestaña, la enfoca y
//                               la recarga él mismo. La web solo podía pedirlo.
//   paso 4  Créditos          → se consulta contra la pestaña de Flow, sin dar la
//                               vuelta por la cola de MaKo.

const MAKO = 'https://hola-mako.com/video-generator';

const $ = (id) => document.getElementById(id);

/** Un solo lugar arma la pantalla: título, línea tenue y como máximo un botón. */
function pantalla({ titulo, numero, tenue, boton, accion, suave }) {
  const cuerpo = $('cuerpo');
  cuerpo.textContent = '';

  const h = document.createElement('h1');
  if (numero) h.className = 'numero';
  h.textContent = titulo;
  cuerpo.appendChild(h);

  if (tenue) {
    const p = document.createElement('div');
    p.className = 'tenue';
    p.textContent = tenue;
    cuerpo.appendChild(p);
  }

  if (boton) {
    const b = document.createElement('button');
    if (suave) b.className = 'suave';
    b.textContent = boton;
    b.addEventListener('click', () => {
      // Se apaga en el acto: el popup vive mientras tiene foco y un segundo clic
      // dispararía dos veces la misma cosa —dos tokens, dos pestañas de Flow—.
      b.disabled = true;
      b.textContent = 'Un momento…';
      accion();
    });
    cuerpo.appendChild(b);
  }
}

function esperando(titulo) {
  pantalla({ titulo });
}

const enviar = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (out) => {
  // Leer `lastError` no es cosmético: si el service worker estaba dormido y no
  // contesta, Chrome lo escupe como error sin capturar en la consola.
  void chrome.runtime.lastError;
  r(out || null);
}));

/** El motivo por el que la página no pudo acuñar, en una frase. */
const POR_QUE = {
  sesion: 'Inicia sesión en MaKo y vuelve a intentar.',
  rol: 'Solo quien administra la cuenta puede conectar un navegador.',
  sin_ws: 'Abre un cliente en MaKo y vuelve a intentar.',
  error: 'Vuelve a intentar en un momento.',
};

async function pintar() {
  const v = await enviar({ tipo: 'ESTADO' });
  if (!v) { pantalla({ titulo: 'Reinicia el navegador', tenue: 'La extensión no responde.' }); return; }

  $('version').textContent = 'v' + v.version;
  $('ws').textContent = v.workspace || '';

  const latido = v.ultimoLatido || null;

  // ── Conectar (paso 2) ──────────────────────────────────────────────────
  if (v.emparejando) { esperando('Conectando…'); return; }

  if (v.emparejarError) {
    // «Ya hay otro navegador» es el único que no es un error del usuario: es una
    // decisión, y por eso ofrece continuar en vez de mandarlo a otro lado.
    if (v.emparejarError === 'otro_navegador') {
      pantalla({
        titulo: 'Ya hay otro navegador conectado',
        tenue: (v.emparejarEtiqueta ? v.emparejarEtiqueta + '. ' : '') + 'Si continúas, ese se desconectará.',
        boton: 'Conectar este',
        accion: () => void conectar(true),
      });
      return;
    }
    pantalla({
      titulo: 'Termina de conectar en MaKo',
      tenue: POR_QUE[v.emparejarError] || POR_QUE.error,
      boton: 'Abrir MaKo',
      accion: abrirMako,
    });
    return;
  }

  if (!v.token) {
    pantalla({ titulo: 'Conecta tu navegador', boton: 'Conectar', accion: () => void conectar(false) });
    return;
  }

  // ⚠️ Un 404 NO es «se cayó internet»: es «este token ya no existe», y pasa cada
  // vez que se conecta otro navegador. Mandar a revisar la red sobre esto es
  // mandar a buscar donde no es.
  if (latido && latido.http === 404) {
    pantalla({
      titulo: 'Esta conexión ya no sirve',
      tenue: 'Se conectó otro navegador.',
      boton: 'Volver a conectar',
      accion: () => void conectar(true),
    });
    return;
  }

  if (latido && latido.ok === false && latido.http === 0 && Date.now() - latido.cuando < 120000) {
    pantalla({ titulo: 'No pude hablar con MaKo', tenue: 'Revisa tu internet.', boton: 'Reintentar', accion: latir });
    return;
  }

  if (latido && latido.estado === 'marcada') {
    pantalla({
      titulo: 'Google pausó tu sesión de Flow',
      tenue: 'Espera un rato, borra las cookies de google.com y labs.google, y vuelve a entrar a Flow.',
      boton: 'Abrir MaKo',
      accion: abrirMako,
    });
    return;
  }

  // ── Google Flow (paso 3) ───────────────────────────────────────────────
  if (!v.hayFlow) {
    pantalla({ titulo: 'Abre Google Flow', boton: 'Abrir Google Flow', accion: abrirFlow });
    return;
  }
  if (!v.bearer) {
    pantalla({ titulo: 'Inicia sesión en Google Flow', boton: 'Ir a Google Flow', accion: abrirFlow });
    return;
  }
  // ⚠️ Con bearer pero sin `apiKey` el pedido llega sin proyecto atribuido y
  // Google contesta su página de bloqueo. Tiene remedio propio —recargar— y por
  // eso es su propia pantalla: sin ella el popup diría «todo listo» mientras MaKo
  // dice «falta abrir Google Flow» sobre el mismo navegador.
  if (!v.apiKey || (latido && latido.estado === 'sin_sesion')) {
    pantalla({ titulo: 'Recarga Google Flow', boton: 'Recargar', accion: recargarFlow });
    return;
  }

  // ── Créditos (paso 4) ──────────────────────────────────────────────────
  const s = v.saldo;
  if (s && !s.error && typeof s.creditos === 'number' && Date.now() - s.cuando < 60000) {
    pantalla({
      titulo: s.creditos.toLocaleString('es-MX'),
      numero: true,
      tenue: 'créditos' + (s.gratuito ? ' · plan gratuito' : s.sku ? ' · plan ' + s.sku : ''),
    });
    return;
  }
  pantalla({ titulo: 'Todo listo', boton: 'Ver mis créditos', suave: true, accion: verSaldo });
}

// ── Las acciones. Todas terminan repintando: la pantalla siempre dice el
//    estado de AHORA, nunca el de antes del clic. ──────────────────────────
async function conectar(forzar) {
  esperando('Conectando…');
  await enviar({ tipo: 'CONECTAR', forzar: !!forzar });
  await pintar();
}

async function latir() { esperando('Reintentando…'); await enviar({ tipo: 'LATIR' }); await pintar(); }

async function abrirFlow() {
  await enviar({ tipo: 'ABRIR_FLOW' });
  // Abrir Flow enfoca otra pestaña, y con eso este popup se cierra solo. No hay
  // nada que repintar: la próxima vez que se abra dirá lo que corresponda.
  window.close();
}

async function recargarFlow() {
  esperando('Recargando…');
  await enviar({ tipo: 'RECARGAR_FLOW' });
  window.close();
}

async function verSaldo() {
  esperando('Preguntando a Google…');
  const s = await enviar({ tipo: 'SALDO' });
  if (s && s.error) {
    pantalla({
      titulo: 'No pude leer tus créditos',
      // Sin enumerar causas: el error clasificado vive en el latido y el remedio
      // real de casi todos es el mismo.
      tenue: 'Recarga la pestaña de Google Flow y vuelve a intentar.',
      boton: 'Recargar',
      accion: recargarFlow,
    });
    return;
  }
  await pintar();
}

function abrirMako() { chrome.tabs.create({ url: MAKO }); window.close(); }

void pintar();

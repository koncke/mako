#!/usr/bin/env node
// =============================================================================
// gen-iconos-landing — genera lib/editor-landing/iconos.ts (subset de Phosphor)
// =============================================================================
// El editor de landings copiado de Gamma (docs/diseno-editor-landing.md, paquete
// B) necesita íconos en tres lugares: el menú «/» y la barra de bloques (cada
// bloque de lib/editor-landing/catalogo-bloques.ts nombra el suyo), el chrome del
// editor (casa, compartir, deshacer, destellos…) y el CONTENIDO de una landing
// (los «diseños optimizados» con íconos, los recuadros). Los tres salen de UN
// módulo, `ICONOS`, para que la página publicada y el editor dibujen el mismo
// trazo.
//
// Por qué un subset GENERADO y no la dependencia: @phosphor-icons/core trae 9.072
// SVG (seis pesos); el editor usa ~250 en peso «regular». Instalarla mete 9.000
// archivos al repo de todos para usar el 3%, y además el render público (render.ts,
// sin DOM) necesita el `d` del trazo como string, no un componente React.
//
// CÓMO SE CORRE (no instala nada en el repo ni ejecuta código del paquete: sólo
// LEE sus SVG, su LICENSE y su package.json):
//
//   mkdir <carpeta-nueva> && cd <carpeta-nueva>
//   npm pack @phosphor-icons/core@2.1.1 --ignore-scripts
//   mkdir pkg && tar -xzf phosphor-icons-core-2.1.1.tgz -C pkg
//   node <repo>/scripts/gen-iconos-landing.mjs <carpeta-nueva>/pkg/package
//
// Para sumar un ícono: agregar su fila a LISTA (nombre nuestro, nombre en
// Phosphor, etiquetas en español SIN acentos, peso opcional) y volver a correrlo.
// El script se NIEGA a escribir si falta un ícono que nombra el catálogo de
// bloques, si un nombre se repite, si un SVG no es un solo <path> o si un trazo
// trae algo que no sea un comando de path (AGENTS.md: «un reescritor de código
// fuente reporta éxito sobre un archivo roto» — acá se valida ANTES de escribir).
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'lib', 'editor-landing', 'iconos.ts');
const CATALOGO = join(RAIZ, 'lib', 'editor-landing', 'catalogo-bloques.ts');

// ─────────────────────────────────────────────────────────────────────────────
// La lista curada: [nombre nuestro, nombre en Phosphor, etiquetas, peso?]
// ─────────────────────────────────────────────────────────────────────────────
// Las etiquetas van en español sin acentos (buscarIconos normaliza la consulta
// igual) y separadas por espacio: cada palabra es una etiqueta. El nombre nuestro
// también se busca, así que no hace falta repetirlo como etiqueta.
const LISTA = [
  // ── Bloques del catálogo (lib/editor-landing/catalogo-bloques.ts) ──────────
  ['texto-t', 'text-t', 'titulo texto display letra'],
  ['texto-h1', 'text-h-one', 'encabezado titulo h1'],
  ['texto-h2', 'text-h-two', 'encabezado subtitulo h2'],
  ['texto-h3', 'text-h-three', 'encabezado h3'],
  ['texto-h4', 'text-h-four', 'encabezado h4'],
  ['texto-aa', 'text-aa', 'texto tamano fuente letra tipografia'],
  ['texto-parrafo', 'paragraph', 'parrafo texto'],
  ['lista', 'list-bullets', 'lista vinetas puntos'],
  ['lista-numerada', 'list-numbers', 'lista numeros ordenada'],
  ['lista-check', 'list-checks', 'tareas checklist pendientes'],
  ['cita', 'quotes', 'cita comillas testimonio frase'],
  ['separador', 'minus', 'separador linea divisor'],
  ['espacio', 'arrows-out-line-vertical', 'espacio aire separacion'],
  ['desplegable', 'caret-circle-down', 'desplegable acordeon preguntas faq'],
  ['columnas-2', 'columns', 'columnas dos'],
  ['columnas-3', 'kanban', 'columnas tres'],
  ['columnas-4', 'grid-four', 'columnas cuatro cuadricula'],
  ['info', 'info', 'informacion ayuda dato recuadro'],
  ['nota', 'note', 'nota apunte recuadro'],
  ['advertencia', 'warning', 'advertencia alerta cuidado recuadro'],
  ['precaucion', 'warning-octagon', 'precaucion peligro alto recuadro'],
  ['exito', 'check-circle', 'exito listo correcto garantia recuadro'],
  ['pregunta', 'question', 'pregunta duda ayuda recuadro'],
  ['opt-vinetas', 'list-dashes', 'vinetas lista diseno'],
  ['opt-cajas', 'squares-four', 'cajas tarjetas bloques'],
  ['opt-iconos', 'shapes', 'iconos formas figuras'],
  ['opt-tiempo', 'git-commit', 'tiempo historia hitos cronologia'],
  ['opt-etapas', 'steps', 'etapas pasos proceso'],
  ['opt-flechas', 'arrow-fat-lines-right', 'flechas avance secuencia'],
  ['opt-estadisticas', 'trend-up', 'estadisticas numeros metricas resultados'],
  ['opt-comparacion', 'scales', 'comparacion versus balanza'],
  ['opt-piramide', 'triangle', 'piramide niveles triangulo'],
  ['opt-embudo', 'funnel', 'embudo ventas filtro'],
  ['opt-ciclo', 'arrows-clockwise', 'ciclo circulo repetir'],
  ['opt-citas', 'chats-circle', 'citas testimonios resenas opiniones'],
  ['opt-equipo', 'users-three', 'equipo personas grupo'],
  ['opt-logos', 'buildings', 'logos clientes marcas empresas'],
  ['opt-galeria', 'images', 'galeria fotos imagenes'],
  ['boton', 'cursor-click', 'boton clic accion'],
  ['botones', 'rows', 'botones dos'],
  ['formulario', 'textbox', 'formulario campos captura registro'],
  ['etiqueta', 'tag', 'etiqueta pildora insignia'],
  ['imagen', 'image', 'imagen foto'],
  ['buscar-imagen', 'images-square', 'buscar imagenes stock fotos'],
  ['enlace', 'link', 'enlace link url vinculo'],
  ['video', 'video-camera', 'video grabar camara'],
  ['video-enlace', 'monitor-play', 'video youtube vimeo reproducir'],
  ['insertar', 'app-window', 'insertar incrustar embed calendly'],
  ['codigo', 'code', 'codigo html programacion'],
  ['grafico-barras', 'chart-bar-horizontal', 'grafico barras'],
  ['grafico-columnas', 'chart-bar', 'grafico columnas'],
  ['grafico-lineas', 'chart-line', 'grafico lineas tendencia'],
  ['grafico-circular', 'chart-pie', 'grafico circular torta'],
  ['grafico-dona', 'chart-donut', 'grafico dona anillo'],
  ['tabla', 'table', 'tabla celdas filas'],

  // ── El chrome del editor (lo que dibuja Gamma en barras, paneles y menús) ──
  ['casa', 'house', 'inicio panel'],
  ['compartir', 'share-network', 'compartir red'],
  ['exportar', 'export', 'exportar sacar'],
  ['descargar', 'download-simple', 'descargar bajar'],
  ['subir', 'upload-simple', 'subir cargar'],
  ['play', 'play', 'presentar reproducir'],
  // El ▶ del VSL vacío en la miniatura de un diseño con video (especificacion.ts, `specInsertado`): relleno,
  // como el de un reproductor; el de contorno se leía como un botón más («Diseños con video», 14/10/2026).
  ['play-relleno', 'play', 'reproducir video', 'fill'],
  ['presentar', 'presentation', 'presentar pantalla diapositivas'],
  ['globo', 'globe', 'publicar sitio web internet'],
  ['puntos', 'dots-three', 'opciones menu'],
  ['puntos-vertical', 'dots-three-vertical', 'opciones menu'],
  ['deshacer', 'arrow-counter-clockwise', 'deshacer volver'],
  ['rehacer', 'arrow-clockwise', 'rehacer repetir'],
  ['lapiz', 'pencil-simple', 'editar escribir'],
  ['destellos', 'sparkle', 'ia magia destello inteligencia'],
  ['varita', 'magic-wand', 'magia ia'],
  ['grilla-mas', 'plus-square', 'agregar bloque nuevo'],
  ['capas', 'stack', 'capas apilar formato'],
  ['paleta', 'palette', 'tema colores'],
  ['papelera', 'trash', 'borrar eliminar'],
  ['copiar', 'copy', 'copiar'],
  ['duplicar', 'copy-simple', 'duplicar copia'],
  ['desenlazar', 'link-break', 'quitar enlace'],
  ['notas', 'notepad', 'notas orador apuntes'],
  ['reloj', 'clock', 'hora tiempo'],
  ['historial', 'clock-counter-clockwise', 'historial versiones'],
  ['comentario', 'chat-circle', 'comentario mensaje'],
  ['comentarios', 'chats', 'comentarios conversacion'],
  ['grafico', 'chart-line-up', 'grafico analisis crecimiento analitica'],
  ['engranaje', 'gear', 'configuracion ajustes'],
  ['ajustes', 'sliders-horizontal', 'ajustes controles'],
  ['estrella', 'star', 'favorito destacado'],
  ['estrella-llena', 'star', 'calificacion favorito', 'fill'],
  ['estrella-media', 'star-half', 'calificacion media', 'fill'],
  ['ojo', 'eye', 'ver mostrar vista'],
  ['ojo-tachado', 'eye-slash', 'ocultar esconder'],
  ['flecha-izquierda', 'arrow-left', 'flecha atras'],
  ['flecha-derecha', 'arrow-right', 'flecha siguiente'],
  ['flecha-arriba', 'arrow-up', 'flecha subir'],
  ['flecha-abajo', 'arrow-down', 'flecha bajar'],
  ['flecha-externa', 'arrow-up-right', 'abrir externo enlace'],
  ['mas', 'plus', 'agregar nuevo sumar'],
  ['menos', 'minus', 'quitar restar'],
  ['cerrar', 'x', 'cerrar salir cancelar'],
  ['chevron-abajo', 'caret-down', 'abrir desplegar'],
  ['chevron-arriba', 'caret-up', 'plegar'],
  ['chevron-izquierda', 'caret-left', 'anterior'],
  ['chevron-derecha', 'caret-right', 'siguiente'],
  ['chevron-doble-izquierda', 'caret-double-left', 'colapsar plegar panel'],
  ['arrastrar', 'dots-six-vertical', 'arrastrar mover ordenar'],
  ['buscar', 'magnifying-glass', 'buscar lupa'],
  ['zoom-mas', 'magnifying-glass-plus', 'acercar zoom'],
  ['zoom-menos', 'magnifying-glass-minus', 'alejar zoom'],
  ['carpeta', 'folder', 'carpeta archivos'],
  ['carpeta-abierta', 'folder-open', 'carpeta abierta'],
  ['carpeta-mas', 'folder-plus', 'nueva carpeta'],
  ['archivo', 'file-text', 'archivo documento texto'],
  ['paginas', 'files', 'paginas documentos'],
  ['check', 'check', 'listo correcto'],
  ['x-circulo', 'x-circle', 'error cancelar'],
  ['pantalla-completa', 'corners-out', 'pantalla completa expandir'],
  ['celular', 'device-mobile', 'movil telefono celular'],
  ['tablet', 'device-tablet', 'tableta'],
  ['escritorio', 'desktop', 'computadora pantalla'],
  ['alinear-izquierda', 'text-align-left', 'alinear izquierda'],
  ['alinear-centro', 'text-align-center', 'centrar centro'],
  ['alinear-derecha', 'text-align-right', 'alinear derecha'],
  ['negrita', 'text-b', 'negrita'],
  ['cursiva', 'text-italic', 'cursiva italica'],
  ['subrayado', 'text-underline', 'subrayado'],
  ['tachado', 'text-strikethrough', 'tachado'],
  ['resaltar', 'highlighter', 'resaltar marcador'],
  ['color-texto', 'text-a-underline', 'color texto'],
  ['diseno', 'layout', 'diseno plantilla estructura'],
  ['plantillas', 'cards', 'plantillas modelos miniaturas'],
  ['teclado', 'keyboard', 'atajos teclado'],
  ['traducir', 'translate', 'traducir idioma'],
  ['mover', 'arrows-out-cardinal', 'mover posicion'],
  ['pegar', 'clipboard', 'pegar portapapeles'],
  ['enviar', 'paper-plane-right', 'enviar mandar'],
  ['candado', 'lock', 'seguridad privado bloquear'],
  ['candado-abierto', 'lock-open', 'desbloquear abierto'],
  ['nube-check', 'cloud-check', 'guardado sincronizado'],
  ['refrescar', 'arrows-counter-clockwise', 'recargar actualizar'],
  ['imagen-rota', 'image-broken', 'imagen rota error'],
  ['usuario-circulo', 'user-circle', 'perfil cuenta avatar'],

  // ── Contenido: lo que una landing pone en sus diseños optimizados ──────────
  ['negocio', 'briefcase', 'negocio trabajo empresa maletin'],
  ['dinero', 'money', 'dinero billete pago efectivo'],
  ['monedas', 'coins', 'monedas ahorro dinero'],
  ['dolar', 'currency-circle-dollar', 'dolar precio moneda'],
  ['billetera', 'wallet', 'billetera pago'],
  ['tarjeta-credito', 'credit-card', 'tarjeta pago credito'],
  ['alcancia', 'piggy-bank', 'ahorro alcancia'],
  ['recibo', 'receipt', 'recibo factura compra'],
  ['calculadora', 'calculator', 'calcular numeros'],
  ['porcentaje', 'percent', 'porcentaje descuento'],
  ['etiqueta-precio', 'tag-simple', 'precio oferta'],
  ['cohete', 'rocket-launch', 'lanzamiento crecimiento rapido'],
  ['objetivo', 'target', 'objetivo meta diana'],
  ['trofeo', 'trophy', 'premio ganar exito'],
  ['medalla', 'medal', 'medalla premio'],
  ['corona', 'crown', 'premium vip lider'],
  ['diamante', 'diamond', 'premium valor'],
  ['regalo', 'gift', 'regalo bono'],
  ['escudo', 'shield-check', 'seguridad garantia proteccion'],
  ['llave', 'key', 'acceso llave'],
  ['huella', 'fingerprint', 'identidad seguridad'],
  ['sello', 'seal-check', 'verificado certificado aprobado'],
  ['certificado', 'certificate', 'certificado diploma'],
  ['usuario', 'user', 'persona usuario cliente'],
  ['usuarios', 'users', 'personas usuarios clientes'],
  ['comunidad', 'users-four', 'comunidad equipo grupo'],
  ['usuario-mas', 'user-plus', 'agregar persona registro'],
  ['usuario-check', 'user-check', 'cliente verificado'],
  ['apreton', 'handshake', 'acuerdo trato socio alianza'],
  ['mano-corazon', 'hand-heart', 'cuidado ayuda'],
  ['aplauso', 'hands-clapping', 'aplauso celebrar'],
  ['pulgar-arriba', 'thumbs-up', 'me gusta aprobado'],
  ['corazon', 'heart', 'amor favorito'],
  ['sonrisa', 'smiley', 'feliz satisfecho'],
  ['rayo', 'lightning', 'rapido energia'],
  ['fuego', 'fire', 'popular caliente tendencia'],
  ['brillo', 'star-four', 'brillo destello nuevo'],
  ['confeti', 'confetti', 'fiesta celebracion'],
  ['chat', 'chat-circle-dots', 'chat mensaje conversacion'],
  ['chat-texto', 'chat-text', 'mensaje texto'],
  ['telefono', 'phone', 'telefono llamada'],
  ['llamada', 'phone-call', 'llamada contacto'],
  ['mail', 'envelope-simple', 'correo email'],
  ['megafono', 'megaphone', 'anuncio marketing publicidad'],
  ['campana', 'bell', 'notificacion aviso'],
  ['notificacion', 'bell-ringing', 'alerta aviso'],
  ['calendario', 'calendar-blank', 'fecha agenda'],
  ['calendario-check', 'calendar-check', 'cita agendada reserva'],
  ['calendario-mas', 'calendar-plus', 'agendar reservar'],
  ['reloj-arena', 'hourglass', 'espera tiempo'],
  ['cronometro', 'timer', 'tiempo minutos'],
  ['alarma', 'alarm', 'alarma recordatorio'],
  ['ubicacion', 'map-pin', 'ubicacion direccion lugar'],
  ['mapa', 'map-trifold', 'mapa ruta'],
  ['mundo', 'globe-hemisphere-west', 'mundo internacional america'],
  ['brujula', 'compass', 'direccion rumbo'],
  ['bandera', 'flag', 'meta hito'],
  ['senal', 'signpost', 'direccion camino'],
  ['ruta', 'path', 'ruta camino proceso'],
  ['montana', 'mountains', 'desafio cima'],
  ['edificio', 'building-office', 'oficina empresa'],
  ['tienda', 'storefront', 'tienda comercio local'],
  ['carrito', 'shopping-cart', 'compra carrito tienda'],
  ['bolsa', 'shopping-bag', 'compra bolsa'],
  ['paquete', 'package', 'paquete producto envio'],
  ['camion', 'truck', 'envio entrega logistica'],
  ['avion', 'airplane-tilt', 'viaje vuelo'],
  ['hogar', 'house-line', 'hogar casa inmueble'],
  ['bombilla', 'lightbulb', 'idea innovacion'],
  ['cerebro', 'brain', 'inteligencia mente'],
  ['libro', 'book-open', 'libro aprender lectura'],
  ['graduacion', 'graduation-cap', 'curso educacion aprender'],
  ['pizarra', 'chalkboard-teacher', 'clase ensenanza'],
  ['microfono', 'microphone', 'audio podcast voz'],
  ['auriculares', 'headset', 'soporte atencion'],
  ['salvavidas', 'lifebuoy', 'soporte ayuda'],
  ['musica', 'music-notes', 'musica audio'],
  ['camara', 'camera', 'foto camara'],
  ['pantalla', 'monitor', 'pantalla computadora'],
  ['laptop', 'laptop', 'computadora portatil'],
  ['base-datos', 'database', 'datos base'],
  ['wifi', 'wifi-high', 'conexion internet'],
  ['enchufe', 'plug', 'integracion conectar'],
  ['rompecabezas', 'puzzle-piece', 'integracion pieza solucion'],
  ['cubo', 'cube', 'producto'],
  ['conexiones', 'graph', 'red conexiones'],
  ['flujo', 'flow-arrow', 'flujo automatizacion'],
  ['jerarquia', 'tree-structure', 'organigrama estructura'],
  ['herramienta', 'wrench', 'herramienta servicio'],
  ['planta', 'plant', 'crecimiento planta'],
  ['hoja', 'leaf', 'natural ecologia'],
  ['sol', 'sun', 'sol dia'],
  ['cafe', 'coffee', 'cafe pausa'],
  ['salud', 'heartbeat', 'salud bienestar pulso'],
  ['pesa', 'barbell', 'fitness gimnasio entrenamiento'],
  ['velocimetro', 'gauge', 'rendimiento velocidad'],
  ['tendencia-baja', 'trend-down', 'baja descenso'],
  ['infinito', 'infinity', 'infinito ilimitado'],
  ['firma', 'signature', 'firma contrato'],
  ['portapapeles', 'clipboard-text', 'lista checklist'],
  ['ticket', 'ticket', 'entrada evento cupon'],
  ['videollamada', 'video-conference', 'reunion videollamada zoom'],
  ['reporte', 'presentation-chart', 'reporte presentacion'],

  // ── Redes (pie de página y botones de una landing) ─────────────────────────
  ['whatsapp', 'whatsapp-logo', 'whatsapp mensaje redes'],
  ['instagram', 'instagram-logo', 'instagram redes'],
  ['facebook', 'facebook-logo', 'facebook redes'],
  ['youtube', 'youtube-logo', 'youtube video redes'],
  ['linkedin', 'linkedin-logo', 'linkedin redes'],
  ['tiktok', 'tiktok-logo', 'tiktok redes'],
  ['x-twitter', 'x-logo', 'twitter x redes'],

  // ── El neutro: lo que dibuja svgIcono cuando el nombre no existe ───────────
  ['neutro', 'placeholder', 'marcador generico'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Entrada: la carpeta del paquete (la que tiene assets/, LICENSE y package.json)
// ─────────────────────────────────────────────────────────────────────────────

function fallar(msg) {
  console.error('✖ ' + msg);
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error('uso: node scripts/gen-iconos-landing.mjs <carpeta del paquete @phosphor-icons/core>');
  process.exit(2);
}
// Acepta la raíz extraída del tgz («pkg») o la carpeta «package» de adentro.
const PKG = existsSync(join(arg, 'assets')) ? arg : join(arg, 'package');
if (!existsSync(join(PKG, 'assets', 'regular'))) fallar('no encuentro assets/regular en ' + PKG);

const sinCR = (s) => s.replace(/\r\n/g, '\n');
const pkgJson = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
const licencia = sinCR(readFileSync(join(PKG, 'LICENSE'), 'utf8')).trim();
if (!/MIT License/.test(licencia) || !/Copyright \(c\)/.test(licencia)) fallar('la LICENSE del paquete no es la MIT esperada');

// ─────────────────────────────────────────────────────────────────────────────
// Validación ANTES de escribir nada
// ─────────────────────────────────────────────────────────────────────────────

const NOMBRE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TAG_RE = /^[a-z0-9]+$/;               // sin acentos, sin ñ: la búsqueda normaliza igual
const D_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]+$/;
const PESOS = new Set(['regular', 'fill']);

const vistos = new Set();
const iconos = [];
for (const fila of LISTA) {
  const [nombre, fuente, etiquetas, peso = 'regular'] = fila;
  if (!NOMBRE_RE.test(nombre)) fallar('nombre inválido: ' + nombre);
  if (vistos.has(nombre)) fallar('nombre repetido: ' + nombre);
  vistos.add(nombre);
  if (!PESOS.has(peso)) fallar(nombre + ': peso desconocido ' + peso);
  const archivo = peso === 'regular' ? fuente + '.svg' : fuente + '-' + peso + '.svg';
  const ruta = join(PKG, 'assets', peso, archivo);
  if (!existsSync(ruta)) fallar(nombre + ': no existe ' + peso + '/' + archivo + ' en Phosphor');
  const svg = sinCR(readFileSync(ruta, 'utf8'));
  if (!/viewBox="0 0 256 256"/.test(svg)) fallar(nombre + ': el SVG no tiene viewBox 0 0 256 256');
  // Un solo <path> y nada más: si un ícono trajera <circle> o varios trazos, unirlos
  // a mano cambiaría el relleno (nonzero) sin que nadie lo vea.
  const sinRaiz = svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const paths = [...sinRaiz.matchAll(/<path d="([^"]+)"\s*\/>/g)];
  const resto = sinRaiz.replace(/<path d="[^"]+"\s*\/>/g, '').trim();
  if (paths.length !== 1 || resto) fallar(nombre + ': el SVG no es un solo <path> (' + paths.length + ' paths, resto «' + resto.slice(0, 40) + '»)');
  const d = paths[0][1].trim();
  if (!D_RE.test(d)) fallar(nombre + ': el trazo trae caracteres que no son de un path');
  const tags = etiquetas.trim().split(/\s+/);
  for (const t of tags) if (!TAG_RE.test(t)) fallar(nombre + ': etiqueta inválida «' + t + '» (sin acentos ni símbolos)');
  iconos.push({ nombre, fuente, peso, d, tags: [...new Set(tags)] });
}
if (!vistos.has('neutro')) fallar('falta el ícono «neutro» (el respaldo de svgIcono)');

// Todo ícono que nombra el catálogo de bloques tiene que existir acá.
const catalogo = sinCR(readFileSync(CATALOGO, 'utf8'));
const pedidos = [...new Set([...catalogo.matchAll(/icono:\s*'([^']+)'/g)].map((m) => m[1]))];
if (pedidos.length < 20) fallar('no pude leer los íconos de catalogo-bloques.ts (' + pedidos.length + ')');
const faltan = pedidos.filter((n) => !vistos.has(n));
if (faltan.length) fallar('el catálogo de bloques nombra íconos que no están en LISTA: ' + faltan.join(', '));

// ─────────────────────────────────────────────────────────────────────────────
// Salida
// ─────────────────────────────────────────────────────────────────────────────

const comentarLicencia = licencia.split('\n').map((l) => ('// ' + l).trimEnd()).join('\n');
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const filas = iconos.map((i) =>
  '  ' + q(i.nombre) + ': { d: ' + q(i.d) + ', tags: [' + i.tags.map(q).join(', ') + '] },' +
  (i.peso !== 'regular' ? ' // ' + i.fuente + ' (' + i.peso + ')' : ''),
);

const salida = [
  '// =============================================================================',
  '// editor-landing/iconos — subset de Phosphor Icons. GENERADO: no editar a mano',
  '// =============================================================================',
  '// Lo escribe scripts/gen-iconos-landing.mjs desde ' + pkgJson.name + '@' + pkgJson.version,
  '// (peso «regular», viewBox 256; las estrellas de calificación y el ▶ del video, en «fill»). Para',
  '// sumar un ícono: agregar su fila a LISTA en el script y volver a correrlo (las',
  '// instrucciones están en su cabecera). ' + iconos.length + ' íconos.',
  '//',
  '// Lo usan el menú «/» y la barra de bloques (cada bloque de catalogo-bloques.ts',
  '// nombra el suyo), el chrome del editor y el CONTENIDO de la landing (diseños',
  '// optimizados con íconos, recuadros): svgIcono devuelve un <svg> string que',
  '// sirve igual en el render público (sin DOM) y en el editor.',
  '//',
  '// Phosphor Icons — https://phosphoricons.com — se distribuye bajo esta licencia,',
  '// que exige conservar el aviso de copyright y el permiso en las copias:',
  '//',
  comentarLicencia,
  '// =============================================================================',
  '',
  '/** Un ícono: el d de su único <path> (viewBox 0 0 256 256) y sus etiquetas en español sin acentos. */',
  'export type Icono = { d: string; tags: readonly string[] };',
  '',
  'export const ORIGEN_ICONOS = { paquete: ' + q(pkgJson.name) + ', version: ' + q(pkgJson.version) + ', licencia: ' + q('MIT') + ' } as const;',
  '',
  'export const ICONOS: Readonly<Record<string, Icono>> = {',
  ...filas,
  '};',
  '',
  '/** Los nombres, en el orden de la lista (bloques, chrome, contenido, redes). */',
  'export const NOMBRES_ICONO: readonly string[] = Object.keys(ICONOS);',
  '',
  '/** Lo que se dibuja cuando un nombre no existe: un marcador genérico, nunca un hueco. */',
  "export const ICONO_NEUTRO = 'neutro';",
  '',
  'export function existeIcono(nombre: string | null | undefined): boolean {',
  '  return !!nombre && Object.prototype.hasOwnProperty.call(ICONOS, nombre);',
  '}',
  '',
  '/**',
  ' * El <svg> como string, listo para el render público o un dangerouslySetInnerHTML.',
  ' *',
  ' * Nunca devuelve vacío: un nombre que no existe dibuja el NEUTRO. Un ícono que',
  ' * desaparece sin rastro se lee como un bloque roto; el marcador se ve y se corrige',
  ' * (es el mismo modo de falla que <Icon name="inventado"> dibujando un punto, al',
  ' * revés: acá se nota). Pinta con currentColor, así hereda el color del texto o',
  ' * del acento del tema según dónde se monte.',
  ' */',
  'export function svgIcono(nombre: string, tam: number = 24, clase?: string): string {',
  '  const icono = existeIcono(nombre) ? ICONOS[nombre] : ICONOS[ICONO_NEUTRO];',
  '  const lado = Number.isFinite(tam) && tam > 0 ? Math.min(Math.round(tam), 512) : 24;',
  "  // La clase va dentro de un atributo: se quitan las comillas y los ángulos en vez de",
  "  // escaparlos, porque una clase legítima nunca los trae.",
  "  const cls = clase ? ' class=\"' + clase.replace(/[\"'<>&]/g, '').trim() + '\"' : '';",
  "  return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" width=\"' + lado + '\" height=\"' + lado +",
  "    '\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"' + cls + '><path d=\"' + icono.d + '\"/></svg>';",
  '}',
  '',
  "const normalizar = (s: string) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();",
  '',
  '/**',
  ' * Busca por nombre y por etiquetas (sin acentos, sin mayúsculas). Con varias',
  ' * palabras, cada una tiene que encontrarse. El orden: nombre exacto, nombre que',
  ' * empieza igual, nombre que la contiene, etiqueta exacta, etiqueta que empieza',
  ' * igual, etiqueta que la contiene; a igual puntaje, el orden de la lista.',
  ' * Consulta vacía = todos.',
  ' */',
  'export function buscarIconos(consulta: string, max: number = Infinity): string[] {',
  '  const palabras = normalizar(consulta || \'\').split(/\\s+/).filter(Boolean);',
  '  if (!palabras.length) return NOMBRES_ICONO.slice(0, max);',
  '  const puntaje = (nombre: string, tags: readonly string[], p: string): number => {',
  '    if (nombre === p) return 0;',
  '    if (nombre.startsWith(p)) return 1;',
  '    if (nombre.includes(p)) return 2;',
  '    if (tags.includes(p)) return 3;',
  '    if (tags.some((t) => t.startsWith(p))) return 4;',
  '    if (tags.some((t) => t.includes(p))) return 5;',
  '    return -1;',
  '  };',
  '  const hallados: { nombre: string; total: number; i: number }[] = [];',
  '  NOMBRES_ICONO.forEach((nombre, i) => {',
  '    const tags = ICONOS[nombre].tags;',
  '    let total = 0;',
  '    for (const p of palabras) {',
  '      const s = puntaje(nombre, tags, p);',
  '      if (s < 0) return;',
  '      total += s;',
  '    }',
  '    hallados.push({ nombre, total, i });',
  '  });',
  '  return hallados.sort((a, b) => a.total - b.total || a.i - b.i).slice(0, max).map((h) => h.nombre);',
  '}',
  '',
].join('\n');

if (salida.includes('`') || salida.includes('${')) fallar('la salida trae un backtick o un ${: no escribo');
if (/[^\n]\r|\r(?!\n)/.test(salida)) fallar('la salida trae un CR suelto: no escribo');

writeFileSync(SALIDA, salida, 'utf8');
console.log('✓ ' + iconos.length + ' íconos → lib/editor-landing/iconos.ts (' + Math.round(salida.length / 1024) + ' KB). ' +
  'El catálogo de bloques pide ' + pedidos.length + ' y están todos.');

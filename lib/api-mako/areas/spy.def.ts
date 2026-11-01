// =============================================================================
// Área `spy` — Competitors Spy por la API de MaKo
// =============================================================================
// «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API» (Martín,
// 25/10/2026). Y el plan de la tab lo pide explícito: tiene que ser contestable desde WhatsApp —
// «¿qué está haciendo @x?» (docs/diseno-competitors-spy.md §3).
//
// `canales: ['app', 'whatsapp']`, SIN `'http'`, y es una decisión, no un olvido: lo que sale por
// HTTP sale a un token que puede vivir en la máquina de un tercero, y acá lo que viaja es a quién
// vigila un negocio — un dato que no tiene por qué salir del workspace por un bearer. El día que un
// integrador lo necesite se agrega `'http'`, se regenera `tests/api-mako-http.snapshot.txt` y se
// suman las rutas a `RUTAS_REST`. Es el mismo criterio que `tickets.def.ts`.
//
// `gating.tab: 'market-an'` y `rolMinimo: 'admin'`: la pantalla hace `requireRolWs([], { nav:
// 'market-an' })`, así que sin `rolMinimo` un closer leería por MaKo lo que su pantalla le esconde.
//
// ⚠️ LAS DESCRIPCIONES SON CORTAS A PROPÓSITO. El chat ordena las operaciones por puntaje contra el
// pedido y las va metiendo hasta un presupuesto de 12.000 caracteres (el techo de Groq, que no se
// sube): cada carácter que gasta una operación se lo saca a otra. A igual puntaje gana la declarada
// antes, y por eso **una operación nueva va AL FINAL de su área**. El peso se mide con
// `tests/ops-center-clasificador-app.test.ts` ANTES de entregar.
// =============================================================================

import type { OperacionDef } from '../tipos';
import { TOPES } from '@/lib/spy-reglas';

const CANALES = ['app', 'whatsapp'] as const;
/** El mismo gating que la pantalla: la tab es del super admin, y la operación, del admin del workspace. */
const PUERTA = { tab: 'market-an', rolMinimo: 'admin' } as const;

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'listar_vigilados', area: 'spy', tipo: 'lectura',
    datosDeClientes: false,
    titulo: 'A quiénes les sigues la pista',
    descripcion: 'Los competidores que mira este negocio, con sus canales y cuándo se los revisó por última vez. Sin parámetros.',
    parametros: [],
    salida: 'json', canales: CANALES, costo: 'gratis', gating: PUERTA,
  },
  {
    id: 'sumar_al_radar', area: 'spy', tipo: 'accion', confirmacion: 'chat', reversible: true,
    datosDeClientes: false,
    titulo: 'Sumar a alguien al radar',
    descripcion: 'PROPONE empezar a mirar a alguien. Alcanza con pegar su @ de Instagram, el enlace de su canal de YouTube o el de su sitio.',
    parametros: [
      { nombre: 'pegado', tipo: 'string', obligatorio: true, max: 500, rotulo: 'Lo que pegó', descripcion: 'Un @ de Instagram, un enlace de YouTube o de su sitio.' },
      { nombre: 'nombre', tipo: 'string', max: TOPES.nombre, rotulo: 'Nombre', descripcion: 'Cómo llamarlo. Si no viene, se usa el @ o el dominio.' },
    ],
    escribe: 'crea una ficha para ese competidor en este negocio (tabla spy_competidores)',
    canales: CANALES, costo: 'gratis', gating: PUERTA,
  },
  {
    id: 'revisar_sus_canales', area: 'spy', tipo: 'accion', confirmacion: 'chat', reversible: false, lenta: true,
    datosDeClientes: false,
    titulo: 'Revisar qué publicó',
    descripcion: 'PROPONE leer ahora el Instagram, el YouTube y el sitio de uno de ellos, y guardar lo nuevo. Gasta cuota de esos servicios.',
    parametros: [
      { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, rotulo: 'Cuál', descripcion: 'El id que devuelve listar_vigilados.' },
    ],
    escribe: 'guarda cada pieza leída y la fecha en que se vio por primera vez (tabla spy_piezas)',
    canales: CANALES, costo: 'externo', gating: PUERTA,
  },
  {
    id: 'que_esta_haciendo', area: 'spy', tipo: 'lectura',
    datosDeClientes: false,
    titulo: 'Qué está haciendo',
    descripcion: 'La ficha de uno de ellos: qué publicó, con cuántas vistas, y desde cuándo está a la vista cada pieza.',
    parametros: [
      { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, rotulo: 'Cuál', descripcion: 'El id que devuelve listar_vigilados.' },
      { nombre: 'canal', tipo: 'string', enum: ['instagram', 'youtube', 'landing', 'anuncios'], rotulo: 'Canal', descripcion: 'Para ver sólo uno.' },
    ],
    salida: 'markdown', canales: CANALES, costo: 'gratis', gating: PUERTA,
  },
  {
    id: 'leer_su_oferta', area: 'spy', tipo: 'accion', confirmacion: 'chat', reversible: false, lenta: true,
    datosDeClientes: false,
    titulo: 'Qué vende y qué objeción ataca',
    descripcion: 'PROPONE que la IA lea lo guardado de uno de ellos y diga qué promete, a quién, y qué ataca que este negocio no menciona.',
    parametros: [
      { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, rotulo: 'Cuál', descripcion: 'El id que devuelve listar_vigilados.' },
    ],
    escribe: 'guarda la lectura de su oferta y la clasificación de cada pieza (tablas spy_competidores y spy_piezas)',
    canales: CANALES, costo: 'ia', gating: PUERTA,
  },
  {
    id: 'guardar_anuncio_visto', area: 'spy', tipo: 'accion', confirmacion: 'chat', reversible: true,
    datosDeClientes: false,
    titulo: 'Guardar un anuncio que viste',
    descripcion: 'PROPONE guardar un anuncio de la Biblioteca de Meta que viste tú. Es la única vía: la API de Meta no entrega anuncios comerciales fuera de Europa.',
    parametros: [
      { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, rotulo: 'De quién', descripcion: 'El id que devuelve listar_vigilados.' },
      { nombre: 'enlace', tipo: 'string', obligatorio: true, max: 1000, rotulo: 'Enlace', descripcion: 'El enlace del anuncio en la Biblioteca.' },
      { nombre: 'copy', tipo: 'string', max: TOPES.texto, rotulo: 'Texto', descripcion: 'El texto del anuncio, si lo tienes a mano.' },
    ],
    escribe: 'guarda ese anuncio en la ficha de ese competidor, marcado como traído por una persona (tabla spy_piezas)',
    canales: CANALES, costo: 'gratis', gating: PUERTA,
  },
  {
    id: 'dejar_de_mirar', area: 'spy', tipo: 'accion', confirmacion: 'chat', reversible: false,
    datosDeClientes: false,
    titulo: 'Dejar de mirar a alguien',
    descripcion: 'PROPONE sacar a alguien del radar. Se borra lo que se leyó de él.',
    parametros: [
      { nombre: 'id', tipo: 'number', obligatorio: true, entero: true, minimo: 1, rotulo: 'A quién', descripcion: 'El id que devuelve listar_vigilados.' },
    ],
    escribe: 'borra a ese competidor y lo que se leyó de él en este negocio (tablas spy_competidores y spy_piezas)',
    canales: CANALES, costo: 'gratis', gating: PUERTA,
  },
];

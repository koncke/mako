// /m/inbox y /m/cuenta: las decisiones de pantalla que no se ven en el navegador.
//
// Verificado ROMPIENDO (11/10/2026), cada rotura contra la base en verde (0 fallos):
//   · yaNoPendiente sin la regex de «ya se estaba ejecutando o ya venció»: 1 fallo.
//   · armarPayload sin `base[p.nombre] = null` para los declarados ausentes: 1 fallo.
//   · armarPayload aceptando «abc» como número (sin el isFinite): 1 fallo.
//   · esEditable sin el corte de ids: 1 fallo.
//   · vistaAvisos devolviendo 'activar' para 'bloqueado': 1 fallo.
//   · tiposParaRol sin filtrar para no-admin: 1 fallo.
//   · el guard de la página sin `maxDuration = 300`: 1 fallo.
// Y en la integración v2 (base 10 / 0, scratchpad/integ/romper.py):
//   · `resumenAvisos` sin mirar el interruptor general: 9 / 1.
//   · `resumenAvisos` contando como apagado lo que nunca se tocó: 9 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  armarPayload, esEditable, fraseDeFallas, minutosRestantes, rielDeVence, rotulosDe, yaNoPendiente,
} from '../app/m/inbox/inbox-ui';
import {
  comoDesbloquear, ofertaInstalar, resumenAvisos, segundaAvisos, tiposParaRol, toastDeActivar, toastDePrueba, vistaAvisos,
} from '../app/m/cuenta/cuenta-ui';

const leer = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('«ya no está pendiente» se reconoce en los textos reales de las acciones de escritorio', () => {
  for (const e of [
    'No hay ninguna acción pendiente vigente para confirmar.',
    'No encuentro la acción #12 vigente.',
    'Esa acción ya estaba resuelta.',
    'Esa acción ya se estaba ejecutando o ya venció.',
    'Esta propuesta ya está aplicada.',
  ]) assert.equal(yaNoPendiente(e), true, e);
  // Un fallo de verdad NO es «ya no está»: se muestra como error.
  assert.equal(yaNoPendiente('Meta rechazó el presupuesto.'), false);
  assert.equal(yaNoPendiente(undefined), false);
});

test('los botones nombran acción + objeto, nunca «Sí / No / Confirmar» a secas', () => {
  const p = rotulosDe({ tipo: 'pendiente', accionMovil: 'confirmar-pendiente' });
  const a = rotulosDe({ tipo: 'accion', accionMovil: 'confirmar-accion' });
  for (const r of [p.primario, p.salida, a.primario, a.salida]) {
    assert.ok(r && r.split(' ').length >= 2, `«${r}» tiene que nombrar un objeto`);
    assert.doesNotMatch(r!, /^(Sí|No|Aceptar|Cancelar|Confirmar|Descartar)$/);
  }
  assert.deepEqual(rotulosDe({ tipo: 'lead', accionMovil: 'computadora' }), { primario: null, salida: null });
});

test('el payload lleva TODOS los parámetros declarados (null si faltan) y las correcciones encima', () => {
  const params = [
    { nombre: 'leadId', tipo: 'number' as const },
    { nombre: 'mensaje', tipo: 'string' as const, rotulo: 'Mensaje' },
    { nombre: 'monto', tipo: 'number' as const, rotulo: 'Monto' },
    { nombre: 'urgente', tipo: 'boolean' as const },
    { nombre: 'nota', tipo: 'string' as const },
  ];
  const r = armarPayload(params, { leadId: 7, mensaje: 'Hola', monto: 10 }, { mensaje: '  Hola, Ana  ', monto: '12,5', urgente: true });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.payload, { leadId: 7, mensaje: 'Hola, Ana', monto: 12.5, urgente: true, nota: null });
  // Vaciar un campo es null (no el valor viejo).
  const v = armarPayload(params, { mensaje: 'Hola' }, { mensaje: '   ' });
  assert.equal(v.ok && v.payload.mensaje, null);
  // Un número que no es número no se manda: se dice cuál.
  const mal = armarPayload(params, {}, { monto: 'abc' });
  assert.equal(mal.ok, false);
  assert.match(!mal.ok ? mal.error : '', /Monto/);
});

test('sólo texto, número y sí/no se corrigen en el teléfono; los ids nunca', () => {
  assert.equal(esEditable({ nombre: 'mensaje', tipo: 'string' }), true);
  assert.equal(esEditable({ nombre: 'monto', tipo: 'number' }), true);
  assert.equal(esEditable({ nombre: 'activo', tipo: 'boolean' }), true);
  assert.equal(esEditable({ nombre: 'leadId', tipo: 'number' }), false);
  assert.equal(esEditable({ nombre: 'etiquetas', tipo: 'string[]' }), false);
  assert.equal(esEditable({ nombre: 'datos', tipo: 'object' }), false);
});

test('lo que vence se cuenta en el reloj del teléfono y «Vencida» se dice', () => {
  const ahora = Date.parse('2026-10-11T10:00:00Z');
  assert.equal(rielDeVence(minutosRestantes('2026-10-11T10:42:00Z', ahora)), '42 min');
  assert.equal(rielDeVence(minutosRestantes('2026-10-11T11:20:00Z', ahora)), '1 h 20');
  assert.equal(rielDeVence(minutosRestantes('2026-10-11T09:59:00Z', ahora)), 'Vencida');
  assert.equal(rielDeVence(minutosRestantes(undefined, ahora)), null);
});

// (v2: el título-frase «Te esperan 2 decisiones» ya no existe —el título es el nombre y el número
// va en el segmentado—, así que sus aserciones se fueron con la función.)
test('las fallas de lectura se DICEN', () => {
  assert.equal(fraseDeFallas(['accion']), 'No pude leer las propuestas de MaKo.');
  assert.equal(fraseDeFallas(['pendiente', 'confirmacion']), 'No pude leer las acciones de MaKo y los cambios del CRM.');
  assert.equal(fraseDeFallas([]), null);
});

test('avisos en este teléfono: cada estado ofrece UNA cosa', () => {
  assert.equal(vistaAvisos(null), 'cargando');
  assert.equal(vistaAvisos('instalar-primero'), 'instalar-ios');
  assert.equal(vistaAvisos('bloqueado'), 'bloqueado');
  assert.equal(vistaAvisos('apagado'), 'activar');
  assert.equal(vistaAvisos('activo'), 'activo');
  assert.equal(ofertaInstalar({ ios: true, instalada: false, puedePedir: false }), 'pasos-ios');
  assert.equal(ofertaInstalar({ ios: false, instalada: false, puedePedir: true }), 'boton');
  assert.equal(ofertaInstalar({ ios: true, instalada: true, puedePedir: false }), null);
  assert.match(comoDesbloquear(true, true), /Ajustes/);
  assert.equal(toastDePrueba({ ok: true, enviados: 1, sinSuscripciones: 0 }), 'Aviso enviado');
  assert.equal(toastDePrueba({ ok: false, enviados: 0, sinSuscripciones: 1 }), 'Ningún teléfono activo');
});

test('lo que sólo les llega a los admins no se le ofrece a un closer', () => {
  const tipos = [{ id: 'mako-pendiente' }, { id: 'reunion-cancelada' }];
  const solo = new Set(['mako-pendiente']);
  assert.deepEqual(tiposParaRol(tipos, solo, false).map((t) => t.id), ['reunion-cancelada']);
  assert.equal(tiposParaRol(tipos, solo, true).length, 2);
});

test('la página del Inbox declara su techo, y el permiso de avisos se pide dentro del toque', () => {
  const pagina = sinComentarios(leer('app/m/inbox/page.tsx'));
  assert.match(pagina, /export const maxDuration = 300;/);
  assert.match(pagina, /requireMovil\(\)/);
  // activarAvisos() es la PRIMERA línea del handler (antes de cualquier setState o await).
  const cuenta = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  assert.match(cuenta, /const activar = \(\) => \{\s*const pedido = activarAvisos\(\);/);
  // Nada en /m navega con next/link ni next/navigation.
  for (const f of ['app/m/inbox/InboxM.tsx', 'app/m/cuenta/CuentaM.tsx', 'app/m/cuenta/instalar/PasosInstalar.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /from 'next\/(link|navigation)'/, f);
  }
});

// v2 (integración, 11/10/2026): la fila «Avisos en este teléfono» y «Qué te avisa».
test('avisos: la segunda línea sólo cuando hay algo que hacer, y «Qué te avisa» cuenta lo que se VE', () => {
  assert.equal(segundaAvisos('bloqueado'), 'Bloqueados en el teléfono');
  assert.equal(segundaAvisos('instalar-ios'), 'Primero instala MaKo');
  assert.equal(segundaAvisos('activo'), null, 'prendido no lleva segunda línea');
  assert.equal(toastDeActivar('sin-claves'), 'Avisos no disponibles');
  assert.equal(toastDeActivar('cualquier-otro'), 'No se pudo activar');
  const tipos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(resumenAvisos({ activo: false, items: {} }, tipos), 'Ninguno', 'el interruptor general apagado manda');
  assert.equal(resumenAvisos({ activo: true, items: {} }, tipos), 'Todos', 'lo no tocado está prendido');
  assert.equal(resumenAvisos({ activo: true, items: { b: false } }, tipos), '2 de 3');
  assert.equal(resumenAvisos({ activo: true, items: { a: false, b: false, c: false } }, tipos), 'Ninguno');
  // Lo de admin no se cuenta para quien no lo ve: el total es el de SU lista.
  assert.equal(resumenAvisos({ activo: true, items: { x: false } }, tipos), 'Todos');
});

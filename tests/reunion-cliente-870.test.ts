// =============================================================================
// #870 — la reunión con un cliente: a qué proyecto van sus tareas, en los DOS tableros
// =============================================================================
// Lo que se vio en las llamadas del 16/10/2026:
//   · tablero del DUEÑO (ws9): las 26 tarjetas de la revisión con Código Inmobiliario cayeron en
//     «Cliente: Código Inmobiliario», y las 11 de «Mau <> Martin» en «Cliente: Mauricio Bustos», un
//     proyecto que la importación CREÓ al lado de «Cliente: Mauricio». Eran bugs y features de MaKo.
//   · tablero de MAURICIO (ws1): «Junta Monserrat HMO» no se reconoció como de Congelados HMO (Fathom
//     devolvió sólo al que grabó y el título no dice la empresa entera) y 7 de sus 15 tareas cayeron
//     en «Sin proyecto»; y el mismo cliente tenía TRES proyectos («hay dos Macarios»).
// Las reglas puras (lib/reunion-cliente-reglas.ts) con los datos REALES del ws1, y el camino entero
// —`proyectoQueManda`, «Cargar» un borrador— en el arnés de tests/_fathom-carga-hijo.ts (sin red).
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `clienteManda` devolviendo true siempre ............................. 2 fallos
//   2. `aplicarPropuestas` del dueño con `clienteDeLaReunion: !!clienteNombre` 1 fallo
//   3. `proyectoDelCliente` sin el escalón del lead ......................... 1 fallo
//   4. `esDelCliente` sin «una categoría de OTRO lead nunca es suya» ........ 1 fallo
//   5. `clientePorTitulo` sin la vía de la sigla ............................ 1 fallo
//   6. `siglas` sin el corte de «empresa toda en mayúsculas» ................ 1 fallo
//   7. `rutearSinIA` sin buscar el proyecto del cliente por su lead ......... 1 fallo
//   8. `proyectoDeCliente` creando la categoría sin el lead ................. 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { clienteManda, proyectoDelCliente, esDelCliente, clientePorTitulo } from '../lib/reunion-cliente-reglas';

// Los clientes GANADOS del ws1 el 17/10/2026, tal cual están en el CRM.
const GANADOS_WS1 = [
  { id: 297, empresa: null, nombre: 'Francisco Ramos' }, { id: 376, empresa: 'Jorge Negrete', nombre: 'Jorge Negrete' },
  { id: 23, empresa: 'Seguser', nombre: 'Adrian Medina' }, { id: 28, empresa: 'Grupo Esquer', nombre: 'Sergio Esquer' },
  { id: 81, empresa: 'GetReAll', nombre: 'Alejandro Corrales' }, { id: 491, empresa: 'Cendejas IESCA Inmobiliaria', nombre: 'Jesus Cendejas hernandez' },
  { id: 31, empresa: 'Congelados HMO', nombre: 'Macario Romero Valencia' }, { id: 18, empresa: 'Aspro', nombre: 'RICARDO azpe' },
  { id: 21, empresa: 'TEXX', nombre: 'Teresa de Jesus Hernandez' }, { id: 14, empresa: 'Teriyaki baja', nombre: 'Rosina Patricia Muñoz López' },
  { id: 91, empresa: 'Vertice Industrial', nombre: 'Francisco Javier Hernandez Baltazar' }, { id: 778, empresa: 'tsolco', nombre: 'Erik Markeset' },
];

test('el cliente de la reunión manda el proyecto SÓLO en el tablero de un cliente', () => {
  assert.equal(clienteManda('cliente'), true);
  assert.equal(clienteManda('dueno'), false, 'en el tablero del dueño, lo que un cliente dice de MaKo va a la tab');
});

test('un cliente, un proyecto: primero por el lead, después por el nombre en cualquier orden', () => {
  // Como estaba el ws1 el 16/10: tres proyectos para el lead 31 (uno sin lead).
  const antes = [
    { id: 47, nombre: 'Cliente: Macario Romero — HMO', cliente_lead_id: null },
    { id: 76, nombre: 'Cliente: Baja Teriyaki', cliente_lead_id: 14 },
    { id: 151, nombre: 'Cliente: Congelados HMO', cliente_lead_id: 31 },
    { id: 153, nombre: 'Cliente: Macario Romero', cliente_lead_id: 31 },
  ];
  const macario = { leadId: 31, empresa: 'Congelados HMO', nombre: 'Macario Romero Valencia' };
  assert.equal(proyectoDelCliente(antes, macario)?.id, 151, 'el atado a su lead gana');
  // Los tres son suyos (es lo que une scripts/unir-proyectos-de-cliente.ts).
  assert.deepEqual(antes.filter((c) => esDelCliente(c, macario)).map((c) => c.id), [47, 151, 153]);
  // Sin lead en ninguno, el que armó el dueño se reconoce por las palabras de empresa + persona.
  assert.equal(proyectoDelCliente([{ id: 47, nombre: 'Cliente: Macario Romero — HMO' }], macario)?.id, 47);
  // «Teriyaki baja» en el CRM, «Cliente Baja Teriyaki» en el tablero.
  assert.equal(proyectoDelCliente([{ id: 9, nombre: 'Cliente Baja Teriyaki' }], { leadId: 0, empresa: 'Teriyaki baja', nombre: 'Rosina' })?.id, 9);
  // Una categoría atada a OTRO lead nunca es de este cliente, por más que el nombre coincida.
  assert.equal(proyectoDelCliente([{ id: 5, nombre: 'Cliente: Remax', cliente_lead_id: 2451 }], { leadId: 2462, empresa: 'Remax', nombre: 'Sergio Arratia' }), undefined);
  // Un nombre de pila solo no alcanza: «Cliente: Mauricio» no es de cualquier Mauricio.
  assert.equal(proyectoDelCliente([{ id: 6, nombre: 'Cliente: Mauricio' }], { leadId: 0, empresa: null, nombre: 'Mauricio Pérez Soto' }), undefined);
});

test('el título nombra al cliente por la sigla o por la empresa en otro orden, nunca por un nombre de pila', () => {
  const de = (t: string) => clientePorTitulo(t, GANADOS_WS1)?.id ?? null;
  assert.equal(de('Junta Monserrat HMO'), 31, 'la junta del 16/10 que dejó 7 tareas en «Sin proyecto»');
  assert.equal(de('Capacitación SPIN Monserrat HMO'), 31);
  assert.equal(de('Reunion Paty Baja Teriyaki'), 14);
  assert.equal(de('Junta RRHH Grupo Esquer'), 28);
  assert.equal(de('Reunión TEXX Mantenimiento'), 21);
  assert.equal(de('Impromptu Google Meet Meeting'), null);
  assert.equal(de('Junta Sergio y Adriana'), null, 'nombres de pila: no se adivina');
  // ws11: «Nadia H Tremari» es cliente; «NADIA PIEDAD CALDERON…» es otra persona.
  assert.equal(clientePorTitulo('NADIA PIEDAD CALDERON MONTAÑEZ Mentoría con Leila', [{ id: 2605, empresa: 'Nadia H Tremari', nombre: 'NadiaHTremari' }]), null);
  // Una empresa toda en mayúsculas no tiene sigla: sus palabras no distinguen nada.
  assert.equal(clientePorTitulo('Visita a Brisas', [{ id: 2629, empresa: 'BRISAS RESIDENCES MAHAHUAL', nombre: 'Yendi' }]), null);
  // Dos clientes con la misma empresa: no se elige.
  assert.equal(clientePorTitulo('Junta Remax', [{ id: 1, empresa: 'Remax', nombre: 'A' }, { id: 2, empresa: 'Remax', nombre: 'B' }]), null);
});

// ── El camino entero, en el arnés sin red ──────────────────────────────────────────────────────
const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_fathom-carga-hijo.ts'), 'cliente870'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, env: { ...process.env, NODE_ENV: 'test' },
});
const r = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  dueno870: { manda: string; proyectos: string[]; creadas: Array<{ titulo: string; proyectos: string[] }> };
  cliente870: { manda: string; categorias: Array<{ nombre: string; lead: number | null }>; nuevoId: number | null; creadas: Array<{ titulo: string; proyectos: string[] }> };
  sinMock: string[];
};

test('tablero del dueño: la reunión no manda y su «Cliente: X» no se abre', () => {
  assert.equal(r.dueno870.manda, '', 'proyectoQueManda devuelve vacío en el tablero del dueño');
  assert.ok(!r.dueno870.proyectos.includes('Cliente: Mauricio Bustos'), `no nace el gemelo: ${r.dueno870.proyectos.join(', ')}`);
  const crm = r.dueno870.creadas.find((t) => t.titulo.startsWith('Arreglar el guardado'));
  assert.deepEqual(crm?.proyectos, ['Feature: CRM'], 'lo que eligió la extracción se respeta');
});

test('tablero de un cliente: todo al proyecto del cliente, encontrado por su lead', () => {
  assert.equal(r.cliente870.manda, 'Cliente: Macario Romero — HMO', 'el que ya existe, no «Cliente: Congelados HMO»');
  const t = r.cliente870.creadas.find((x) => x.titulo.startsWith('Enviar el contrato'));
  assert.deepEqual(t?.proyectos, ['Cliente: Macario Romero — HMO'], 'el borrador viejo traía el nombre del que se unió');
  assert.equal(r.cliente870.categorias.filter((c) => c.lead === 31).length, 1, 'no se reabrió el proyecto unido');
  const nuevo = r.cliente870.categorias.find((c) => c.nombre === 'Cliente: Panadería Sol');
  assert.equal(nuevo?.lead, 99, 'el proyecto nuevo de un cliente nace atado a su lead');
});

// =============================================================================
// probar-no-existe — la regla de «lo que no existe» contra el MODELO REAL (27/10/2026, ticket 874749710-14)
// =============================================================================
// Uso (con las claves de IA en el entorno, como cualquier script de la cascada):
//   node --conditions=react-server --import tsx scripts/probar-no-existe.mts
// Le pregunta a la cascada de verdad lo que Leandro preguntó, con la regla de lib/no-existe.ts y lo que de verdad hay en la
// tuerca de Automations, y dice si: (1) marcó [[no-existe: …]], (2) no inventó un bloque/sección por canal, (3) un pedido que
// SÍ existe no lleva la marca. No escribe nada: no levanta tickets (eso lo prueba tests/mako-no-existe.test.ts).
// =============================================================================

import { chatCheapCascade } from '../lib/ai-cheap';
import { REGLA_NO_EXISTE, sacarNoExiste } from '../lib/no-existe';

const SYSTEM = [
  'Eres MaKo, el asistente de un negocio dentro de la app MaKo. Contestas en español neutro, corto y claro.',
  'LO QUE HAY en la tuerca de Automations (Configuraciones): «Horario de oficina» y el bloque «Todos los canales», con «Goteo» y «Tope por día», que valen para TODOS los canales juntos. No hay nada por canal.',
  REGLA_NO_EXISTE,
].join('\n\n');

const CASOS = [
  { pedido: '¿Dónde configuro el tope máximo de comentarios para Instagram?', noExiste: true },
  { pedido: 'Quiero que MaKo me mande los leads a un Google Sheet cada hora, ¿cómo lo activo?', noExiste: true },
  { pedido: '¿Dónde pongo el horario de oficina para que no mande mensajes de noche?', noExiste: false },
];
const INVENTADO = /\b(?:bloque|secci[oó]n|pesta[ñn]a|apartado)\s+(?:de|para|del)\s+instagram\b/i;

let malos = 0;
for (const c of CASOS) {
  const errores: string[] = [];
  const salida = await chatCheapCascade({ system: SYSTEM, user: c.pedido, feature: 'mako-chat', motivo: 'probar-no-existe', maxTokens: 400, erroresOut: errores });
  if (!salida) { console.log(`✖ «${c.pedido}»: la IA no contestó (${errores.join(' · ').slice(0, 200)})`); malos++; continue; }
  const { texto, falta } = sacarNoExiste(salida);
  const bien = c.noExiste ? !!falta && !INVENTADO.test(texto) : !falta;
  if (!bien) malos++;
  console.log(`${bien ? '✔' : '✖'} «${c.pedido}»\n   marca: ${falta ? `«${falta}»` : '(ninguna)'}\n   texto: ${texto.replace(/\s+/g, ' ').slice(0, 280)}`);
}
console.log(malos ? `\n${malos} de ${CASOS.length} mal` : `\nlos ${CASOS.length} bien`);
process.exit(malos ? 1 : 0);

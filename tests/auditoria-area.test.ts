// =============================================================================
// La auditoría de un área: una LÍNEA por tarea, con su fecha
// =============================================================================
// Pedido de Martín (30/09/2026), después de ver la primera versión publicada:
// «Te pedí poco texto, que sea entendible... Y mirá lo que hiciste», sobre un
// documento que era el volcado crudo de 25 agentes — cada tarea con su párrafo de
// 900 a 2.000 caracteres y su lista de evidencia.
//
// ⚠️ LO QUE ESTE TEST PROTEGE NO ES EL FORMATO, ES EL LARGO. La tentación es pegar
// el párrafo del agente: está escrito, es correcto y es gratis. Y convierte la
// pantalla en lo mismo que se vino a arreglar. El techo de acá abajo es la regla
// de «la pantalla dice QUÉ pasó; el PORQUÉ va al código» aplicada a una lista de
// 25 filas, donde el costo se multiplica por 25.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUDITORIA as CRM } from '../app/admin/dev/crm/auditoria';
import type { Auditoria } from '../app/admin/dev/_registro/tipos';

const RAIZ = join(import.meta.dirname, '..');
const TODAS: Array<[string, Auditoria]> = [['crm', CRM]];

test('⚠️ cada «qué falta» entra en UNA línea', () => {
  // 110 caracteres es lo que entra al lado del título en la fila del panel sin
  // partirse en tres renglones. Verificado rompiéndolo: con el párrafo original de
  // #6 (904 caracteres) el test cae con 1 fallo y el resto pasa.
  const TECHO = 110;
  for (const [area, aud] of TODAS) {
    for (const [num, fila] of Object.entries(aud.filas)) {
      assert.ok(fila.falta.length > 0, `${area} #${num}: vacío`);
      assert.ok(fila.falta.length <= TECHO,
        `${area} #${num}: ${fila.falta.length} caracteres, el techo es ${TECHO} — «${fila.falta.slice(0, 60)}…»`);
      // Y una línea es UNA frase: el punto y seguido es por dónde entra el párrafo.
      assert.ok(!/\.\s+[A-ZÁÉÍÓÚÑ¿«]/.test(fila.falta.replace(/\.$/, '')),
        `${area} #${num}: son dos frases, y en una fila de lista entra una`);
    }
  }
});

test('⚠️ una auditoría SIN fecha se lee como el estado de hoy', () => {
  // Es una foto: el día que alguien arregle una de estas tareas, la línea miente.
  // La fecha es lo único que le dice a quien mira que puede estar vieja.
  for (const [area, aud] of TODAS) {
    assert.match(aud.fecha, /^\d{2}\/\d{2}\/\d{4}$/, `${area}: falta la fecha o no es dd/mm/aaaa`);
  }
});

test('⚠️ el link al detalle apunta a un .md que EXISTE', () => {
  // Una ruta escrita a mano que apunta a la nada no rompe nada: el link abre
  // /admin/docs y no muestra el documento, que se lee como que la pantalla falla.
  for (const [area, aud] of TODAS) {
    if (!aud.doc) continue;
    const ruta = join(RAIZ, 'docs', `${aud.doc}.md`);
    assert.ok(readFileSync(ruta, 'utf8').length > 0, `${area}: docs/${aud.doc}.md no existe`);
  }
});

test('⚠️ el panel dibuja el veredicto Y nombra cuándo contradice al avance', () => {
  // El % lo escribió una persona en la tarjeta; el veredicto salió de leer el
  // código. Los dos al lado sin nombrar la diferencia dejan la fila afirmando
  // «75%» y «sin empezar» a la vez, que se lee como que la pantalla está rota —
  // cuando es el dato más útil: ese avance no lo respalda nada. Medido el
  // 30/09/2026 en /admin/dev/crm: pasa en #38.
  const d = readFileSync(join(RAIZ, 'app/admin/dev/_registro/Derivados.tsx'), 'utf8');
  assert.match(d, /ChipAuditoria/, 'se fue el chip del veredicto');
  assert.match(d, /aud\?\.filas\[t\.num\]/, 'la fila dejó de mirar la auditoría');
  assert.match(d, /estado === 'sin' && t\.progreso > 0/, 'dejó de nombrar la contradicción entre el % y el veredicto');
  assert.match(d, /\{aud\.fecha\}/, 'el veredicto se dibuja sin su fecha');
});

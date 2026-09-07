// =============================================================================
// La cobertura del banco se mide contra el DOCUMENTO, no contra el catálogo
// =============================================================================
// `lib/banco-skills.ts` declara a qué nivel el material que mandó Mauricio cubre
// cada módulo, y esa lectura la ve él en la tab «Tu material».
//
// El riesgo específico de este archivo: hay DOS programas en el repo con la
// misma numeración y distinto contenido. El del documento que escribió Mauricio
// (13 módulos, 0 a 12) y el que está cargado en la plataforma (12, 0 a 11). Desde
// el 5 un mismo número nombra cosas distintas: «módulo 5» es El propósito en el
// catálogo y Objetivos por área en el documento.
//
// Si la cobertura se atara al catálogo, la pantalla le diría a Mauricio que el
// banco cubre un módulo que NO es ese — y el error sería mudo, porque los dos
// números existen. Estos tests son lo que impide que alguien «arregle» la
// referencia apuntándola al catálogo.
//
// El segundo bloque cuida las AFIRMACIONES. Cada defecto que se le muestra a
// Mauricio es sobre material suyo, así que ninguno puede quedar sin su prueba:
// una acusación sin evidencia no es un dato flojo, es una discusión.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODULOS_DOC, COBERTURA, DEFECTOS, TAREAS, NIVELES, INVENTARIO,
  DIVERGENCIA, PIEZAS_CLASE, PIEZAS_USADAS, MODULOS_EN_CERO, MODULOS_QUE_DESTRABA,
  coberturaDe, moduloDoc,
} from '../lib/banco-skills';
import { PROGRAMA } from '../lib/programa-catalogo';

// ── La cobertura cubre el documento entero, sin huecos ni de más ─────────────

test('cada módulo del documento tiene exactamente una cobertura', () => {
  for (const m of MODULOS_DOC) {
    const c = COBERTURA.filter(x => x.modulo === m.numero);
    assert.equal(c.length, 1, `el módulo ${m.numero} («${m.titulo}») tiene ${c.length} coberturas`);
  }
});

test('no hay coberturas de módulos que el documento no declara', () => {
  const declarados = new Set(MODULOS_DOC.map(m => m.numero));
  for (const c of COBERTURA) {
    assert.ok(declarados.has(c.modulo), `hay cobertura del módulo ${c.modulo}, que no está en MODULOS_DOC`);
  }
});

test('los niveles son de la escalera declarada', () => {
  for (const c of COBERTURA) {
    assert.ok(NIVELES.includes(c.nivel), `módulo ${c.modulo}: nivel «${c.nivel}» no existe`);
  }
});

// ⚠️ EL TEST QUE IMPIDE EL ERROR MUDO. Si alguien reapunta la cobertura al
// catálogo, los números siguen existiendo y nada falla — salvo esto.
test('la cobertura NO se mide contra el catálogo de la plataforma', () => {
  const desajustados = MODULOS_DOC.filter(m => {
    const enCatalogo = PROGRAMA.find(p => p.numero === m.numero);
    return enCatalogo && enCatalogo.titulo !== m.titulo;
  });
  assert.ok(
    desajustados.length > 0,
    'los dos programas coinciden en todo: si eso pasó de verdad, aplicá el documento al catálogo y borrá MODULOS_DOC',
  );
  // Y mientras no coincidan, la divergencia tiene que estar declarada.
  assert.ok(DIVERGENCIA.length > 0, 'hay módulos desajustados pero DIVERGENCIA salió vacía');
});

test('cada fila de la divergencia nombra al menos un programa', () => {
  for (const d of DIVERGENCIA) {
    assert.ok(
      d.enDocumento || d.enPlataforma,
      `el módulo ${d.numero} figura como desajustado y no tiene título en ninguno de los dos`,
    );
  }
});

// ── Lo que se le muestra a Mauricio va con su prueba ─────────────────────────

test('cada módulo dice qué hacer, incluso los que están cubiertos', () => {
  for (const c of COBERTURA) {
    assert.ok(c.tarea.trim().length > 25, `módulo ${c.modulo}: la tarea está vacía o es demasiado corta`);
  }
});

test('un módulo sin material tiene que decir qué falta', () => {
  for (const c of COBERTURA.filter(x => x.nivel === 'nada')) {
    assert.equal(c.piezas.length, 0, `módulo ${c.modulo}: dice «nada» y lista piezas`);
    assert.ok(c.falta.length > 0, `módulo ${c.modulo}: dice «nada» y no enumera qué falta`);
  }
});

test('toda pieza declara su formato medido', () => {
  for (const c of COBERTURA) {
    for (const p of c.piezas) {
      if (p.formato.tipo === 'video') {
        assert.ok(p.formato.minutos > 0, `${p.archivo}: video de ${p.formato.minutos} min`);
      } else {
        assert.ok(p.formato.palabras > 0, `${p.archivo}: documento de ${p.formato.palabras} palabras`);
      }
      assert.ok(p.aporta.trim().length > 30, `${p.archivo}: «aporta» no explica nada`);
    }
  }
});

// Una pieza puede aparecer en varios módulos, pero su formato es una propiedad
// del ARCHIVO: si difiere entre módulos, uno de los dos está inventado.
test('el mismo archivo declara el mismo formato en todos los módulos', () => {
  const visto = new Map<string, string>();
  for (const c of COBERTURA) {
    for (const p of c.piezas) {
      const huella = p.formato.tipo === 'video'
        ? `video:${p.formato.minutos}`
        : `doc:${p.formato.palabras}`;
      const previo = visto.get(p.archivo);
      if (previo) {
        assert.equal(huella, previo, `${p.archivo} declara «${huella}» y también «${previo}»`);
      } else {
        visto.set(p.archivo, huella);
      }
    }
  }
});

test('cada defecto lleva evidencia, arreglo y los archivos que toca', () => {
  for (const d of DEFECTOS) {
    assert.ok(d.archivos.length > 0, `${d.id}: no nombra ningún archivo`);
    assert.ok(d.evidencia.trim().length > 40, `${d.id}: la evidencia no prueba nada`);
    assert.ok(d.arreglo.trim().length > 25, `${d.id}: no dice qué hacer`);
  }
});

test('los ids de defectos y tareas son únicos', () => {
  const ids = [...DEFECTOS.map(d => d.id), ...TAREAS.map(t => t.id)];
  assert.equal(new Set(ids).size, ids.length, 'hay ids repetidos entre defectos y tareas');
});

test('cada tarea dice por qué es esa y cuándo está lista', () => {
  for (const t of TAREAS) {
    assert.ok(t.porque.trim().length > 40, `${t.id}: no dice por qué`);
    assert.ok(t.listoCuando.trim().length > 25, `${t.id}: no dice cuándo está lista`);
  }
});

// ── Los derivados salen de los datos, no de un número escrito a mano ─────────

test('los derivados coinciden con la cobertura', () => {
  assert.deepEqual(
    MODULOS_EN_CERO,
    COBERTURA.filter(c => c.nivel === 'nada').map(c => c.modulo),
  );
  assert.deepEqual(
    MODULOS_QUE_DESTRABA,
    COBERTURA.filter(c => c.nivel === 'parcial' || c.nivel === 'clase').map(c => c.modulo),
  );
});

test('PIEZAS_CLASE no repite un archivo que aparece en varios módulos', () => {
  const archivos = PIEZAS_CLASE.map(p => p.archivo);
  assert.equal(new Set(archivos).size, archivos.length, 'PIEZAS_CLASE trae el mismo archivo dos veces');
  for (const p of PIEZAS_CLASE) {
    assert.equal(p.esClase, true, `${p.archivo} está en PIEZAS_CLASE sin esClase`);
  }
});

test('no se cuelgan del programa más piezas de las que hay en el banco', () => {
  assert.ok(
    PIEZAS_USADAS <= INVENTARIO.archivos,
    `${PIEZAS_USADAS} piezas usadas contra ${INVENTARIO.archivos} archivos que existen`,
  );
});

test('el inventario es internamente coherente', () => {
  assert.ok(INVENTARIO.videosUnicos <= INVENTARIO.videos, 'hay más grabaciones distintas que archivos de video');
  assert.equal(INVENTARIO.videos + INVENTARIO.documentos, INVENTARIO.archivos);
});

// ── Los buscadores ───────────────────────────────────────────────────────────

test('coberturaDe y moduloDoc resuelven por número y no rompen con uno que no existe', () => {
  assert.equal(coberturaDe(7)?.modulo, 7);
  assert.equal(moduloDoc(0)?.titulo, 'Cómo se juega');
  assert.equal(coberturaDe(99), null);
  assert.equal(moduloDoc(99), null);
});

import io

def ab(p):
    c = io.open(p, encoding='utf-8', newline='').read()
    return c.replace('\r\n', '\n'), ('\r\n' if '\r\n' in c else '\n')

def ce(p, s, nl):
    io.open(p, 'w', encoding='utf-8', newline='').write(s if nl == '\n' else s.replace('\n', nl))

# ══ tests/variables-aviso.test.ts ══════════════════════════════════════════════
p = 'tests/variables-aviso.test.ts'
s, nl = ab(p)

s = s.replace("  variablesOfrecidas, PORQUE_NO_SE_PUEDE,", "  variablesOfrecidas,", 1)

ini = s.index("test('⚠️ sin lead, los datos del CRM se OFRECEN APAGADOS, nunca resolubles'")
fin = s.index("test('⚠️ y el EDITOR apaga exactamente eso, con el motivo en el renglón'")
fin2 = s.index("\n\n", s.index("assert.match(flujo", fin))
NUEVO = '''test('⚠️ sin lead, los datos del CRM NO SE MUESTRAN', () => {
  // ⚠️ ESTE TEST AFIRMÓ LO CONTRARIO DURANTE MEDIO DÍA, y el cambio es una decisión de
  // Martín con la pantalla delante: «si no está disponible porque elegí por tiempo y no
  // por acción, no lo muestres directamente, no que esté en gris, eso confunde»
  // (05/10/2026). Antes se ofrecían los 42 con 31 apagados y su motivo al lado.
  //
  // Lo que queda de la versión anterior, porque sigue siendo cierto: ofrecer un valor que
  // va a salir CRUDO al WhatsApp del cliente es prometer un dato que no existe. Lo que
  // cambió es qué se hace con el resto: antes se grisaba, ahora no se dibuja.
  const sinLead = variablesPara({ conLead: false });
  assert.deepEqual(sinLead.filter((v) => v.alcance !== 'siempre'), [],
    'sin lead ni cuota sólo se puede resolver lo de alcance `siempre`');

  const gs = variablesOfrecidas({ conLead: false });
  const filas = gs.flatMap((g) => g.items);
  assert.equal(filas.length, sinLead.length, 'el selector dibuja algo que no se puede resolver');
  assert.ok(filas.every((f) => f.alcance === 'siempre'), 'se coló un dato que este mensaje no resuelve');
  assert.deepEqual(gs.map((g) => g.titulo), ['El momento', 'Links a MaKo']);

  // Con lead entran los del lead y NO los de la cuota; con los dos, todo.
  const conLead = variablesOfrecidas({ conLead: true }).flatMap((g) => g.items);
  assert.ok(conLead.some((f) => f.alcance === 'lead'), 'con lead tiene que haber datos del CRM');
  assert.ok(!conLead.some((f) => f.alcance === 'cuota'), 'ofreció datos de una cuota en un mensaje que no la tiene');
  assert.equal(
    variablesOfrecidas({ conLead: true, conCuota: true }).flatMap((g) => g.items).length,
    VARIABLES_AVISO.length,
    'con lead y cuota se puede resolver TODO el catálogo',
  );
  // Y los grupos vacíos no se dibujan: un título sin filas promete algo que no está.
  assert.ok(gs.every((g) => g.items.length > 0), 'quedó un grupo vacío en el desplegable');
  // Agrupar lo YA filtrado da el mismo orden: dos caminos, una regla.
  assert.deepEqual(
    agruparVariables(sinLead).map((g) => g.titulo),
    variablesPorGrupo({ conLead: false }).map((g) => g.titulo),
  );
});

test('⚠️ y el EDITOR no dibuja NADA apagado en ese selector', () => {
  // Un guard de cableado: el test de arriba prueba el catálogo, no la barra. Si la barra
  // volviera a pasar `disabled`, se vería el gris que Martín mandó sacar — y si dejara de
  // pedirle los datos al catálogo, se vería de más.
  const src = leer('../app/agencia/EditorMensaje.tsx');
  const i = src.indexOf('columns={[grupos.map(');
  const bloque = src.slice(i, src.indexOf('onChange=', i));
  assert.ok(i > 0 && bloque.length < 900, `el recorte del selector mide ${bloque.length}: mira otra cosa`);
  assert.ok(!/disabled:/.test(bloque), 'el selector volvió a dibujar opciones apagadas');
  assert.match(bloque, /sub: v\\.ejemplo/, 'el renglón dejó de mostrar el valor de ejemplo');
  // Y el que lo monta pregunta por las DOS cosas que deciden qué se puede resolver.
  const flujo = leer('../app/agencia/FlujoAviso.tsx');
  const i2 = flujo.indexOf('variables={variablesOfrecidas(');
  assert.ok(i2 > 0, 'el lienzo dejó de pasarle los datos al editor');
  const llamada = flujo.slice(i2, flujo.indexOf('})}', i2));
  assert.match(llamada, /conLead:/, 'el selector dejó de preguntar por el lead');
  assert.match(llamada, /conCuota: aporta\\.includes\\('cuota'\\)/, 'los datos de cobranza no se ofrecen en ningún mensaje');
  assert.match(llamada, /aporta\\.includes\\('lead'\\)/, 'un cron que trae el lead volvería a esconder el CRM');
});'''
s = s[:ini] + NUEVO + s[fin2:]
ce(p, s, nl)
print('1 - tests de variables al dia')

# ══ tests/cobranza.test.ts ═════════════════════════════════════════════════════
p = 'tests/cobranza.test.ts'
s, nl = ab(p)
v = """  const conCuota = variablesOfrecidas({ conLead: true, conCuota: true }).flatMap((g) => g.items);
  for (const k of CLAVES_DE_CUOTA) {
    assert.equal(conCuota.find((v) => v.key === k)?.resoluble, true, `${k} no se ofrece en un mensaje de cobranza`);
  }
  // Y en un mensaje que no es de cobranza se ofrecen APAGADAS, con su motivo: el dato
  // no se consigue cambiando el disparador, así que decirlo sería un candado sin llave.
  const sinCuota = variablesOfrecidas({ conLead: true }).flatMap((g) => g.items);
  for (const k of CLAVES_DE_CUOTA) {
    assert.equal(sinCuota.find((v) => v.key === k)?.resoluble, false, `${k} dice que se puede resolver sin cuota`);
  }"""
n = """  const conCuota = variablesOfrecidas({ conLead: true, conCuota: true }).flatMap((g) => g.items);
  for (const k of CLAVES_DE_CUOTA) {
    assert.ok(conCuota.some((v) => v.key === k), `${k} no se ofrece en un mensaje de cobranza`);
  }
  // Y en un mensaje que NO es de cobranza no se dibujan — ni apagadas. Era al revés
  // hasta el 05/10/2026: «si no está disponible… no lo muestres directamente, no que
  // esté en gris, eso confunde».
  const sinCuota = variablesOfrecidas({ conLead: true }).flatMap((g) => g.items);
  for (const k of CLAVES_DE_CUOTA) {
    assert.ok(!sinCuota.some((v) => v.key === k), `${k} se ofrece en un mensaje que no habla de ninguna cuota`);
  }"""
assert v in s, 'no calzo el test de cobranza'
s = s.replace(v, n, 1)
ce(p, s, nl)
print('2 - test de cobranza al dia')

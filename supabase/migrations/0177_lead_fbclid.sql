-- =============================================================================
-- 0177 — El `fbclid` del lead: la columna que faltaba debajo de cinco lugares
-- =============================================================================
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy. El código nuevo ya escribe
-- esta columna; sin ella, PostgREST rechaza la fila ENTERA y el alta del lead falla
-- con la pantalla ya pintada. Es la regla de la cabecera de la 0170, del lado del
-- que AGREGA.
--
-- ⚠️ POR QUÉ EXISTE. El identificador de clic de Facebook se venía transportando
-- entero y no caía en ningún lado: el snippet lo captura (`lib/landing-token.ts`),
-- el tipo lo declara (`lib/atribucion-url.ts`), `conAtribucion` lo devuelve y
-- `hayAtribucion` lo cuenta para decidir si hay atribución — y la tabla `leads` no
-- tenía dónde guardarlo. Un `grep fbclid` sobre `lib/leads.ts` no lo encontraba ni
-- una vez. Cinco lugares que lo pasean y cero que lo guardan: es «escribir la
-- salida no es ofrecerla» en su forma más cara, porque el cableado completo hace
-- creer que el dato está.
--
-- Y pesa: medido el 27/09/2026, **857 de las 1.284 visitas del ws13 traen fbclid**,
-- y hay un lead cuyo ÚNICO dato de origen es ése — no tiene `utm_content`, así que
-- hoy figura sin anuncio teniendo con qué.
--
-- ⚠️ PARA QUÉ SIRVE, que es lo que justifica guardarlo y no borrar el cableado: la
-- API de Conversiones de Meta pide `fbc` para atribuir una conversión offline al
-- clic que la originó. Sin esto, marcar un lead como cualificado le avisa a Meta
-- que pasó algo bueno y no le puede decir DE QUÉ ANUNCIO — que es justo la mitad
-- que hace que la optimización sirva.
--
-- ⚠️ NO ES UN DATO INVENTADO NI DEDUCIDO: llega en la URL de aterrizaje, lo pone
-- Meta. Se guarda tal cual, sin parsear: el `adid` que parece llevar adentro es un
-- formato opaco del proveedor y decodificarlo a ojo sería inventar un id.
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS fbclid TEXT;

COMMENT ON COLUMN leads.fbclid IS
  'Identificador de clic de Facebook (parámetro fbclid de la URL de aterrizaje). Lo pone '
  'Meta y se guarda literal. Sirve para atribuir la conversión al anuncio en la API de '
  'Conversiones. Null = el lead no vino de un clic de Meta, o vino antes del 27/09/2026.';

-- Se consulta «¿qué lead tiene este clic?» al mandar la conversión, y sobre una
-- columna que la mayoría de las filas tiene en null: el índice parcial es el que
-- corresponde. Sin el WHERE, se indexarían los ~1.500 nulls para nada.
CREATE INDEX IF NOT EXISTS leads_fbclid_idx ON leads (workspace_id, fbclid)
  WHERE fbclid IS NOT NULL;

COMMIT;

#!/bin/sh
# =============================================================================
# guardas-push.sh — los chequeos del push que NO son el typecheck
# =============================================================================
# Los corren DOS lugares y por eso viven acá, versionados: el pre-push local
# (.git/hooks/pre-push, que no se versiona) y GitHub Actions
# (.github/workflows/integracion.yml). Hasta el 15/10/2026 la lista vivía sólo
# adentro del hook: una copia por máquina y otra en AGENTS.md, y Actions habría
# sido la tercera. El porqué de cada uno, en AGENTS.md → «El typecheck NO corre en
# el build». Uso: sh scripts/guardas-push.sh <remoto>   (el remoto, para hooks-en-orden)
# =============================================================================

# Primero las bitácoras de /admin/dev: es lo que más se rompe (un hito sin `puntos`,
# TS2741) y un tsc ACOTADO a ellas tarda ~4 s y ~300 MB. El 15/10/2026 ese error tiró
# un run entero de Actions. Un árbol viejo sin el script sigue: lo chequea Actions.
if [ -f scripts/tsc-bitacoras.mjs ]; then
  echo "[pre-push] Chequeando los tipos de las bitácoras de /admin/dev..."
  if ! node scripts/tsc-bitacoras.mjs; then
    echo ""
    echo "  X PUSH BLOQUEADO: una bitácora de /admin/dev no compila (el error está arriba)."
    echo "  Casi siempre es un hito sin \`puntos\` o con un campo mal escrito."
    echo ""
    exit 1
  fi
fi

# Un test que fija una ruta de Windows (C:\…) da verde en la notebook y rojo en Linux,
# donde es RELATIVA (16/10/2026: tiró el run 38845971505). ~1 s, sin tsx.
if [ -f scripts/rutas-windows-en-tests.mjs ]; then
  echo "[pre-push] Chequeando que ningún test fije una ruta de Windows..."
  if ! node scripts/rutas-windows-en-tests.mjs; then
    echo "  X PUSH BLOQUEADO: un test fija una ruta de Windows (arriba, cuál y cómo arreglarlo)."
    echo ""
    exit 1
  fi
fi

echo "[pre-push] Chequeando que las skills tengan el contrato al día…"
if ! node scripts/sync-contrato-detalle.mjs --check; then
  echo ""
  echo "  ✖ PUSH BLOQUEADO: una skill quedó desincronizada del contrato."
  echo ""
  echo "  Corré esto y volvé a pushear:"
  echo "      node scripts/sync-contrato-detalle.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que el manual de marca tenga la gramatica al dia..."
if ! node --import tsx scripts/sync-gramatica-doc.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: docs/branding-mako.md quedo viejo respecto de lib/mako-gramatica.ts."
  echo ""
  echo "  Corre esto y volve a pushear:"
  echo "      node --import tsx scripts/sync-gramatica-doc.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que el plugin publico este al dia..."
if ! node --import tsx scripts/generar-plugin.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: plugin/ quedo viejo respecto de lib/agente-skill.ts."
  echo ""
  echo "  Corre esto y volve a pushear:"
  echo "      node --import tsx scripts/generar-plugin.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que el zip de la extension este al dia..."
if ! node scripts/zip-extension.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: public/mako-puente.zip quedo viejo respecto de extension/."
  echo ""
  echo "  Corre esto y volve a pushear:"
  echo "      node scripts/zip-extension.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que los artefactos del replay esten al dia..."
if ! node scripts/replay-libs.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: public/replay/ quedo viejo respecto de node_modules."
  echo "  Ese archivo lo baja el navegador de un VISITANTE de la landing de un cliente:"
  echo "  si queda viejo, el que graba es el de public/ y nada lo avisa."
  echo ""
  echo "  Corre esto y volve a pushear:"
  echo "      node scripts/replay-libs.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que el catalogo no importe fichas sin commitear..."
if ! node scripts/curso-catalogo-verificar.mjs; then
  echo ""
  echo "  X PUSH BLOQUEADO: catalogo.ts importa archivos que no estan en git."
  echo "  El build de Vercel muere con Module not found y el push sale con 0."
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que el catalogo de operaciones del puente este al dia..."
if ! node --import tsx scripts/sync-operaciones.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: extension/operaciones.js quedo viejo."
  echo "  Los tokens son el ancla que decide si una generacion PAGADA se reconoce:"
  echo "  desincronizados, al cliente se le cobra un clip y el puente dice que no aprendio."
  echo ""
  echo "  Corre: node scripts/sync-operaciones.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que el parcheador de BOQ este al dia..."
if ! node --import tsx scripts/sync-boq-patch.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: extension/boq-patch.js quedo viejo."
  echo "  Decide el cuerpo de un pedido que GASTA CREDITOS del cliente: la version"
  echo "  que corre tiene que ser la que se probo."
  echo ""
  echo "  Corre: node --import tsx scripts/sync-boq-patch.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que el lector de respuestas de BOQ este al dia..."
if ! node --import tsx scripts/sync-boq-respuesta.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: extension/boq-respuesta.js quedo viejo."
  echo "  Decide si se AFIRMA un exito. Con la version vieja el popup ya dijo"
  echo "  Listo, lo veras en tu Flow sobre un pedido que no creo nada."
  echo ""
  echo "  Corre: node --import tsx scripts/sync-boq-respuesta.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que el juicio de puede-filmar este al dia..."
if ! node --import tsx scripts/sync-puede-filmar.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: extension/puede-filmar.js quedo viejo."
  echo "  De ese juicio cuelgan CUATRO compuertas: el boton de crear, la cola de la"
  echo "  extension, el reparto del server y el guard de filmar. Dos versiones es"
  echo "  media app diciendo que si y media que no."
  echo ""
  echo "  Corre: node --import tsx scripts/sync-puede-filmar.mjs"
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que ningun hook de React quede detras de un return..."
if ! sh scripts/hooks-en-orden.sh "$1"; then
  echo ""
  echo "  X PUSH BLOQUEADO: un hook de React se llama condicionalmente."
  echo "  Eso es el Minified React error #300: la PANTALLA ENTERA en blanco."
  echo ""
  echo "  Mové el hook arriba de todos los return del componente."
  echo ""
  exit 1
fi

echo "[pre-push] Chequeando que la referencia de la API de MaKo este al dia..."
if ! node --import tsx scripts/generar-api-doc.mjs --check; then
  echo ""
  echo "  X PUSH BLOQUEADO: docs/api-mako.md o tests/api-mako-http.snapshot.txt quedaron"
  echo "  viejos respecto de lib/api-mako/areas/*.def.ts. La referencia que leen los"
  echo "  clientes y la lista de lo que sale por HTTP no pueden decir otra cosa que el codigo."
  echo ""
  echo "  Corre: node --import tsx scripts/generar-api-doc.mjs  (y commitea los dos archivos)"
  echo ""
  exit 1
fi

exit 0

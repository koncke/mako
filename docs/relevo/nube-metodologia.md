# Cómo se sube, para todas las cuentas: la punta, sus tiempos medidos y lo que falta medir

> Escrito por la sesión de la nube que lo construyó (cuenta `nube`, sesión `cli_fe9e34df-f0e0-505d-89ab-5b8ddc011a0b`),
> el 4/11/2026. Pedido de Martín: «De la investigación de buenas practicas para que todo sea mas eficiente, aplicalo, y que
> todas las cuentas sigan esa metodologia...». La regla corta está en AGENTS.md → «Cómo se sube lo terminado»; acá van los
> comandos, los números y lo que quedó sin medir.

## 1. Lo que hay que hacer UNA vez en cada clon de la PC (y en cada cuenta que tenga su propio clon)

El hook de pre-push **no se versiona**: un clon nuevo, o uno que tiene el hook viejo, sube sin el filtro y sin el rechazo a
`integracion`. Los worktrees comparten el hook del clon (`git rev-parse --git-common-dir`), así que se instala una vez por
CLON, no por worktree. En Git Bash, desde la carpeta del clon:

```bash
cp scripts/claude-hooks/pre-push "$(git rev-parse --git-common-dir)/hooks/pre-push"
```

```bash
chmod +x "$(git rev-parse --git-common-dir)/hooks/pre-push"
```

Para que las bitácoras de /admin/dev se unan solas también al mezclar main en la PC (en GitHub ya lo hace `punta.yml`):

```bash
git config merge.bitacora.driver "node scripts/unir-bitacora.mjs %O %A %B %P"
```

Para comprobar que el hook instalado es el del repo (sin salida = al día):

```bash
diff -q scripts/claude-hooks/pre-push "$(git rev-parse --git-common-dir)/hooks/pre-push"
```

⚠️ Hasta que el clon tenga main al día, `scripts/filtro-punta.mjs` y `scripts/unir-bitacora.mjs` no existen en su árbol: el
hook se saltea el filtro en silencio (lo mira con `[ -f … ]`) y el driver no corre. `git pull` primero.

## 2. Qué tarda cada paso (medido el 4/11/2026)

| Paso | Cuánto | De dónde sale |
|---|---|---|
| Guardas del pre-push (`scripts/guardas-push.sh`) | 6 s | la nube, 4 CPU, 15 GB |
| Filtro chico (`scripts/filtro-punta.mjs`) | 4-7 s con pocos tests; corta a los 90 s | cinco commits reales de otros chats (4-6 s), la punta de las bitácoras (7 s) |
| `punta.yml`, punta verde | mediana 14,4 min, de 6,8 a 21,8 | las 30 verdes entre las 07:49 y las 08:30 UTC |
| `punta.yml`, sólo docs | 1,4-1,5 min | tres puntas de relevo ese mismo rato |
| `punta.yml`, choque de mezcla | 0,7-3,5 min, sin pagar la instalación | tres de los siete rojos |
| tsc entero en la punta | 148-504 s | 148 s en una punta liviana; 504 s con 6.238 MB vivos de 12.288 (run de sobre-main) |
| Barredoras compartidas (`--barredoras --compartir`) | 107 s, 2.198 tests de 230 archivos | la nube |
| Suite completa de la noche / tsc sin tandas | ~25 min / ~5 min | corridas anteriores de `semanal-tests.yml` y `tipos-respaldo.yml` |
| Costo de las 40 corridas de esa media hora | 514 min ≈ US$3,09 | a US$0,006 el minuto |

Para comparar: las 23 corridas rojas de `integracion` (#360 a #398) tardaron de 3 a 38 minutos cada una, y cada rojo
frenaba a todas las puntas del tren.

**Lo que el filtro dio en la práctica, el mismo día:**
- Frenó un rojo de verdad antes de subir: `tests/punta-ci.test.ts` en la punta de las bitácoras, en 7 s. Sin el filtro era una
  corrida roja de ~14 min.
- Con un cambio a AGENTS.md no llega: 46 tests leen AGENTS.md, el cambio arrastra 52 tests y en 90 s no entra ninguno. Avisa
  «FILTRO A MEDIAS» y deja subir, y lo chequea GitHub.
- Los tipos casi nunca entran: un archivo de app/ o lib/ arrastra ~1.400 archivos de imports (131 s y 3,2 GB). Con más de
  400, el filtro los saltea con aviso.

## 3. Lo que se construyó, punta por punta

| # | Punta | Qué | Estado al escribir esto |
|---|---|---|---|
| 1 | `punta/sin-nombra-20` | sin la regla «nombra 20+»; el tiempo por archivo de test en el resumen | en main |
| 2 | `punta/filtro-punta` | el filtro chico del pre-push | en main |
| 3+4 | `punta/despues-del-deploy` | deploy fallido = corrida roja; prueba de humo de 9 GET; vigía cada 8 h | en main |
| 5 | `punta/sobre-main` | la mezcla sin probar se chequea sola; `ci-rojo/main` y `espera-main/<punta>` se relanzan | en main a la cuarta (4085a32d8), después de tres rojos: el `maxBuffer` de un hijo, un choque en el índice y un workflow que el token de Actions no podía subir (ver abajo) |
| 6 | `punta/redes-de-noche` | suite completa y tsc sin tandas cada noche si entró algo; 36 h sin veredicto = rojo | en main |
| 7a | `punta/sin-integracion` | el hook rechaza `integracion`, `integracion-retirada.yml`, AGENTS.md sin el tren; el selector ve el hook | en main |
| 7b+8 | `punta/metodologia` | borra `integracion.yml`; esta regla arriba en AGENTS.md; este relevo | en main |
| 9 | `punta/bitacoras-sin-choque` | el driver de las bitácoras y las reglas `merge=` de main para puntas viejas | en main |

La 9 la pidió el Cerebro (`session_01LWmw2eawQJnmE1ZcC7K4Xn`) durante la tanda. No se le pudo contestar: esta sesión de la
nube no tiene permiso para escribirle a una sesión de la PC (HTTP 401 / «elevated_session_untrusted_device»). Lo que le
interesa: la 9 ya está en main, así que una punta que quedó roja por un choque de bitácora se arregla relanzándola.

**El tercer rojo de la 5 dejó una regla para todos.** Tests y tipos en verde, y los cinco intentos de llevar a main
rebotaron: GitHub no deja que el token de Actions suba una versión NUEVA de un workflow, y eso arma la mezcla de la corrida
cuando la punta y main cambiaron el mismo archivo de `.github/workflows/`. Desde ahí, `scripts/ci-workflow-nuevo.sh` lo
frena a los ~20 s y dice qué hacer: mezclar `origin/main` en la máquina y volver a subir. A las puntas que no tocan
workflows no les pasa.

**Y para las sesiones de la nube:** el hook de cierre de la sesión pide que los commits salgan con
`noreply@anthropic.com` (si no, GitHub los muestra «Unverified»). Una sesión de la nube corre una vez
`git config user.email noreply@anthropic.com` y `git config user.name Claude` antes de commitear.

## 4. Lo que quedó sin medir

- **Los eventos de Vercel:** si `repository_dispatch` (`vercel.deployment.*`) llega a `despues-del-deploy.yml` y si
  `github.silent` lo corta. El vigía da rojo si en 48 h hubo commits en main y no llegó ninguno: es la respuesta.
- **El firewall de Vercel con el runner de GitHub:** la prueba de humo puede dar rojo por un 403 de Vercel y no por una caída.
  Si pasa, se ve en el primer run.
- **El filtro en la PC con 8 chats:** el tope de 90 s se midió en la nube (4 CPU, 15 GB libres); en la notebook compartida
  va a entrar menos. No espera RAM: si no hay, avisa y deja subir.
- ✔ **`sobre-main.yml` en el runner, medido:** la primera (run 41805916695, 4/11 09:15 UTC) la lanzó `punta.yml` solo,
  porque main se movió durante los tests de `punta/sobre-main`, y dio verde en 12,9 min (instalar, tipos enteros y las
  barredoras compartidas).
- **El driver de las bitácoras en un choque real de CI:** se probó con git de verdad en los tests y sobre 24 pares reales de
  hitos de la historia de main (24 de 24 bien), no todavía en una corrida.

## 5. Para Martín (no lo decide esta sesión)

- Las ramas `claude/*` de las sesiones de la nube pueden estar disparando previews de Vercel (`vercel.json` sólo apaga
  `integracion`, `punta/**`, `ci-rojo/**` y `espera-main/**`). No se tocó: es plata y es tuyo decidirlo.

## 6. Que la nube haga los tests: el veredicto (4/11/2026, tarde)

Martín, por el Cerebro: «Por que actions subió tanto?... Y estamos con 1 sola cuenta, imagina que tengo 5 cuentas... No debe
subir tanto el precio ese... No hay otra manera de resolverlo? Que los chats en la nube hagan los testeos o algo así...».

**Cómo se usa, en una sesión de la nube, con todo commiteado:**

```bash
export PATH="$(sh scripts/node24.sh):$PATH"
```

```bash
node scripts/veredicto.mjs sacar
```

```bash
git push origin HEAD:punta/<nombre>
```

`sacar` corre los tests afectados y el tsc entero con Node 24 (el de Actions) y deja un renglón `Veredicto:` en el último commit,
o en un commit vacío si ése ya estaba subido. **Se sube tal cual:** un commit más encima, aunque sea un relevo, y GitHub corre todo.
En la PC no se saca: la RAM es de los chats, y GitHub chequea esas puntas como siempre.

**Qué hace GitHub con él** (`punta.yml`, paso «Lo que ya se probó»): lo ata al árbol, a la base y a la selección. Recalcula qué
tests le tocaban a la punta y exige el mismo hash. Después mezcla main y repite SÓLO:
- lo que mira algo que cambió entre lo probado y lo mezclado (las barredoras, siempre que cambió algo);
- lo que el veredicto no tenía en verde;
- una muestra: los tests que la punta toca más 4.

No corre el tsc, y la punta llega a main «sin probar»: `sobre-main.yml` corre el tsc entero y las barredoras sobre main. Sin
veredicto que valga, corre todo como siempre, y el resumen de la corrida dice por qué. Actions además guarda su propio veredicto en
la caché de la rama: al arreglar un rojo, la próxima subida no repite lo que ya pasó.

**Qué tiene en cuenta y qué no:** frena el veredicto de otro árbol, el editado a mano, el de otra selección, el de Node 22 y el de una
base que no es de main (cada caso tiene su test en `tests/veredicto.test.ts`). NO frena a quien arma uno a propósito sin correr
nada: el algoritmo es público. Para eso hace falta una clave que tengan sólo las sesiones y GitHub: el secreto `MAKO_VEREDICTO_CLAVE`
en el repo y la misma variable en el entorno de la nube. Con la clave en GitHub, uno sin firma no pasa. Cargarla es de Martín.

**Los números** (4/11/2026; 87 puntas de código que dieron verde ese día, repetidas como si la nube hubiera sacado su veredicto
12 min antes de subir):

| | Sin veredicto | Con veredicto |
|---|---|---|
| Una punta de código de la nube | mediana 16,1 min | mediana 6,8 min (media 5,8) |
| Lo que se repite en GitHub | 690 archivos de test (una punta típica) | 251 (mediana): lo que mira a la vez algo de la punta y algo de main |
| El tsc entero en la punta | 4,5 min | no corre: lo mira sobre-main en main |
| Una punta de la PC | ~14 min | igual: en la PC no se saca veredicto |
| Una de sólo documentación | 1,4 min, sin ningún test | ~3,5 min: corren los tests que la leen |

Lo que no baja más es el registro de la API. `lib/api-mako/registro.ts` importa todas las áreas, y la punta y main casi siempre
tocan algo que llega ahí. Entonces los ~400 tests que lo importan corren otra vez.

**Por mes** (a US$0,006 el minuto de Linux 2 núcleos, sin contar los minutos que incluya el plan de GitHub; con el ritmo del 4/11,
que es el de una cuenta; el 65 % de las puntas las sube la nube; sobre-main no crece con las cuentas porque corre una y espera una):

| | Hoy | Con el veredicto |
|---|---|---|
| 1 cuenta | ~74.000 min ≈ US$444 | ~47.000 min ≈ US$283 |
| 5 cuentas | ~367.000 min ≈ US$2.200 | ~232.000 min ≈ US$1.394 |

Además, la nube ve sus propios rojos antes de subir. Ese día fueron 16 rojos de más de 4 min, 262 min, que con el veredicto no
llegan a GitHub. Eso no está restado arriba: son hasta ~US$15 por mes y por cuenta.

**Si sigue siendo mucho, las dos palancas que quedan** (no aplicadas; las decide Martín o el Cerebro):
1. **Que una punta con veredicto no repita lo que cruza con main**, y dejarle eso a sobre-main (barredoras y tsc) y a la suite de la
   noche. Una punta de la nube bajaría a ~1,5 min, y el mes a ~US$210 con 1 cuenta y ~US$1.040 con 5. El costo: una mezcla que rompe
   un test que no es barredora se ve recién a la noche, y mientras tanto da rojo en la punta de otro chat.
2. **Un runner propio** (no contratado). Hoy, 159 corridas en ~6 h son ~6 corridas a la vez en las horas pico, así que hacen falta
   varias máquinas, no una. El tsc entero pide ~7 GB, así que cada una necesita 16 GB. Precios que se pudieron ver hoy, de un buscador
   y no de la página oficial (docs.github.com y www.hetzner.com están fuera de la red de la nube):
   - Hetzner CX33 (4 vCPU, 8 GB) ~€8,5 al mes, CAX21 (Arm, 4 vCPU, 8 GB) ~€10,5. Los de 16 GB no se pudieron ver.
   - GitHub anunció US$0,002 por minuto para los runners propios desde marzo de 2026. Según esas fuentes, lo postergó sin fecha.
   - Con 5 cuentas y el veredicto, serían ~6-8 máquinas de 16 GB, más ese cargo si llega (~US$460 al mes con 232.000 min).
   Conviene recién con varias cuentas, y le suma a Martín una máquina que mantener. Antes de decidir: medir una semana con el
   veredicto puesto.


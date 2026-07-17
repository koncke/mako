# Migración del cifrado de credenciales (v1 → v2)

Runbook para separar el secreto de cifrado del de sesiones y atar cada
criptograma a su fila. **Se hace sin downtime**, pero el ORDEN no es opcional.

## Por qué

Hasta ahora las credenciales BYOK se cifraban así:

```
clave = sha256( CREDENCIALES_SECRET || AUTH_COOKIE_VALUE || SUPABASE_SERVICE_ROLE_KEY )
```

Tres problemas:

1. **`CREDENCIALES_SECRET` nunca estuvo seteado**, así que la cascada caía en
   `AUTH_COOKIE_VALUE`. Y eso es peor que "el mismo secreto para dos cosas":
   `AUTH_COOKIE_VALUE` **no es un secreto de servidor**. El login compartido
   compara la cookie contra ese valor *tal cual* (`lib/auth.ts`), así que está en
   el browser de cualquiera que haya entrado con la contraseña maestra. **Todo lo
   cifrado en v1 está protegido por un secreto repartido.** Con un dump de la
   base, quien tenga esa cookie lee las 30 credenciales.
   Y si algún día faltara también `AUTH_COOKIE_VALUE`, la cascada caía a la llave
   de Supabase: ahí la base sola alcanzaría, o sea que el cifrado no protegería
   de nada.
2. **Sin AAD**: el criptograma no estaba atado a `(workspace_id, clave)`. Era
   portable: se podía copiar la fila de un cliente a la de otro y abría igual.
3. **Una sola clave para toda la plataforma**: reventarla daba las de todos.

Y una trampa: **setear `CREDENCIALES_SECRET` sin este plan rompe producción en
silencio.** La cascada cambia de rama, `descifrar()` empieza a devolver `null`,
las 30 filas aparecen como "ilegible" y nadie se entera hasta que un cliente lo
ve en pantalla. El backfill del boot tampoco lo repara: saltea las filas que ya
existen, aunque estén ilegibles.

## Los dos formatos

```
gcm1.<iv>.<tag>.<ct>          viejo — sha256(secreto), sin sal, sin AAD
gcm2.<salt>.<iv>.<tag>.<ct>   nuevo — HKDF-SHA256 por (workspace, clave), AAD = "ws:clave"
```

El criptograma dice su versión, así que se pueden **leer los dos y escribir uno
solo**. Ese lector dual (`lib/cripto-credenciales.ts`) es todo el truco.

## Pasos

### 0 — Antes de tocar nada

```bash
# Secreto nuevo, alta entropía. NO reusar AUTH_COOKIE_VALUE: ese es el problema.
openssl rand -base64 32

# Red de seguridad (son ~30 filas, no cuesta nada)
# create table credenciales_backup_YYYYMMDD as select * from credenciales;
```

Aplicar la migración de auditoría:

```bash
node scripts/apply-migration.mjs supabase/migrations/0091_credenciales_auditoria.sql
```

### 1 — Lector dual en producción (ya está en el código)

Solo hay que deployar. En este punto se lee v1 y v2, y **se sigue escribiendo v1**.

Ya se puede poner `CREDENCIALES_SECRET` en Vercel: todavía no se escribe con él.

> Este deploy tiene que estar arriba **ANTES** de setear el secreto. Con el código
> viejo, setearlo rompe todo en silencio (ver arriba).

Verificar (lee, no escribe):

```bash
node --experimental-strip-types scripts/recifrar-credenciales.mjs
# esperado: "Por formato: {gcm1: 30}" y "Se abren bien: 30/30"
```

### 2 — Empezar a escribir v2

En Vercel: `CREDENCIALES_V2=1`. **Redeploy.**

Desde acá cada credencial que se guarda nace v2; las viejas se siguen leyendo por
la rama v1.

> **Rollback**: sacar `CREDENCIALES_V2` (dejando el secreto). Lo escrito en v2 se
> sigue leyendo, porque el lector dual nunca se fue. Por eso el flag va SEPARADO
> del secreto: si fueran lo mismo, "revertir" volvería ilegible todo lo guardado
> en el medio.

### 3 — Backfill

```bash
node --experimental-strip-types scripts/recifrar-credenciales.mjs            # seco
node --experimental-strip-types scripts/recifrar-credenciales.mjs --aplicar  # escribe
```

Idempotente. Usa compare-and-swap contra el criptograma leído, así que no
necesita locks ni ventana: si alguien guarda esa credencial desde la app mientras
corre, el update no aplica y esa fila ya nació v2 igual.

Si alguna fila no abre, **no migra nada**: una fila ilegible ya estaba rota antes,
y pisarla taparía la evidencia. Hay que re-pegar esa credencial a mano primero.

> **`credenciales` NO es la única tabla.** El refresh_token de Google Calendar
> vive en `app_settings` y se cifra con la misma función. El script cubre las dos
> (`SECRETOS_EN_SETTINGS`); si algún día se cifra un secreto nuevo fuera de
> `credenciales`, hay que agregarlo ahí. Olvidarse tiene una falla fea: el token
> de GCal moriría en el paso 4 **sin ninguna señal** — no hay estado "ilegible"
> en `app_settings`, y el tile seguiría diciendo "conectada".

Verificar hasta que las dos den cero:

```sql
select split_part(valor_enc,'.',1) as v, count(*) from credenciales group by 1;
select split_part(value,'.',1) as v, count(*) from app_settings
 where key = 'google.calendar.refresh_token' and coalesce(value,'') <> '' group by 1;
```

### 4 — Cerrar el downgrade: `CREDENCIALES_V1_OFF=1`

Cuando el backfill dé cero en las dos tablas. **Este paso no es opcional ni
cosmético**: mientras el lector acepte `gcm1`, el AAD de v2 no garantiza nada.
El formato lo elige el criptograma, así que a una fila ya migrada se le puede
plantar un blob `gcm1` forjado (sin AAD, sin clave por workspace) y el lector lo
toma — y la clave v1 la tiene cualquiera que haya usado el login compartido.

O sea: **la promesa "un criptograma no se puede mover de fila" recién es cierta
con este flag prendido.** Hasta entonces v1 es una rampa de salida, no un formato.

Rollback: apagar el flag.

### 5 — Rotar `AUTH_COOKIE_VALUE` y borrar la rama v1

Con `CREDENCIALES_V1_OFF=1` estable y un tiempo prudencial (un restore de backup
puede reinyectar una fila vieja): rotar `AUTH_COOKIE_VALUE` —que hoy es un
secreto repartido— y borrar la rama v1 de `lib/cripto-credenciales.ts`.

Ese es el objetivo de todo el ejercicio: hoy no se puede rotar el secreto de
sesiones sin romper las credenciales.

## Qué NO arregla esto

El zero-knowledge no es alcanzable y no hay que prometerlo. Los crons y los
webhooks descifran sin ninguna sesión presente (`lib/cron-workspaces.ts`,
`lib/webhook-routing.ts`): el webhook de Meta de las 3am no puede esperar a que el
cliente abra el dashboard. O el server puede descifrar solo, o no hay producto.
Ni un KMS lo cambia: el server necesita permiso de `Decrypt` igual.

Lo que esto **sí** logra (todo esto recién vale con el paso 4 hecho, no antes):

- Un dump de la base + la cookie del login compartido deja de alcanzar. Hoy
  alcanza.
- El secreto de las credenciales deja de ser un valor que viaja a los browsers.
- Un criptograma robado no se puede mover a otra fila ni a otro workspace.
- Reventar la clave derivada de un workspace no da las de los demás.
- Queda registrado en la base quién miró qué llave — incluidos los intentos
  rechazados — y lo puede auditar el dueño del espacio, no solo quien tiene la
  consola de Vercel.

# Las etiquetas `rescate/*`, rearmadas desde la nube (4/11/2026)

Martín: «haz todo el resto, como los commits sin subir». Once etiquetas `rescate/<rama>` guardaban trabajo que sólo vivía en
la PC. Cada una se rearmó sobre `origin/main` con cherry-pick de sus commits (nunca de un tren viejo) y se subió a su propia
`punta/<rama>`, que `punta.yml` chequea y lleva a main si da verde. Sesión `cli_109047b0-8d03-5975-8d5a-3718ed2b31fe`, cuenta
`nube`. La cosecha de lo que engañó al rearmar: docs/hallazgos-infra.md → «Rearmar etiquetas `rescate/*` desde la nube».

**Una línea por etiqueta.** «En main» = el commit ya es ancestro de `origin/main` (llegó por su punta en verde); que esté
desplegado lo dice Vercel, que no se ve desde la nube.

| Etiqueta | Estado | Detalle |
|---|---|---|
| `crm-bajas-3010` | **Descartada** | Traía un pendiente («21 fallos y 10 borradores de Código Inmobiliario, sin investigar») que main ya cerró el 2/11 en `dbc64bdd` (docs/relevo/crm.md: «Código Inmobiliario, cerrado»). Subirlo reabría un pendiente resuelto. |
| `tickets-leila-0311` | **En main** (`2473763e6`) | El código de los tickets #46-48 ya estaba en main (`d6501deac`, `71bbc41e0`). Sólo traía su relevo, que decía «sin pushear» y «falta el tsc»: se subió corregido (el tsc entero lo corre cada punta desde el 4/11). |
| `pricing-bloqueantes-3010` | **En main** (`7ce7bdd8c`) | Sólo texto de /admin/dev/pricing. Las líneas que cita se verificaron contra main (`recordUsage` en 7 lugares de ai-cheap, `wsDeProveedor` :32, `insertUsage` :161). |
| `aut-2510` | **En main** (`e156bcea7`) | Main ya tenía dos de sus tres «sin hacer» (`indiceDeLaFila`, `metadata_zernio`). Quedó lo nuevo: **las 8 inscripciones de @leantejado ya se repararon el 30/10 17:19**; main decía que no. No se vuelve a reparar. |
| `spy-rehecho-3110` | **En main** (`cbb7e1d95`) | Sólo el hallazgo «se mata por PID propio» (docs/hallazgos-infra.md). No toca Competitors Spy, que se rehace en otro chat. |
| `landing-high-ticket-2910` | **En main** (`bed0cbedb`) | El script de la landing principal (`scripts/landing-principal-high-ticket.mts`): las 9 tarjetas en el orden de la demo a Thiago y la última impar a todo el ancho. Es el script: el documento #32 lo publica el Cerebro con `--aplicar --version 14`, que no se corrió (escribe en producción). |
| `diseno-web-3110` | **En main** (`1631e7bcd`) | Web Generator con los valores de Tilvo y la landing con los de Fitlo. 3.778 tests en verde en la nube. `scripts/landing-valores-tilvo.mjs` NO se aplicó: aplicarlo es publicar la portada, lo decide Martín. |
| `desktop-offline-t2-2810` | **En main** (`f59d7ac35`) | MaKo sin conexión, T1 y T2 (6 commits). 4.212 tests en verde en la nube. **Migración 0346 sin aplicar**: necesita el sí de Martín (docs/relevo/cerebro.md). Sin la tabla, el código no sube nada y contesta «reintentar»: no rompe. |
| `newsletter-2910` | **En main** (`27612fca9`) | El Newsletter (3 commits) más dos arreglos para las reglas que main sumó después: su ruta REST y, en `27612fca9`, su caja declarada, la app de escritorio, español neutro y la guarda de la baja (la de un email no es la de una cuota). **Migración 0351:** el commit dice «sin aplicar» y docs/relevo/cerebro.md dice «aplicada»; desde la nube no se puede medir. Sin ella la baja sigue andando y sólo falla la tab, que es del super admin. El consentimiento de los suscriptos espera a Martín. |
| `motion-imagen-2610` | **Anotada, no subida** | Motion lo suspendió Martín el 26/10 («Suspende y deja para después lo de Motion, el editor e imágenes») y no está en main ni en uso. Lo del Video Editor de Leila que venía en la rama ya está en main (`b7495299e`, `0e27cb66f`, `d5baaa302`). Lo que sigue en la etiqueta: `lib/motion` (201 archivos), el chat fijo del Image Editor y las imágenes con IA a medias. Para retomarla: docs/relevo/video-editor-leila.md → «Motion». |
| `replica-editable-2810` | **En main** (`33d6a73f1`) | Los 24 commits entraron sin choques, más `f5c74329c`: «Contenido» lista íconos y videos, el color del texto gana al degradado (`-webkit-text-fill-color`) y se avisa cuando una capa tapa la imagen de fondo. Y `33d6a73f1`: la descripción de `editar_landing_con_ia` volvió a la de main (sus tres ejemplos nuevos le sacaban el lugar a otras operaciones en el chat: 6 rojos) y tres tests que copiaban una línea pasaron a fijar lo que cuidan. **Sin la base no se pudo ver:** los dos ❌ en las copias #68 y #69, las capturas 1440/390 y el chat de punta a punta en #70–#72. El detalle: docs/hallazgos-editor-landing.md → «La réplica editable». |

## Lo que espera a otro (no lo hace la nube)

- **Migraciones:** 0346 (MaKo sin conexión) con el sí de Martín; medir si la 0351 (Newsletter) está aplicada
  (`scripts/verificar-migraciones-aplicadas.mjs`, con permiso).
- **Publicar:** la portada con los valores de Fitlo (`scripts/landing-valores-tilvo.mjs`) y el documento #32 con la última
  tarjeta a todo el ancho (`scripts/landing-principal-high-ticket.mts --aplicar --version 14`).
- **La réplica editable, en una sesión con la base:** abrir #68 y #69 en el editor y ver si los dos ❌ se fueron; mirar las
  capturas; correr el chat en #70–#72; mandar las copias #68–#72 a la papelera al cerrar.
- **El autor de las puntas de la nube:** la nube viene con `noreply@anthropic.com`, y Vercel bloquea esos deploys
  (build-deploy, 17/08). Estas puntas se firmaron con el correo del equipo. La mezcla de `punta/spy-busqueda` (otra sesión) entró
  a main con `noreply` (`9202c22d2`). Falta que `punta.yml` frene ese correo, como frena `[bot]`: lo decide Integración.

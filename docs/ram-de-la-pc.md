# La RAM de la notebook: qué conviene hacer

*25/10/2026. Medí la PC el 24/10/2026 de 23:59 a 00:06 del 25/10, hora de Argentina. Los precios y la documentación son del 23 al 25/10/2026. Los euros los pasé a dólares a 1,12 (cambio del Banco Central Europeo del 23/10/2026).*

---

## 1. La respuesta corta

- **Primero, lo gratis:** poner freno a los tests y que corra un solo trabajo pesado por vez. El vigía mató 81 corridas el 24/10 y 70 el 23/10, porque la guardia las deja arrancar sin la RAM que necesitan.
- **Lo que más rinde por la plata:** pasar la notebook a 32 GB. Es un pago único de unos **USD 280-300**, en pesos y en el país: 2 módulos de 16 GB. Los zócalos no están soldados.
- **Lo que imaginabas existe y ya lo pagás:** los chats de Claude Code en la nube de Anthropic. Cada uno corre en una máquina de 16 GB y no tiene costo aparte, pero gasta la misma cuota de tu plan. Sirve para los chats de código que no tocan producción ni tu Chrome. En la cuenta que medí todavía no está habilitado.
- **Para que subir a main no dependa de la RAM:** que el chequeo de tipos antes de main corra afuera. Puede ser una tarea programada en la nube de Anthropic (sin costo extra, pero está en prueba) o una máquina alquilada para GitHub (unos USD 5-25 por mes). El orden de los pasos está en la sección 4.
- **No por ahora:** alquilar un servidor para TODOS los chats. Habría que llevar ahí las claves de producción y rehacer la memoria, las reglas y el Runner.

---

## 2. Qué come la RAM hoy

Lo medí en la notebook (MSI Thin 15 B13VF, 15,7 GB utilizables) el **24/10/2026 entre las 23:59 y las 00:06**. Había 8 chats abiertos, Chrome estaba cerrado y la PC llevaba 19,7 horas prendida.

### Lo fijo: unos 10 GB sin nada pesado corriendo

| Qué | RAM en uso |
|---|---|
| Reserva interna de Windows y sus controladores | 3,6 a 4,3 GB. Una parte puede estar en el disco, pero igual es alta para 16 GB |
| Los 8 chats de Claude Code | 2,0 GB (253 MB cada uno en promedio, de 115 a 366) |
| App de escritorio de Claude | 1,2 a 1,3 GB |
| Apps de fondo (Copilot, Fathom, NVIDIA, MEGA, Intel, MSI, Enlace Móvil) | ~0,73 GB |
| Defender (antivirus) | ~0,47 GB |
| Servicios de Windows | ~0,47 GB |
| Chrome | 0 (estaba cerrado) |

Quedan **unos 5,6 GB libres**, y eso es lo que se come el trabajo pesado. Si a cada chat le sumás la parte que le toca de la app de escritorio, cada uno cuesta unos 410 MB.

Ojo, que la foto cambia de un día a otro. El 22/10, con 8 chats, quedaban sólo 1,6 GB libres: Chrome usaba 1,3 GB y había unos 20 procesos auxiliares de node con 3,7 GB. Ese dato es de otra investigación de esta misma corrida y no lo volví a medir.

### Los picos (lo que se come esos 5,6 GB)

- **Chequeo de tipos del repo entero:** pide entre 5 y 6,3 GB libres. Es la revisión que hace TypeScript de todo el código antes de subir. Crece cerca de 1 GB por semana; el 21/10 usaba 5.065 MB. **Con 5,6 GB libres en el mejor caso, hoy no entra de una sola vez.**
- **Chequeo de tipos «acotado»** (sólo lo que tocó un chat): 2 a 2,5 GB cada uno.
- **Tests sin freno:** si no se les pone un límite, arrancan 11 procesos a la vez en esta PC. Medí 15 procesos de node con 2,1 GB.
- **Lo que pasó en un minuto** (00:01:33 a 00:02:34): corrieron juntos dos chequeos acotados y una tanda de tests. La RAM libre bajó de 3,1 a 0,9 GB en 6 segundos, que es la zona roja del vigía. Cuando terminaron, volvió a 5,6 GB.

### Lo que se pierde

- El vigía **mató 81 trabajos pesados el 24/10**, 70 el 23/10 y 886 desde el 11/10 (unos 63 por día en promedio). Cada uno tenía reservados 2,37 GB en promedio.
- **Causa 1:** la guardia deja arrancar un trabajo pesado con 1,5 GB libres y 20 segundos de separación, pero cada uno pide entre 2 y 2,5 GB. Lo deja arrancar y después el vigía lo mata.
- **Causa 2:** los tests sin freno (`npm test` no tiene el límite).
- El 24/10 hubo 32 momentos en zona roja sin nada que el vigía pudiera matar.
- **Búsquedas de archivos huérfanas (grep y find):** había un grep cuyo proceso de origen ya no existía. Ocupó 1 GB de RAM (3,4 GB reservados) durante 13 minutos o más, buscando adentro del programa de Claude. También había un find que llevaba 5,5 horas. El vigía sólo mira procesos de node, así que no los ve.

### Lo que NO es el problema

El archivo de paginación (23 GB) y la compresión de memoria no son el cuello de botella. El límite de memoria reservada estaba al 64%. Lo que falta es RAM física: a las 23:59 Windows ya estaba leyendo memoria desde el disco, unas 1.700 veces por segundo.

### Cuántos chats

Hubo 8 chats con actividad en la última hora, 16 en las últimas 6 horas y 22 en las últimas 24. Con 20 abiertos serían unos 3 GB más, sólo de chats.

### Dos correcciones a lo que se creía

- Los tests **no son vitest**: corren con `node --test` y son 1.683 archivos.
- El chequeo de tipos ya no son 4.300 archivos y 57 MB, que era el dato del 14/10. Al 21/10 eran **7.723 archivos y 76,5 MB**.

### La cuenta que importa

Sacar de la PC los chequeos y los tests elimina los picos y las corridas que mata el vigía. Pero **no deja lugar para abrir más chats**, porque la base de unos 10 GB con 8 chats sigue igual. Para tener más chats abiertos hace falta más RAM o mover chats enteros a la nube.

*Fuentes:*
- Medición local de procesos y hardware (WMI), 24/10/2026 23:59 a 25/10 00:06.
- `~/.claude/guardia/vigia.csv` y `guardia.log`; `~/.claude/guardia/memoria.mjs` línea 42.
- `C:/dev/wt-push-q/package.json` línea 12; `C:/dev/wt-push-q/AGENTS.md` líneas 133 y 183.
- Límite por defecto de los tests en Node: https://nodejs.org/api/cli.html#--test-concurrency

---

## 3. Las opciones

### A. Ordenar la PC (gratis)

**Qué resuelve:** que dejen de morir 70 a 80 corridas por día y que haya más margen estable. Son siete arreglos:

1. **Tests con freno:** sumar `--test-concurrency=2` a `npm test`, y que la guardia frene cualquier `node --test` que no lo tenga. Libera 1,5 a 1,8 GB en cada pico.
2. **Un solo trabajo pesado a la vez en toda la PC**, con un piso real de unos 3 GB en lugar de 1,5, y con vencimiento por si uno se cuelga. El turno ya existe para el chequeo de tipos; hay que extenderlo a todo lo pesado. El pico queda en unos 2,5 GB y quedan 2,5 a 3 GB libres en vez de 0,9.
3. **Que el vigía vea las búsquedas huérfanas (grep y find):** las que ya no tienen quién las lanzó y llevan más de 5 minutos o pasan 500 MB. Libera hasta 1 GB.
4. **Sacar del inicio las apps de fondo** que no usás: libera 0,5 a 0,7 GB. Si Fathom graba las reuniones con Mauricio, dejalo o abrilo sólo para esas reuniones.
5. **Reiniciar la PC.** La reserva de Windows (3,6 a 4,3 GB) se vacía al reiniciar. Si vuelve a crecer, puede ser un controlador que pierde memoria; no está confirmado.
6. **Opcional: que Defender no revise la carpeta del repo ni C:\dev.** Los trabajos pesados durarían menos y se pisarían menos. No lo medí.
7. **Tener abiertos sólo los chats que están trabajando:** cada chat archivado libera 0,25 GB. Lo mismo con Chrome cuando no lo usás: el 22/10 ocupaba 1,3 GB.

**Cuánto cuesta por mes:** USD 0.

**Cuánta RAM libera:** unos 2 a 3 GB de margen estable, y dejan de tirarse 70 a 80 corridas de unos 2,4 GB por día.

**Lo que NO resuelve:** el chequeo entero antes de main sigue sin entrar de una vez, porque pide 6,3 GB y en el mejor caso hay 5,6. Para eso hacen falta B o D.

**Qué cambia para vos:** casi nada. Los chats esperan su turno en lugar de arrancar y que los maten, y los tests tardan más.

**Esfuerzo:**
- Chats: menos de 1 día en total (10 minutos los tests, medio día el turno, 1 hora el vigía).
- Vos: 15 minutos para las apps de fondo y, si querés, Defender, que pide permiso de administrador.

**Riesgos:**
- En las horas pico la cola puede ser larga.
- Si Defender deja de revisar esas carpetas, no detectaría un paquete malicioso al instalarse.
- La guardia y el vigía están en `~/.claude` y son compartidos: hay que avisar a los demás chats antes de cambiarlos.

*Fuentes:* https://nodejs.org/api/cli.html#--test-concurrency · https://learn.microsoft.com/windows/dev-drive · https://support.microsoft.com/windows/add-an-exclusion-to-windows-security-811816c0-4dfd-af4a-47e4-c301afe13b26 · `~/.claude/guardia/vigia.ps1` línea 47 · `C:/dev/wt-push-q/scripts/tests-afectados.mjs` líneas 30-32

### B. Ampliar la RAM de la notebook

**Qué resuelve:** todo lo local de una sola vez: los chats, los chequeos, los tests y lo que tiene que quedarse en la PC (producción, tu Chrome, el Cerebro). La notebook tiene 2 zócalos de notebook (SODIMM). Los dos están ocupados con módulos Samsung de 8 GB DDR4-3200, y Windows informa un máximo de 64 GB.

- **32 GB (2 módulos de 16):** quedarían unos 21 GB libres con lo fijo de hoy. Entra el chequeo entero junto con varios acotados y tests, sin pausar el vigía ni partir el chequeo en tandas. Como el chequeo crece cerca de 1 GB por semana, el margen es para muchos meses, pero no para siempre.
- **Variante de 24 GB** (un módulo de 16 más uno de los de 8): unos $234.000 (unos USD 150). Rinde algo menos y no verifiqué que este modelo la acepte.
- **64 GB (2 módulos de 32):** sobra para 20 chats con varios chequeos enteros a la vez. Con lo medido, probablemente sea gastar de más.

**Cuánto cuesta por mes:** USD 0. Es un pago único, en pesos y en el país, así que no lleva los impuestos de las compras al exterior:
- 32 GB: $430.000 a $470.000, o sea **unos USD 277-302** al oficial de $1.550.
- 64 GB: $1.010.000 a $1.550.000, o sea **unos USD 652-998**. Ese precio se movió mucho en 19 días.

**Cuánta RAM libera:** suma 16 GB físicos con la de 32, o 48 GB con la de 64.

**Qué cambia para vos:** nada en el software. Los dos módulos de 8 GB sobran y se pueden revender.

**Esfuerzo:** 20 a 30 minutos con un destornillador Phillips chico, o lo hace un técnico. Hay que comprar:
- **SODIMM (de notebook) DDR4 a 3200 MHz y 1,2 V.** No sirven los módulos de escritorio (U-DIMM): no son intercambiables.
- **Los dos módulos iguales**, mejor en un kit, para que trabajen juntos a la velocidad máxima.

**Riesgos:**
- No sé si abrir la tapa afecta la garantía de MSI en Argentina.
- El máximo de 64 GB sale de Windows y de la ficha de un comercio para otro B13VF; la ficha oficial de este modelo exacto no la encontré.
- Los precios salen del historial de un comparador (22 y 23/10), no de Mercado Libre en vivo.

*Fuentes:*
- 16 GB: https://mejorescompras.com.ar/precio/MLA23875914--memoria-ram-sodimm-ddr4-16gb-3200mhz-hiksemi-hiker
- 32 GB: https://mejorescompras.com.ar/precio/MLA64539461--memoria-ddr4-32gb-3200mhz-adata-sodimm-oem
- Dólar: https://dolarapi.com/v1/dolares/oficial (venta $1.550, actualizado el 23/10/2026; lo volví a consultar el 25/10)
- Zócalos y máximo: https://www.memoryexpress.com/Products/MX00136807 · https://storage-asset.msi.com/specSheet/es/nb/Thin%2015%20B13VE-2446ES.pdf
- Medición local WMI.

### C. Chats de Claude Code en la nube de Anthropic

Esto es lo que imaginabas con «Grockbox». Puede ser Grok Build, el agente de programación de xAI, que está en beta desde mayo de 2026 y suele correr en máquinas de otras empresas (E2B, por ejemplo). No está confirmado que hables de ese, y además usa los modelos de xAI, no Claude. La idea es la misma: el chat trabaja en una computadora de ellos, no en la tuya.

**Qué resuelve:** cada chat corre en una computadora de Anthropic con 4 procesadores, 16 GB de RAM y 30 GB de disco. Ahí el chequeo de tipos entero entra holgado, y el chat sigue trabajando con la notebook cerrada.
- Se abre desde la app de escritorio (selector «Cloud»), desde claude.ai/code o desde la pestaña Code de la app de Android.
- Un chat local se puede pasar a la nube con «Open in > Cloud».

**Cuánto cuesta por mes:** USD 0 extra. La documentación dice «no separate charge for the cloud VM». Gasta la misma cuota de la cuenta: la ventana de 5 horas y la semanal.

**Cuánta RAM libera:** unos 0,25 GB por chat, más **todos sus chequeos y tests** (2 a 6 GB por pico), que pasan a correr allá. No medí cuánto le cuesta a la app de escritorio mostrar un chat de la nube.

**Qué cambia para vos:**
- **Va a la nube:** código, tests, chequeos de tipos, revisiones, documentos y migraciones escritas pero no aplicadas.
- **Se queda en la PC:**
  - Todo lo que toca producción: el `.env.local`, aplicar migraciones, reparar datos, el vigía de MaKo Alert y Evolution.
  - Lo que usa tu Chrome o la extensión: el Puente a Flow, los trámites de Meta, Claude in Chrome y el control de la PC.
  - Mirar la app con tu sesión.
  - El Cerebro, el Runner y el chat del Ops Center.
- Un chat de la nube no ve la memoria de la PC. Un script de arranque puede copiarle las reglas clave.
- No le puede escribir al Cerebro: recibe mensajes pero no contesta.
- Lo que sube a GitHub aparece con tu usuario.
- **En el Ops Center** aparece con el chip «Nube», sin caja para escribir ni conversación. Completarlo lleva 2 a 4 días de trabajo; mientras tanto, lo contestás desde la app de Claude en Android.
- **Hoy no está habilitado** en la cuenta que medí («no_environment», 25/10). Los entornos son por cuenta, así que hay que crear uno en cada una (4 o 5) y darle acceso a GitHub.
- El repo pesa 301 MB, más que el tope de 100 MB para mandar un repo desde la PC. Por eso la nube lo copia directo desde GitHub.

**Esfuerzo:**
- Vos: 15 a 30 minutos por cuenta. Crear el entorno en claude.ai/code, darle a la app de Claude acceso a `koncke/mako` en GitHub y dejar la red en «Trusted», que es la que viene. «Trusted» sólo deja entrar a sitios conocidos, como los de paquetes y GitHub.
- Chats: medio día. La regla de arranque, actualizar `docs/relevo/nube.md` (que es del 16/10 y todavía habla de «integracion» y de Actions) y una prueba.

**Riesgos:**
- **El más serio:** el chequeo antes de subir **no viaja** con el repo, porque git no versiona esas reglas. Un chat de la nube sin una regla de arranque que lo instale puede subir a main sin chequear tipos. Hay que arreglarlo **antes** de mover cualquier chat.
- La cuota es compartida: 10 chats en la nube queman la ventana de 5 horas y el corte al 97% llega antes.
- Hay un tope de chats de la nube a la vez. La documentación confirma que existe, pero no publica la cifra.
- La documentación avisa que la máquina puede frenar trabajos que piden mucha más memoria. El build completo de Next no está medido.
- Si el chat queda un rato sin actividad, la máquina se apaga. La conversación se recupera, pero lo que corría de fondo se pierde y hay que pedirlo de nuevo.
- **Nunca hay que poner claves de producción en las variables del entorno**, porque las lee cualquiera que use el entorno, incluido el modelo. Si algún día hace falta una clave (por ejemplo, para que el Ops Center reciba las conversaciones), va como «secreto de red», que la máquina no ve. Ojo: ese secreto se adjunta a todo pedido a ese dominio desde cualquier chat del entorno.

*Fuentes:* https://code.claude.com/docs/en/claude-code-on-the-web · https://code.claude.com/docs/en/cloud-environments · https://code.claude.com/docs/en/desktop · https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan · https://claude.com/pricing · Grok Build: https://docs.e2b.dev/agents/grok (consultados el 25/10/2026)

### D. Que el chequeo antes de main vuelva a correr fuera de la PC

**Contexto:**
- Hasta el 22/10 lo hacía GitHub Actions en la rama `integracion`. Desde ese día está sin minutos.
- Hoy el chequeo antes de subir que corre en la PC es la única red de tipos, porque Vercel no chequea tipos.
- Los minutos gratis vuelven el 1/11, pero en octubre los 2.000 duraron una semana.
- La máquina de GitHub para repos privados tiene 8 GB. El 21/10 el chequeo entero ya usaba 5.065 de los 6.144 MB que se le permiten en esa máquina (82%).

**Cuánta RAM libera (cualquiera de las variantes):** el pico del chequeo entero (5 a 6,3 GB) y los tests del tren (0,7 a 1,4 GB). No toca la base.

**Qué cambia para vos:** el tren vuelve a ser automático. La PC sólo sube los cambios, y una máquina de afuera chequea y avanza main.

**Seguridad, para cualquier variante:** la máquina de afuera necesita permiso para escribir en el repo, porque avanza main. No hay que llevarle el `.env.local` ni claves de producción: el chequeo de tipos no las necesita.

#### D1. Una tarea programada en la nube de Anthropic

- **Cuánto cuesta por mes:** USD 0 extra. Cada corrida gasta cuota del plan.
- **Cómo anda:** la PC la dispara con un pedido web que no usa RAM. La tarea corre el chequeo entero y los tests en una máquina de 16 GB y, si todo da bien, avanza main.
- **Topes:** 30 disparos por hora por tarea y 100 por hora por cuenta.
- **Esfuerzo:** alrededor de 1 día de chats. Necesita el entorno de la opción C.
- **Riesgos:**
  - Está en prueba («research preview»): la forma de usarla y los topes pueden cambiar.
  - **No es un programa fijo, es un chat de Claude que corre el chequeo.** Que la corrida figure como «Succeeded» sólo dice que la sesión terminó bien, no que el chequeo dio verde. El veredicto lo tiene que dar el script, y hay que probar que Claude no avanza main con un rojo.
  - Por defecto sube a ramas `claude/…`. Según la documentación puede subir a otra rama si se lo pide. Lo que **no está medido** es si el filtro automático de permisos lo deja subir a main sin quedarse esperando tu aprobación.
  - El token del disparo es un secreto y no puede ir al repo.
  - Si se acaba la cuota, el tren se frena.

*Fuente:* https://code.claude.com/docs/en/routines (consultada el 25/10/2026)

#### D2. Una máquina alquilada propia para GitHub («runner propio»)

- **Cómo anda:** GitHub no cobra el uso de máquinas propias. La rama `integracion` vuelve a andar como antes, cambiando una línea en cada uno de los 4 archivos de configuración de GitHub Actions.
- **Cuánto cuesta por mes**, en dólares a 1,12 por euro:
  - Contabo, 24 GB: unos €14 (USD 16). Ese precio es con 24 meses de permanencia; mes a mes cuesta alrededor de 25% más, según un tercero.
  - Hetzner CX43, 16 GB: €15,99 (USD 18), más la dirección IP, que se cobra aparte. En septiembre no estaba disponible para clientes nuevos.
  - netcup, 16 GB: unos €22,6 (USD 25) con contrato de 12 meses, según un tercero.
  - OVH, 24 GB: desde USD 23,37, que parece ser con pago anual.
  - **Unos USD 16-25 por mes, sin impuestos.** Al pagar un servicio del exterior con tarjeta se suma, probablemente, el 21% de IVA a servicios digitales. Si se paga en pesos, se suma además una percepción de 30% a cuenta de Ganancias, que después se puede descontar o pedir de vuelta. No lo verifiqué con ARCA.
  - Si tenés otra computadora con 16 GB que pueda quedar prendida, sirve igual y cuesta 0. No lo miré.
- **Esfuerzo:**
  - Vos: 30 minutos. Dar de alta el proveedor con tu tarjeta y sacar el token en GitHub (Settings → Actions → Runners).
  - Chats: medio día.
  - Después queda mantenimiento: actualizaciones y limpiar el disco cada tanto.
- **Riesgos:**
  - El cobro de USD 0,002 por minuto para estas máquinas está postergado, no cancelado. Si vuelve, serían unos USD 12 por mes.
  - No está documentado si arrancan con la cuenta bloqueada por falta de minutos; un tercero dice que sí. Desde el 1/11 la cuota se renueva.
  - El código y el permiso para escribir en el repo quedan en una máquina con dirección pública: sólo se entra con llave, nunca con contraseña.
  - Con 16 GB hay margen para semanas o meses, porque el chequeo crece.

*Fuentes:* https://docs.github.com/en/billing/concepts/product-billing/github-actions · https://docs.github.com/en/actions/reference/runners/github-hosted-runners · https://prodevs.in/tutorials/self-hosted-github-runners-cost-2026/ · https://www.contabo.com/en/vps/ · https://toolradar.com/tools/contabo/pricing · https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/ · https://www.vincentschmalbach.com/hetzner-cheap-cloud-unavailable-price-increases/ · https://notes.nicolasdeville.com/helpers/netcup/ · https://www.ovhcloud.com/en/vps/ · Cambio: https://api.frankfurter.dev/v1/latest?from=EUR&to=USD (1,1193 al 23/10/2026) · Impuestos: https://www.global66.com/blog/como-afectan-los-impuestos-a-tus-gastos-digitales/ · https://www.elancasti.com.ar/edicion-impresa/dejo-aplicarse-el-impuesto-pais-las-compras-el-exterior-n603139

#### D3. Máquinas por minuto (Ubicloud)

- **Cuánto cuesta por mes:** unos **USD 5-13** (estimado), más el IVA del exterior. La página oficial cobra USD 0,0025 por minuto por 4 procesadores y 16 GB, y da USD 2,50 de crédito por mes, que son unos 1.000 minutos de esa máquina.
- **Ventaja:** no hay servidor que mantener.
- **Esfuerzo:** vos, 15 minutos (registrarte, la tarjeta y la app en GitHub); chats, 1 hora.
- **Riesgos:**
  - Un tercero tiene acceso al código.
  - No confirmé que acepte cuentas personales de GitHub; la página de precios no lo dice.
  - Cada corrida arranca de cero, sin lo guardado de la anterior, así que cada chequeo tarda más.

*Fuente:* https://ubicloud.com/docs/about/pricing (consultada el 25/10/2026)

#### D4. Pagar minutos de GitHub (sólo para comparar)

- **Cuánto cuesta por mes:** unos **USD 40** por encima de los 2.000 gratis, al ritmo de octubre (USD 0,006 por minuto).
- **Por qué no conviene:** es un parche de semanas, porque la máquina de 8 GB ya está al límite.

*Fuente:* https://docs.github.com/en/billing/concepts/product-billing/github-actions

**Para esta misma función también miré:**
- CircleCI gratis: tiene una máquina de 15 GB, pero no confirmé cuántos créditos gasta por minuto y habría que reescribir todo el flujo.
- GitHub Codespaces: no avanza main solo.
- Chequear tipos en Vercel: la máquina de 8 GB ya está al límite, y un error de tipos frenaría hasta los arreglos urgentes.

Ninguna conviene.

### E. Un servidor alquilado para TODOS los chats

**Qué resuelve:** casi toda la RAM, de los chats y de los picos. Hay dos formas oficiales:
- **Por conexión remota (SSH) desde la app de escritorio:** el selector ofrece Local, Cloud o SSH.
- **«Remote Control» en el servidor:** atiende hasta 32 chats que manejás desde Android o claude.ai, y siguen con la notebook apagada.

**Cuánto cuesta por mes**, en dólares a 1,12 por euro y sin impuestos:
- Hetzner AX41 (64 GB): 59 € (USD 66), sin alta.
- Hetzner AX42: 99 € (USD 111), más 49 € de alta.
- Contabo 64 GB: unos 37 € (USD 41), con procesador compartido; no lo medí.
- **Unos USD 41-111.** Valen los mismos impuestos del exterior que en D2.
- Lo más cerca es São Paulo (29 ms), y ahí se paga por hora. En Google Cloud São Paulo, 32 GB cuestan unos USD 264 por mes prendido, o USD 79 con máquinas «spot». En AWS sólo encontré precio en Virginia (unos 143 ms): USD 222, o USD 73 en «spot». Las «spot» son capacidad sobrante que te pueden sacar con 30 segundos a 2 minutos de aviso, así que no sirven para chats.

**Cuánta RAM libera:** casi toda. En la notebook quedan la app, Chrome y las conexiones.

**Qué cambia para vos (mucho):**
- La memoria y las reglas globales probablemente se lean del servidor. La documentación lo confirma para las reglas y las skills; para la memoria es una deducción. Habría que copiar 328 archivos y mantener dos copias.
- Varias reglas automáticas leen datos de la app de Windows y no andan allá, y el vigía es de PowerShell.
- Los chats quedan guardados en el servidor, así que el Runner de la PC no los ve: haría falta otro allá.
- No hay panel de navegador, y no está confirmado que ande Claude in Chrome.
- Por SSH desde Windows, si cerrás la app o se reinicia para actualizarse, **se pierde la tarea en curso**.
- Para producción, el servidor necesitaría el `.env.local` con unas 80 claves: la base entera, el DNS de hola-mako.com, publicar la extensión, los tokens de Meta, etc.

**Esfuerzo:** 1 a 2 días, más mantenimiento.

**Riesgos:**
- Claves de producción en una máquina con dirección pública prendida las 24 horas. Si alguien entra o un paquete malicioso lee el `.env.local`, tiene la base entera, el dominio y la extensión. Las copias de seguridad del proveedor también guardarían las claves.
- Como arrancar la app en modo local ya escribe en producción, en el servidor pasaría lo mismo.
- Con Remote Control, quien entre a tu cuenta de Claude maneja una máquina con esas claves. Habría que activar «Require trusted devices».
- Unos 240 ms hasta Europa: en el chat casi no se nota, pero ver la app a distancia se siente lento.
- Hetzner puede pedir documento y foto al darte de alta.

**Veredicto:** no por ahora. Conviene volver a mirarlo sólo si con 32 GB y la nube no alcanza.

La variante de Anthropic para correr «chats de la nube en tu servidor» es sólo para planes Team y Enterprise, así que queda descartada.

*Fuentes:* https://code.claude.com/docs/en/desktop · https://code.claude.com/docs/en/remote-control · https://code.claude.com/docs/en/self-hosted-environments · https://www.hetzner.com/dedicated-rootserver/ax41 · https://www.hetzner.com/dedicated-rootserver/ax42 · https://calculator.holori.com/aws/ec2/r7a.xlarge · https://calculator.holori.com/gcp/vm/n2d-highmem-4/southamerica-east1 · https://heise.de/-11333037 · https://wondernetwork.com/pings/Buenos%20Aires

### F. TypeScript 7 (el chequeo de tipos reescrito)

**Qué resuelve:** es el mismo chequeo, entre 7,7 y 11,9 veces más rápido según Microsoft. Salió estable el 8/7/2026. Como el pico dura mucho menos, es más fácil encontrarle un hueco de RAM.

**Cuánto cuesta por mes:** USD 0.

**Cuánta RAM libera:** no se sabe, porque no está medido en este repo.
- Microsoft da entre 6 y 26% menos.
- Por defecto trabaja con 4 hilos a la vez, y Microsoft avisa que más hilos piden más memoria.
- Con 1 solo hilo, un tercero midió casi la mitad en un proyecto Next de 7.000 archivos.

**Qué cambia para vos:** nada, si se instala aparte. Next 16.2.11 y los scripts de tandas usan el TypeScript actual. Hay que ajustar la configuración.

**Esfuerzo:** medio día de un chat, **probándolo en la nube o en el runner, nunca en esta PC**.

**Riesgos:**
- Puede marcar errores distintos que la versión actual.
- Con varios hilos puede dar resultados que dependen del orden.
- Lo que usan los scripts recién llega en la 7.1 (beta del 20/10).
- No es un programa de node, así que el vigía de hoy no lo ve ni lo frena.

*Fuentes:* https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (consultado el 25/10/2026) · https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/ · https://zackoverflow.dev/writing/why-does-tsgo-use-so-much-memory/

### Otras que miré y no convienen

- **Codex cloud (OpenAI):** desde USD 20 por mes. Es otro modelo, no publica la RAM de sus máquinas y en su foro hay tareas cortadas por falta de recursos. https://learn.chatgpt.com/docs/pricing
- **Cursor Cloud Agents:** desde USD 30 por mes, más Claude a precio de API. https://cursor.com/pricing
- **Jules (Google):** gratis con 15 tareas por día, pero usa Gemini, no Claude, y no publica la RAM. https://jules.google/docs/usage-limits
- **Devin:** de USD 20 a 200 por mes, con una cuota que no está clara. https://devin.ai/pricing
- **El agente de Copilot de GitHub:** gasta minutos de Actions, y hay 0. https://docs.github.com/en/billing/concepts/product-billing/github-copilot-premium-requests
- **Codespaces como máquina de trabajo:** unos USD 525 por mes prendido, y necesita medio de pago. https://docs.github.com/en/billing/concepts/product-billing/github-codespaces
- **Proyectos de Claude Code:** está en beta. Sería un segundo Cerebro y no carga las reglas del repo, así que no instalaría el chequeo antes de subir. En 1 hora se puede ver si está habilitado. https://code.claude.com/docs/en/claude-projects

Ninguno se conecta al Ops Center ni a la memoria.

### Tabla comparativa

| Opción | Por mes | RAM que libera | Cambia tu trabajo | Esfuerzo |
|---|---|---|---|---|
| A. Ordenar la PC | USD 0 | 2-3 GB de margen y 70-80 corridas por día que no se pierden | Casi nada | Menos de 1 día de chats y 15 min tuyos |
| B. RAM a 32 GB | USD 0 (único: ~USD 280-300, en pesos) | +16 GB | Nada | 30 min y una compra |
| B. RAM a 64 GB | USD 0 (único: ~USD 650-1.000, en pesos) | +48 GB | Nada | 30 min y una compra |
| C. Chats en la nube | USD 0 extra (cuota) | 0,25 GB por chat y todos sus picos | Sí: sin producción ni Chrome; Ops Center a medias | 30 min por cuenta y medio día de chats |
| D1. Tren en la nube | USD 0 extra (cuota) | Pico de 5-6,3 GB | El tren vuelve a ser automático | ~1 día |
| D2. Runner propio | ~USD 16-25* | Pico de 5-6,3 GB | Vuelve `integracion` | 30 min tuyos, medio día y mantenimiento |
| D3. Ubicloud | ~USD 5-13 (estimado)* | Pico de 5-6,3 GB | Vuelve `integracion` | 15 min tuyos y 1 h |
| D4. Minutos de GitHub | ~USD 40* | Pico (máquina al límite) | Nada | 10 min |
| E. Servidor para todos | ~USD 41-111* | Casi toda | Mucho: memoria, reglas, Runner y claves | 1-2 días y mantenimiento |
| F. TypeScript 7 | USD 0 | Incierta; el pico dura ~10 veces menos | Nada | Medio día |

\* Servicio del exterior: euros a 1,12 dólares (23/10/2026), sin el IVA de servicios digitales ni la percepción si se paga en pesos.

---

## 4. Lo que recomiendo, en orden

1. **Hoy, gratis. Un chat:**
   - Tests con freno (`--test-concurrency=2` en `npm test`, y que la guardia frene a los que no lo tengan).
   - Un solo trabajo pesado a la vez, con un piso de ~3 GB y vencimiento (en `~/.claude/guardia/memoria.mjs`).
   - Que el vigía mate las búsquedas huérfanas (grep y find).
   - Avisar a los demás chats antes, porque son reglas compartidas.
   - Después, confirmar en `vigia.csv` que bajan las 70-80 muertes por día.
2. **Hoy, 15 minutos. Vos:**
   - Sacar del inicio Copilot, el overlay de NVIDIA, MEGA y lo que no uses (Configuración → Aplicaciones → Inicio). Dejá Fathom si lo usás con Mauricio.
   - Reiniciar la PC. Un chat mide si la reserva de Windows bajó.
3. **Esta semana, la compra. Vos:**
   - 2 módulos iguales de **16 GB DDR4-3200 SODIMM de 1,2 V**, unos USD 280-300.
   - Antes, averiguar si abrir la tapa toca la garantía; si no querés abrirla, que lo haga un técnico.
   - Es lo único que agranda la base para tener 15 a 20 chats, y lo que hace que el chequeo entero antes de main vuelva a entrar en la PC.
4. **Habilitar la nube en UNA cuenta. Vos, 30 minutos:**
   - Crear el entorno en claude.ai/code, darle a la app de Claude acceso a `koncke/mako` y dejar la red en «Trusted».
   - Sin claves de producción.
5. **Antes de mover cualquier chat a la nube. Un chat, medio día:**
   - La regla de arranque que instala el chequeo antes de subir en la nube.
   - Actualizar `docs/relevo/nube.md`.
   - La prueba: un chat en la nube corre el chequeo de tipos entero y un test.
   - Si da bien, se mudan los chats de código que no tocan producción ni Chrome.
6. **El tren fuera de la PC. Chats, alrededor de 1 día:**
   - Una tarea programada en la nube que corre el chequeo entero y los tests y avanza main.
   - Probarla con un error puesto a propósito, y comprobar que con un rojo **no** avanza main.
   - **Plan B**, si no puede subir a main sola, si falla de forma impredecible o si la cuota no alcanza: una máquina de afuera para GitHub, que es un programa fijo y no gasta cuota de Claude. La más barata y sin mantenimiento es Ubicloud (unos USD 5-13 por mes), si acepta tu cuenta personal. Si no, un runner propio en Contabo, Hetzner o netcup (unos USD 16-25 por mes). En los dos casos vos te das de alta con tu tarjeta, y los chats lo configuran en 1 hora a medio día. Mejor desde el 1/11, cuando GitHub renueva la cuota.
7. **El Ops Center para los chats de la nube. Chats, 2 a 4 días en tandas:**
   - Medir cómo aparece el primer chat de la nube.
   - Entregarle mensajes con acuse de recibo.
   - Subir su conversación.
   - Mandar los cierres y las preguntas directo a MaKo.
   - Mientras tanto, los contestás desde la app de Claude en Android.
8. **TypeScript 7. Un chat, cuando ya haya nube o runner:** medirlo allá, nunca en esta PC.
9. **Las demás cuentas. Vos:** habilitar la nube en el resto recién cuando el paso 5 dé bien.

**No recomiendo, por ahora:** el servidor para todos los chats, Codex, Cursor, Jules, Devin ni pagar minutos de GitHub. Conviene volver a mirarlo en unas dos semanas, con los 32 GB y la nube andando.

---

## 5. Lo que no pude confirmar

**Nube de Anthropic**
- Cuántos chats de la nube a la vez permite cada plan. La documentación confirma que hay un tope, pero no da la cifra. «Max 10, Pro 5» sale de un tercero sin fuente oficial.
- Que el chequeo de tipos entero y los tests de este repo terminen bien en esa máquina, y cuánto tarda la instalación. Si pasa de unos 5 minutos, no queda guardada y se repite en cada sesión.
- Cuánta memoria pide el build completo de Next allá.
- Si el filtro automático de permisos de la tarea programada la deja subir a main sin pedir aprobación. La documentación dice que puede subir a otra rama si el prompt lo pide.
- Si el Runner puede leer la conversación de un chat de la nube y escribirle, y si el envío por línea de comandos funciona con las varias cuentas. La documentación dice que hay que estar con sesión iniciada en la misma cuenta dueña del chat.
- Cuánta cuota gasta un chat en la nube comparado con uno local.
- Cuánta RAM ahorra la app de escritorio al pasar un chat a la nube: los 0,25 GB por chat son de la medición en la PC.
- Si los Proyectos de Claude Code ya están habilitados en alguna de tus cuentas.
- Que «Grockbox» sea Grok Build de xAI. Grok Build existe, pero no sé si es lo que viste.

**Servidores y runners**
- Si un runner propio arranca con la cuenta de GitHub bloqueada por falta de minutos. Sólo hay un reporte de un tercero, del 27/09/2026, que dice que sí.
- Si vuelve el cobro de USD 0,002 por minuto, y cuándo.
- Si Hetzner CX43 se puede contratar hoy, y cuánto cuesta la dirección IP aparte.
- Los precios de Contabo (permanencia, alta y recargo en EE.UU.), los de netcup (son de terceros) y los de OVH (pago anual y stock).
- Si Ubicloud acepta cuentas personales de GitHub.
- Cuántos créditos por minuto gasta la máquina de CircleCI.
- Cuánta RAM trae cada tamaño de Codespaces.
- Los impuestos argentinos exactos a servicios del exterior: probablemente 21% de IVA más 30% de percepción si se paga en pesos. Conviene confirmarlo con tu contador o con ARCA.
- Cuánto tarda el chequeo de tipos en un servidor con procesador compartido.
- Por conexión remota (SSH): si la memoria se lee del servidor, si anda Claude in Chrome, dónde quedan guardados los chats y cuánta RAM usa la app con 20 chats remotos.
- Los precios de AWS en São Paulo para 32 y 64 GB, normales y «spot».
- Si en Vercel la máquina Standard sigue costando USD 0.

**La PC**
- La ficha oficial de MSI de este modelo exacto: el máximo de 64 GB sale de Windows y de fichas de modelos parecidos.
- Si cambiar la RAM afecta la garantía.
- Los precios de RAM son del historial de un comparador, no de Mercado Libre en vivo. Los de Fullh4rd no tienen fecha.
- Si la combinación de 24 GB (16 más 8) anda en este modelo.
- Por qué la reserva de Windows ocupa entre 3,6 y 4,3 GB, y cuánto de eso está de verdad en la RAM. Puede ser un controlador, pero confirmarlo pide herramientas de administrador.
- Cuánto más lentos serían los tests con freno: no corrí tests porque no había RAM.
- Cuánto acortaría los trabajos sacar esas carpetas de la revisión de Defender.
- Qué chat lanzó el grep huérfano.
- Por qué el 22/10 había 3,7 GB en procesos auxiliares de node y el 24/10, en reposo, sólo 60 MB.

**TypeScript 7**
- Cuánta memoria usa en este repo.
- Si el vigía lo puede frenar, y si su informe de memoria tiene el formato que leen los scripts.
- Si Next 16.2.11 se rompe al tenerlo instalado.
- Los tiempos que di (el chequeo entero en 2-3 minutos en un runner y TypeScript 7 en decenas de segundos) son estimaciones, no mediciones.

---

## Notas del crítico

- **Corregí datos:** los USD 222 de «São Paulo en AWS» eran de Virginia, así que lo separé. Cambié «unas 80 muertes por día» por 81 y 70 (63 de promedio desde el 11/10). Sobre el grep, se sabía que no existía el proceso que lo lanzó, no que el chat ya no existiera. Y «la paginación funciona bien» lo cambié por «no es el cuello de botella», porque Windows ya estaba leyendo memoria del disco.
- **Verifiqué en la web el 25/10:**
  - La máquina de la nube (4 procesadores y 16 GB), que no se cobra aparte y el tope de 100 MB.
  - Los topes de 30 y 100 disparos por hora.
  - Ubicloud: USD 0,0025 por minuto y USD 2,50 de crédito.
  - TypeScript 7: entre 7,7 y 11,9 veces más rápido.
  - El dólar oficial a $1.550.
  - El euro a 1,12. Con eso recalculé D2 (USD 16-25) y E (USD 41-111).
- **Agregué lo que faltaba:**
  - Los impuestos argentinos a servicios del exterior, que la compra de RAM en pesos no paga.
  - Que A no hace entrar el chequeo entero antes de main.
  - Que la tarea programada es un chat de Claude y no un programa fijo: su «Succeeded» no quiere decir verde.
  - Ubicloud como plan B más barato.
  - Una línea en el resumen sobre el tren a main.
- **Seguridad:** sumé que no hay que llevar claves de producción a ninguna máquina de chequeo. También el riesgo de los «secretos de red», el aviso de «Require trusted devices» para Remote Control, que arrancar la app en el servidor escribiría en producción, y las copias de seguridad del proveedor con claves adentro.
- **Lenguaje:** saqué jerga («workflow», «grep» sin explicar). Marqué como deducción lo de la memoria por SSH, y aclaré que Grok Build existe pero no es seguro que sea «Grockbox».
- **Cosecha pendiente**, porque esta corrida era de sólo lectura y no escribí nada en el repo. Hay que pasar estos hallazgos a `docs/hallazgos-infra.md` y `docs/hallazgos-operaciones.md`.
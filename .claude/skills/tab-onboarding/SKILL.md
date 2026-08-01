---
name: tab-onboarding
description: Construir el ONBOARDING de una tab de MaKo. Usar SIEMPRE que se cree una tab nueva o se le agregue configuración a una existente. REGLA DEL PRODUCTO — toda tab tiene onboarding y su estado (hecho / no hecho) alimenta a MaKo. Define las 3 etapas (Conectar → Contexto → Ensayo), los principios de baja fricción y qué componentes reusar.
---

# El onboarding de una tab

## La regla

**Toda tab tiene onboarding. Sin excepción.** Ninguna tab funciona bien sin
configuración previa, así que la tab NO se entrega cruda: se entrega con un
recorrido que la deja lista.

El estado de ese onboarding (`hecho` / `no hecho`, y en qué etapa quedó) es un
dato de primera clase: lo lee el gate de la tab **y lo lee MaKo**. Cuando MaKo
detecta algo a optimizar en una tab cuyo onboarding no está hecho, lo primero que
dice es eso — no propone optimizar lo que nunca se configuró.

## Las 3 etapas (siempre las mismas; cambia el contenido)

### ① CONECTAR — la plomería, con prueba de vida
La credencial mínima para que la tab pueda operar. **No alcanza con guardar la
key: tiene que llegar algo de verdad.** El paso se cierra con evidencia:
- un mensaje real que llega al teléfono del dueño (OTP de 6 dígitos, ver
  `contacto-enviar-codigo` / `contacto-verificar-codigo` en `app/api/onboarding/route.ts`),
- un email de prueba que aparece en su bandeja,
- o *facts* de su propia cuenta devueltos por el ping (`PanelMarketing` los pinta
  en el aside en vez del carrusel — la recompensa es el dato real, no un tilde).

Si la tab tiene dos canales (WhatsApp + Email), cada uno se prueba por separado:
uno conectado no implica el otro.

### ② CONTEXTO — lo que MaKo necesita saber
Lo que la IA va a usar para trabajar en esa tab. **Nunca se le pide al usuario
que redacte.** Se le pide un ARTEFACTO que ya existe y MaKo extrae de ahí:
capturas de sus chats, el WhatsApp donde ya atiende, un PDF, un audio, un link.

Antes de pedir cualquier cosa, revisar qué ya está en la app: brief del negocio,
funnel, avatares, personalidad, fase, métricas. **Lo que ya se sabe no se
pregunta** — se muestra como "esto ya lo tengo de vos" y se pide solo el hueco.

### ③ ENSAYO — MaKo propone, el usuario valida jugando
El usuario **nunca escribe la configuración final: la descubre respondiendo.**
MaKo propone (secuencias, reglas, criterios) y lo pone a prueba en un chat:
- **MaKo hace de CLIENTE**, no de negocio: te tira el escenario real ("soy un
  lead que vio el VSL y no agendó, te escribo esto") y vos contestás como
  contestarías de verdad;
- de ese ida y vuelta salen los mensajes, las objeciones cubiertas y las reglas;
- al final se muestra lo que quedó armado y recién ahí se aprueba.

Es la diferencia entre pedirle a alguien que escriba una secuencia (fricción
altísima, resultado pobre) y hacerlo jugar un rato (fricción cero, resultado
real). **El ensayo es también la prueba de que la tab quedó lista.**

## Principios de baja fricción (no negociables)

Destilados de lo que el repo YA hace bien. Al diseñar cualquier paso, aplicalos:

1. **Nunca un campo libre en un formulario.** Si el candidato obvio es un
   textarea, está mal diseñado. Alternativas: chips multi-select, opciones
   cerradas, subir un archivo.
2. **Forced-choice sobre autodescripción.** La gente se describe mal a sí misma
   pero se reconoce al instante. En vez de "¿cuál es tu tono?", mostrale 3 frases
   y que elija la suya (`lib/personalidad.ts`). El dato real viaja OCULTO en la
   opción.
3. **La IA propone, el usuario corrige.** Nunca una hoja en blanco: todo llega
   pre-llenado y se edita inline (`CamposNegocio`, contentEditable con guardado
   al blur).
4. **Las opciones se personalizan al negocio ANTES de mostrarlas** con su oferta,
   avatar y dolor reales (`personalizarPregunta`). Si la IA falla, cae a la
   genérica: el paso nunca se traba.
5. **Una pregunta por pantalla**, y la siguiente la decide la IA mirando el
   historial; corta sola cuando ya sabe suficiente (`{"terminado":true}`, tope
   3-4 preguntas — molde: `siguientePreguntaEntregable`).
6. **La pregunta puede ser "subí una foto".** Si el dueño ya tiene el dato en
   algún lado, se le pide el archivo y la IA lo lee (`tipo:'archivo'` +
   `describirArchivo*`). Si ya declinó una vez, no se le vuelve a pedir.
7. **Pedir un link vale como subir un documento**: el server baja el HTML y lo
   trata como fuente (con guardas anti-SSRF).
8. **Prueba visible de que lo leyó.** Después de recibir algo, mostrar en 2-3
   frases qué entendió ("esto entendí de tus documentos"). Sin eso, el usuario no
   confía en lo que sigue.
9. **Retomar donde quedó, siempre.** El wizard salta al primer paso incompleto y
   el "Atrás" reusa la pregunta guardada sin volver a llamar a la IA.
10. **Contexto que no se pide**: lo que se pueda levantar solo (métricas, leads,
    transcripciones) se levanta en background mientras el usuario avanza
    (`onboarding-extract`, por tandas reanudables).
11. **"Completar después" cuando el paso no es bloqueante** (`extraFooter` del
    WizardShell). Trabar al usuario en un paso opcional es perderlo.
12. **Errores que dicen qué hacer**, distinguiendo causas ("no hay key" vs "se
    quedó sin cuota") — `motivoDeErroresCascada`.

## Qué reusar (no reinventes nada de esto)

| Necesidad | Reusar |
|---|---|
| Chrome del wizard (aside negro + dots + footer) | `app/_components/WizardShell.tsx` (modo `fullscreen`, `bloqueante`, `extraFooter`) |
| Aside con slides o facts reales | `app/_components/PanelMarketing.tsx` + `lib/servicio-slides.ts` |
| Pantalla "tab sin conectar" | `app/_components/PanelActivacion.tsx` + `lib/tab-activacion.ts` |
| Estado del proceso | molde literal de `lib/onboarding-state.ts` (JSON en `app_settings`, **sin migración**) |
| Preguntas adaptativas 1x1 | `siguientePreguntaEntregable` / `siguientePreguntaAvatares` |
| Preguntas cerradas por hueco | `generarPreguntasCerradas(faltantes, conocido)` — ya es genérico |
| Leer archivos que sube el usuario | `leerDocumentoIA` / `describirArchivo*`; subida por URL firmada (`/archivero/upload-url`) |
| Edición inline del brief | `app/onboarding/CamposNegocio.tsx` (filtra por `keys`/`prefijos`) |
| Chat de WhatsApp (burbujas, typing, audio, adjuntos) | `app/whatsapp/_shared/ChatHilo.tsx` |
| IA barata con cascada y validación | `chatCheapCascade` de `lib/ai-cheap.ts` |
| Prompts editables | `lib/prompt-registry.ts` (skill `add-editable-prompt`) |

**OJO con el simulador**: `lib/setting-simulador.ts` hoy pone a MaKo de SETTER y
al usuario de lead. Para el ensayo del onboarding hace falta **al revés** (MaKo =
cliente). Es cambio de prompt + del mapeo `lead=user/negocio=assistant`, no de
arquitectura.

## Tabs que dependen de otras

No toda tab necesita SU PROPIO recorrido: varias comparten la misma
configuración. En vez de hacer tres wizards que piden lo mismo, **una tab cubre a
las otras** y las demás mandan ahí.

Se declara en el catálogo con `cubre: ['whatsapp', 'email']`, y la page de la tab
dependiente resuelve el destino con `onboardingRequeridoPara(tab)`:

```ts
const destino = await onboardingRequeridoPara('whatsapp');
if (destino) redirect(destino);
```

Ejemplo real: `/whatsapp` y `/email` NO tienen onboarding propio. Su canal, su
voz y sus secuencias se configuran enteros en `/setting`, así que entrar ahí sin
eso hecho manda a Setting. Una sola puerta de entrada.

Criterio para decidir: si el recorrido de la tab B le pediría al usuario lo mismo
que ya le pidió la tab A, B no necesita onboarding — necesita depender de A.

## El contrato de estado

Estado por tab en `app_settings` (per-workspace, sin tabla nueva):

```
key:   onboarding.tab.<tabKey>          // ej. onboarding.tab.setting
value: { "v": 1, "status": "pendiente" | "done",
         "steps": { "<paso>": { "done": true, "at": "ISO" } },
         "updated_at": "ISO" }
```

- `status: 'done'` cuando se cierra el ÚLTIMO paso definido para esa tab.
- El gate NO es bloqueante como el onboarding global: la tab se abre igual, pero
  arranca en su onboarding mientras `status !== 'done'` (y deja verla con un
  "ya lo configuro después" salvo que sin config no haya nada que mostrar).
- **MaKo lo lee**: el estado consolidado entra al system prompt
  (`lib/mako-context.ts`) para que nunca proponga optimizar una tab sin
  configurar. Base ya lista: `leerSenales()` de `lib/plan-senales.ts`.

## Checklist para agregar el onboarding de una tab

- [ ] Definir los pasos de las 3 etapas (Conectar / Contexto / Ensayo) para ESA tab.
- [ ] Para cada paso, aplicar los principios de baja fricción: ¿estoy pidiendo que
      alguien redacte? ¿puedo pedir un artefacto o inferirlo de lo que ya tengo?
- [ ] Estado en `onboarding.tab.<key>` con el molde de `onboarding-state.ts`.
- [ ] Vista con `WizardShell` + `PanelMarketing` (se ve idéntico al onboarding global).
- [ ] Paso de Conectar con **prueba de vida** real, no solo credencial guardada.
- [ ] Paso de Ensayo con `ChatHilo` y MaKo en el rol del CLIENTE.
- [ ] Endpoint con el molde de la action `'paso'` de `/api/onboarding` (guard por
      `rol_ws` admin + patch + devolver el estado entero).
- [ ] Enganchar el estado al system prompt de MaKo.
- [ ] Multi-tenant: todo por `getSetting`/`setSetting` y `getTenantDb` (skill
      `tenant-safe-query`).

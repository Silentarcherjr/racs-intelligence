# Guion de grabación — RACS Intelligence

Documento vivo. Se está corrigiendo la UI hasta el momento de grabar, así que
edita aquí en vez de volver a pegar el prompt en el chat.

**Pégale a Astra todo lo que está entre las líneas.** Modelo recomendado:
GPT-6 Astra en esfuerzo medio — la tarea es ejecución prescrita, no resolución
abierta de problemas.

---

```
Vas a grabar el video de demostración de un proyecto de hackathon. Máximo 5
minutos. Trabajas en Windows con PowerShell.

Si algo falla, PARA y repórtame el error exacto. No improvises ni grabes un
demo roto.

── TU INTERFAZ NO DEBE APARECER ─────────────────────────────────────────────

Configura la grabación para capturar ÚNICAMENTE dos fuentes de ventana:
  - la ventana de PowerShell
  - la ventana del navegador en 127.0.0.1:3001

Nada de "pantalla completa". Tú ejecutas los comandos desde donde estés, pero
lo que se graba son esas dos ventanas y nada más.

Razón: el producto demuestra que ninguna IA en la nube toca los datos. Tu
interfaz en pantalla contradice eso visualmente.

── PASO 1: traer la última versión ──────────────────────────────────────────

Si ya tienes el proyecto:
  cd C:\ruta\a\racs-intelligence
  git checkout main
  git pull
  npm install
  npm run build

Si NO lo tienes:
  git clone https://github.com/Silentarcherjr/racs-intelligence.git
  cd racs-intelligence
  Copy-Item .env.example .env
  npm install
  npm run build

OJO: el repo se renombró. Si tu remoto apunta todavía a "sovereign-sentinel":
  git remote set-url origin https://github.com/Silentarcherjr/racs-intelligence.git

Verifica que estés al día — el último commit debe ser el PR #31 o posterior:
  git log --oneline -3

── PASO 2: levantar el entorno ──────────────────────────────────────────────

Docker Desktop debe estar abierto y diciendo "Engine running".

  docker compose up -d
  docker compose ps          → espera "healthy" en clickhouse y kafka
  npm run bootstrap          → debe terminar en "Ready."

Limpia la base para que la pantalla arranque vacía:

  curl.exe -s --data-binary "TRUNCATE TABLE sentinel.dns_incidents" `
    -H "X-ClickHouse-User: sentinel" -H "X-ClickHouse-Key: sentinel" `
    http://127.0.0.1:8123/

Levanta la interfaz en segundo plano:

  Start-Process npm -ArgumentList "start","-w","@sentinel/analyst-ui"

── PASO 3: corrida de calentamiento — NO GRABAR ─────────────────────────────

  npm run demo -- typosquat

Déjala terminar completa (~2 min). Carga los modelos en memoria. Si grabas en
frío, el video tiene 15 segundos muertos esperando a MedPsy.

Vuelve a limpiar dns_incidents con el mismo comando del paso 2.

── PASO 4: VERIFICACIONES OBLIGATORIAS ──────────────────────────────────────

Comprueba CADA UNA. Si alguna falla, PARA y repórtala. No grabes hasta que
las seis pasen.

1. docker compose ps
   → clickhouse y kafka deben decir "healthy". No "starting", no "unhealthy".

2. npm run bootstrap
   → debe terminar con la palabra "Ready." Si hay algún ✗, para.

3. Abre http://127.0.0.1:3001
   → el panel "Inteligencia local" debe mostrar el modelo de texto y el de
     visión como cargado o disponible. Si dice "no disponible", faltan las
     pesas: para y avisa.

4. La interfaz debe estar EN ESPAÑOL. Si ves texto en inglés en los títulos o
   botones, para y repórtalo — es un bug, no una configuración.

5. Tras la corrida de calentamiento, la tabla de incidentes debe tener AL
   MENOS 3 filas, y al menos una con el ícono de cámara. Si sale vacía o sin
   cámara, algo falló: para.

6. Haz clic en un incidente con cámara.
   → debe abrirse la captura de un sitio bancario falso
   → el botón "Explicar con QVAC" debe estar ACTIVO, no gris
   → púlsalo: en ~5 segundos debe aparecer un análisis EN ESPAÑOL

Solo si las seis pasan, limpia la base y empieza a grabar.

── PASO 5: preparar las tomas ───────────────────────────────────────────────

Dos ventanas lado a lado:
  IZQUIERDA  PowerShell
  DERECHA    navegador en http://127.0.0.1:3001

NO abras Grafana. Dispersa la atención y no muestra nada que la UI no tenga.

Graba con OBS, o con Xbox Game Bar (Win+G). 1920x1080, 30fps. Si tienes una
forma mejor que domines, úsala — pero respeta la regla de capturar solo esas
dos ventanas.

── PASO 6: grabar ───────────────────────────────────────────────────────────

  npm run demo -- typosquat --wait --keep-alive

Levanta todo y SE DETIENE esperando Enter. Empieza a grabar primero, y
presiona Enter con la cámara corriendo: así el video abre con un incidente en
vivo y no con los logs de arranque de Kafka.

Tomas necesarias, en orden:

  0:00-0:30  La UI poblada. Plano general del panel.
  0:30-1:15  Terminal: detecciones apareciendo con evidencia y peso.
  1:15-2:15  ZOOM a la línea "investigating:" — es el momento clave. Luego el
             render y la respuesta de VisionPsy. El riesgo sube de 64 a 89.
  2:15-3:00  Clic en un incidente con cámara. Se abre la captura del sitio
             falso junto a la evidencia DNS. Plano cerrado.
  3:00-3:30  Pulsa "Explicar con QVAC". GRABA LA ESPERA COMPLETA de ~5
             segundos y la respuesta que aparece. Esos segundos son el
             argumento: es un modelo en esta máquina, no una API que
             respondería en 300 ms.
  3:30-4:05  Scroll a QoE y correlación: dos sedes, veredictos opuestos.
  4:05-4:40  ZOOM al panel de zero-egress: 0 conexiones bloqueadas, 0
             endpoints de nube, 0 capturas subidas.
  4:40-5:00  ACTIVA MODO AVIÓN en cámara y vuelve a correr el demo. Funciona
             igual. Toma de cierre.

── DIFERENCIA EN WINDOWS ────────────────────────────────────────────────────

NO uses scripts/verify-zero-egress.sh. Usa lsof, que no existe en Windows.
La prueba en cámara es el panel de la UI más la toma del modo avión. El guard
que bloquea sockets sí funciona igual en Windows — es el mismo código.

── REGLAS ───────────────────────────────────────────────────────────────────

- No aceleres el video. Los 5 segundos por explicación son parte del
  argumento: corre local, no en la nube.
- No narres mientras grabas. La voz se añade después.
- Guarda los clips sin editar. La edición va aparte.
```

---

## PARTE B — Editar con Hyperframes

```
Ya tienes los clips. Ahora edita. El objetivo es un video de EXACTAMENTE
5 minutos o menos. Si te pasas, el jurado corta donde sea.

── ORDEN DE LOS CORTES ──────────────────────────────────────────────────────

  1. 0:00–0:22   Panel general de la UI. Estático, sin movimiento de cámara.
  2. 0:22–1:05   Terminal: detecciones apareciendo. Acelera SOLO los espacios
                 muertos entre detecciones, nunca el texto que se lee.
  3. 1:05–2:00   La línea "investigating:". ZOOM al 140% sobre esa línea y
                 mantenlo mientras se lee. Luego el render y VisionPsy.
  4. 2:00–2:45   Corte a la UI. Clic en el incidente con cámara. La captura
                 del sitio falso ocupa el encuadre.
  5. 2:45–3:20   El botón "Explicar con QVAC". DEJA LA ESPERA COMPLETA de
                 ~5 segundos. No la cortes: es el argumento.
  6. 3:20–4:00   QoE y correlación SOC/NOC. ZOOM a los dos veredictos
                 opuestos, lado a lado si se puede.
  7. 4:00–4:35   Panel de zero-egress. ZOOM a los ceros.
  8. 4:35–5:00   Modo avión activándose, y el demo corriendo igual.

── REGLAS DE EDICIÓN ────────────────────────────────────────────────────────

- NO aceleres ningún texto que el espectador deba leer.
- NO aceleres la espera de la inferencia. Esos 5 segundos prueban que el
  modelo corre en la máquina.
- Cortes duros entre secciones. Sin transiciones de fantasía.
- Si haces zoom, que sea lento y sostenido, no un salto.
- Sin música. La voz y el texto en pantalla bastan.
- Resolución final 1920x1080, 30fps, H.264, bajo 100 MB si se puede.

── RÓTULOS EN PANTALLA ──────────────────────────────────────────────────────

Texto sobrio, esquina inferior izquierda, mismo tipo en todos:

  0:22   Detección determinista · cuatro motores
  1:05   El sistema decide que le falta evidencia
  2:00   Evidencia visual, capturada y analizada en esta máquina
  2:45   Modelo local · MedPsy-4B · sin conexión a la nube
  3:20   Seguridad y operaciones en un solo contexto
  4:00   Cero egress, verificado
  4:35   Sin red

── PARTE C: VOZ — NO LA GENERES TÚ ──────────────────────────────────────────

El equipo genera el audio aparte y te lo entrega. Tu trabajo es SOLO
sincronizarlo. No abras Google AI Studio ni intentes producir la voz.

Recibirás ocho archivos de audio numerados, uno por segmento. Cada uno
corresponde a un tramo del video:

  01  →  0:00   apertura
  02  →  0:30   detección
  03  →  1:05   el sistema decide investigar
  04  →  2:10   evidencia visual en la UI
  05  →  2:45   la espera de la inferencia
  06  →  3:20   correlación SOC/NOC
  07  →  4:00   zero-egress
  08  →  4:45   cierre

Reglas de sincronización:

- Si un segmento de voz es MÁS LARGO que su toma, ALARGA la toma: congela el
  último fotograma o extiende el plano. Nunca aceleres la voz.
- Si es MÁS CORTO, deja el silencio. Un respiro antes del siguiente corte se
  ve bien; una voz atropellada no.
- La voz no debe sonar encima de ningún momento donde el espectador tenga que
  leer texto en pantalla. Si choca, mueve el corte, no la voz.
- Si el total pasa de 5:00, avisa ANTES de exportar. No recortes el guion por
  tu cuenta.
```

---

## Guion narrado

Español neutro, tono calmado. Unas 730 palabras, que a ritmo normal dan
alrededor de 4:50 — deja margen.

> **[0:00]** La telemetría DNS de un banco revela más de lo que parece. Qué
> aplicaciones usa cada área, cómo se comporta cada endpoint, la estructura
> interna de la organización. Para una institución regulada, incluso una
> representación derivada de ese tráfico es información sensible.
>
> **[0:15]** Y eso vuelve inutilizable el camino habitual: mandar la telemetría
> a una API en la nube para que un modelo la analice. RACS Intelligence hace lo
> contrario. Todo ocurre aquí.
>
> **[0:30]** Esto es tráfico DNS de la red de un banco: la casa matriz, las
> sucursales, la banca en línea, la red de cajeros. Cuatro motores deterministas
> lo analizan en tiempo real y detectan dominios generados por algoritmo,
> tunneling, beaconing y suplantación de marca.
>
> **[0:50]** Cada detección trae su evidencia y el peso de cada pieza. El
> puntaje no es un porcentaje que salió de un modelo: es la suma de estas
> piezas, y cualquiera puede auditarla.
>
> **[1:05]** Aquí está la diferencia. El sistema encontró un dominio que imita
> a un banco. Riesgo sesenta y cuatro. Un detector normal dispara la alerta y
> termina.
>
> **[1:20]** Este decide que **le falta evidencia** — y explica por qué: el
> nombre por sí solo no distingue un dominio aparcado de una página viva de
> robo de credenciales. Así que va a buscarla.
>
> **[1:35]** Abre un navegador aislado, sin credenciales y sin almacenamiento,
> con la navegación anclada al dominio. Fotografía la página. Y un segundo
> modelo, de visión, analiza esa captura. También aquí.
>
> **[1:55]** Confirma el formulario de credenciales y el lenguaje de urgencia.
> El riesgo sube de sesenta y cuatro a ochenta y nueve. La captura nunca salió
> de esta máquina.
>
> **[2:10]** Esto es lo que ve el analista: la página falsa que el sistema
> encontró, al lado de la evidencia DNS que la delató.
>
> **[2:30]** Y puede pedirle al modelo local que lo explique.
>
> **[2:45]** Fíjense en la espera. Cinco segundos. Eso es un modelo de cuatro
> mil millones de parámetros corriendo en esta computadora. Una API en la nube
> respondería en trescientos milisegundos — y se habría llevado los datos.
>
> **[3:05]** El modelo explica la evidencia. Nunca la inventa, y nunca toca el
> puntaje.
>
> **[3:20]** RACS también responde la pregunta de las dos de la mañana: ¿el DNS
> está lento porque el resolver sufre, o porque algo en la red se está portando
> mal?
>
> **[3:35]** Misma ventana de tiempo, dos sedes, veredictos opuestos. La
> sucursal tiene un problema de infraestructura. La casa matriz tiene un
> problema de seguridad, y el sistema muestra qué hallazgos lo explican.
>
> **[3:50]** Nunca dice *causado*. Dice *correlacionado*. Hay una prueba
> automatizada que falla si el sistema afirma causalidad.
>
> **[4:00]** Y el cero egress no es una frase del README. Hay un guard que
> bloquea cualquier conexión no local, una verificación a nivel de sistema
> operativo, y cero SDKs de nube instalados.
>
> **[4:20]** Cero endpoints de inferencia en la nube. Cero eventos DNS
> subidos. Cero capturas subidas.
>
> **[4:35]** No decimos que sea un air gap. La máquina tiene red. Simplemente
> no la usamos.
>
> **[4:45]** Y esta es la prueba que no requiere que nos crean nada.
>
> **[4:52]** RACS Intelligence. Sus datos. Su perímetro.

---

## Configuración para Google AI Studio — la hace el equipo, no Astra

**Dónde:** AI Studio → Speech (o Vertex AI Studio → Media Studio → Speech).

| Ajuste | Valor |
|---|---|
| Modelo | Gemini 3.1 Flash TTS — o 2.5 Pro TTS si prefieren más calidad y les sobra tiempo |
| Idioma | Español (latinoamericano / neutro) |
| Voz | Una voz **masculina o femenina grave, adulta**. Prueben dos o tres y quédense con la menos "locutor de radio" |
| Salida | WAV o MP3, la calidad más alta disponible |

**Instrucción de estilo** — péguenla en el campo de *style instructions*:

```
Lee esto como un ingeniero de seguridad presentando su trabajo a colegas
técnicos. Tono calmado, seguro y sin énfasis publicitario. Ritmo pausado,
con pausas naturales en los puntos. No subas la entonación al final de las
frases. No suenes entusiasta ni comercial: el contenido es serio y se
sostiene solo.
```

### Guion, segmento por segmento

Generen **ocho audios separados**, uno por bloque. Es más fácil de sincronizar
que un archivo largo, y si uno sale mal solo se regenera ese.

> No incluyan los títulos ni los números — solo el texto de cada bloque.

**01 — apertura**
```
La telemetría DNS de un banco revela más de lo que parece. Qué aplicaciones usa cada área, cómo se comporta cada endpoint, la estructura interna de la organización. Para una institución regulada, incluso una representación derivada de ese tráfico es información sensible. Y eso vuelve inutilizable el camino habitual: mandar la telemetría a una API en la nube para que un modelo la analice. RACS Intelligence hace lo contrario. Todo ocurre aquí.
```

**02 — detección**
```
Esto es tráfico DNS de la red de un banco: la casa matriz, las sucursales, la banca en línea, la red de cajeros. Cuatro motores deterministas lo analizan en tiempo real y detectan dominios generados por algoritmo, tunneling, beaconing y suplantación de marca. Cada detección trae su evidencia y el peso de cada pieza. El puntaje no es un porcentaje que salió de un modelo: es la suma de estas piezas, y cualquiera puede auditarla.
```

**03 — decide investigar**
```
Aquí está la diferencia. El sistema encontró un dominio que imita a un banco. Riesgo sesenta y cuatro. Un detector normal dispara la alerta y termina. Este decide que le falta evidencia, y explica por qué: el nombre por sí solo no distingue un dominio aparcado de una página viva de robo de credenciales. Así que va a buscarla. Abre un navegador aislado, sin credenciales y sin almacenamiento, con la navegación anclada al dominio. Fotografía la página. Y un segundo modelo, de visión, analiza esa captura. También aquí. Confirma el formulario de credenciales y el lenguaje de urgencia. El riesgo sube de sesenta y cuatro a ochenta y nueve. La captura nunca salió de esta máquina.
```

**04 — evidencia en la UI**
```
Esto es lo que ve el analista: la página falsa que el sistema encontró, al lado de la evidencia DNS que la delató. Y puede pedirle al modelo local que lo explique.
```

**05 — la espera**
```
Fíjense en la espera. Cinco segundos. Eso es un modelo de cuatro mil millones de parámetros corriendo en esta computadora. Una API en la nube respondería en trescientos milisegundos, y se habría llevado los datos. El modelo explica la evidencia. Nunca la inventa, y nunca toca el puntaje.
```

**06 — correlación**
```
RACS también responde la pregunta de las dos de la mañana: ¿el DNS está lento porque el resolver sufre, o porque algo en la red se está portando mal? Misma ventana de tiempo, dos sedes, veredictos opuestos. La sucursal tiene un problema de infraestructura. La casa matriz tiene un problema de seguridad, y el sistema muestra qué hallazgos lo explican. Nunca dice causado. Dice correlacionado. Hay una prueba automatizada que falla si el sistema afirma causalidad.
```

**07 — zero-egress**
```
Y el cero egress no es una frase del README. Hay un guard que bloquea cualquier conexión no local, una verificación a nivel de sistema operativo, y cero kits de desarrollo de nube instalados. Cero endpoints de inferencia en la nube. Cero eventos DNS subidos. Cero capturas subidas.
```

**08 — cierre**
```
No decimos que sea un air gap. La máquina tiene red. Simplemente no la usamos. Y esta es la prueba que no requiere que nos crean nada. RACS Intelligence. Sus datos. Su perímetro.
```

### Antes de entregarle los audios a Astra

- Escúchenlos completos. Si una cifra suena mal leída, regeneren ese bloque.
- Nómbrenlos `01.wav` … `08.wav` para que el orden sea obvio.
- Si el total pasa de 4:50, recorten del guion en vez de acelerar la voz.

---

## Notas

- **No incluir Grafana.** Tercera superficie que no aporta nada que la UI no
  muestre, y en cinco minutos cada segundo cuenta.
- **MedPsy es de 4B y ocasionalmente mezcla idiomas.** Si sale un carácter
  raro en cámara, repetir la toma. No es un bug del código.
- **Limpiar `dns_incidents` antes de grabar**, o quedan explicaciones viejas
  en inglés de corridas anteriores.

## Cambios recientes que afectan la grabación

| PR | Qué cambió |
|---|---|
| #33 | Los incidentes investigados ya se guardan — antes se perdían todos |
| #32 | El traductor descartaba lotes; añadido `npm run audit:i18n` |
| #31 | El analista QVAC responde en español |
| #29 | El botón «Explicar con QVAC» ya no depende del agente |
| #28 | Barra lateral deslizable, logotipo sin recorte |

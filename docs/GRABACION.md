# Guion de grabación — RACS Intelligence

Dos bloques. **El primero se copia entero y se le pega a Astra.** El segundo es
para ustedes: la configuración de voz y el texto que va en Google AI Studio.

Documento vivo — si aparece otro bug antes de grabar, edítalo aquí.

---

## 1 · Para Astra — copiar todo lo de abajo

```
Vas a grabar y editar el video de demostración de un proyecto de hackathon.
Máximo 5 minutos. Trabajas en Windows con PowerShell.

Si algo falla, PARA y repórtame el error exacto. No improvises ni grabes un
demo roto. No generes la voz: el equipo te entregará los audios.

═══ TU INTERFAZ NO DEBE APARECER ═══════════════════════════════════════════

Configura la grabación para capturar ÚNICAMENTE dos fuentes de ventana:
  - la ventana de PowerShell
  - la ventana del navegador en 127.0.0.1:3001

Nada de "pantalla completa". Tú ejecutas los comandos desde donde estés, pero
lo que se graba son esas dos ventanas y nada más.

Razón: el producto demuestra que ninguna IA en la nube toca los datos. Tu
interfaz en pantalla contradice eso visualmente.

═══ PASO 1 · TRAER LA ÚLTIMA VERSIÓN ═══════════════════════════════════════

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

El repo se renombró. Si tu remoto apunta todavía a "sovereign-sentinel":
  git remote set-url origin https://github.com/Silentarcherjr/racs-intelligence.git

Verifica que estés al día:
  git log --oneline -3

═══ PASO 2 · LEVANTAR EL ENTORNO ═══════════════════════════════════════════

Docker Desktop debe estar abierto y diciendo "Engine running".

  docker compose up -d
  docker compose ps          → espera "healthy" en clickhouse y kafka
  npm run bootstrap          → debe terminar en "Ready."

Limpia la base para que la pantalla arranque vacía:

  curl.exe -s --data-binary "TRUNCATE TABLE sentinel.dns_incidents" `
    -H "X-ClickHouse-User: sentinel" -H "X-ClickHouse-Key: sentinel" `
    http://127.0.0.1:8123/

Mata cualquier interfaz que haya quedado corriendo de antes. ESTO IMPORTA: si
un proceso viejo sigue ocupando el 3001, el nuevo falla en silencio por puerto
ocupado y el viejo sigue sirviendo el build ANTERIOR al git pull. Los síntomas
son endpoints que "no existen" y texto sin traducir:

  Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

Ahora levanta la interfaz:

  Start-Process npm -ArgumentList "start","-w","@sentinel/analyst-ui"

Espera 5 segundos y comprueba que sea el build NUEVO:

  Invoke-RestMethod http://127.0.0.1:3001/api/capabilities

Debe devolver algo como  textModel : True.  Si devuelve "Not found", estás
hablando con un proceso viejo: vuelve a matar el 3001 y repite.

═══ PASO 3 · CALENTAMIENTO — NO GRABAR ═════════════════════════════════════

  npm run demo -- typosquat

Déjala terminar completa (~2 min). Carga los modelos en memoria. Si grabas en
frío, el video tiene 15 segundos muertos esperando al modelo.

Vuelve a limpiar dns_incidents con el mismo comando del paso 2.

═══ PASO 4 · SIETE VERIFICACIONES OBLIGATORIAS ═════════════════════════════

Comprueba CADA UNA. Si alguna falla, PARA y repórtala. No grabes hasta que
las siete pasen.

1. docker compose ps
   → clickhouse y kafka deben decir "healthy". No "starting", no "unhealthy".

2. npm run bootstrap
   → debe terminar con la palabra "Ready." Si hay algún ✗, para.

3. Invoke-RestMethod http://127.0.0.1:3001/api/capabilities
   → debe responder textModel. Si dice "Not found", hay un proceso viejo en el
     3001 sirviendo un build anterior: mátalo y relanza la interfaz.

4. Abre http://127.0.0.1:3001
   → el panel de inteligencia local debe mostrar el modelo de texto y el de
     visión como cargado o disponible. Si dice "no disponible", faltan las
     pesas: para y avisa.

5. La interfaz debe estar EN ESPAÑOL. Si ves texto en inglés en títulos o
   botones, para y repórtalo — es un bug, no una configuración.

6. Tras el calentamiento, la tabla de incidentes debe tener AL MENOS 3 filas,
   y al menos una con el ícono de cámara. Si sale vacía o sin cámara, para.

7. Haz clic en un incidente con cámara.
   → debe abrirse la captura de un sitio bancario falso
   → el botón "Explicar con QVAC" debe estar ACTIVO, no gris
   → púlsalo: en ~5 segundos debe aparecer un análisis EN ESPAÑOL

Solo si las siete pasan, limpia la base y empieza a grabar.

═══ PASO 5 · PREPARAR LAS TOMAS ════════════════════════════════════════════

Dos ventanas lado a lado:
  IZQUIERDA  PowerShell
  DERECHA    navegador en http://127.0.0.1:3001

NO abras Grafana. Dispersa la atención y no muestra nada que la UI no tenga.

Graba con OBS, o con Xbox Game Bar (Win+G). 1920x1080, 30fps. Si dominas otra
forma mejor, úsala — pero respeta la regla de capturar solo esas dos ventanas.

═══ PASO 6 · GRABAR ════════════════════════════════════════════════════════

  npm run demo -- typosquat --wait --keep-alive

Levanta todo y SE DETIENE esperando Enter. Empieza a grabar primero, y
presiona Enter con la cámara corriendo: así el video abre con un incidente en
vivo y no con los logs de arranque de Kafka.

Tomas necesarias, en orden:

  0:00-0:30  La UI poblada. Plano general del panel.
  0:30-1:05  Terminal: detecciones apareciendo con evidencia y peso.
  1:05-2:00  ZOOM a la línea "investigating:" — es el momento clave. Luego el
             render y la respuesta del modelo de visión. El riesgo sube de
             64 a 89.
  2:00-2:45  Clic en un incidente con cámara. Se abre la captura del sitio
             falso junto a la evidencia DNS. Plano cerrado.
  2:45-3:20  Pulsa "Explicar con QVAC". GRABA LA ESPERA COMPLETA de ~5
             segundos y la respuesta que aparece.
  3:20-4:00  Scroll a QoE y correlación: dos sedes, veredictos opuestos.
  4:00-4:35  ZOOM al panel de zero-egress: 0 conexiones bloqueadas, 0
             endpoints de nube, 0 capturas subidas.
  4:35-5:00  ACTIVA MODO AVIÓN en cámara y vuelve a correr el demo. Funciona
             igual. Toma de cierre.

Guarda los clips sin editar antes de pasar a la edición.

═══ PASO 7 · EDITAR CON HYPERFRAMES ════════════════════════════════════════

Objetivo: EXACTAMENTE 5 minutos o menos. Si te pasas, el jurado corta donde
sea.

Orden de los cortes:

  1. 0:00–0:22   Panel general de la UI. Estático, sin movimiento de cámara.
  2. 0:22–1:05   Terminal: detecciones. Acelera SOLO los espacios muertos
                 entre detecciones, nunca el texto que se lee.
  3. 1:05–2:00   La línea "investigating:". ZOOM al 140% y mantenlo mientras
                 se lee. Luego el render y el análisis visual.
  4. 2:00–2:45   La UI. Clic en el incidente con cámara. La captura del sitio
                 falso ocupa el encuadre.
  5. 2:45–3:20   El botón "Explicar con QVAC". DEJA LA ESPERA COMPLETA.
  6. 3:20–4:00   QoE y correlación. ZOOM a los dos veredictos opuestos.
  7. 4:00–4:35   Panel de zero-egress. ZOOM a los ceros.
  8. 4:35–5:00   Modo avión activándose, y el demo corriendo igual.

Reglas que no se rompen:

- NO aceleres ningún texto que el espectador deba leer.
- NO cortes la espera de la inferencia. Esos 5 segundos son el argumento:
  una API en la nube respondería en 300 ms y se habría llevado los datos.
- Cortes duros entre secciones. Sin transiciones de fantasía.
- Si haces zoom, lento y sostenido, no un salto.
- Sin música. La voz y el texto en pantalla bastan.
- Exporta 1920x1080, 30fps, H.264, bajo 100 MB si se puede.

Rótulos en pantalla, sobrios, esquina inferior izquierda, mismo tipo:

  0:22   Detección determinista · cuatro motores
  1:05   El sistema decide que le falta evidencia
  2:00   Evidencia visual, capturada y analizada en esta máquina
  2:45   Modelo local · MedPsy-4B · sin conexión a la nube
  3:20   Seguridad y operaciones en un solo contexto
  4:00   Cero egress, verificado
  4:35   Sin red

═══ PASO 8 · SINCRONIZAR LA VOZ ════════════════════════════════════════════

El equipo te entrega ocho audios numerados. Tú NO los generas.

  01 → 0:00   apertura
  02 → 0:30   detección
  03 → 1:05   el sistema decide investigar
  04 → 2:10   evidencia visual en la UI
  05 → 2:45   la espera de la inferencia
  06 → 3:20   correlación SOC/NOC
  07 → 4:00   zero-egress
  08 → 4:45   cierre

Reglas:

- Si un audio es MÁS LARGO que su toma, ALARGA la toma: congela el último
  fotograma o extiende el plano. Nunca aceleres la voz.
- Si es MÁS CORTO, deja el silencio. Un respiro antes del corte se ve bien;
  una voz atropellada no.
- La voz no debe sonar encima de un momento donde haya que leer texto en
  pantalla. Si choca, mueve el corte, no la voz.
- Si el total pasa de 5:00, avisa ANTES de exportar. No recortes el guion por
  tu cuenta.

═══ DIFERENCIA EN WINDOWS ══════════════════════════════════════════════════

NO uses scripts/verify-zero-egress.sh. Usa lsof, que no existe en Windows.
La prueba en cámara es el panel de la UI más la toma del modo avión. El guard
que bloquea sockets sí funciona igual en Windows — es el mismo código.

═══ AVISOS ════════════════════════════════════════════════════════════════

- El modelo de texto es de 4B y ocasionalmente mezcla idiomas. Si aparece un
  carácter raro en cámara, repite la toma. No es un bug del código.
- Limpia dns_incidents antes de grabar o quedarán explicaciones viejas en
  inglés de corridas anteriores.
```

---

## 2 · Para el equipo — la voz

**Dónde:** Google AI Studio → Speech (o Vertex AI Studio → Media Studio → Speech).

| Ajuste | Valor |
|---|---|
| Modelo | Gemini 3.1 Flash TTS — o 2.5 Pro TTS si prefieren más calidad y sobra tiempo |
| Idioma | Español latinoamericano / neutro |
| Voz | Grave, adulta. Prueben dos o tres y quédense con la menos "locutor de radio" |
| Salida | WAV o MP3, máxima calidad |

**Instrucción de estilo** — al campo de *style instructions*:

```
Lee esto como un ingeniero de seguridad presentando su trabajo a colegas
técnicos. Tono calmado, seguro y sin énfasis publicitario. Ritmo pausado,
con pausas naturales en los puntos. No subas la entonación al final de las
frases. No suenes entusiasta ni comercial: el contenido es serio y se
sostiene solo.
```

Generen **ocho audios separados**, uno por bloque. Nómbrenlos `01.wav` … `08.wav`.

**01**
```
La telemetría DNS de un banco revela más de lo que parece. Qué aplicaciones usa cada área, cómo se comporta cada endpoint, la estructura interna de la organización. Para una institución regulada, incluso una representación derivada de ese tráfico es información sensible. Y eso vuelve inutilizable el camino habitual: mandar la telemetría a una API en la nube para que un modelo la analice. RACS Intelligence hace lo contrario. Todo ocurre aquí.
```

**02**
```
Esto es tráfico DNS de la red de un banco: la casa matriz, las sucursales, la banca en línea, la red de cajeros. Cuatro motores deterministas lo analizan en tiempo real y detectan dominios generados por algoritmo, tunneling, beaconing y suplantación de marca. Cada detección trae su evidencia y el peso de cada pieza. El puntaje no es un porcentaje que salió de un modelo: es la suma de estas piezas, y cualquiera puede auditarla.
```

**03**
```
Aquí está la diferencia. El sistema encontró un dominio que imita a un banco. Riesgo sesenta y cuatro. Un detector normal dispara la alerta y termina. Este decide que le falta evidencia, y explica por qué: el nombre por sí solo no distingue un dominio aparcado de una página viva de robo de credenciales. Así que va a buscarla. Abre un navegador aislado, sin credenciales y sin almacenamiento, con la navegación anclada al dominio. Fotografía la página. Y un segundo modelo, de visión, analiza esa captura. También aquí. Confirma el formulario de credenciales y el lenguaje de urgencia. El riesgo sube de sesenta y cuatro a ochenta y nueve. La captura nunca salió de esta máquina.
```

**04**
```
Esto es lo que ve el analista: la página falsa que el sistema encontró, al lado de la evidencia DNS que la delató. Y puede pedirle al modelo local que lo explique.
```

**05**
```
Fíjense en la espera. Cinco segundos. Eso es un modelo de cuatro mil millones de parámetros corriendo en esta computadora. Una API en la nube respondería en trescientos milisegundos, y se habría llevado los datos. El modelo explica la evidencia. Nunca la inventa, y nunca toca el puntaje.
```

**06**
```
RACS también responde la pregunta de las dos de la mañana: ¿el DNS está lento porque el resolver sufre, o porque algo en la red se está portando mal? Misma ventana de tiempo, dos sedes, veredictos opuestos. La sucursal tiene un problema de infraestructura. La casa matriz tiene un problema de seguridad, y el sistema muestra qué hallazgos lo explican. Nunca dice causado. Dice correlacionado. Hay una prueba automatizada que falla si el sistema afirma causalidad.
```

**07**
```
Y el cero egress no es una frase del README. Hay un guard que bloquea cualquier conexión no local, una verificación a nivel de sistema operativo, y cero kits de desarrollo de nube instalados. Cero endpoints de inferencia en la nube. Cero eventos DNS subidos. Cero capturas subidas.
```

**08**
```
No decimos que sea un air gap. La máquina tiene red. Simplemente no la usamos. Y esta es la prueba que no requiere que nos crean nada. RACS Intelligence. Sus datos. Su perímetro.
```

Escúchenlos completos antes de entregárselos a Astra. Si una cifra suena mal
leída, regeneren ese bloque. Si el total pasa de 4:50, recorten del guion en
vez de acelerar la voz.

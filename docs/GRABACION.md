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

## Notas para quien edita después

- **Voz:** generar con el modelo de Google AI Studio, sobre el guion narrado.
  Deja el guion cerrado antes de generar audio — sincronizar voz contra tomas
  ya cortadas es más fácil que al revés.
- **Edición:** hyperframes.
- **No incluir Grafana.** Es una tercera superficie que no aporta nada que la
  UI no muestre ya, y en cinco minutos cada segundo cuenta.

## Cambios recientes que afectan la grabación

| PR | Qué cambió |
|---|---|
| #31 | El analista QVAC responde en español, y VisionPsy también |
| #30 | Se tradujo el detalle del incidente y las acciones recomendadas |
| #29 | El botón "Explicar con QVAC" ya no depende de que el agente corra |
| #28 | Barra lateral deslizable, logotipo sin recorte |

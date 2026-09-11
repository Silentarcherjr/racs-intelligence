# Voz para el video de 3:05

El guion anterior estaba escrito para cinco minutos. El video real dura 3:05,
así que este lo reemplaza: **cinco bloques, ~430 palabras**, que a ritmo normal
dan unos 2:55 y dejan aire.

## Configuración en Google AI Studio → Speech

| Ajuste | Valor |
|---|---|
| Modelo | Gemini 3.1 Flash TTS |
| Idioma | Español latinoamericano / neutro |
| Voz | Grave, adulta. La menos "locutor de radio" de las que prueben |
| Salida | WAV, máxima calidad |

**Instrucción de estilo:**

```
Lee esto como un ingeniero de seguridad presentando su trabajo a colegas
técnicos. Tono calmado, seguro y sin énfasis publicitario. Ritmo pausado,
con pausas naturales en los puntos. No subas la entonación al final de las
frases. No suenes entusiasta ni comercial: el contenido es serio y se
sostiene solo.
```

## Los cinco bloques

Generen uno por archivo: `01.wav` … `05.wav`.

**01 · apertura y detección** — entra sobre el plano general, ~0:00

```
La telemetría DNS de un banco revela más de lo que parece: qué aplicaciones usa cada área, cómo se comporta cada endpoint, la estructura interna de la organización. Para una institución regulada, incluso una representación derivada de ese tráfico es información sensible. Y eso vuelve inutilizable el camino habitual, que es mandarla a una API en la nube. RACS Intelligence hace lo contrario: todo ocurre aquí. Cuatro motores deterministas analizan el flujo en tiempo real y detectan dominios generados por algoritmo, tunneling, beaconing y suplantación de marca. Cada detección trae su evidencia y el peso de cada pieza. El puntaje no es un porcentaje que salió de un modelo: es la suma de esas piezas, y cualquiera puede auditarla.
```

**02 · la decisión de investigar** — entra en la línea «investigating:»

```
Aquí está la diferencia. El sistema encontró un dominio que imita a un banco. Un detector normal dispara la alerta y termina. Este decide que le falta evidencia, y explica por qué: el nombre por sí solo no distingue un dominio aparcado de una página viva de robo de credenciales. Así que va a buscarla. Abre un navegador aislado, sin credenciales y sin almacenamiento, fotografía la página, y un segundo modelo, de visión, analiza esa captura. También aquí. El riesgo sube, y la captura nunca salió de esta máquina.
```

**03 · la evidencia visual** — entra al abrir el incidente con la captura

```
Esto es lo que ve el analista: la página falsa que el sistema encontró, al lado de la evidencia DNS que la delató.
```

**04 · la inferencia local** — entra al pulsar «Explicar con QVAC»

```
Y puede pedirle al modelo local que lo explique. Fíjense en la espera: son segundos, no milisegundos. Eso es un modelo de cuatro mil millones de parámetros corriendo en esta computadora. Una API en la nube habría respondido más rápido, y se habría llevado los datos. El modelo explica la evidencia. Nunca la inventa, y nunca toca el puntaje.
```

**05 · cero egress y cierre** — entra sobre la prueba en terminal, ~2:42

```
Y el cero egress no es una frase del README. Cero endpoints de inferencia en la nube. Cero eventos DNS subidos. Cero capturas subidas. No decimos que sea un air gap: la máquina tiene red, simplemente no la usamos. RACS Intelligence. Sus datos. Su perímetro.
```

## Qué se recortó del guion de cinco minutos

- La correlación SOC/NOC entre sedes. **No está en las tomas grabadas**, así que
  narrarla sería describir algo que no se ve.
- El detalle de las tres capas de verificación de egress.
- La toma del modo avión.

Si más adelante se graban esas tomas, el guion largo sigue en
`docs/GRABACION.md`.

# Voz para el video final (racs-demo-v4.mp4, ~1:40 antes de ajustar ritmo)

Este reemplaza a `VOZ_3MIN.md` — ese guion era para el corte de 73s de la sesión
anterior, que solo mostraba typosquatting. El video actual (`racs-demo-v4.mp4`,
99.5s) muestra mucho más: variedad de detecciones, un ejemplo de evidencia
determinista, la investigación con VisionPsy, la explicación local con QVAC,
QoE + Grafana + correlación SOC/NOC, y la prueba de cero egress.

**Cómo seguimos desde aquí:** graben los 6 bloques por separado en Google AI
Studio. Cuando tengan los archivos de audio, díganme cuánto dura cada uno —
con eso alargo o hago más lento el segmento de video correspondiente
(`setpts` en ffmpeg, sin volver a grabar nada) para que quede sincronizado.
No hace falta que la narración caiga al milisegundo exacto: el video ya está
cortado en bloques claros, así que cuadrar por bloque es suficiente.

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

## Los seis bloques

Generen uno por archivo: `01.wav` … `06.wav`.

**01 · apertura y variedad de detección** — entra sobre el dashboard poblado,
con el donut mostrando varias categorías (typosquatting, DGA, tunneling)

```
La telemetría DNS de un banco revela más de lo que parece: qué aplicaciones usa cada área, cómo se comporta cada endpoint, la estructura interna de la organización. Para una institución regulada, incluso una representación derivada de ese tráfico es información sensible. Y eso vuelve inutilizable el camino habitual, que es mandarla a una API en la nube. RACS Intelligence hace lo contrario: todo ocurre aquí. Cuatro motores deterministas analizan el flujo en tiempo real: dominios generados por algoritmo, tunneling, beaconing y suplantación de marca. Cada uno con su propio peso, su propia evidencia.
```

**02 · un ejemplo determinista** — entra al abrir el incidente de tunneling
(o DGA), mostrando las tarjetas de evidencia

```
Miren un caso de tunneling. El sistema no dice simplemente "sospechoso": mide la longitud de cada subdominio, qué proporción de las consultas usa registros pensados para llevar datos y no direcciones, cuántos subdominios únicos hay, cuánta entropía tiene el nombre. Cuatro señales, cada una con su peso, sumadas en un puntaje que cualquiera puede auditar. El modelo no participa en este número. Lo explica después; no lo inventa.
```

**03 · la decisión de investigar** — entra al cerrar ese incidente y abrir el
de Banco Aurora

```
Aquí está la diferencia. El sistema encontró un dominio que imita a un banco. Un detector normal dispara la alerta y termina ahí. Este decide que le falta evidencia, y explica por qué: el nombre por sí solo no distingue un dominio aparcado de una página viva de robo de credenciales. Así que va a buscarla. Abre un navegador aislado, sin credenciales y sin almacenamiento, fotografía la página, y un segundo modelo, de visión, analiza esa captura. También aquí, todo local. El riesgo sube, y la captura nunca salió de esta máquina.
```

**04 · la inferencia local** — entra al pulsar «Explicar con QVAC» y durante
la espera real

```
Y puede pedirle al modelo local que lo explique. Fíjense en la espera: son segundos, no milisegundos. Eso es un modelo de cuatro mil millones de parámetros corriendo en esta computadora. Una API en la nube habría respondido más rápido, y se habría llevado los datos con ella. El modelo explica la evidencia que ya existe. Nunca la inventa, y nunca toca el puntaje.
```

**05 · QoE, correlación y Grafana** — entra al abrir Salud de la red, sigue
en el dashboard de Grafana

```
Esto no es solo seguridad: es también la experiencia de la red. El mismo sistema mide la calidad del servicio DNS por sede — latencia, tasa de fallos — y correlaciona esa degradación con los eventos de seguridad del mismo período. Cuando una sede se degrada al mismo tiempo que aparece una campaña activa, el sistema lo señala como correlación, nunca como causa probada. Y todo esto vive también en un panel de operaciones real, con los mismos números, para el equipo que no vive en la terminal.
```

**06 · cero egress y cierre** — entra sobre la terminal corriendo
`verify-zero-egress.sh`

```
Y el cero egress no es una frase del README. Cero endpoints de inferencia en la nube. Cero eventos DNS subidos. Cero capturas subidas. No decimos que sea un air gap: la máquina tiene red, simplemente no la usamos. RACS Intelligence. Sus datos. Su perímetro.
```

## Qué se dejó fuera

- El detalle de las tres capas de verificación de egress (guardia en proceso,
  chequeo de sistema operativo, prueba de Wi-Fi apagado) — se menciona la
  conclusión, no las tres capas, para no alargar el bloque 6.
- La toma real de apagar el Wi-Fi. `verify-zero-egress.sh` ya prueba el cero
  egress a nivel de sockets del sistema operativo; esa toma queda para si
  sobra tiempo.

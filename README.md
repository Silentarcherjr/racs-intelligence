# RACS Intelligence

> **Analista de seguridad DNS que detecta, investiga, correlaciona y explica
> incidentes enteramente dentro de la infraestructura del cliente.**

Decentralized AI Hackathon — Panamá 2026 · [English version](README.en.md)

---

## 1. Qué es

RACS Intelligence es un analista de seguridad DNS que corre localmente. Consume un flujo
de eventos en vivo, puntúa cuatro clases de amenaza con motores deterministas, calcula la
calidad de servicio DNS por sede, y le pide a un modelo de lenguaje **que corre en la
misma máquina** que explique la evidencia — sin enviar una sola consulta DNS, indicador
derivado, prompt o captura de pantalla a un proveedor en la nube.

Cuando la evidencia no alcanza para decidir, **va a buscar la que falta**: renderiza el
dominio sospechoso en un navegador aislado, fotografía la página y la analiza con un
modelo de visión local.

Y responde una pregunta que la mayoría de las herramientas DNS no puede: **¿la calidad
está cayendo porque el resolver sufre, o porque algo en la red se está portando mal?**

## 2. El problema

La telemetría DNS revela hábitos de navegación, aplicaciones internas, comportamiento de
endpoints, patrones de comando y control, y la estructura de una organización. Para un
banco, un ministerio o un hospital, incluso una representación *derivada* de ese tráfico
puede ser sensible — lo que vuelve inutilizable el pipeline habitual:

```
telemetría → API en la nube → modelo → resultado
```

Aquí se reemplaza por:

```
telemetría → features locales → inferencia QVAC local → evidencia local → acción local
```

## 3. Tracks

| Track | Estado |
|---|---|
| **04 — Ovnicom** | **Reclamado.** Todos los requisitos implementados y verificados. |
| **05 — Caja de Ahorros** | **Reclamado.** Ver el escenario bancario en §11. |
| **03 — Ranking General** | Reclamado. |
| **02 — QVAC Psy** | **Reclamado.** VisionPsy es central: el flujo de investigación visual está integrado y funcionando, con benchmarks medidos en §18. **No realizamos operaciones RAG** — declarado en §19. |

## 4. Arquitectura

```
  eventos DNS sintéticos
            │
          Kafka  (dns.events.raw, 3 particiones, con clave por IP de cliente)
            │
   ┌────────┴─────────┐
   ▼                  ▼
 feature-engine    qoe-engine ──── baselines por sede
   │                  │
   ▼                  ▼
 threat-engine     puntaje QoE ──┐
   │                             │
   ▼                             ▼
 Incidente ──────────────► correlación SOC/NOC
   │
   ├──► investigador activo → navegador aislado → VisionPsy → fusión de evidencia
   ├──► qvac-runtime  → MedPsy-4B explica la evidencia, en el dispositivo
   ├──► wazuh-adapter → alerta con toda la evidencia
   └──► clickhouse-adapter → Grafana
```

La detección es determinista y explicable. **El modelo explica la evidencia; nunca crea
ni modifica un puntaje de riesgo.** Cada número es una suma ponderada, y los pesos viajan
dentro de la alerta.

| Paquete | Responsabilidad |
|---|---|
| `dns-schema` | Tipos compartidos. Sin dependencias, a propósito. |
| `feature-engine` | Features léxicos y de comportamiento |
| `threat-engine` | DGA · typosquatting · tunneling · beaconing, y el puntaje |
| `qoe-engine` | QoE, baselines por sede, correlación SOC/NOC |
| `evidence-engine` | Selección de acción, sandbox del navegador, VisionPsy, fusión |
| `qvac-runtime` | Inferencia local vía `@qvac/sdk` |
| `wazuh-adapter` | Formato y entrega de alertas |
| `clickhouse-adapter` | Almacenamiento de QoE e incidentes |
| `egress-guard` | Bloquea cualquier socket no local |

## 5. Uso de QVAC

Toda la inferencia pasa por `@qvac/sdk` en el dispositivo. El modelo recibe evidencia
estructurada producida por los motores deterministas y devuelve JSON restringido por un
esquema, que se valida antes de usarse; si la validación falla, **el incidente se entrega
sin explicación** en lugar de con una sin validar.

El prompt de sistema son las siete reglas del spec §20 — nunca inventes evidencia, nunca
afirmes confirmación, usa lenguaje probabilístico, explica primero lo más importante,
recomienda solo pasos defensivos, no pidas servicios externos, devuelve JSON válido.

`reasoning_budget: 0` es obligatorio: MedPsy deriva de Qwen3 y, si razona libremente,
agota su presupuesto de tokens dentro de `<think>` y devuelve una respuesta vacía.

## 6. Modelos exactos

| Rol | Modelo |
|---|---|
| Analista de texto | `qvac/MedPsy-4B-GGUF` |
| Análisis visual | `qvac/VisionPsy-Nano-460M-Flash-GGUFs` |

**Algo que preferimos decir a que se descubra:** MedPsy está afinado para uso clínico. De
los 25 modelos publicados por QVAC, es el único modelo instruct de texto usable — la
familia Genesis produce salida inservible, AfriSLM y TranslateNano son de traducción, y
Fabric es un LoRA biomédico. Por debajo es Qwen3 y sigue bien el prompt restringido, pero
no fue entrenado para seguridad. Explica evidencia; no decide nada.

## 7. Cuantizaciones exactas

| Modelo | Cuantización | Archivo |
|---|---|---|
| MedPsy-4B | `q4_k_m-imat` | `medpsy-4b-q4_k_m-imat.gguf` (2.5 GB) |
| VisionPsy-Flash | `q4_k_m-imat` + mmproj `q8` | `visionpsy-nano-460m-flash-q4_k_m-imat.gguf` (393 MB) |

## 8. Hardware

Apple M1 Max, 32 GB de memoria unificada, macOS 15. Inferencia en GPU vía Metal.
Verificado también en Windows x64 con Docker Desktop.

## 9. Instalación

```bash
git clone https://github.com/Silentarcherjr/racs-intelligence.git
cd racs-intelligence
npm install && npm run build

cp .env.example .env
docker compose up -d          # kafka, clickhouse, grafana
npm run bootstrap             # verifica requisitos y aplica el esquema
```

Verificado en colima 0.10.3 / Docker 29.5.2 en Apple Silicon, y en Windows con Docker
Desktop. En macOS sin Docker Desktop, `brew install colima docker docker-compose && colima start`
funciona y no necesita interfaz gráfica.

**Las pesas de los modelos nunca se descargan en tiempo de ejecución.** Bájalas una vez,
por adelantado, y apunta `QVAC_MODELS_DIR` al directorio que contiene
`medpsy-4b-q4_k_m-imat.gguf`. Sin ellas el pipeline corre igual; los incidentes
simplemente no llevan texto del analista.

### Investigación visual (opcional)

```bash
npx playwright install chromium
```

Coloca `visionpsy-nano-460m-flash-q4_k_m-imat.gguf` y
`mmproj-visionpsy-nano-460m-flash-q8.gguf` (393 MB juntos) en un directorio y apunta
`QVAC_VISION_MODELS_DIR` ahí.

## 10. Ejecución

```bash
npm run demo                       # pipeline completo sobre el fixture
npm run demo -- typosquat          # un escenario a la vez
npm run demo -- typosquat --wait   # levanta todo y espera Enter
npm run demo -- live               # flujo continuo
npm test                           # 21 pruebas de regresión
```

Funcionan en **macOS, Linux y Windows** — son scripts de Node, así que Windows no
necesita WSL ni Git Bash. `scripts/verify-zero-egress.sh` es la excepción: usa `lsof`,
que no tiene equivalente en Windows que valga la pena fingir.

### Verlo funcionar

| | | |
|---|---|---|
| **Analyst UI** | <http://127.0.0.1:3001> | Incidentes con toda su evidencia, la captura del sandbox, QoE por sede, veredicto SOC/NOC, y un panel del runtime local en vivo. Se refresca cada 4 s. |
| **Grafana** | <http://127.0.0.1:3000> | Diez paneles, refresco cada 10 s. |

## 11. Escenarios de demo

`npm run demo` reproduce 66 eventos y produce, idénticamente en cada corrida:

| Riesgo | Clasificación | Evidencia |
|---|---|---|
| 90 | Tunneling DNS | Subdominios codificados de 48 caracteres, 100% TXT/NULL, sin caché |
| 80 | Typosquatting | `micr0soft-secure-login.example`, homoglifo, dos sedes |
| 75 | DGA | 10 nombres únicos, 100% NXDOMAIN, 3.66 bits de entropía |
| 65 | Beaconing | Coeficiente de variación 0.000 con cadencia de 60 s |
| 60 / 35 | Typosquatting | `app1e-id-verify`, `banes-co-panama` |

Y la correlación que une seguridad con operaciones:

```
pa-branch-01  QoE 45  LIKELY_OPERATIONAL      ningún hallazgo lo explica
pa-hq         QoE 59  LIKELY_SECURITY_DRIVEN  DGA + tunneling explican el 100%
```

**Escenario bancario (Track 05).** `npm run demo -- typosquat` genera dominios que imitan
marcas bancarias. El investigador decide que el nombre por sí solo no distingue un dominio
aparcado de una página viva de robo de credenciales, renderiza el sitio en un navegador
aislado, y VisionPsy confirma el formulario de credenciales y el lenguaje de urgencia. El
riesgo sube de 64 a 89 — y el tráfico DNS que lo reveló nunca sale del banco.

## 12. Zero-egress

Demostrado de tres formas, no afirmado una vez. Ver [`docs/ZERO_EGRESS.md`](docs/ZERO_EGRESS.md).

1. **Guard en proceso** — `packages/egress-guard` parchea la capa de sockets antes de que
   ningún módulo pueda conectarse, y rechaza todo lo que no sea loopback o RFC 1918.
2. **Verificación a nivel de sistema operativo** — `scripts/verify-zero-egress.sh`
   inspecciona los sockets reales con `lsof`, por debajo de JavaScript, y audita el árbol
   de dependencias buscando doce SDKs de nube.
3. **Apagar el WiFi** — el demo se comporta idénticamente.

**Esto es cero inferencia en la nube y cero egress. No es un air gap**, y no lo afirmamos:
la máquina tiene interfaz de red, simplemente no la usamos.

## 13. Fuentes de datos

Eventos sintéticos generados por `apps/synthetic-producer`, más un fixture de 66 eventos
(`datasets/synthetic/sample-events.json`, semilla `20260909`). Todos los dominios están
bajo `.example` o son inventados; todas las direcciones son RFC 1918.

## 14. Declaración de datos sintéticos

**Todos los datos DNS son sintéticos.** En ningún momento se procesó tráfico DNS real,
de producción o capturado.

El sitio señuelo (`apps/phishing-demo`) representa una **institución ficticia**. Ninguna
marca, nombre o dominio de un banco real se imita en ningún lugar de este repositorio.

## 15. Declaración de APIs remotas

**No se usa inferencia en la nube.** Ni OpenAI, ni Anthropic, ni Gemini, ni Groq, ni
Together, ni OpenRouter, ni embeddings remotos, ni visión remota. Tampoco hay llamadas
remotas que no sean de IA: en tiempo de ejecución los únicos destinos son el broker Kafka
local, ClickHouse, Grafana y el endpoint de Wazuh.

Las pesas de los modelos se descargaron una vez desde Hugging Face **antes** de la
corrida, como paso de construcción. El runtime se niega a descargar nada.

## 16. Componentes de terceros

| Componente | Uso |
|---|---|
| Apache Kafka 4.3.1 | Flujo de eventos |
| ClickHouse 26.8.2 | Almacenamiento |
| Grafana 13.2.1 | Dashboards |
| Wazuh | Destino de alertas (decoder y reglas en `infra/wazuh/`) |
| `kafkajs` | Cliente de Kafka |
| `@qvac/sdk` | Inferencia local |
| `playwright` | Navegador aislado para la investigación visual |
| Modelos QVAC | Tether AI Research |

## 17. Declaración de código preexistente

**No se usó ningún código base preexistente.** Cada archivo de este repositorio se
escribió dentro de la ventana de construcción (9 sep 2026 08:00 → 11 sep 2026 08:00,
Panamá).

Se construyó un banco de pruebas local de modelos QVAC para validar la viabilidad del SDK;
sus archivos están fechados 2026-09-09 09:57–11:48, también dentro de la ventana. Las
**pesas de los modelos** QVAC son artefactos de terceros publicados por Tether AI Research
y están declaradas en §16.

## 18. Benchmarks

Medidos en el hardware de §8 con `./qvac smoke --preset all`. **25 de 25 modelos QVAC
pasan.** Los dos relevantes:

| Modelo | Cuantización | Rendimiento |
|---|---|---|
| `medpsy-4b-gguf` | `q4_k_m-imat` | **72.6 tok/s** |
| `visionpsy-460m-flash-gguf` | `q4_k_m-imat` | **238.0 tok/s**, TTFT ~0.8 s |

### Track 02 — benchmark de VisionPsy

```bash
node benchmarks/run-vision-benchmark.mjs
```

Registro completo en [`benchmarks/results/vision-benchmark.json`](benchmarks/results/vision-benchmark.json),
con el formato exacto del spec §22. Última corrida medida:

| Métrica | Valor |
|---|---|
| Carga del modelo | 968 ms |
| TTFT promedio | 1143 ms |
| Throughput | 234.9 tok/s |
| Precisión detección de formulario de credenciales | 0.75 |
| Precisión detección de suplantación de marca | 0.5 |
| Falsos positivos | 2 de 12 |
| Falsos negativos | 7 de 12 |

El set de evaluación tiene **4 casos** — dos páginas de phishing de
credenciales y dos controles benignos — evaluados **3 veces**, porque un
modelo de 460M no es determinista: corridas consecutivas del mismo set dieron 1.00 y 0.75
en detección de formularios. Las precisiones son sobre las 12
evaluaciones.

**La precisión de marca de 0.5 es una debilidad
real**, no un error de medición: el modelo responde "no" a la pregunta de institución
financiera en páginas que él mismo identifica como un banco. Reportamos su respuesta
textual en lugar de corregirla — sobrescribirla haría que la evidencia fuera nuestra y no
suya. Los falsos positivos, que son los que hacen que un SOC apague un feed, se mantienen
bajos.

El throughput se mide en una generación larga aparte. Las llamadas de clasificación
responden en una palabra, así que su tiempo lo domina el encoding de la imagen y dividir
tokens entre segundos ahí no mide nada útil.

## 19. Limitaciones

- Solo datos DNS sintéticos.
- No reemplaza inteligencia de amenazas empresarial.
- Los puntajes priorizan investigación; **no son prueba de compromiso**.
- El veredicto de correlación dice *correlacionado*, nunca *causado*, y hay una prueba que
  lo verifica.
- El modelo analista está afinado para uso clínico (§6). Explica; no decide.
- El modelo de visión tiene 460M parámetros y a veces se contradice. Reportamos su
  respuesta textual en lugar de corregirla — si no se puede leer con certeza, no se afirma
  nada y el riesgo no se modifica.
- **Vector no está en el pipeline.** El productor escribe a Kafka directamente; el pipeline
  declarado por Ovnicom empieza en BIND9 → dnstap → Vector. Nosotros arrancamos en la
  frontera de Kafka.
- **No hacemos operaciones RAG**, lo que puede afectar el Track 02.
- Los baselines por sede necesitan varias ventanas sanas antes de significar algo; hasta
  entonces se usa una referencia fija y la salida lo dice.
- El cifrado DNS (DoH/DoT) limita la visibilidad según el despliegue.

## 20. Declaración de seguridad

Uso defensivo únicamente. El sistema observa metadatos DNS, los puntúa y recomienda pasos
de investigación. No bloquea, no escanea activamente y no interactúa con infraestructura
sospechosa más allá de renderizar una página en un navegador aislado sin credenciales ni
almacenamiento. La severidad de las alertas se limita al nivel 12 de Wazuh — el 13 en
adelante se lee como compromiso confirmado, y un puntaje de riesgo no es eso.

## 21. Licencia

MIT — ver [LICENSE](LICENSE).

---

**Colaboradores y agentes de IA:** lean [`AGENTS.md`](AGENTS.md) antes de hacer cualquier
cambio.

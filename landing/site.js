const youtubeVideoId = "pc7N_vlqlo0";
if (youtubeVideoId) {
  const shell = document.querySelector("#video-shell");
  shell.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${youtubeVideoId}?rel=0" title="Demostración de RACS Intelligence" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  shell.classList.add("video-live");
}

const spanish = {
  ".nav-links a": ["Sistema", "Evidencia", "Demo"], ".nav-repo": "Ver repositorio ↗",
  ".eyebrow": "<span></span>SEGURIDAD INTELIGENTE, LOCAL PRIMERO", ".hero h1": "Ve la amenaza.<br><i>Conserva los datos.</i>",
  ".lede": "RACS convierte la telemetría DNS en inteligencia de seguridad explicable sin enviar una consulta, un indicador, un prompt o una captura fuera de la infraestructura del cliente.",
  ".actions a": ["Ver el demo <b>↓</b>", "Explorar el sistema"], ".hero-notes": "Para infraestructura regulada <span>Panamá · 2026</span>",
  ".hero-image figcaption span": "RACS / OPERACIÓN LOCAL", ".hero-image figcaption b": "01 — OBSERVAR. INVESTIGAR. EXPLICAR.",
  ".ticker": "<span>TELEMETRÍA DNS</span><span>DETECCIÓN DETERMINISTA</span><span>EVIDENCIA ACTIVA</span><span>INFERENCIA QVAC LOCAL</span><span>CONTEXTO SOC × NOC</span>",
  ".statement .section-label": "EL PROBLEMA", ".statement h2": "DNS cuenta una historia de seguridad.<br>Para un banco, esa historia es sensible.",
  ".statement p:last-child": "El análisis tradicional exporta telemetría a servicios en la nube. RACS parte de otra premisa: los datos de infraestructura sensible deben permanecer en infraestructura sensible.",
  ".section-intro .section-label": "UN SOLO SISTEMA LOCAL", ".section-intro h2": "Entra evidencia. Sale una decisión.<br><i>No sale nada.</i>",
  ".proof .section-label": "MEDIDO, NO SUPUESTO", ".proof h2": "Inteligencia local<br>con evidencia.",
  ".proof-body h3": "Zero egress es una propiedad, no un eslogan.", ".proof-body p": "RACS bloquea sockets no locales en proceso, inspecciona conexiones activas a nivel de sistema operativo y está diseñado para correr igual con el Wi-Fi apagado.",
  ".demo .section-label": "DEMO DEL PRODUCTO", ".demo h2": "De un dominio sospechoso<br>a una alerta<br><i>explicable.</i>",
  ".demo-copy p:not(.section-label)": "La demostración completa sigue una investigación de phishing bancario: detección, adquisición visual aislada, análisis local y correlación SOC/NOC.",
  ".demo-copy .button": "Leer documentación técnica ↗", ".video-poster strong": "Demo disponible<br>muy pronto", ".video-poster small": "El video final se reproducirá aquí.",
  ".stack .section-label": "CONSTRUIDO CON", "footer p": "Inteligencia de seguridad DNS soberana.<br>Hecho en Panamá para Decentralized AI Hackathon 2026."
};

const nodeCopy = [["DNS sintético", "Telemetría de prueba, segura y repetible"], ["Flujo Kafka", "Eventos en vivo y ordenados"], ["Sentinel", "Features, puntaje y evidencia"], ["Acción local", "Wazuh, QoE y contexto analista"]];
const featureCopy = [["Detección determinista", "DGA, typosquatting, tunneling y beaconing se puntúan con evidencia explícita y ponderada. El modelo nunca crea un puntaje de riesgo."], ["Investigación activa", "Cuando DNS no basta, RACS renderiza la página sospechosa en un navegador aislado y adquiere solo la evidencia que necesita."], ["Seguridad y operaciones", "QoE por sede se correlaciona con eventos de seguridad para distinguir degradación de infraestructura de un incidente impulsado por seguridad."]];
const metricCopy = ["modelos QVAC superan pruebas locales", "tokens / segundo · analista MedPsy-4B", "tokens / segundo · VisionPsy Flash", "endpoints de inferencia cloud en la ruta runtime"];
const listCopy = [["MODELOS LOCALES", "QVAC SDK en el dispositivo"], ["SALIDA VALIDADA", "Esquema estructurado antes de usar"], ["DATOS SINTÉTICOS", "Nunca tráfico de clientes"]];

function setCopy(selector, value) { document.querySelectorAll(selector).forEach((element, index) => element.innerHTML = Array.isArray(value) ? value[index] : value); }
function applySpanish() {
  document.documentElement.lang = "es"; document.title = "RACS Intelligence — Seguridad DNS soberana";
  document.querySelector('meta[name="description"]').content = "RACS Intelligence: inteligencia de seguridad DNS local para infraestructura regulada.";
  Object.entries(spanish).forEach(([selector, value]) => setCopy(selector, value));
  document.querySelectorAll(".arch-node").forEach((node, index) => { node.querySelector("h3").textContent = nodeCopy[index][0]; node.querySelector("p").textContent = nodeCopy[index][1]; });
  document.querySelectorAll(".capability-grid article").forEach((node, index) => { node.querySelector("h3").textContent = featureCopy[index][0]; node.querySelector("p").textContent = featureCopy[index][1]; });
  setCopy(".metric-grid article span", metricCopy);
  document.querySelectorAll(".proof-body li").forEach((item, index) => { item.querySelector("b").textContent = listCopy[index][0]; item.querySelector("span").textContent = listCopy[index][1]; });
}
const language = localStorage.getItem("racs-language") || "es";
if (language === "es") applySpanish();
document.querySelectorAll("[data-language]").forEach(button => { button.setAttribute("aria-pressed", String(button.dataset.language === language)); button.addEventListener("click", () => { localStorage.setItem("racs-language", button.dataset.language); location.reload(); }); });

// ------------------------------------------------------------
// Frontend: habla con la API usando fetch (JSON por HTTP).
// Nunca se recarga la página: solo se vuelve a dibujar la lista.
// ------------------------------------------------------------

const API = "/api";
const ESTADOS = ["Creado", "En tránsito", "En reparto", "Entregado", "Cancelado"];
const COLOR_ESTADO = {
  "Creado": "secondary", "En tránsito": "info", "En reparto": "warning",
  "Entregado": "success", "Cancelado": "danger",
};

// Ventanas (modales) de Bootstrap
const modalPaquete = new bootstrap.Modal("#modal-paquete");
const modalEvento = new bootstrap.Modal("#modal-evento");
const modalHistorial = new bootstrap.Modal("#modal-historial");

let paquetesActuales = [];  // última lista recibida de la API
let idEditando = null;      // null = creando, texto = editando ese _id
let idEvento = null;        // paquete al que se le agrega un evento
let etiquetas = [];         // etiquetas del formulario (arreglo)


// ---------- Utilidades ----------

// Hace una petición a la API y regresa el JSON (o lanza el error que mandó el backend)
async function pedir(url, metodo = "GET", cuerpo = null) {
  const opciones = { method: metodo, headers: { "Content-Type": "application/json" } };
  if (cuerpo) opciones.body = JSON.stringify(cuerpo);
  const respuesta = await fetch(API + url, opciones);
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.detail || "Error en la petición");
  return datos;
}

function mensaje(texto, tipo = "success") {
  const toast = document.getElementById("toast");
  toast.className = `toast text-white border-0 bg-${tipo}`;
  document.getElementById("toast-texto").textContent = texto;
  bootstrap.Toast.getOrCreateInstance(toast).show();
}

// Evita que un texto escrito por el usuario se interprete como HTML
function esc(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function fecha(iso) {
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function badgeEstado(estado) {
  return `<span class="badge bg-${COLOR_ESTADO[estado] || "dark"}">${esc(estado)}</span>`;
}

function lineaDeTiempo(eventos) {
  return `<ul class="timeline mt-3">` + eventos.map(e => `
    <li>
      <div>${badgeEstado(e.estado)} <strong>${esc(e.ubicacion)}</strong></div>
      <small class="text-muted">${fecha(e.fecha)}</small>
      ${e.comentario ? `<div>${esc(e.comentario)}</div>` : ""}
    </li>`).join("") + `</ul>`;
}


// =============================================================
// MÓDULO DE CLIENTE: rastreo por tracking_id
// =============================================================
document.getElementById("form-rastreo").addEventListener("submit", async (ev) => {
  ev.preventDefault();  // evita que el formulario recargue la página
  const id = document.getElementById("rastreo-id").value.trim();
  const caja = document.getElementById("resultado-rastreo");
  try {
    const p = await pedir(`/rastreo/${encodeURIComponent(id)}`);
    caja.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between">
            <h3 class="h5 font-monospace">${esc(p.tracking_id)}</h3>
            <span class="fs-5">${badgeEstado(p.estado)}</span>
          </div>
          <p class="mb-1">${esc(p.descripcion)}</p>
          <p class="text-muted mb-0">Para: ${esc(p.destinatario.nombre)} · ${esc(p.destinatario.ciudad)}
            ${p.repartidor ? ` · Repartidor: ${esc(p.repartidor.nombre)}` : ""}</p>
          ${lineaDeTiempo(p.historial_eventos)}
        </div>
      </div>`;
  } catch (error) {
    caja.innerHTML = `<div class="alert alert-warning">${esc(error.message)}</div>`;
  }
});


// =============================================================
// MÓDULO DE ADMINISTRACIÓN
// =============================================================

// Casillas de estado para el filtro
document.getElementById("filtro-estados").innerHTML = ESTADOS.map(e => `
  <div class="form-check form-check-inline">
    <input class="form-check-input filtro-estado" type="checkbox" value="${e}" id="f-${e}">
    <label class="form-check-label small" for="f-${e}">${e}</label>
  </div>`).join("");

// ---------- R: listar con filtros ----------
async function cargarPaquetes() {
  // Arma la URL con los filtros: /api/paquetes?buscar=..&estado=..&estado=..&repartidor=..
  const params = new URLSearchParams();
  const buscar = document.getElementById("buscar").value.trim();
  const repartidor = document.getElementById("filtro-repartidor").value;
  if (buscar) params.append("buscar", buscar);
  if (repartidor) params.append("repartidor", repartidor);
  document.querySelectorAll(".filtro-estado:checked").forEach(c => params.append("estado", c.value));

  paquetesActuales = await pedir(`/paquetes?${params}`);
  dibujarPaquetes();
}

async function cargarRepartidores() {
  const select = document.getElementById("filtro-repartidor");
  const elegido = select.value;
  const nombres = await pedir("/repartidores");
  select.innerHTML = `<option value="">Todos los repartidores</option>` +
    nombres.map(n => `<option ${n === elegido ? "selected" : ""}>${esc(n)}</option>`).join("");
}

function dibujarPaquetes() {
  document.getElementById("contador").textContent = paquetesActuales.length;
  const lista = document.getElementById("lista-paquetes");
  if (paquetesActuales.length === 0) {
    lista.innerHTML = `<p class="text-muted">No hay paquetes con esos filtros.</p>`;
    return;
  }
  lista.innerHTML = paquetesActuales.map(p => {
    const ultimo = p.historial_eventos[0];  // la API manda solo el último evento
    const activo = p.estado !== "Entregado" && p.estado !== "Cancelado";
    return `
    <div class="col-md-6 col-xl-4">
      <div class="card h-100 shadow-sm tarjeta-paquete">
        <div class="card-header d-flex justify-content-between">
          <span>${esc(p.tracking_id)}</span> ${badgeEstado(p.estado)}
        </div>
        <div class="card-body">
          <p class="mb-1"><strong>${esc(p.descripcion)}</strong> · ${p.peso_kg} kg</p>
          <p class="mb-1 small">De: ${esc(p.remitente.nombre)} (${esc(p.remitente.ciudad)})</p>
          <p class="mb-1 small">Para: ${esc(p.destinatario.nombre)} (${esc(p.destinatario.ciudad)})</p>
          <p class="mb-2 small">Repartidor: ${p.repartidor ? esc(p.repartidor.nombre) : "<em>sin asignar</em>"}</p>
          <div class="mb-2">${p.etiquetas.map(t => `<span class="badge text-bg-light border me-1">${esc(t)}</span>`).join("")}</div>
          <p class="small text-muted mb-0">Último evento: ${esc(ultimo.estado)} en ${esc(ultimo.ubicacion)}
            · ${fecha(ultimo.fecha)} · ${p.total_eventos} evento(s)</p>
        </div>
        <div class="card-footer d-flex flex-wrap gap-1">
          <button class="btn btn-sm btn-outline-primary" onclick="verHistorial('${p.tracking_id}')"><i class="bi bi-clock-history"></i> Historial</button>
          <button class="btn btn-sm btn-outline-secondary" onclick="abrirEditar('${p._id}')"><i class="bi bi-pencil"></i> Editar</button>
          ${activo ? `
          <button class="btn btn-sm btn-outline-info" onclick="abrirEvento('${p._id}')"><i class="bi bi-geo-alt"></i> Evento</button>
          <button class="btn btn-sm btn-outline-success" onclick="marcarEntregado('${p._id}')"><i class="bi bi-check2-circle"></i> Entregado</button>` : ""}
          ${p.estado === "Creado" ? `
          <button class="btn btn-sm btn-outline-danger" onclick="eliminar('${p._id}')"><i class="bi bi-trash"></i> Eliminar</button>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");
}

// Búsqueda en tiempo real: espera 300 ms después de la última tecla
let temporizador;
document.getElementById("buscar").addEventListener("input", () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(cargarPaquetes, 300);
});
document.getElementById("filtro-repartidor").addEventListener("change", cargarPaquetes);
document.getElementById("filtro-estados").addEventListener("change", cargarPaquetes);
document.getElementById("btn-tab-admin").addEventListener("shown.bs.tab", () => { cargarRepartidores(); cargarPaquetes(); });


// ---------- Historial completo ----------
async function verHistorial(trackingId) {
  const p = await pedir(`/rastreo/${trackingId}`);
  document.getElementById("contenido-historial").innerHTML =
    `<h6 class="font-monospace">${esc(p.tracking_id)} ${badgeEstado(p.estado)}</h6>` + lineaDeTiempo(p.historial_eventos);
  modalHistorial.show();
}


// ---------- Formulario dinámico (crear / editar) ----------
const formPaquete = document.getElementById("form-paquete");
const switchRepartidor = document.getElementById("con-repartidor");

// Mostrar u ocultar los campos del repartidor
switchRepartidor.addEventListener("change", () => {
  document.getElementById("campos-repartidor").classList.toggle("d-none", !switchRepartidor.checked);
  formPaquete.rep_nombre.required = switchRepartidor.checked;
});

// Etiquetas: se agregan y quitan del arreglo sin recargar
function dibujarEtiquetas() {
  document.getElementById("etiquetas-form").innerHTML = etiquetas.map((t, i) => `
    <span class="badge text-bg-primary me-1">${esc(t)}
      <i class="bi bi-x" role="button" onclick="quitarEtiqueta(${i})"></i></span>`).join("");
}
function quitarEtiqueta(i) { etiquetas.splice(i, 1); dibujarEtiquetas(); }
function agregarEtiqueta() {
  const input = document.getElementById("nueva-etiqueta");
  const valor = input.value.trim().toLowerCase();
  if (valor && !etiquetas.includes(valor)) etiquetas.push(valor);
  input.value = "";
  dibujarEtiquetas();
}
document.getElementById("btn-agregar-etiqueta").addEventListener("click", agregarEtiqueta);
document.getElementById("nueva-etiqueta").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") { ev.preventDefault(); agregarEtiqueta(); }
});

function prepararFormulario(p = null) {
  formPaquete.reset();
  idEditando = p ? p._id : null;
  etiquetas = p ? [...p.etiquetas] : [];
  document.getElementById("titulo-modal-paquete").textContent = p ? `Editar ${p.tracking_id}` : "Nuevo paquete";
  if (p) {
    formPaquete.rem_nombre.value = p.remitente.nombre;
    formPaquete.rem_telefono.value = p.remitente.telefono || "";
    formPaquete.rem_ciudad.value = p.remitente.ciudad;
    formPaquete.des_nombre.value = p.destinatario.nombre;
    formPaquete.des_telefono.value = p.destinatario.telefono || "";
    formPaquete.des_direccion.value = p.destinatario.direccion;
    formPaquete.des_ciudad.value = p.destinatario.ciudad;
    formPaquete.descripcion.value = p.descripcion;
    formPaquete.peso_kg.value = p.peso_kg;
    if (p.repartidor) {
      formPaquete.rep_nombre.value = p.repartidor.nombre;
      formPaquete.rep_vehiculo.value = p.repartidor.vehiculo || "";
    }
  }
  switchRepartidor.checked = Boolean(p && p.repartidor);
  switchRepartidor.dispatchEvent(new Event("change"));
  dibujarEtiquetas();
  modalPaquete.show();
}

document.getElementById("btn-nuevo").addEventListener("click", () => prepararFormulario());
function abrirEditar(id) { prepararFormulario(paquetesActuales.find(p => p._id === id)); }

// ---------- C / U: guardar el formulario ----------
formPaquete.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = formPaquete;
  // Se arma el documento con subdocumentos y arreglo, igual que en MongoDB
  const datos = {
    remitente: { nombre: f.rem_nombre.value, telefono: f.rem_telefono.value, ciudad: f.rem_ciudad.value },
    destinatario: {
      nombre: f.des_nombre.value, telefono: f.des_telefono.value,
      direccion: f.des_direccion.value, ciudad: f.des_ciudad.value,
    },
    descripcion: f.descripcion.value,
    peso_kg: parseFloat(f.peso_kg.value),
    repartidor: switchRepartidor.checked ? { nombre: f.rep_nombre.value, vehiculo: f.rep_vehiculo.value } : null,
    etiquetas: etiquetas,
  };
  try {
    if (idEditando) {
      await pedir(`/paquetes/${idEditando}`, "PUT", datos);               // U ($set)
      mensaje("Paquete actualizado");
    } else {
      const r = await pedir("/paquetes", "POST", datos);                   // C (insert_one)
      mensaje(`Paquete creado: ${r.tracking_id}`);
    }
    modalPaquete.hide();
    cargarRepartidores();
    cargarPaquetes();
  } catch (error) {
    mensaje(error.message, "danger");
  }
});


// ---------- U: agregar evento ($push + $set + $inc) ----------
const formEvento = document.getElementById("form-evento");

function abrirEvento(id) {
  idEvento = id;
  formEvento.reset();
  document.getElementById("evento-tracking").textContent = paquetesActuales.find(p => p._id === id).tracking_id;
  modalEvento.show();
}

formEvento.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    await pedir(`/paquetes/${idEvento}/evento`, "PUT", {
      estado: formEvento.estado.value,
      ubicacion: formEvento.ubicacion.value,
      comentario: formEvento.comentario.value,
    });
    modalEvento.hide();
    mensaje(`Evento agregado: ${formEvento.estado.value}`);
    cargarPaquetes();
  } catch (error) {
    mensaje(error.message, "danger");
  }
});

// Atajo: marcar como Entregado en la ciudad del destinatario
async function marcarEntregado(id) {
  const p = paquetesActuales.find(x => x._id === id);
  try {
    await pedir(`/paquetes/${id}/evento`, "PUT", {
      estado: "Entregado", ubicacion: p.destinatario.ciudad, comentario: "Entregado al destinatario",
    });
    mensaje(`${p.tracking_id} marcado como Entregado`);
    cargarPaquetes();
  } catch (error) {
    mensaje(error.message, "danger");
  }
}


// ---------- D: eliminar (solo estado Creado) ----------
async function eliminar(id) {
  const p = paquetesActuales.find(x => x._id === id);
  if (!confirm(`¿Eliminar el paquete ${p.tracking_id}?`)) return;
  try {
    await pedir(`/paquetes/${id}`, "DELETE");
    mensaje("Paquete eliminado", "secondary");
    cargarRepartidores();
    cargarPaquetes();
  } catch (error) {
    mensaje(error.message, "danger");
  }
}

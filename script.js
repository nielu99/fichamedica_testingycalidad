const STORAGE_KEY = "fichaMedicaPacientes_v1";

const form = document.getElementById("patientForm");
const rutInput = document.getElementById("rut");
const searchInput = document.getElementById("searchApellido");
const results = document.getElementById("results");
const count = document.getElementById("count");
const message = document.getElementById("message");

let editingRut = null;

function loadPatients() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function savePatients(patients) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function cleanRut(value) {
  return String(value || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

function formatRut(value) {
  const clean = cleanRut(value);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}

function validRut(value) {
  const clean = cleanRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return expected === dv;
}

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `message show ${type}`;
}

function hideMessage() {
  message.className = "message";
  message.textContent = "";
}

function getFormData() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.rut = formatRut(data.rut);
  return data;
}

function setFormData(patient) {
  Object.entries(patient).forEach(([key, value]) => {
    const element = form.elements[key];
    if (element) element.value = value || "";
  });
}

function clearValidation() {
  form.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
}

function validate(data) {
  clearValidation();
  const required = ["rut", "nombres", "apellidos", "direccion", "ciudad", "telefono", "email", "fechaNacimiento", "estadoCivil"];

  for (const field of required) {
    if (!String(data[field] || "").trim()) {
      const el = form.elements[field];
      el.classList.add("invalid");
      showMessage("Completa todos los campos obligatorios.");
      el.focus();
      return false;
    }
  }

  if (!validRut(data.rut)) {
    rutInput.classList.add("invalid");
    showMessage("El RUT ingresado no es válido.");
    rutInput.focus();
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    form.elements.email.classList.add("invalid");
    showMessage("Ingresa un correo electrónico válido.");
    form.elements.email.focus();
    return false;
  }

  const birth = new Date(`${data.fechaNacimiento}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) {
    form.elements.fechaNacimiento.classList.add("invalid");
    showMessage("La fecha de nacimiento no puede ser futura.");
    form.elements.fechaNacimiento.focus();
    return false;
  }

  return true;
}

function renderResults(query = "") {
  const patients = loadPatients();
  const normalizedQuery = normalizeText(query);

  count.textContent = `${patients.length} ${patients.length === 1 ? "registro" : "registros"}`;

  if (!normalizedQuery) {
    results.innerHTML = `
      <div class="empty">
        <div class="empty-icon">⌕</div>
        <strong>Sin búsqueda</strong>
        <p>Escribe un apellido para buscar.</p>
      </div>`;
    return;
  }

  const matches = patients.filter(patient =>
    normalizeText(patient.apellidos).includes(normalizedQuery)
  );

  if (!matches.length) {
    results.innerHTML = `
      <div class="empty">
        <div class="empty-icon">∅</div>
        <strong>No se encontraron registros</strong>
        <p>No hay pacientes con ese apellido.</p>
      </div>`;
    return;
  }

  results.innerHTML = matches.map((patient, index) => `
    <article class="result">
      <span class="result-name">${escapeHtml(patient.apellidos)}, ${escapeHtml(patient.nombres)}</span>
      <span class="result-rut">RUT: ${escapeHtml(patient.rut)}</span>
      <span class="result-city">${escapeHtml(patient.ciudad)}</span>
      <div class="result-actions">
        <button class="mini-btn edit" type="button" data-action="edit" data-index="${patients.indexOf(patient)}">Editar</button>
        <button class="mini-btn delete" type="button" data-action="delete" data-index="${patients.indexOf(patient)}">Eliminar</button>
      </div>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function resetForm() {
  form.reset();
  editingRut = null;
  clearValidation();
  hideMessage();
  rutInput.focus();
}

rutInput.addEventListener("input", () => {
  const cursorEnd = rutInput.value.length;
  rutInput.value = formatRut(rutInput.value);
  if (cursorEnd >= 1) rutInput.setSelectionRange(rutInput.value.length, rutInput.value.length);
});

form.addEventListener("submit", event => {
  event.preventDefault();

  const data = getFormData();
  if (!validate(data)) return;

  const patients = loadPatients();
  const clean = cleanRut(data.rut);

  const existingIndex = patients.findIndex(p => cleanRut(p.rut) === clean);
  const isEditingSame = editingRut && cleanRut(editingRut) === clean;

  if (existingIndex >= 0 && !isEditingSame) {
    const overwrite = confirm(
      `Ya existe un registro para el RUT ${data.rut}.\n\n¿Deseas sobrescribir los datos existentes?`
    );

    if (!overwrite) {
      showMessage("El registro no fue modificado.", "error");
      return;
    }

    patients[existingIndex] = data;
    savePatients(patients);
    editingRut = data.rut;
    showMessage("Registro sobrescrito correctamente.", "success");
  } else if (isEditingSame) {
    patients[existingIndex] = data;
    savePatients(patients);
    editingRut = data.rut;
    showMessage("Registro actualizado correctamente.", "success");
  } else {
    patients.push(data);
    savePatients(patients);
    editingRut = data.rut;
    showMessage("Paciente registrado correctamente.", "success");
  }

  renderResults(searchInput.value);
});

document.getElementById("clearBtn").addEventListener("click", resetForm);

document.getElementById("closeBtn").addEventListener("click", () => {
  const confirmed = confirm("¿Deseas cerrar el formulario?");
  if (confirmed) {
    form.reset();
    hideMessage();
    document.querySelector(".form-card").style.display = "none";
    const closed = document.createElement("div");
    closed.className = "card";
    closed.style.padding = "40px";
    closed.style.textAlign = "center";
    closed.innerHTML = `
      <h2>Formulario cerrado</h2>
      <p style="color:#6c7587">Puedes recargar la página para volver a abrirlo.</p>
      <button class="btn primary" onclick="location.reload()">Abrir nuevamente</button>`;
    document.querySelector(".layout").prepend(closed);
  }
});

searchInput.addEventListener("input", () => renderResults(searchInput.value));

document.getElementById("clearSearch").addEventListener("click", () => {
  searchInput.value = "";
  renderResults("");
  searchInput.focus();
});

results.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const index = Number(button.dataset.index);
  const patients = loadPatients();
  const patient = patients[index];

  if (!patient) return;

  if (button.dataset.action === "edit") {
    setFormData(patient);
    editingRut = patient.rut;
    showMessage("Editando este registro. Guarda para aplicar los cambios.", "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
    rutInput.focus();
  }

  if (button.dataset.action === "delete") {
    const confirmed = confirm(
      `¿Eliminar el registro de ${patient.nombres} ${patient.apellidos} (${patient.rut})?`
    );

    if (!confirmed) return;

    patients.splice(index, 1);
    savePatients(patients);

    if (editingRut && cleanRut(editingRut) === cleanRut(patient.rut)) {
      resetForm();
    }

    renderResults(searchInput.value);
    showMessage("Registro eliminado.", "success");
  }
});

renderResults("");

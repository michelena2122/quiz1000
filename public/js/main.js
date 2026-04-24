(function sincronizarSesionOAuth() {
    const params = new URLSearchParams(window.location.search);

    const googleOk = params.get("google") === "ok";
    const facebookOk = params.get("facebook") === "ok";

    if (!googleOk && !facebookOk) return;

    const id = params.get("id") || "";
    const nombre = params.get("nombre") || "";
    const apellidos = params.get("apellidos") || "";
    const email = params.get("email") || "";

    if (!id || !email) return;

    const usuarioOAuth = {
        id,
        nombre,
        apellidos,
        email
    };

    localStorage.setItem("jugadorId", id);
    localStorage.setItem("usuarioLogueado", JSON.stringify(usuarioOAuth));
    localStorage.setItem("jugadorActual", JSON.stringify(usuarioOAuth));

    params.delete("google");
    params.delete("facebook");
    params.delete("id");
    params.delete("nombre");
    params.delete("apellidos");
    params.delete("email");

    const nuevaQuery = params.toString();
    const nuevaUrl = window.location.pathname + (nuevaQuery ? "?" + nuevaQuery : "");

    window.history.replaceState({}, document.title, nuevaUrl);
})();
console.log("MAIN NUEVO VERSION 2");

let reservasActivas = [];
document.addEventListener("DOMContentLoaded", () => {

    if (!document.body.classList.contains("tablero")) return;

    const grid = document.querySelector(".tablero-grid");
    if (!grid) return;

    // ==========================
    // DETECTAR FOLIO DESDE URL
    // ==========================

    const params = new URLSearchParams(window.location.search);
    const folioURL = params.get("folio");

    console.log("FOLIO DETECTADO:", folioURL);
// ============================
// VINCULAR TABLERO AL PERFIL
// ============================

if(document.body.classList.contains("tablero")){

    let jugadorActual = JSON.parse(localStorage.getItem("jugadorActual"));

    if(jugadorActual && folioURL){

        if(!jugadorActual.tableros){
            jugadorActual.tableros = {};
        }

        if(!jugadorActual.tableros[folioURL]){
            jugadorActual.tableros[folioURL] = {
                numeros: [],
                mejorTiempo: null,
                estado: "activo"
            };

            localStorage.setItem("jugadorActual", JSON.stringify(jugadorActual));
        }
    }
}
    // ==========================
    // FOLIO Y FECHA (LÓGICA ACTUAL)
    // ==========================

   // ==========================
// FOLIO Y FECHA
// ==========================

const folioSpan = document.getElementById("folio");

let folio = folioURL || localStorage.getItem("folioTableroActual");
console.log("🧪 FOLIO URL:", folioURL);
console.log("🧪 FOLIO LOCALSTORAGE:", localStorage.getItem("folioTableroActual"));
console.log("🧪 FOLIO FINAL USADO:", folio);
console.log("🧪 TIPO DE FOLIO:", typeof folio);
let fechaApertura = localStorage.getItem("fechaApertura");

if (!folio) {
    alert("No se encontró folio del tablero");
    throw new Error("Folio no encontrado");
}

localStorage.setItem("folioTableroActual", folio);
// ==========================
// DEBUG FECHA APERTURA BACKEND
// ==========================
fetch("/api/estado-tablero?folio=" + encodeURIComponent(folio))
.then(res => res.json())
.then(data => {

    console.log("🧪 ESTADO TABLERO BACKEND:", data);

    // 🔥 sincronizar fecha desde backend
    if (data.ok && data.tablero && data.tablero.fechaApertura) {
        localStorage.setItem("fechaApertura", data.tablero.fechaApertura);
        fechaApertura = String(data.tablero.fechaApertura);
    }

    // 🔥 pintar encabezado SIEMPRE desde este bloque
    if (folioSpan) {

        let fechaMostrar = "Sin iniciar";

        if (fechaApertura && fechaApertura !== "Sin iniciar") {
            const fechaNum = Number(fechaApertura);
            if (!isNaN(fechaNum)) {
                fechaMostrar = new Date(fechaNum).toLocaleString("es-MX");
            }
        }

        folioSpan.textContent = `Folio: ${folio} | Apertura: ${fechaMostrar}`;
    }

    // 🔥 refrescar barra con la fecha correcta
    actualizarBarraTiempo();

})
.catch(err => {
    console.log("❌ Error leyendo estado tablero:", err);
});

let tablerosGlobal = JSON.parse(localStorage.getItem("tableros")) || {};

if (!tablerosGlobal[folio]) {
    tablerosGlobal[folio] = {
        fechaCreacion: new Date().toLocaleString(),
        casillasResueltas: [],
        completo: false
    };

    localStorage.setItem("tableros", JSON.stringify(tablerosGlobal));
}

// 🔥 solo fallback si backend aún no ha definido apertura
if (!fechaApertura) {
    fechaApertura = "Sin iniciar";
}
// ==========================
// BARRA PROGRESO 10 DIAS
// ==========================

const barra = document.getElementById("barraTiempo");
const textoTiempo = document.getElementById("textoTiempo");

async function actualizarBarraTiempo(){

    const folioEstado =
        new URLSearchParams(window.location.search).get("folio") ||
        localStorage.getItem("folioTableroActual");

    if(!folioEstado){
        if(textoTiempo){
            textoTiempo.textContent = "No se encontró folio del tablero";
        }
        return;
    }

    const respEstado = await fetch(`/api/estado-tablero?folio=${encodeURIComponent(folioEstado)}`);
    const dataEstado = await respEstado.json();

    if(!dataEstado.ok || !dataEstado.tablero || !dataEstado.tablero.fechaApertura){
        if(textoTiempo){
            textoTiempo.textContent = "El tablero inicia cuando se seleccione la primera casilla";
        }
        return;
    }

    const inicio = parseInt(dataEstado.tablero.fechaApertura);
    const cerradoPorTiempo = !!dataEstado.tablero.cerradoPorTiempo;
    const ahora = new Date();

    const diasTotal = 10;
    const msPorDia = 1000 * 60 * 60 * 24;
    const diasTranscurridos = (Date.now() - inicio) / msPorDia;

    let progreso = (diasTranscurridos / diasTotal) * 100;

    // ==========================
    // CIERRE AUTOMATICO TABLERO
    // ==========================

    if(cerradoPorTiempo){

    progreso = 100;

    const celdas = document.querySelectorAll(".cell");

    celdas.forEach(celda=>{
        celda.style.pointerEvents = "none";
        celda.style.opacity = "0.5";
    });

}

    // ==========================
    // MARCAR TABLERO CERRADO
    // ==========================

    if(cerradoPorTiempo){
    progreso = 100;
}

    if(barra){
        barra.style.width = progreso + "%";

        if(progreso < 25){
            barra.style.background = "#2ecc71";
        }
        else if(progreso < 50){
            barra.style.background = "#f1c40f";
        }
        else if(progreso < 75){
            barra.style.background = "#e67e22";
        }
        else{
            barra.style.background = "#e74c3c";
        }
    }

    if(textoTiempo){

        let diasRestantes = Math.max(0, Math.ceil(diasTotal - diasTranscurridos));

        if(isNaN(diasRestantes)) {
            diasRestantes = 10;
        }

        if(cerradoPorTiempo){

    textoTiempo.textContent =
    "TABLERO CERRADO – BONIFICACIÓN A JUGADORES";

    textoTiempo.style.color = "#e74c3c";

    return;
}

        textoTiempo.textContent =
        `Este tablero se cierra en 10 dias. Tiempo restante: ${diasRestantes} días`;

    }

}

actualizarBarraTiempo();
setInterval(actualizarBarraTiempo,60000);

if (folioSpan) {

    let fechaMostrar = "Sin iniciar";

    if (fechaApertura && fechaApertura !== "Sin iniciar") {
        const fechaNum = Number(fechaApertura);
        if (!isNaN(fechaNum)) {
            fechaMostrar = new Date(fechaNum).toLocaleString("es-MX");
        }
    }

    folioSpan.textContent = `Folio: ${folio} | Apertura: ${fechaMostrar}`;
}
    // ==========================
    // ESTADO DEL TABLERO
    // ==========================

   let tableroEstado = JSON.parse(localStorage.getItem("tableroEstado_" + folio)) || {
        casillasResueltas: [],
        mejorTiempo: null,
        completo: false
    };

 // ==========================
// CARGAR PREGUNTAS
// ==========================

fetch("/api/preguntas")
.then(res => res.json())
.then(data => {

    fetch("/api/tablero")
    .then(res => res.json())
    .then(tableroData => {

// ==========================
// CONSULTAR RESERVAS
// ==========================

fetch("/api/reservas")
.then(res => res.json())
.then(data => {

    if(!data.ok) return;

    data.reservas.forEach(reserva => {

        const numero = reserva.casilla;
        const cell = document.querySelector(`.cell[data-id="${numero-1}"]`);

        if(!cell) return;

        // evitar sobrescribir robots
        if(cell.classList.contains("resuelta")) return;

        const tiempoRestante = reserva.expira - Date.now();

        if(tiempoRestante <= 0) return;

        const segundos = Math.floor(tiempoRestante / 1000);
        const minutos = Math.floor(segundos / 60);
        const seg = segundos % 60;

        const texto = `${minutos}:${seg.toString().padStart(2,"0")}`;

        cell.classList.add("resuelta");
        cell.style.backgroundColor = "white";
        cell.innerHTML = `<span class="contador-reserva">${texto}</span>`;

    });

});

        const casillasOcupadas = tableroData.casillas.map(c => c.casilla);
        // ==========================
// SINCRONIZAR FECHA APERTURA
// ==========================
      
        // ==========================
// ACTUALIZAR CONTADOR DESDE BACKEND
// ==========================

const TOTAL_NUMEROS_TABLERO = 50;
const resueltas = casillasOcupadas.length;
const reservadas = data.reservas
? data.reservas.filter(r => r.expira > Date.now()).length
: 0;
const faltantes = TOTAL_NUMEROS_TABLERO - resueltas;
const estadoTableroEl = document.getElementById("estadoTablero");

if(estadoTableroEl){

estadoTableroEl.innerHTML = `
<span class="estado-tablero">

<span class="estado-celda estado-resueltas">${resueltas}</span>
<span class="estado-label">RESUELTOS</span>

<span class="estado-celda estado-reservadas">${reservadas}</span>
<span class="estado-label">RESERVADAS</span>

<span class="estado-celda estado-faltantes">${faltantes}</span>
<span class="estado-label">POR COMPLETAR</span>

</span>
`;

}

        const preguntasMezcladas = [...data].sort(() => Math.random() - 0.5);

const colores = [
            "#e74c3c","#2ecc71","#3498db","#9b59b6","#f39c12",
            "#1abc9c","#e67e22","#16a085","#8e44ad","#c0392b"
        ];

        preguntasMezcladas.forEach((item, index) => {

            const cell = document.createElement("div");
            cell.classList.add("cell");

            const colorOriginal = colores[Math.floor(Math.random() * colores.length)];
            cell.style.backgroundColor = colorOriginal;
            cell.dataset.color = colorOriginal;
            cell.dataset.id = data.indexOf(item);
            

            // estado guardado en localStorage
            const numero = parseInt(cell.dataset.id) + 1;

if (tableroEstado.casillasResueltas.includes(numero)) {

    cell.classList.add("resuelta");
    cell.style.backgroundColor = "transparent";

    const robot = document.createElement("img");
    robot.src = "/assets/images/robot2.png";
    robot.classList.add("robot-mini");

    cell.textContent = "";
    cell.appendChild(robot);
}

            // estado guardado en backend
            if (casillasOcupadas.includes(item.resultado)) {
            

                cell.classList.add("resuelta");
                cell.style.backgroundColor = "transparent";

                const robot = document.createElement("img");
                robot.src = "/assets/images/robot2.png";
                robot.classList.add("robot-mini");

                cell.innerHTML = "";
                cell.appendChild(robot);
            }

            // 👇 EVENTO CLICK (ESTO FALTABA)
            cell.addEventListener("click", () => {
                if (cell.classList.contains("resuelta")) return;

                abrirPregunta(cell, tableroEstado);
            });

            grid.appendChild(cell);

        });

    });

});
// ==========================
// ACTUALIZAR TABLERO AUTOMATICAMENTE
// ==========================
function actualizarContadorHeader(estados){

const TOTAL = 50;

const resueltas = estados.filter(c => c.estado === "pagada").length;
const reservadas = estados.filter(c => c.estado === "reservada" && c.expira > Date.now()).length;
const faltantes = TOTAL - resueltas - reservadas;

const estado = document.getElementById("estadoTablero");

if(!estado) return;

estado.innerHTML = `
<div class="resumen-casillas">

  <div class="resumen-item">
    <div class="resumen-num resumen-verde">${reservadas}</div>
    <div class="resumen-texto">RESERVADAS</div>
  </div>

  <div class="resumen-item">
    <div class="resumen-num resumen-azul">${resueltas}</div>
    <div class="resumen-texto">RESUELTOS</div>
  </div>

  <div class="resumen-item">
    <div class="resumen-num resumen-naranja">${faltantes}</div>
    <div class="resumen-texto">POR COMPLETAR</div>
  </div>

</div>
`;
}
setInterval(async () => {

try{

// ==========================
// 1️⃣ OBTENER RESERVAS
// ==========================

const resEstado = await fetch("/api/estado-casillas?folio=" + encodeURIComponent(folio));
const dataEstado = await resEstado.json();
const estados = dataEstado.ok ? dataEstado.casillas : [];

actualizarContadorHeader(estados);

// ==========================
// 3️⃣ RECORRER CELDAS
// ==========================

document.querySelectorAll(".cell").forEach(cell => {

const numero = parseInt(cell.dataset.id) + 1;
const estadoCasilla = estados.find(c => c.casilla === numero);

// ==========================
// CASILLA PAGADA
// ==========================

if(estadoCasilla && estadoCasilla.estado === "pagada"){

    if(!cell.querySelector(".robot-mini")){

        cell.classList.add("resuelta");
        cell.style.backgroundColor = "transparent";
        cell.style.pointerEvents = "none";

        const robot = document.createElement("img");
        robot.src = "/assets/images/robot2.png";
        robot.classList.add("robot-mini");

        cell.innerHTML = "";
        cell.appendChild(robot);
    }

    return;
}

// ==========================
// CASILLA RESERVADA
// ==========================

if(estadoCasilla && estadoCasilla.estado === "reservada"){

    const tiempoRestante = estadoCasilla.expira - Date.now();

    if(tiempoRestante > 0){

        const segundos = Math.floor(tiempoRestante / 1000);
        const minutos = Math.floor(segundos / 60);
        const seg = segundos % 60;

        const texto =
        `${minutos.toString().padStart(2,"0")}:${seg.toString().padStart(2,"0")}`;

        cell.classList.add("resuelta");
        cell.style.backgroundColor = "white";
        cell.style.pointerEvents = "none";
        cell.innerHTML = `<span class="contador-reserva">${texto}</span>`;

        return;
    }
}

// ==========================
// CASILLA LIBRE
// ==========================

if(cell.classList.contains("resuelta")){
    cell.classList.remove("resuelta");
}

cell.innerHTML = "";
cell.style.backgroundColor = cell.dataset.color;
cell.style.pointerEvents = "";

});

}catch(error){

console.log("Error actualizando tablero",error);

}

},1000);
// ======================================
// VARIABLES GLOBALES
// ======================================

let intervalo;
let tiempoInicio;

// ======================================
// FUNCIÓN ABRIR PREGUNTA
// ======================================

function abrirPregunta(cell, tableroEstado) {

    const modal = document.getElementById("modalPregunta");
    const textoPregunta = document.getElementById("preguntaTexto");
    const contador = document.getElementById("contador");
    const input = document.getElementById("respuestaInput");
    const boton = document.getElementById("btnResponder");

    if (!modal || !textoPregunta || !contador || !input || !boton) {
        console.error("Algún elemento del modal no existe");
        return;
    }

    const jugadorActual = JSON.parse(localStorage.getItem("jugadorActual")) || {};

fetch("/api/abrir-pregunta",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
    id: cell.dataset.id,
    jugador: jugadorActual.nombre || "Invitado"
})
});
fetch("/api/pregunta/" + cell.dataset.id)
.then(res => res.json())
.then(data => {

    textoPregunta.textContent = data.pregunta + " = ?";

     });

    input.value = "";
    modal.classList.remove("hidden");

    tiempoInicio = Date.now();

    intervalo = setInterval(() => {

        const tiempoActual = Date.now() - tiempoInicio;

        const minutos = Math.floor(tiempoActual / 60000);
        const segundos = Math.floor((tiempoActual % 60000) / 1000);
        const decimas = Math.floor((tiempoActual % 1000) / 100);
        const centesimas = Math.floor((tiempoActual % 100) / 10);

        contador.textContent =
            `${String(minutos).padStart(2,'0')}:` +
            `${String(segundos).padStart(2,'0')}:` +
            `${String(decimas).padStart(2,'0')}:` +
            `${String(centesimas).padStart(2,'0')}`;

    }, 10);

   boton.onclick = () => {

    clearInterval(intervalo);

    const respuestaUsuario = Number(input.value);

    if (isNaN(respuestaUsuario)) {
        alert("Escribe tu respuesta.");
        return;
    }

    fetch("/api/responder",{
    method:"POST",
    headers:{
    "Content-Type":"application/json"
    },
    body:JSON.stringify({
        id: cell.dataset.id,
        respuesta: respuestaUsuario,
        jugador: jugadorActual.nombre || "Invitado"
    })
    })
    .then(res => res.json())
    .then(data => {

        if(!data.ok){
            alert("❌ Incorrecto");
            modal.classList.add("hidden");
            mezclarCeldas();
            return;
        }

        const numeroPagado = data.resultado;

        modal.classList.add("hidden");

        const tiempoFormateado = contador.textContent;

        const folioCarrito = folioURL || localStorage.getItem("folioTableroActual");

        fetch("/api/ocupar-casilla", {
        method: "POST",
        headers: {
        "Content-Type": "application/json"
        },
        body: JSON.stringify({
        casilla: numeroPagado,
        jugador: jugadorActual.nombre || "Invitado",
        email: jugadorActual.email || "pendiente",
        tiempo: tiempoFormateado,
        folio: folioCarrito 
        })
        })
        .then(res => res.json())
        .then(dataReserva => {

            if(!dataReserva.ok){
                alert("Esta casilla ya está reservada o pagada.");
                return;
            }

            const tiempoRestante = dataReserva.expira - Date.now();
            const segundos = Math.max(0, Math.floor(tiempoRestante / 1000));
            const minutos = Math.floor(segundos / 60);
            const seg = segundos % 60;

            const texto =
            `${minutos.toString().padStart(2,"0")}:${seg.toString().padStart(2,"0")}`;

            cell.classList.add("resuelta");
            cell.style.backgroundColor = "white";
            cell.innerHTML = `<span class="contador-reserva">${texto}</span>`;

            const folioCarrito = folioURL || localStorage.getItem("folioTableroActual");

            let carrito = JSON.parse(localStorage.getItem("carrito_" + folioCarrito)) || { items: [] };

            const yaExiste = carrito.items.some(item => item.numero === numeroPagado);

            if (!yaExiste) {
                carrito.items.push({
                    numero: numeroPagado,
                    tiempo: tiempoFormateado
                });
                localStorage.setItem("carrito_" + folioCarrito, JSON.stringify(carrito));
            }

            localStorage.setItem("numeroSeleccionado", numeroPagado);

            window.location.href = "carrito.html?folio=" + folioCarrito;

        })
        .catch(error => {
            console.error("Error reservando casilla:", error);
            alert("Error al reservar la casilla");
        });

    })
    .catch(error => {
        console.error("Error validando respuesta:", error);
        alert("Error al validar la respuesta");
    });

}; // cierre boton.onclick

} // cierre abrirPregunta

function responder(opcion){

let respuesta = document.getElementById("respuesta");

if(opcion === "jugar"){
respuesta.innerHTML = "Para jugar selecciona una casilla del tablero y responde la pregunta matemática. la respuesta que obtengas será 1,2,3.. maximo 50, y esa es la cantidad a pagar por participar. Recuerda que pagas en MXN al tipo de caambio del dólar. Ejemplo: Si tu respuesta es 1, pagaras aprox $18.00 pesos";
}

if(opcion === "pagos"){
respuesta.innerHTML = "El pago es con Mercado Pago y dependemos de esta plataforma. Si tu pago no aparece espera 2 minutos y recarga la página.";
}

if(opcion === "folio"){
respuesta.innerHTML = "Tu folio se envía al correo registrado.";
}

if(opcion === "soporte"){
respuesta.innerHTML = "Contacta soporte en el botón de WhatsApp.";
}

}
// ==========================
// MEZCLAR CELDAS TABLERO
// ==========================

function mezclarCeldas(){

const board = document.getElementById("board");

const celdas = Array.from(board.children);

celdas.sort(()=>Math.random()-0.5);

board.innerHTML = "";

celdas.forEach(c=>{
board.appendChild(c);
});

}

});








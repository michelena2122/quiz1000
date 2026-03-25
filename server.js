const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const { Payment } = require("mercadopago");
const client = new MercadoPagoConfig({
    accessToken: "TEST-2663546958880234-110418-76e2aeb24b31137cb7f87b000963013f-153115257"
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/tablero", (req, res) => {
res.sendFile(path.join(__dirname, "public", "tablero.html"));
});

app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "portada.html"));
});
app.get("/portada", (req, res) => {
res.sendFile(path.join(__dirname, "public", "portada.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "carrito.html"));
});
app.get("/carrito", (req, res) => {
res.sendFile(path.join(__dirname, "public", "carrito.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "registro.html"));
});
app.get("/registro", (req, res) => {
res.sendFile(path.join(__dirname, "public", "registro.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "pago.html"));
});
app.get("/pago", (req, res) => {
res.sendFile(path.join(__dirname, "public", "pago.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "perfil.html"));
});
app.get("/perfil", (req, res) => {
res.sendFile(path.join(__dirname, "public", "perfil.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/login", (req, res) => {
res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/index", (req, res) => {
res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "legales.html"));
});
app.get("/legales", (req, res) => {
res.sendFile(path.join(__dirname, "public", "legales.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "lobby.html"));
});
app.get("/lobby", (req, res) => {
res.sendFile(path.join(__dirname, "public", "lobby.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "reglas.html"));
});
app.get("/reglas", (req, res) => {
res.sendFile(path.join(__dirname, "public", "reglas.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "nueva-password.html"));
});
app.get("/nueva-password", (req, res) => {
res.sendFile(path.join(__dirname, "public", "nueva-password.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "ranking.html"));
});
app.get("/ranking", (req, res) => {
res.sendFile(path.join(__dirname, "public", "ranking.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "recuperar.html"));
});
app.get("/recuperar", (req, res) => {
res.sendFile(path.join(__dirname, "public", "recuperar.html"));
});
app.get("/", (req, res) => {
res.sendFile(path.join(__dirname, "public", "admin.html"));
});
app.get("/admin", (req, res) => {
res.sendFile(path.join(__dirname, "public", "admin.html"));
});
const FILE_PATH = path.join(__dirname, "public", "data", "preguntas.json");

const codigosEmail = {};
const preguntasAbiertas = {};
const MP_ACCESS_TOKEN = "c0E8HVNboWsJMBiRkHxKBW3pypue47uk";
// ============================
// BASE DE DATOS USUARIOS
// ============================

const db = new sqlite3.Database("./usuarios.db");

// ============================
// BASE DE DATOS
// ============================
function inicializarConfiguracion(callback){
    db.serialize(() => {

        db.run(`DROP TABLE IF EXISTS usuarios`, (err) => {
            if(err){
                console.log("Error eliminando tabla usuarios:", err.message);
                if(callback) return callback(err);
            }

            console.log("Tabla usuarios eliminada");

            db.run(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id TEXT PRIMARY KEY,
                    nombre TEXT,
                    apellidos TEXT,
                    edad INTEGER,
                    nacionalidad TEXT,
                    telefono TEXT,
                    email TEXT UNIQUE,
                    password TEXT,
                    numeroComprado TEXT,
                    folioTablero TEXT,
                    mejorTiempoGlobal INTEGER
                )
            `, (err) => {
                if(err){
                    console.log("Error creando tabla usuarios:", err.message);
                    if(callback) return callback(err);
                }

                console.log("Tabla usuarios creada correctamente");

                db.run(`
                    CREATE TABLE IF NOT EXISTS tableros (
                        id TEXT PRIMARY KEY,
                        completo INTEGER DEFAULT 0,
                        fechaCreacion INTEGER
                    )
                `, (err) => {
                    if(err){
                        console.log("Error creando tabla tableros:", err.message);
                        if(callback) return callback(err);
                    }

                    console.log("Tabla tableros creada correctamente");
                    db.run(`
    CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT
    )
`, (err) => {
    if(err){
        console.log("Error creando tabla configuracion:", err.message);
    } else {
        console.log("Tabla configuracion creada correctamente");
    }
});

                    if(callback) callback(null);
                });
            });
        });
    });
}
// ============================
// OBTENER CONFIGURACION
// ============================
function obtenerConfiguracion(clave){
    return new Promise((resolve) => {
        db.get(
            `SELECT valor FROM configuracion WHERE clave = ?`,
            [clave],
            (err, row) => {
                if(err){
                    console.log("Error leyendo configuracion:", err);
                    return resolve(null);
                }

                resolve(row ? row.valor : null);
            }
        );
    });
}
// ============================
// CONFIGURAR EMAIL OUTLOOK
// ============================

const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
        user: "juanjmichelena@outlook.com",
        pass: "xndzynqcazodcfjw"
    }
});

// ============================
// ENVIAR CODIGO
// ============================

app.post("/enviar-codigo", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({ ok: false, mensaje: "Email requerido" });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000);
    const expiracion = Date.now() + (5 * 60 * 1000);

    codigosEmail[email] = {
        codigo,
        expira: expiracion,
        intentos: 0
    };

    console.log("Enviando código a:", email);
    console.log("Código generado:", codigo);

    const mailOptions = {
        from: '"Quiz $1000" <juanjmichelena@outlook.com>',
        to: email,
        subject: "Código de verificación",
        html: `
            <h2>Tu código es: ${codigo}</h2>
            <p>Este código expira en 5 minutos.</p>
        `
    };

    res.json({
        ok: true,
        mensaje: "Código enviado"
    });

    transporter.sendMail(mailOptions)
        .then(() => {
            console.log("Código enviado por email:", codigo);
        })
        .catch((error) => {
            console.error("ERROR ENVIANDO EMAIL:", error);
        });
});
// ============================
// REGISTRO DE USUARIO
// ============================

app.post("/registro", async (req,res)=>{

const {
nombre,
apellidos,
edad,
nacionalidad,
telefono,
email,
password,
numeroComprado,
folioTablero
} = req.body;

try{

const hash = await bcrypt.hash(password,10);

const id = "JUG-" + Date.now();

db.run(

`INSERT INTO usuarios
(id,nombre,apellidos,edad,nacionalidad,telefono,email,password,numeroComprado,folioTablero,mejorTiempoGlobal)
VALUES (?,?,?,?,?,?,?,?,?,?,?)`,

[
id,
nombre,
apellidos,
edad,
nacionalidad,
telefono,
email,
hash,
numeroComprado,
folioTablero,
null
],

function(err){

if(err){

console.log(err);

return res.json({ ok:false, mensaje:"Usuario o email ya existen" });

}

res.json({
ok:true,
id:id
});

}

);

}catch(error){

res.json({ ok:false });

}

});
// ============================
// VALIDAR CODIGO
// ============================

app.post("/validar-codigo", (req, res) => {

    const { email, codigo } = req.body;

    const registro = codigosEmail[email];

    if(!registro){
        return res.json({ ok:false, mensaje:"No existe código para este email" });
    }

    if(Date.now() > registro.expira){
        delete codigosEmail[email];
        return res.json({ ok:false, mensaje:"El código expiró" });
    }

    if(registro.codigo != codigo){

        registro.intentos++;

        if(registro.intentos >= 3){

            delete codigosEmail[email];

            return res.json({
                ok:false,
                mensaje:"Demasiados intentos. Solicita un nuevo código."
            });

        }

        return res.json({
            ok:false,
            mensaje:"Código incorrecto"
        });

    }

    delete codigosEmail[email];

    res.json({ ok:true });

});
// ============================
// LOGIN DE USUARIO
// ============================

app.post("/login", async (req,res)=>{

const { email, password } = req.body;

db.get(

`SELECT * FROM usuarios WHERE email = ?`,

[email],

async (err, row)=>{

if(err){
    return res.json({ ok:false });
}

if(!row){
    return res.json({ ok:false, mensaje:"Email no encontrado" });
}

const coincide = await bcrypt.compare(password, row.password);

if(!coincide){
    return res.json({ ok:false, mensaje:"Contraseña incorrecta" });
}

res.json({
    ok:true,
    usuario:{
        id: row.id,
        nombre: row.nombre,
        apellidos: row.apellidos,
        email: row.email,
        telefono: row.telefono
    }
});

}

);

});
// ============================
// OBTENER PERFIL DE USUARIO
// ============================

app.get("/usuario/:id",(req,res)=>{

const id = req.params.id;

db.get(

`SELECT id,nombre,apellidos,edad,email,telefono
FROM usuarios
WHERE id = ?`,

[id],

(err,row)=>{

if(err){
return res.json({ok:false});
}

if(!row){
return res.json({ok:false});
}

res.json({
ok:true,
usuario:row
});

}

);

});
// ============================
// ACTUALIZAR PERFIL
// ============================

app.post("/actualizar-perfil", async (req,res)=>{

const { id, email, telefono, password } = req.body;

let query;
let params;

if(password){

const hash = await bcrypt.hash(password,10);

query = `
UPDATE usuarios
SET email=?, telefono=?, password=?
WHERE id=?`;

params = [email,telefono,hash,id];

}else{

query = `
UPDATE usuarios
SET email=?, telefono=?
WHERE id=?`;

params = [email,telefono,id];

}

db.run(query,params,function(err){

if(err){
return res.json({ok:false});
}

res.json({ok:true});

});

});
// ============================
// CAMBIAR PASSWORD (RECUPERACION)
// ============================

app.post("/cambiar-password", async (req,res)=>{

const email = req.body.email.toLowerCase().trim();
const password = req.body.password;

try{

const hash = await bcrypt.hash(password,10);

db.run(

`UPDATE usuarios SET password=? WHERE email=?`,

[hash,email],

function(err){

if(err){
console.log("ERROR ACTUALIZANDO PASSWORD:", err);
return res.json({ ok:false });
}

if(this.changes === 0){
console.log("EMAIL NO ENCONTRADO:", email);
return res.json({ ok:false });
}

console.log("PASSWORD ACTUALIZADO:", email);

res.json({ ok:true });

}

);

}catch(error){

console.log("ERROR:", error);

res.json({ ok:false });

}

});

// =============================
// OBTENER PREGUNTAS
// =============================
app.get("/api/preguntas", (req, res) => {

    const filePath = path.join(__dirname, "public", "data", "preguntas.json");

    fs.readFile(filePath, "utf8", (err, data) => {

        if (err) {
            return res.status(500).json({ error: "Error leyendo preguntas" });
        }

        const preguntas = JSON.parse(data);

        res.json(preguntas);

    });

});
// =============================
// REGISTRAR APERTURA DE PREGUNTA
// =============================
app.post("/api/abrir-pregunta", (req, res) => {

    const { id, jugador } = req.body;

    const clave = jugador + "_" + id;
    // evitar abrir la misma pregunta dos veces
    if(preguntasAbiertas[clave]){
        return res.json({ ok:false });
    }

    preguntasAbiertas[clave] = Date.now();

    res.json({ ok:true });

});

// =============================
// GUARDAR PREGUNTAS (ADMIN)
// =============================
app.post("/api/preguntas", (req, res) => {

    const lista = req.body;

    if (!Array.isArray(lista)) {
        return res.status(400).json({ error: "Formato inválido." });
    }

    if (lista.length !== 50) {
        return res.status(400).json({ error: "Debe haber exactamente 50 preguntas." });
    }

    const resultados = lista.map(p => p.resultado);
    const setResultados = new Set(resultados);

    if (setResultados.size !== 50) {
        return res.status(400).json({ error: "Hay resultados repetidos." });
    }

    if (!resultados.every(r => r >= 1 && r <= 50)) {
        return res.status(400).json({ error: "Los resultados deben estar entre 1 y 50." });
    }

    try {
        fs.writeFileSync(FILE_PATH, JSON.stringify(lista, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error guardando archivo." });
    }
});
// =============================
// ESTADO DEL TABLERO
// =============================

app.get("/api/tablero", (req, res) => {

db.all(

`SELECT casilla
FROM casillas
WHERE estado = 'pagada'`,

[],

(err,rows)=>{

if(err){
return res.json({ casillas:[] });
}

res.json({
completo:false,
casillas:rows
});

}

);

});
// =============================
// OCUPAR CASILLA
// =============================

app.post("/api/ocupar-casilla", (req, res) => {

const casilla = req.body.casilla;
const jugador = req.body.jugador;
const email = (req.body.email || "pendiente").toLowerCase();
const tiempo = req.body.tiempo;

console.log("POST ocupar casilla:", casilla, jugador);

const filePath = path.join(__dirname, "public", "data", "tablero.json");

try {

    const data = fs.readFileSync(filePath, "utf8");
    const tablero = JSON.parse(data);

    if(tablero.completo){
        return res.json({ ok:false, mensaje:"Tablero cerrado" });
    }

    const ahora = Date.now();
    const expiraReserva = ahora + 300000;

    db.get(
    `SELECT id
     FROM casillas
     WHERE casilla = ?
     AND (
          estado = 'pagada'
          OR estado = 'ocupada'
          OR (estado = 'reservada' AND expira > ?)
     )`,
    [casilla, ahora],
    (err, ocupada) => {

        if(err){
            console.error("ERROR VALIDANDO CASILLA:", err.message);
            return res.status(500).json({ ok:false });
        }

        if(ocupada){
            return res.json({ ok:false, mensaje:"Casilla ya ocupada o reservada" });
        }

        db.run(
        `INSERT INTO casillas
        (tableroId,casilla,jugador,email,tiempo,estado,expira,fecha)
        VALUES (?,?,?,?,?,?,?,?)`,
        [
        "TAB-1001",
        casilla,
        jugador,
        email,
        tiempo,
        "reservada",
        expiraReserva,
        ahora
        ],
        function(err){

            if(err){
                console.error("ERROR INSERTANDO RESERVA:", err.message);
                return res.status(500).json({ ok:false });
            }

            console.log("RESERVA GUARDADA EN DB:", casilla);

            res.json({
                ok:true,
                expira: expiraReserva
            });

        }
        );

    }
    );

} catch(error){

    console.error("ERROR OCUPANDO CASILLA:", error);
    res.status(500).json({ ok:false });

}

});

// =============================
// ADMIN - ESTADO DEL TABLERO
// =============================

app.get("/admin/tablero", (req, res) => {

    const filePath = path.join(__dirname, "public", "data", "tablero.json");

    try {

        const data = fs.readFileSync(filePath, "utf8");
        const tablero = JSON.parse(data);

        res.json({
            completo: tablero.completo || false,
            ocupadas: tablero.casillas.length,
            restantes: 50 - tablero.casillas.length,
            casillas: tablero.casillas
        });

    } catch (error) {

        console.error("Error leyendo tablero admin:", error);

        res.status(500).json({
            error: "Error leyendo tablero"
        });

    }

});
app.post("/admin/reset", (req,res)=>{

    db.run(`DELETE FROM usuarios`);
    db.run(`DELETE FROM casillas`);
    db.run(`DELETE FROM tableros`);

    const filePath = path.join(__dirname, "public", "data", "tablero.json");

    const nuevoTablero = {
        completo:false,
        casillas:[]
    };

    fs.writeFileSync(filePath, JSON.stringify(nuevoTablero, null, 2));

    res.json({ ok:true, mensaje:"Sistema reiniciado" });

});
// ============================
// CREAR TABLEROS INICIALES
// ============================

function crearTablerosIniciales(){

db.get(

`SELECT COUNT(*) as total FROM tableros`,

(err,row)=>{

if(row.total < 3){

for(let i=1;i<=3;i++){

const id = "TAB-"+(1000+i);

db.run(

`INSERT OR IGNORE INTO tableros (id,fechaCreacion)
VALUES (?,?)`,

[id,Date.now()]

);

}

console.log("Tableros iniciales verificados");

}

}

);

}

crearTablerosIniciales();
function calcularGanador(casillas){

    const tiempos = casillas.map(c => {

        const tiempoTexto = c.tiempo;

        const partes = tiempoTexto.split(":");

    const minutos = parseFloat(partes[0]) || 0;
    const segundos = parseFloat(partes[1]) || 0;
    const decimas = parseFloat(partes[2]) || 0;
    const centesimas = parseFloat(partes[3]) || 0;

const tiempoTotal =
    (minutos * 60) +
    segundos +
    (decimas / 10) +
    (centesimas / 100);

        return {
    jugador: c.jugador,
    email: c.email,
    casilla: c.casilla,
    tiempo: tiempoTotal,
    tiempoTexto: tiempoTexto
};

    });

    tiempos.sort((a,b)=> a.tiempo - b.tiempo);

    const ganador = tiempos[0];

    console.log("GANADOR:", ganador);

    enviarCorreos(casillas, ganador);

}
async function enviarCorreos(casillas, ganador){

    const participantes = [...new Set(casillas.map(c=>c.email))];

    let listaResultados = "";

    casillas.forEach(c=>{

        listaResultados += `
        ${c.jugador} — Número ${c.casilla} — Tiempo ${c.tiempo}<br>
        `;

    });

    const html = `
    <h2>Resultados QUIZ1000</h2>

    <p>El tablero ha sido completado.</p>

    <h3>Participaciones</h3>
    ${listaResultados}

    <h3>GANADOR</h3>

    <p>
    ${ganador.jugador}<br>
    Número ${ganador.casilla}<br>
    Tiempo ${ganador.tiempoTexto}
    </p>
    `;

    crearNuevoTablero();

    for(const email of participantes){

        await transporter.sendMail({

            from: '"Quiz $1000" <juanjmichelena@outlook.com>',
            to: email,
            subject: "Resultado del tablero QUIZ1000",
            html: html

        });

    }

    console.log("Correos enviados");

}
function crearNuevoTablero(){

    const filePath = path.join(__dirname, "public", "data", "tablero.json");

    const nuevoTablero = {
        completo:false,
        casillas:[]
    };

    fs.writeFileSync(filePath, JSON.stringify(nuevoTablero, null, 2));

    console.log("Nuevo tablero creado en JSON");

    // =========================
    // CREAR NUEVO TABLERO EN DB
    // =========================

    const nuevoId = "TAB-" + Date.now();

    db.run(

        `INSERT INTO tableros (id,fechaCreacion)
         VALUES (?,?)`,

        [nuevoId,Date.now()],

        function(err){

            if(err){
                console.log("Error creando tablero DB");
                return;
            }

            console.log("Nuevo tablero creado en DB:", nuevoId);

        }

    );

}
// =============================
// OBTENER UNA PREGUNTA
// =============================

app.get("/api/pregunta/:id", (req, res) => {

    const id = parseInt(req.params.id);

    const filePath = path.join(__dirname, "public", "data", "preguntas.json");

    fs.readFile(filePath, "utf8", (err, data) => {

        if (err) {
            return res.status(500).json({ error: "Error leyendo preguntas" });
        }

        const preguntas = JSON.parse(data);

        const pregunta = preguntas[Number(id)];

        if(!pregunta){
            return res.status(404).json({ error:"Pregunta no encontrada" });
        }

        // SOLO ENVIAMOS LA PREGUNTA
        res.json({
            id: id,
            pregunta: pregunta.pregunta
        });

    });

});
// =============================
// OBTENER TABLEROS DISPONIBLES
// =============================

app.get("/api/tableros", (req,res)=>{

db.all(

`SELECT id, completo
FROM tableros
WHERE completo = 0
ORDER BY fechaCreacion ASC`,

[],

(err,rows)=>{

if(err){
return res.json({ ok:false });
}

res.json({
ok:true,
tableros:rows
});

}

);

});
// =============================
// VER CASILLAS EN BASE DE DATOS
// =============================

app.get("/api/debug-casillas", (req,res)=>{

db.all(

`SELECT tableroId,casilla,jugador,email,tiempo,estado,expira
FROM casillas`,

[],

(err,rows)=>{

if(err){
return res.json({ ok:false });
}

res.json({
ok:true,
casillas:rows
});

}

);

});
// =============================
// RESERVAS ACTIVAS
// =============================

app.get("/api/reservas", (req,res)=>{

db.all(

`SELECT casilla,expira
FROM casillas
WHERE estado = 'reservada'
AND expira > ?`,

[Date.now()],

(err,rows)=>{

if(err){
return res.json({ ok:false });
}

res.json({
ok:true,
reservas:rows
});

}

);

});

// =============================
// VALIDAR RESPUESTA
// =============================

app.post("/api/responder", (req,res)=>{

const { id, respuesta, jugador } = req.body;
const clave = jugador + "_" + id;

const inicio = preguntasAbiertas[clave];

if(!inicio){
return res.json({ ok:false });
}

const tiempoReal = Date.now() - inicio;

delete preguntasAbiertas[clave];

const filePath = path.join(__dirname, "public", "data", "preguntas.json");
const data = fs.readFileSync(filePath,"utf8");
const preguntas = JSON.parse(data);
const pregunta = preguntas[Number(id)];

if(!pregunta){
return res.json({ ok:false });
}

if(Number(respuesta) === Number(pregunta.resultado)){
res.json({
ok:true,
resultado: pregunta.resultado,
tiempoReal: tiempoReal
});
}else{
res.json({ ok:false });
}

});

// =============================
// LIMPIAR RESERVAS EXPIRADAS
// =============================

app.post("/api/limpiar-reservas", (req,res)=>{

const ahora = Date.now();

db.run(
`DELETE FROM casillas
 WHERE estado = 'reservada'
 AND expira <= ?`,
[ahora],
function(err){

if(err){
return res.json({ ok:false });
}

res.json({
ok:true,
eliminadas:this.changes
});

});

});

// =============================
// LIMPIEZA AUTOMATICA
// =============================

function limpiarReservasAutomatico(){

const ahora = Date.now();

db.run(
`DELETE FROM casillas
 WHERE estado = 'reservada'
 AND expira <= ?`,
[ahora],
function(err){

if(err){
console.log("Error limpiando reservas");
return;
}

if(this.changes > 0){
console.log("Reservas liberadas:", this.changes);
}

});

}

setInterval(limpiarReservasAutomatico,60000);

// =============================
// WEBHOOK MERCADO PAGO
// =============================

app.post("/webhook/mercadopago", (req,res)=>{

try{

console.log("🔥 WEBHOOK RECIBIDO");
console.log(req.body);

// responder inmediato
res.sendStatus(200);

// procesar en segundo plano
procesarPago(req.body);

}catch(error){

console.log("❌ ERROR WEBHOOK:",error);
res.sendStatus(200);

}

});

// =============================
// PROCESAR PAGO (MULTICASILLA)
// =============================

async function procesarPago(webhookData){

try{

let paymentId = null;

// webhook con body moderno: action + data.id
if (webhookData.data?.id && typeof webhookData.action === "string" && webhookData.action.startsWith("payment.")) {
paymentId = webhookData.data.id;
}

// webhook con type=payment
if (!paymentId && webhookData.type === "payment" && webhookData.data?.id) {
paymentId = webhookData.data.id;
}

// webhook antiguo con resource
if (!paymentId && webhookData.topic === "payment" && webhookData.resource) {
const parts = webhookData.resource.split("/");
paymentId = parts[parts.length - 1];
}

if (!paymentId) return;

const payment = new Payment(client);

const pago = await payment.get({
id: paymentId
});

const data = pago.body || pago;
const folio = data.metadata?.folio;
const tiempos = data.metadata?.tiempos || [];

if(data.status === "approved"){

const casillas = data.metadata?.casillas || [];

if(!folio){
    console.log("⚠️ Pago sin folio");
    return;
}

if(casillas.length === 0){
console.log("⚠️ Pago sin casillas");
return;
}

casillas.forEach(casilla => {

    const infoTiempo = tiempos.find(t => t.numero === casilla);

    db.run(
        `UPDATE casillas
         SET estado = 'ocupada',
             expira = NULL,
             tiempo = ?
         WHERE tableroId = ? AND casilla = ?`,
        [
            infoTiempo ? infoTiempo.tiempo : null,
            folio,
            casilla
        ],
        function(err){

            if(err){
                console.log("Error actualizando pago:", casilla);
                return;
            }

            console.log("✅ CASILLA PAGADA:", casilla);

        }
    );

});

}

}catch(error){

console.log("❌ ERROR PROCESANDO PAGO:",error);

}

}

// =============================
// CREAR PAGO (MULTICASILLA)
// =============================

app.post("/crear-pago", async (req, res) => {

    try {

        const { folio, items } = req.body;

        console.log("🧾 Crear pago múltiples casillas:", items);

        if(!items || items.length === 0){
            return res.status(400).json({ error: "Carrito vacío" });
        }

        const tipoCambioCobroRaw = await obtenerConfiguracion("tipoCambioCobro");
        const tipoCambioCobro = Number(tipoCambioCobroRaw || 20);

        const preference = {
            items: items.map(item => ({
                title: `Casilla ${item.numero}`,
                quantity: 1,
                unit_price: Number((Number(item.numero) * tipoCambioCobro).toFixed(2)),
                currency_id: "MXN"
            })),

            external_reference: folio,

            metadata: {
    folio: folio,
    casillas: items.map(item => item.numero),
    tiempos: items.map(item => ({
        numero: item.numero,
        tiempo: item.tiempo
    })),
    tipoCambioCobro: tipoCambioCobro
},

            back_urls: {
                success: "https://quiz1000.onrender.com/pago",
                failure: "https://quiz1000.onrender.com/pago",
                pending: "https://quiz1000.onrender.com/pago"
            },

            auto_return: "approved",
            notification_url: "https://quiz1000.onrender.com/webhook/mercadopago"
        };

        const preferenceClient = new Preference(client);

        const response = await preferenceClient.create({
            body: preference
        });

        res.json({
            link: response.init_point
        });

    } catch (error) {

        console.log("❌ ERROR SDK:", error);
        res.status(500).json({ error: "Error creando pago" });

    }

});// =============================
// ADMIN - OBTENER TIPO DE CAMBIO
// =============================
app.get("/api/admin/tipo-cambio", (req, res) => {
    db.all(
        `SELECT clave, valor FROM configuracion
         WHERE clave IN ('tipoCambioCobro','tipoCambioPremio')`,
        [],
        (err, rows) => {
            if(err){
                console.log("Error leyendo tipo de cambio:", err);
                return res.status(500).json({ ok:false });
            }

            const data = {
                tipoCambioCobro: "20.00",
                tipoCambioPremio: "19.50"
            };

            rows.forEach(r => {
                data[r.clave] = r.valor;
            });

            res.json({
                ok: true,
                ...data
            });
        }
    );
});

// =============================
// ADMIN - GUARDAR TIPO DE CAMBIO
// =============================
app.post("/api/admin/tipo-cambio", (req, res) => {

    const tipoCambioCobro = Number(req.body.tipoCambioCobro);
    const tipoCambioPremio = Number(req.body.tipoCambioPremio);

    if(
        !tipoCambioCobro || tipoCambioCobro <= 0 ||
        !tipoCambioPremio || tipoCambioPremio <= 0
    ){
        return res.status(400).json({
            ok:false,
            mensaje:"Valores inválidos"
        });
    }

    const ahora = Date.now();

    db.run(
        `INSERT INTO configuracion (clave, valor, fecha)
         VALUES ('tipoCambioCobro', ?, ?)
         ON CONFLICT(clave) DO UPDATE SET
         valor = excluded.valor,
         fecha = excluded.fecha`,
        [tipoCambioCobro.toFixed(2), ahora],
        function(err){
            if(err){
                console.log("Error guardando tipoCambioCobro:", err);
                return res.status(500).json({ ok:false });
            }

            db.run(
                `INSERT INTO configuracion (clave, valor, fecha)
                 VALUES ('tipoCambioPremio', ?, ?)
                 ON CONFLICT(clave) DO UPDATE SET
                 valor = excluded.valor,
                 fecha = excluded.fecha`,
                [tipoCambioPremio.toFixed(2), ahora],
                function(err2){
                    if(err2){
                        console.log("Error guardando tipoCambioPremio:", err2);
                        return res.status(500).json({ ok:false });
                    }

                    res.json({
                        ok:true,
                        tipoCambioCobro: tipoCambioCobro.toFixed(2),
                        tipoCambioPremio: tipoCambioPremio.toFixed(2)
                    });
                }
            );
        }
    );
});
inicializarConfiguracion((err) => {
    if(err){
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
});


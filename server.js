const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
const FILE_PATH = path.join(__dirname, "public", "data", "preguntas.json");

const codigosEmail = {};
const preguntasAbiertas = {};
const MP_ACCESS_TOKEN = "TEST-2663546958880234-110418-76e2aeb24b31137cb7f87b000963013f-153115257";
// ============================
// BASE DE DATOS USUARIOS
// ============================

const db = new sqlite3.Database("./usuarios.db");

db.serialize(() => {

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
    `);

});
// ============================
    // ASEGURAR COLUMNA expira
    // ============================

    db.run(`ALTER TABLE casillas ADD COLUMN expira INTEGER`, (err)=>{
        if(err){
            if(!String(err).includes("duplicate column name")){
                console.log("Error agregando columna expira:", err.message);
            }
        }else{
            console.log("Columna expira agregada a casillas");
        }
    });

// ============================
// TABLEROS
// ============================

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS tableros (

            id TEXT PRIMARY KEY,
            completo INTEGER DEFAULT 0,
            fechaCreacion INTEGER

        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS casillas (

            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tableroId TEXT,
            casilla INTEGER,
            jugador TEXT,
            email TEXT,
            tiempo TEXT,
            estado TEXT,
            expira INTEGER,
            fecha INTEGER

        )
    `);

});

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

    const codigo = Math.floor(100000 + Math.random() * 900000);

    const expiracion = Date.now() + (5 * 60 * 1000); // 5 minutos

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

    try {

       console.log("Código enviado:", codigo);

        res.json({ ok:true });

    } catch (error) {

        console.error("ERROR ENVIANDO EMAIL:", error);

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
const email = req.body.email.toLowerCase();
const tiempo = req.body.tiempo;

console.log("POST ocupar casilla:", casilla, jugador);

const filePath = path.join(__dirname, "public", "data", "tablero.json");

try {

    const data = fs.readFileSync(filePath, "utf8");
    const tablero = JSON.parse(data);
    if(tablero.completo){
    return res.json({ ok:false, mensaje:"Tablero cerrado" });
}

    // verificar si ya está ocupada
    const ocupada = tablero.casillas.find(c => c.casilla === casilla);

    if (ocupada) {
        return res.json({ ok:false, mensaje:"Casilla ya ocupada" });
    }

    // guardar casilla con tiempo
    tablero.casillas.push({
        casilla: casilla,
        jugador: jugador,
        email: email,
        tiempo: tiempo,
        fecha: Date.now()
    });
// guardar también en base de datos
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
Date.now() + 300000,
Date.now()
],
function(err){

if(err){
console.error("ERROR INSERTANDO RESERVA:", err.message);
}else{
console.log("RESERVA GUARDADA EN DB:", casilla);
}

}
);

    // detectar tablero completo
    if(tablero.casillas.length === 50){

    console.log("TABLERO COMPLETO");

    tablero.completo = true;

    fs.writeFileSync(filePath, JSON.stringify(tablero, null, 2));

    calcularGanador(tablero.casillas);

}

    fs.writeFileSync(filePath, JSON.stringify(tablero, null, 2));

    res.json({ ok:true });

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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
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

db.run(

`DELETE FROM casillas
 WHERE estado = 'reservada'
 AND expira < ?`,

[Date.now()],

function(err){

if(err){
return res.json({ ok:false });
}

res.json({
ok:true,
eliminadas:this.changes
});

}

);

});
// =============================
// LIMPIEZA AUTOMATICA RESERVAS
// =============================

function limpiarReservasAutomatico(){

db.run(

`DELETE FROM casillas
 WHERE estado = 'reservada'
 AND expira < ?`,

[Date.now()],

function(err){

if(err){
console.log("Error limpiando reservas");
return;
}

if(this.changes > 0){
console.log("Reservas liberadas:", this.changes);
}

}

);

}

// ejecutar cada minuto
setInterval(limpiarReservasAutomatico,60000);
app.post("/webhook/mercadopago", (req,res)=>{

try{

console.log("🔥 WEBHOOK RECIBIDO");
console.log(req.body);

// responder inmediato (clave)
res.sendStatus(200);

// procesar en segundo plano
procesarPago(req.body);

}catch(error){

console.log("❌ ERROR WEBHOOK:",error);
res.sendStatus(200);

}

});
async function procesarPago(data){

try{

if(data.type !== "payment") return;

if(!data.data?.id) return;

const paymentId = data.data.id;

const response = await fetch(
`https://api.mercadopago.com/v1/payments/${paymentId}`,
{
headers:{
Authorization:`Bearer ${MP_ACCESS_TOKEN}`
}
}
);

const pago = await response.json();

if(pago.status === "approved"){

const casilla = pago.metadata?.casilla;

if(!casilla) return;

db.run(
`UPDATE casillas SET estado = 'pagada' WHERE casilla = ?`,
[casilla],
function(err){

if(err){
console.log("Error actualizando pago");
return;
}

console.log("✅ CASILLA PAGADA:",casilla);

}
);

}

}catch(error){

console.log("❌ ERROR PROCESANDO PAGO:",error);

}
}

app.post("/crear-pago", async (req, res) => {

    try {

        const { casilla } = req.body;

        console.log("🧾 Crear pago para casilla:", casilla);

        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                items: [
                    {
                        title: `Casilla ${casilla}`,
                        quantity: 1,
                        unit_price: casilla
                    }
                ],
                metadata: {
                    casilla: casilla
                }
            })
        });

        const data = await response.json();

        console.log("🔗 Link generado:", data.init_point);

        res.json({
            link: data.init_point
        });

    } catch (error) {
        
        console.log("❌ ERROR CREANDO PAGO:", error);

        res.status(500).json({
            error: "Error creando pago"
        });

    }
});

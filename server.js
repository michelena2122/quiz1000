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

const DB_PATH = process.env.DB_PATH || "/var/data/usuarios.db";
const db = new sqlite3.Database(DB_PATH);

// ============================
// BASE DE DATOS
// ============================
function inicializarConfiguracion(callback){
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
        if(callback) return callback(err);
    }

    console.log("Tabla configuracion creada correctamente");

    db.run(`
    CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT
    )
`, (err) => {
    if(err){
        console.log("Error creando tabla configuracion:", err.message);
        if(callback) return callback(err);
    }

    console.log("Tabla configuracion creada correctamente");

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
    `, (errCasillas) => {
        if(errCasillas){
            console.log("Error creando tabla casillas:", errCasillas.message);
            if(callback) return callback(errCasillas);
        }

        console.log("Tabla casillas creada correctamente");

        db.run(`
            CREATE TABLE IF NOT EXISTS rankings_tableros (
                tableroId TEXT PRIMARY KEY,
                ganadorId TEXT,
                ganadorNombre TEXT,
                mejorTiempoTexto TEXT,
                mejorTiempoNumero REAL,
                totalParticipantes INTEGER DEFAULT 0,
                resumenJson TEXT,
                fechaCierre INTEGER
            )
        `, (err2) => {
            if(err2){
                console.log("Error creando tabla rankings_tableros:", err2.message);
                if(callback) return callback(err2);
            }

            console.log("Tabla rankings_tableros creada correctamente");

            if(callback) callback(null);
        });
    });

        console.log("Tabla rankings_tableros creada correctamente");

        if(callback) callback(null);
    });
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

    try {
        await transporter.sendMail(mailOptions);

        console.log("Código enviado por email:", codigo);

        return res.json({
            ok: true,
            mensaje: "Código enviado",
            codigo: codigo
        });

    } catch (error) {
        console.error("ERROR ENVIANDO EMAIL:", error);

        return res.json({
            ok: true,
            mensaje: "Correo no enviado (modo pruebas)",
            codigo: codigo
        });
    }
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

console.log("BODY /registro:", req.body);

try{

const hash = await bcrypt.hash(password,10);

const id = "JUG-" + Date.now();

console.log("ID GENERADO /registro:", id);

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
console.log("ERROR INSERTANDO USUARIO:", err);
return res.json({ ok:false, mensaje:"Usuario o email ya existen" });
}

console.log("USUARIO INSERTADO OK:", id);
console.log("CHANGES /registro:", this.changes);

res.json({
ok:true,
id:id
});

}

);

}catch(error){

console.log("ERROR GENERAL /registro:", error);
res.json({ ok:false });

}

});// ============================
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
WHERE estado = 'ocupada'`,

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
const folio = req.body.folio;

if(!folio){
    return res.json({ ok:false, mensaje:"Folio no recibido" });
}

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
     WHERE tableroId = ?
    AND casilla = ?
    AND (
          estado = 'pagada'
          OR estado = 'ocupada'
          OR (estado = 'reservada' AND expira > ?)
     )`,
    [folio,casilla, ahora],
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
        folio,
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
app.get("/api/fecha-apertura/:folio", (req, res) => {

    const folio = req.params.folio;

    if(!folio){
        return res.json({ ok:false, fecha:null });
    }

    db.get(
        `SELECT fechaPrimerPago
         FROM tableros
         WHERE id = ?`,
        [folio],
        (err, row) => {

            if(err){
                console.log("Error obteniendo fechaPrimerPago:", err.message);
                return res.json({ ok:false, fecha:null });
            }

            res.json({
                ok:true,
                fecha: row ? row.fechaPrimerPago : null
            });
        }
    );
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

if(err){
    console.log("Error consultando tableros iniciales:", err.message);
    return;
}

if(!row){
    console.log("No se pudo leer COUNT(*) de tableros");
    return;
}

if(row.total < 3){

for(let i=1;i<=3;i++){

const id = "TAB-"+(1000+i);

db.run(

`INSERT OR IGNORE INTO tableros (id,fechaCreacion)
VALUES (?,?)`,

[id,Date.now()]

);

}

}

console.log("Tableros iniciales verificados");

}

);

}

crearTablerosIniciales();
function iniciarConteoTableroSiEsPrimerPago(tableroId){
    return new Promise((resolve) => {

        db.get(
            `SELECT fechaPrimerPago
             FROM tableros
             WHERE id = ?`,
            [tableroId],
            (errTablero, tablero) => {

                if(errTablero){
                    console.log("❌ Error leyendo fechaPrimerPago del tablero:", errTablero.message);
                    return resolve({ ok:false, iniciado:false });
                }

                if(!tablero){
                    console.log("⚠️ Tablero no encontrado para iniciar contador:", tableroId);
                    return resolve({ ok:false, iniciado:false });
                }

                if(tablero.fechaPrimerPago){
                    return resolve({
                        ok:true,
                        iniciado:false,
                        motivo:"El contador ya había sido iniciado"
                    });
                }

                db.get(
                    `SELECT COUNT(*) AS totalPagadas
                     FROM casillas
                     WHERE tableroId = ?
                       AND estado = 'pagada'`,
                    [tableroId],
                    (errPagadas, row) => {

                        if(errPagadas){
                            console.log("❌ Error contando casillas pagadas para iniciar contador:", errPagadas.message);
                            return resolve({ ok:false, iniciado:false });
                        }

                        const totalPagadas = row ? row.totalPagadas : 0;

                        if(totalPagadas < 1){
                            return resolve({
                                ok:true,
                                iniciado:false,
                                motivo:"Aún no hay casillas pagadas"
                            });
                        }

                        db.run(
                            `UPDATE tableros
                             SET fechaPrimerPago = ?
                             WHERE id = ?
                               AND (fechaPrimerPago IS NULL OR fechaPrimerPago = 0)`,
                            [Date.now(), tableroId],
                            function(errUpdate){

                                if(errUpdate){
                                    console.log("❌ Error iniciando contador de 10 días:", errUpdate.message);
                                    return resolve({ ok:false, iniciado:false });
                                }

                                console.log("⏱️ CONTADOR DE 10 DÍAS INICIADO PARA TABLERO:", tableroId);
                                console.log("⏱️ FILAS AFECTADAS INICIO CONTADOR:", this.changes);

                                resolve({
                                    ok:true,
                                    iniciado:this.changes > 0
                                });
                            }
                        );
                    }
                );
            }
        );
    });
}
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
function convertirTiempoATotal(tiempoTexto){

    if(!tiempoTexto || typeof tiempoTexto !== "string"){
        return Number.MAX_SAFE_INTEGER;
    }

    const partes = tiempoTexto.split(":");

    const dias = parseInt(partes[0], 10) || 0;
    const horas = parseInt(partes[1], 10) || 0;
    const minutos = parseInt(partes[2], 10) || 0;
    const segundos = parseInt(partes[3], 10) || 0;

    return (dias * 86400) + (horas * 3600) + (minutos * 60) + segundos;
}

function obtenerResumenTablero(tableroId){
    return new Promise((resolve, reject) => {

        db.all(`
            SELECT
                c.tableroId,
                c.casilla,
                c.tiempo,
                c.jugador AS jugadorId,
                u.nombre,
                u.apellidos,
                u.email
            FROM casillas c
            LEFT JOIN usuarios u
                ON u.id = c.jugador
            WHERE c.tableroId = ?
              AND c.estado = 'pagada'
            ORDER BY c.casilla ASC
        `, [tableroId], (err, rows) => {

            if(err){
                return reject(err);
            }

            const participantesMap = {};

            rows.forEach(r => {

                const jugadorId = r.jugadorId || "sin-id";

                if(!participantesMap[jugadorId]){
                    const emailReal = (r.email || "").trim().toLowerCase();

let nombreReal = (r.nombre || "").trim();

if(!nombreReal && emailReal){
    nombreReal = emailReal.split("@")[0];
}

if(!nombreReal){
    nombreReal = "Jugador";
}

participantesMap[jugadorId] = {
    jugadorId: jugadorId,
    nombre: nombreReal,
    nombreSolo: nombreReal,
    apellidos: (r.apellidos || "").trim(),
    email: emailReal,
                        numeros: [],
                        tiempos: [],
                        mejorTiempoNumero: Number.MAX_SAFE_INTEGER,
                        mejorTiempoTexto: null
                    };
                }

                participantesMap[jugadorId].numeros.push(r.casilla);
                participantesMap[jugadorId].tiempos.push({
                    numero: r.casilla,
                    tiempo: r.tiempo || "Sin registro"
                });

                const tiempoNumero = convertirTiempoATotal(r.tiempo);

                if(tiempoNumero < participantesMap[jugadorId].mejorTiempoNumero){
                    participantesMap[jugadorId].mejorTiempoNumero = tiempoNumero;
                    participantesMap[jugadorId].mejorTiempoTexto = r.tiempo || "Sin registro";
                }
            });

            const participantes = Object.values(participantesMap)
                .map(p => ({
                    ...p,
                    nombreSolo: p.nombre || "Jugador"
                }))
                .sort((a, b) => a.mejorTiempoNumero - b.mejorTiempoNumero);

            const ganador = participantes.length > 0 ? participantes[0] : null;

            resolve({
                tableroId,
                totalCasillasPagadas: rows.length,
                totalParticipantes: participantes.length,
                participantes,
                ganador
            });
        });
    });
}
function guardarRankingCerrado(resumen){
    return new Promise((resolve, reject) => {

        db.run(`
            INSERT OR REPLACE INTO rankings_tableros
            (
                tableroId,
                ganadorId,
                ganadorNombre,
                mejorTiempoTexto,
                mejorTiempoNumero,
                totalParticipantes,
                resumenJson,
                fechaCierre
            )
            VALUES (?,?,?,?,?,?,?,?)
        `,
        [
            resumen.tableroId,
            resumen.ganador ? resumen.ganador.jugadorId : null,
            resumen.ganador ? resumen.ganador.nombreSolo : null,
            resumen.ganador ? resumen.ganador.mejorTiempoTexto : null,
            resumen.ganador ? resumen.ganador.mejorTiempoNumero : null,
            resumen.totalParticipantes || 0,
            JSON.stringify(resumen),
            Date.now()
        ],
        function(err){
            if(err){
                return reject(err);
            }

            resolve({
                ok:true,
                cambios: this.changes
            });
        });

    });
}
async function enviarCorreoRankingFinal(resumen){
    try{

        if(!resumen || !resumen.participantes || resumen.participantes.length === 0){
            console.log("⚠️ No hay participantes para enviar ranking final");
            return;
        }

        const participantesConEmail = resumen.participantes.filter(p => p.email);

        if(participantesConEmail.length === 0){
            console.log("⚠️ No hay emails de participantes para ranking final");
            return;
        }

        let filasParticipantes = "";

        resumen.participantes.forEach((p, index) => {

            const numeros = (p.numeros || []).join(", ");
            const tiempos = (p.tiempos || [])
                .map(t => `Casilla ${t.numero}: ${t.tiempo}`)
                .join("<br>");

            filasParticipantes += `
                <div style="margin-bottom:18px; padding:12px; border:1px solid #ddd; border-radius:8px;">
                    <p><strong>#${index + 1} ${p.nombreSolo || "Jugador"}</strong></p>
                    <p><strong>Casillas pagadas:</strong> ${numeros || "Sin registro"}</p>
                    <p><strong>Tiempos:</strong><br>${tiempos || "Sin registro"}</p>
                    <p><strong>Mejor tiempo:</strong> ${p.mejorTiempoTexto || "Sin registro"}</p>
                </div>
            `;
        });

        const ganadorNombre = resumen.ganador?.nombreSolo || "Sin ganador";
        const ganadorTiempo = resumen.ganador?.mejorTiempoTexto || "Sin registro";

        const html = `
            <h2>🏆 Ranking final de QUIZ1000</h2>

            <p><strong>Folio del tablero:</strong> ${resumen.tableroId}</p>
            <p>El tablero ha sido completado con 50 casillas pagadas.</p>

            <h3>Ganador</h3>
            <p>
                <strong>${ganadorNombre}</strong><br>
                Mejor tiempo: ${ganadorTiempo}
            </p>

            <h3>Participantes</h3>
            ${filasParticipantes}

            <p>
                Puedes consultar el resultado en:
                <a href="https://quiz1000.onrender.com/ranking?folio=${encodeURIComponent(resumen.tableroId)}">
                    Ver ranking
                </a>
            </p>
        `;

        for(const participante of participantesConEmail){
            await transporter.sendMail({
                from: '"Quiz $1000" <juanjmichelena@outlook.com>',
                to: participante.email,
                subject: `Ranking final QUIZ1000 - ${resumen.tableroId}`,
                html
            });
        }

        console.log("✅ Correos de ranking final enviados:", participantesConEmail.length);

    }catch(error){
        console.log("❌ Error enviando correos de ranking final:", error.message);
    }
}

function revisarCierreTablero(tableroId){
    return new Promise((resolve) => {

        db.get(`
            SELECT COUNT(*) AS total
            FROM casillas
            WHERE tableroId = ?
              AND estado = 'pagada'
        `, [tableroId], async (err, row) => {

            if(err){
                console.log("❌ Error revisando cierre de tablero:", err.message);
                return resolve({ ok:false, cerrado:false });
            }

            const totalPagadas = row ? row.total : 0;

            console.log("📊 CASILLAS PAGADAS EN TABLERO:", {
                tableroId,
                totalPagadas
            });

            if(totalPagadas < 50){
                return resolve({
                    ok:true,
                    cerrado:false,
                    totalPagadas
                });
            }

            db.get(`
                SELECT tableroId
                FROM rankings_tableros
                WHERE tableroId = ?
            `, [tableroId], async (err2, existente) => {

                if(err2){
                    console.log("❌ Error validando ranking existente:", err2.message);
                    return resolve({ ok:false, cerrado:false });
                }

                if(existente){
                    console.log("ℹ️ El ranking ya estaba guardado para este tablero:", tableroId);
                    return resolve({
                        ok:true,
                        cerrado:true,
                        repetido:true,
                        totalPagadas
                    });
                }

                try{

                    const resumen = await obtenerResumenTablero(tableroId);
                    const resultadoGuardado = await guardarRankingCerrado(resumen);

                    db.run(`
                        UPDATE tableros
                        SET completo = 1
                        WHERE id = ?
                    `, [tableroId], async function(err3){

                        if(err3){
                            console.log("❌ Error marcando tablero como completo:", err3.message);
                            return resolve({ ok:false, cerrado:false });
                        }

                        console.log("✅ Tablero marcado como completo:", tableroId);
                        console.log("✅ Ranking guardado:", resultadoGuardado);

                        await enviarCorreoRankingFinal(resumen);

                        resolve({
                            ok:true,
                            cerrado:true,
                            totalPagadas,
                            resumen
                        });
                    });

                }catch(error){
                    console.log("❌ Error cerrando tablero:", error.message);
                    resolve({ ok:false, cerrado:false });
                }
            });
        });
    });
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
app.get("/api/debug-limpiar-duplicados", (req, res) => {

    db.run(`
        DELETE FROM casillas
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM casillas
            GROUP BY tableroId, casilla
        )
    `, function(err){

        if(err){
            return res.json({ ok:false, error: err.message });
        }

        res.json({
            ok:true,
            eliminados: this.changes
        });

    });

});
app.get("/api/debug-rankings", (req, res) => {

    db.all(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name ASC
    `, [], (err, rows) => {

        if(err){
            return res.json({
                ok:false,
                error: err.message
            });
        }

        res.json({
            ok:true,
            tablas: rows
        });

    });

});
app.get("/api/debug-db-status", (req, res) => {

    db.serialize(() => {

        db.get(`SELECT COUNT(*) AS total FROM usuarios`, [], (err1, usuarios) => {
            if(err1){
                return res.json({ ok:false, error: err1.message });
            }

            db.get(`SELECT COUNT(*) AS total FROM casillas`, [], (err2, casillas) => {
                if(err2){
                    return res.json({ ok:false, error: err2.message });
                }

                db.get(`SELECT COUNT(*) AS total FROM tableros`, [], (err3, tableros) => {
                    if(err3){
                        return res.json({ ok:false, error: err3.message });
                    }

                    db.all(`
                        SELECT id, completo, fechaCreacion
                        FROM tableros
                        ORDER BY fechaCreacion DESC
                        LIMIT 10
                    `, [], (err4, ultimosTableros) => {
                        if(err4){
                            return res.json({ ok:false, error: err4.message });
                        }

                        res.json({
                            ok:true,
                            dbPath: path.resolve("./usuarios.db"),
                            conteos: {
                                usuarios: usuarios.total,
                                casillas: casillas.total,
                                tableros: tableros.total
                            },
                            ultimosTableros
                        });
                    });
                });
            });
        });

    });

});
app.get("/api/ranking/:folio", async (req, res) => {

    const folio = req.params.folio;

    try{

        const resumen = await obtenerResumenTablero(folio);

        if(!resumen || !resumen.participantes){
            return res.json({
                ok:false,
                mensaje:"Sin datos de ranking"
            });
        }

        res.json({
            ok:true,
            ranking: resumen
        });

    }catch(error){

        console.log("ERROR RANKING:", error.message);

        res.json({
            ok:false,
            mensaje:"Error generando ranking"
        });

    }

});
app.get("/api/debug-resumen-tablero/:folio", async (req, res) => {

    const folio = req.params.folio;

    try{

        const resumen = await obtenerResumenTablero(folio);

        res.json({
            ok:true,
            resumen
        });

    }catch(error){
        console.log("ERROR DEBUG RESUMEN TABLERO:", error.message);

        res.json({
            ok:false,
            error: error.message
        });
    }

});
app.get("/api/debug-guardar-ranking/:folio", async (req, res) => {

    const folio = req.params.folio;

    try{

        const resumen = await obtenerResumenTablero(folio);

        if(!resumen || resumen.totalCasillasPagadas === 0){
            return res.json({
                ok:false,
                mensaje:"Ese tablero no tiene casillas pagadas para guardar ranking"
            });
        }

        const resultado = await guardarRankingCerrado(resumen);

        res.json({
            ok:true,
            mensaje:"Ranking guardado correctamente",
            resultado,
            resumen
        });

    }catch(error){
        console.log("ERROR DEBUG GUARDAR RANKING:", error.message);

        res.json({
            ok:false,
            error: error.message
        });
    }

});
app.get("/api/debug-ranking-guardado/:folio", (req, res) => {

    const folio = req.params.folio;

    db.get(`
        SELECT *
        FROM rankings_tableros
        WHERE tableroId = ?
    `, [folio], (err, row) => {

        if(err){
            return res.json({
                ok:false,
                error: err.message
            });
        }

        if(!row){
            return res.json({
                ok:false,
                mensaje:"No existe ranking guardado para ese tablero"
            });
        }

        let resumenParseado = null;

        try{
            resumenParseado = JSON.parse(row.resumenJson);
        }catch(error){
            resumenParseado = null;
        }

        res.json({
            ok:true,
            ranking: row,
            resumen: resumenParseado
        });

    });

});
app.get("/api/debug-db-status", (req, res) => {

    db.serialize(() => {

        db.get(`SELECT COUNT(*) AS total FROM usuarios`, [], (err1, usuarios) => {
            if(err1){
                return res.json({ ok:false, error: err1.message });
            }

            db.get(`SELECT COUNT(*) AS total FROM casillas`, [], (err2, casillas) => {
                if(err2){
                    return res.json({ ok:false, error: err2.message });
                }

                db.get(`SELECT COUNT(*) AS total FROM tableros`, [], (err3, tableros) => {
                    if(err3){
                        return res.json({ ok:false, error: err3.message });
                    }

                    db.all(`
                        SELECT id, completo, fechaCreacion
                        FROM tableros
                        ORDER BY fechaCreacion DESC
                        LIMIT 10
                    `, [], (err4, ultimosTableros) => {
                        if(err4){
                            return res.json({ ok:false, error: err4.message });
                        }

                        res.json({
                            ok:true,
                            dbPath: path.resolve("./usuarios.db"),
                            conteos: {
                                usuarios: usuarios.total,
                                casillas: casillas.total,
                                tableros: tableros.total
                            },
                            ultimosTableros
                        });
                    });
                });
            });
        });

    });

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
if (
    webhookData.data?.id &&
    typeof webhookData.action === "string" &&
    webhookData.action.startsWith("payment.")
) {
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

console.log("PAYMENT GET EJECUTADO");

const data = pago.body || pago;
console.log("DATA COMPLETA MP:", JSON.stringify(data, null, 2));
console.log("🧪 METADATA CRUDA MP:", data.metadata);

const metadata = data.metadata || {};

const folio = metadata.folio;
const jugadorId = metadata.jugador_id || metadata.jugadorId || null;
const casillasMetadata = metadata.casillas || [];
const tiempos = metadata.tiempos || [];

console.log("📦 METADATA RECIBIDA:", {
    folio,
    jugadorId,
    casillas: casillasMetadata,
    tiempos
});

if(data.status === "approved"){

    const casillas = casillasMetadata;

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

        console.log("🧪 INTENTO UPDATE WEBHOOK:", {
            folio: folio,
            casilla: casilla,
            jugadorId: jugadorId,
            infoTiempo: infoTiempo ? infoTiempo.tiempo : null
        });

        db.run(
`UPDATE casillas
 SET estado = 'pagada',
     expira = NULL,
     tiempo = ?,
     jugador = ?
 WHERE tableroId = ?
   AND casilla = ?
   AND estado = 'reservada'`,
[
    infoTiempo ? infoTiempo.tiempo : null,
    jugadorId,
    folio,
    casilla
],
function(err){
    if(err){
        console.log("Error actualizando pago:", casilla, err.message);
        return;
    }

    console.log("FILAS AFECTADAS:", this.changes);
    console.log("FILAS AFECTADAS UPDATE PAGO:", this.changes);

    if(this.changes > 0){
        console.log("✅ CASILLA PAGADA NUEVA VERSION:", {
            folio,
            casilla,
            jugadorId,
            tiempo: infoTiempo ? infoTiempo.tiempo : null
        });
    }else{
        console.log("⚠️ No se encontró reserva para actualizar:", {
            folio,
            casilla,
            jugadorId
        });
    }
}
);

    });
setTimeout(async () => {
    try{
        const inicio = await iniciarConteoTableroSiEsPrimerPago(folio);
        console.log("🧾 RESULTADO INICIO CONTADOR:", inicio);

        const cierre = await revisarCierreTablero(folio);
        console.log("🧾 RESULTADO REVISAR CIERRE:", cierre);
    }catch(error){
        console.log("❌ Error al revisar cierre tras pago:", error.message);
    }
}, 1200);

    if(jugadorId){

        db.get(
        `SELECT nombre, apellidos, email
         FROM usuarios
         WHERE id = ?`,
        [jugadorId],
        async (err, usuario) => {

            if(err){
                console.log("❌ Error consultando usuario para correo:", err.message);
                return;
            }

            if(!usuario || !usuario.email){
                console.log("⚠️ No se encontró email para jugador:", jugadorId);
                return;
            }

            const nombreCompleto = [usuario.nombre, usuario.apellidos]
                .filter(Boolean)
                .join(" ")
                .trim() || "jugador";

            const listaCasillas = casillas.join(", ");

            try{

                await transporter.sendMail({
                    from: '"Quiz $1000" <juanjmichelena@outlook.com>',
                    to: usuario.email,
                    subject: "Confirmación de compra - QUIZ1000",
                    html: `
                        <h2>Compra confirmada</h2>
                        <p>Hola ${nombreCompleto},</p>
                        <p>Tu pago fue aprobado correctamente.</p>
                        <p><strong>Folio:</strong> ${folio}</p>
                        <p><strong>Casillas compradas:</strong> ${listaCasillas}</p>
                        <p>
                            Puedes revisar tus jugadas aquí:
                            <a href="https://quiz1000.onrender.com/perfil">Mi perfil</a>
                        </p>
                    `
                });

                console.log("✅ Correo de confirmación enviado a:", usuario.email);

            }catch(emailError){
                console.log("❌ Error enviando correo de confirmación:", emailError.message);
            }

        });

    }else{
        console.log("⚠️ No llegó jugadorId; no se envió correo de confirmación");
    }

}

}catch(error){

console.log("❌ ERROR PROCESANDO PAGO:", error);

}

}

// =============================
// CREAR PAGO (MULTICASILLA)
// =============================

app.post("/crear-pago", async (req, res) => {

    try {

        const { folio, items, jugadorId } = req.body;

        console.log("🧾 Crear pago múltiples casillas:", items);

        if(!items || items.length === 0){
            return res.status(400).json({ error: "Carrito vacío" });
        }

        const tipoCambioCobroRaw = await obtenerConfiguracion("tipoCambioCobro");
        const tipoCambioCobro = Number(tipoCambioCobroRaw || 20);

        const preference = {
            items: items.map(item => ({
                title: `SKU${item.numero}`,
                quantity: 1,
                unit_price: Number((Number(item.numero) * tipoCambioCobro).toFixed(2)),
                currency_id: "MXN"
            })),

            external_reference: folio,

            metadata: {
    folio: folio,
    jugador_id: jugadorId,
    jugadorId: jugadorId,
    casillas: items.map(item => item.numero),
    tiempos: items.map(item => ({
        numero: item.numero,
        tiempo: item.tiempo
    })),
    tipoCambioCobro: tipoCambioCobro
},

back_urls: {
    success: `https://quiz1000.onrender.com/perfil?folio=${folio}&pago=success`,
    failure: `https://quiz1000.onrender.com/pago?folio=${folio}&pago=failure`,
    pending: `https://quiz1000.onrender.com/perfil?folio=${folio}&pago=pending`
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

});
// =============================
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
  console.log("Base de datos inicializada correctamente");
});
    
app.post("/api/crear-tablero", (req, res) => {

    const folio = "TAB-" + Math.floor(100000 + Math.random() * 900000);
    const ahora = Date.now();

    db.run(`
        INSERT INTO tableros (id, completo, fechaCreacion)
        VALUES (?, 0, ?)
    `, [folio, ahora], function(err){

        if(err){
            console.error("ERROR CREANDO TABLERO:", err.message);
            return res.json({ ok:false });
        }

        console.log("TABLERO CREADO:", folio);

        res.json({
            ok:true,
            folio: folio
        });

    });

});
app.get("/api/tableros", (req, res) => {
    db.all(`
        SELECT id, completo, fechaCreacion
        FROM tableros
        ORDER BY fechaCreacion DESC
    `, [], (err, rows) => {
        if (err) {
            console.error("ERROR CONSULTANDO TABLEROS:", err.message);
            return res.json({ ok:false, tableros: [] });
        }

        res.json({
            ok: true,
            tableros: rows || []
        });
    });
});
app.get("/api/estado-casillas", (req, res) => {

    const folio = req.query.folio;

    if(!folio){
        return res.json({ ok:false, mensaje:"Folio requerido", casillas:[] });
    }

    const ahora = Date.now();

    db.all(
    `SELECT casilla, estado, expira, jugador, tiempo
     FROM casillas
     WHERE tableroId = ?
     AND (
         estado = 'pagada'
         OR (estado = 'reservada' AND expira > ?)
     )`,
    [folio, ahora],
    (err, rows) => {

        if(err){
            console.log("Error leyendo estado de casillas:", err.message);
            return res.json({ ok:false, casillas:[] });
        }

        const mapa = {};

        rows.forEach(row => {
            const numero = row.casilla;

            if(row.estado === "pagada"){
                mapa[numero] = {
                    casilla: numero,
                    estado: "pagada",
                    jugador: row.jugador || null,
                    tiempo: row.tiempo || null,
                    expira: null
                };
                return;
            }

            if(!mapa[numero] && row.estado === "reservada"){
                mapa[numero] = {
                    casilla: numero,
                    estado: "reservada",
                    jugador: row.jugador || null,
                    tiempo: row.tiempo || null,
                    expira: row.expira
                };
            }
        });

        res.json({
            ok:true,
            folio,
            casillas: Object.values(mapa)
        });
    });

});
app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
// =============================
// MIS TABLEROS (PERFIL JUGADOR)
// =============================
app.get("/api/mis-tableros/:jugadorId", (req, res) => {

    const jugadorId = req.params.jugadorId;

    db.all(`
        SELECT tableroId, casilla, tiempo
        FROM casillas
        WHERE jugador = ?
        AND estado = 'pagada'
        ORDER BY tableroId ASC
    `,
    [jugadorId],
    (err, rows) => {

        if(err){
            console.error("ERROR PERFIL:", err.message);
            return res.json({ ok:false });
        }

        // agrupar por folio
        const tableros = {};

        rows.forEach(r => {

            if(!tableros[r.tableroId]){
                tableros[r.tableroId] = [];
            }

            tableros[r.tableroId].push({
                numero: r.casilla,
                tiempo: r.tiempo
            });

        });

        res.json({
            ok:true,
            tableros: tableros
        });

    });

});




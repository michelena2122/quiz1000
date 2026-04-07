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
const MP_ACCESS_TOKEN = "TEST-2663546958880234-110418-76e2aeb24b31137cb7f87b000963013f-153115257";
// ============================
// BASE DE DATOS USUARIOS
// ============================

const DB_PATH = process.env.DB_PATH || "/var/data/usuarios.db";
const db = new sqlite3.Database(DB_PATH);

function asegurarColumnaFechaApertura(callback){

    db.all(`PRAGMA table_info(tableros)`, [], (err, columnas) => {
        if(err){
            console.log("Error consultando columnas de tableros:", err.message);
            if(callback) return callback(err);
            return;
        }

        const existeFechaApertura = columnas.some(col => col.name === "fechaApertura");

        if(existeFechaApertura){
            console.log("Columna fechaApertura ya existe en tableros");
            if(callback) return callback(null);
            return;
        }

        db.run(
            `ALTER TABLE tableros ADD COLUMN fechaApertura INTEGER`,
            [],
            (errAlter) => {
                if(errAlter){
                    console.log("Error agregando columna fechaApertura:", errAlter.message);
                    if(callback) return callback(errAlter);
                    return;
                }

                console.log("Columna fechaApertura agregada correctamente en tableros");
                if(callback) callback(null);
            }
        );
    });

}
function asegurarColumnasReembolsoTablero(callback){

    db.all(`PRAGMA table_info(tableros)`, [], (err, columnas) => {
        if(err){
            console.log("Error consultando columnas de reembolso en tableros:", err.message);
            if(callback) return callback(err);
            return;
        }

        const existeEstadoReembolso = columnas.some(col => col.name === "estadoReembolso");
        const existeFechaInicioReembolso = columnas.some(col => col.name === "fechaInicioReembolso");
        const existeFechaFinReembolso = columnas.some(col => col.name === "fechaFinReembolso");

        const tareas = [];

        if(!existeEstadoReembolso){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE tableros ADD COLUMN estadoReembolso TEXT DEFAULT 'pendiente'`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna estadoReembolso:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna estadoReembolso agregada correctamente en tableros");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna estadoReembolso ya existe en tableros");
        }

        if(!existeFechaInicioReembolso){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE tableros ADD COLUMN fechaInicioReembolso INTEGER`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna fechaInicioReembolso:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna fechaInicioReembolso agregada correctamente en tableros");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna fechaInicioReembolso ya existe en tableros");
        }

        if(!existeFechaFinReembolso){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE tableros ADD COLUMN fechaFinReembolso INTEGER`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna fechaFinReembolso:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna fechaFinReembolso agregada correctamente en tableros");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna fechaFinReembolso ya existe en tableros");
        }

        if(tareas.length === 0){
            if(callback) return callback(null);
            return;
        }

        let index = 0;

        function ejecutarSiguiente(error){
            if(error){
                if(callback) return callback(error);
                return;
            }

            if(index >= tareas.length){
                if(callback) return callback(null);
                return;
            }

            const tarea = tareas[index];
            index++;
            tarea(ejecutarSiguiente);
        }

        ejecutarSiguiente(null);
    });

}
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
                return;
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
                    return;
                }

                console.log("Tabla tableros creada correctamente");

                asegurarColumnaFechaApertura((errFecha) => {
                    if(errFecha){
                        if(callback) return callback(errFecha);
                        return;
                    }

                    asegurarColumnasReembolsoTablero((errReembolsoCols) => {
                        if(errReembolsoCols){
                            if(callback) return callback(errReembolsoCols);
                            return;
                        }

                        db.run(`
                            CREATE TABLE IF NOT EXISTS configuracion (
                                clave TEXT PRIMARY KEY,
                                valor TEXT
                            )
                        `, (err) => {
                            if(err){
                                console.log("Error creando tabla configuracion:", err.message);
                                if(callback) return callback(err);
                                return;
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
                                    return;
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
                                        return;
                                    }

                                    console.log("Tabla rankings_tableros creada correctamente");

                                    db.run(`
                                        CREATE TABLE IF NOT EXISTS pagos_mp (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            paymentId TEXT UNIQUE,
                                            tableroId TEXT,
                                            jugadorId TEXT,
                                            email TEXT,
                                            montoTotal REAL,
                                            moneda TEXT,
                                            estadoPago TEXT,
                                            estadoReembolso TEXT DEFAULT 'pendiente',
                                            refundId TEXT,
                                            refundAmount REAL,
                                            refundResponse TEXT,
                                            fechaPago INTEGER,
                                            fechaReembolso INTEGER,
                                            casillasJson TEXT,
                                            tiemposJson TEXT,
                                            observaciones TEXT
                                        )
                                    `, (errPagos) => {
                                        if(errPagos){
                                            console.log("Error creando tabla pagos_mp:", errPagos.message);
                                            if(callback) return callback(errPagos);
                                            return;
                                        }

                                        console.log("Tabla pagos_mp creada correctamente");

                                        if(callback) callback(null);
                                    });
                                });
                            });
                        });
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

/// ============================
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

    transporter.sendMail(mailOptions)
        .then(() => {
            console.log("Código enviado por email:", codigo);
        })
        .catch((error) => {
            console.error("ERROR ENVIANDO EMAIL:", error);
            console.log("Modo pruebas activo. Código disponible en log:", codigo);
        });

    return res.json({
        ok: true,
        mensaje: "Código generado correctamente"
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

        const ganador = resumen.ganador || null;

        const filas = [];

        resumen.participantes.forEach((jugador) => {

            const nombre = (jugador.nombreSolo || jugador.nombre || "Jugador").trim();
            const jugadorId = jugador.jugadorId || "Sin ID";
            const tiempos = Array.isArray(jugador.tiempos) ? jugador.tiempos : [];

            tiempos.forEach((t) => {
                filas.push({
                    nombre,
                    jugadorId,
                    casilla: Number(t.numero) || 0,
                    tiempo: t.tiempo || "Sin registro",
                    esGanador:
                        ganador &&
                        jugador.jugadorId === ganador.jugadorId &&
                        t.tiempo === ganador.mejorTiempoTexto
                });
            });

        });

        filas.sort((a, b) => a.casilla - b.casilla);

        let filasHtml = "";

        filas.forEach((fila) => {

            const estiloFila = fila.esGanador
                ? "background:#d4edda;border:2px solid #28a745;font-weight:bold;"
                : "background:#f5f7fb;border:1px solid #d8e0ea;";

            const marcaGanador = fila.esGanador
                ? `<div style="margin-top:6px;color:#1d6f2c;font-weight:bold;">🏆 Ganador</div>`
                : "";

            filasHtml += `
                <div style="
                    ${estiloFila}
                    border-radius:10px;
                    padding:12px;
                    margin-bottom:10px;
                ">
                    <div style="margin-bottom:4px;"><strong>Nombre:</strong> ${fila.nombre}</div>
                    <div style="margin-bottom:4px;"><strong>ID:</strong> ${fila.jugadorId}</div>
                    <div style="margin-bottom:4px;"><strong>Casilla:</strong> ${fila.casilla}</div>
                    <div><strong>Tiempo:</strong> ${fila.tiempo}</div>
                    ${marcaGanador}
                </div>
            `;
        });

        const ganadorNombre = ganador ? (ganador.nombreSolo || ganador.nombre || "Jugador") : "Sin ganador";
        const ganadorId = ganador?.jugadorId || "Sin ID";
        const ganadorTiempo = ganador?.mejorTiempoTexto || "Sin registro";

        const html = `
            <div style="font-family:Arial,sans-serif;color:#111;line-height:1.4;">
                <h2 style="color:#0b1f5c;">🏆 Ranking final de QUIZ1000</h2>

                <p><strong>Folio del tablero:</strong> ${resumen.tableroId}</p>
                <p>El tablero ha sido completado y este es el ranking oficial final.</p>

                <div style="
                    background:#d4edda;
                    border:2px solid #28a745;
                    border-radius:10px;
                    padding:14px;
                    margin:16px 0;
                ">
                    <div style="font-size:18px;font-weight:bold;margin-bottom:8px;">🏆 Ganador del tablero</div>
                    <div><strong>Nombre:</strong> ${ganadorNombre}</div>
                    <div><strong>ID:</strong> ${ganadorId}</div>
                    <div><strong>Mejor tiempo individual:</strong> ${ganadorTiempo}</div>
                </div>

                <h3 style="color:#0b1f5c;">Detalle de casillas pagadas</h3>
                ${filasHtml || "<p>Sin registros.</p>"}

                <p style="margin-top:20px;">
                    Puedes consultar el ranking publicado aquí:
                    <a href="https://quiz1000.onrender.com/ranking">
                        Ver ranking oficial
                    </a>
                </p>
            </div>
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
function revisarTablerosVencidos(){

    const ahora = Date.now();
    const DIEZ_DIAS = 10 * 24 * 60 * 60 * 1000;

    db.all(`
        SELECT id, fechaApertura, completo, estadoReembolso
        FROM tableros
        WHERE fechaApertura IS NOT NULL
    `, [], (err, rows) => {

        if(err){
            console.log("❌ Error revisando tableros vencidos:", err.message);
            return;
        }

        rows.forEach(tablero => {

            if(tablero.completo === 1){
                return;
            }

            if(tablero.estadoReembolso && tablero.estadoReembolso !== 'pendiente'){
                return;
            }

            const tiempoTranscurrido = ahora - tablero.fechaApertura;

            if(tiempoTranscurrido < DIEZ_DIAS){
                return;
            }

            console.log("⏰ TABLERO VENCIDO DETECTADO:", tablero.id);

                        db.run(`
    UPDATE tableros
    SET estadoReembolso = 'en_proceso',
        fechaInicioReembolso = ?
    WHERE id = ?
    AND (estadoReembolso = 'pendiente' OR estadoReembolso IS NULL)
`, [ahora, tablero.id], async function(errUpdate){

                if(errUpdate){
                    console.log("❌ Error marcando tablero en_proceso:", errUpdate.message);
                    return;
                }

                if(this.changes > 0){
                    console.log("🚨 TABLERO MARCADO PARA REEMBOLSO:", tablero.id);

                    try {
                        const resultadoReembolso = await reembolsarPagosDeTablero(tablero.id);

                        console.log("🧾 RESULTADO REEMBOLSO AUTOMÁTICO:", {
                            tableroId: tablero.id,
                            ok: resultadoReembolso.ok,
                            totalPagos: resultadoReembolso.totalPagos,
                            reembolsados: resultadoReembolso.reembolsados,
                            fallidos: resultadoReembolso.fallidos
                        });

                    } catch (errorReembolso) {
                        console.log("❌ ERROR LANZANDO REEMBOLSO AUTOMÁTICO:", {
                            tableroId: tablero.id,
                            error: errorReembolso.message
                        });
                    }
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
app.get("/api/rankings", (req, res) => {

    db.all(`
        SELECT
            tableroId,
            ganadorId,
            ganadorNombre,
            mejorTiempoTexto,
            mejorTiempoNumero,
            totalParticipantes,
            resumenJson,
            fechaCierre
        FROM rankings_tableros
        ORDER BY fechaCierre DESC
    `, [], (err, rows) => {

        if(err){
            console.log("ERROR LISTANDO RANKINGS:", err.message);
            return res.json({
                ok:false,
                rankings:[]
            });
        }

        const rankings = (rows || []).map(row => {
            let resumen = null;

            try{
                resumen = row.resumenJson ? JSON.parse(row.resumenJson) : null;
            }catch(e){
                resumen = null;
            }

            return {
                tableroId: row.tableroId,
                ganadorId: row.ganadorId,
                ganadorNombre: row.ganadorNombre,
                mejorTiempoTexto: row.mejorTiempoTexto,
                mejorTiempoNumero: row.mejorTiempoNumero,
                totalParticipantes: row.totalParticipantes,
                fechaCierre: row.fechaCierre,
                ranking: resumen
            };
        });

        res.json({
            ok:true,
            total: rankings.length,
            rankings
        });
    });

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
setInterval(revisarTablerosVencidos, 60000);

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
// ==========================
    // GUARDAR PAGO EN pagos_mp
    // ==========================
    db.get(
    `SELECT paymentId FROM pagos_mp WHERE paymentId = ?`,
    [paymentId],
    (errExist, rowExist) => {

        if(errExist){
            console.log("❌ Error verificando pago existente:", errExist.message);
            return;
        }

        if(rowExist){
            console.log("ℹ️ Pago ya registrado, no se duplica:", paymentId);
            return;
        }

        db.run(
        `INSERT INTO pagos_mp (
            paymentId,
            tableroId,
            jugadorId,
            email,
            montoTotal,
            moneda,
            estadoPago,
            fechaPago,
            casillasJson,
            tiemposJson,
            observaciones
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
            paymentId,
            folio,
            jugadorId,
            data.payer?.email || null,
            data.transaction_amount || 0,
            data.currency_id || "MXN",
            data.status,
            Date.now(),
            JSON.stringify(casillasMetadata),
            JSON.stringify(tiempos),
            "pago_aprobado"
        ],
        function(errInsert){

            if(errInsert){
                console.log("❌ Error guardando pago_mp:", errInsert.message);
                return;
            }

            console.log("💾 Pago guardado en pagos_mp:", {
                paymentId,
                folio,
                jugadorId
            });

        });

    });
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

        db.run(
            `UPDATE tableros
             SET fechaApertura = COALESCE(fechaApertura, ?)
             WHERE id = ?`,
            [Date.now(), folio],
            function(errFecha){
                if(errFecha){
                    console.log("❌ Error guardando fechaApertura:", errFecha.message);
                }else{
                    console.log("🕒 fechaApertura verificada para tablero:", folio);
                }
            }
        );

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
// ==========================
// REEMBOLSO TOTAL MERCADO PAGO
// ==========================
async function reembolsarPagoMercadoPago(paymentId) {
    try {
        if (!paymentId) {
            return {
                ok: false,
                error: "paymentId vacío"
            };
        }

        console.log("💸 INICIANDO REEMBOLSO MP:", paymentId);

        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
            method: "POST",
               headers: {
                 "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
                 "Content-Type": "application/json",
                  "X-Idempotency-Key": `refund-${paymentId}-${Date.now()}`
                },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (!response.ok) {
    console.error("❌ ERROR REEMBOLSO MP:", {
        paymentId,
        status: response.status,
        data
    });

    return {
        ok: false,
        paymentId,
        status: response.status,
        mensaje: data?.message || null,
        error: data
    };
}

        console.log("✅ REEMBOLSO MP OK:", {
            paymentId,
            refundId: data.id,
            amount: data.amount,
            status: data.status
        });

        return {
            ok: true,
            paymentId,
            refundId: data.id,
            amount: data.amount,
            status: data.status,
            raw: data
        };

    } catch (error) {
        console.error("❌ EXCEPCIÓN REEMBOLSO MP:", {
            paymentId,
            error: error.message
        });

        return {
            ok: false,
            paymentId,
            error: error.message
        };
    }
}
// ==========================
// REEMBOLSAR TODOS LOS PAGOS DE UN TABLERO
// ==========================
async function reembolsarPagosDeTablero(tableroId) {
    try {
        if (!tableroId) {
            return {
                ok: false,
                error: "tableroId vacío"
            };
        }

        console.log("💰 INICIANDO REEMBOLSOS DEL TABLERO:", tableroId);

        db.run(
            `UPDATE tableros
             SET estadoReembolso = 'reembolsando',
                 fechaInicioReembolso = COALESCE(fechaInicioReembolso, ?)
             WHERE id = ?`,
            [Date.now(), tableroId],
            function(errInicio) {
                if (errInicio) {
                    console.log("❌ Error marcando tablero como reembolsando:", errInicio.message);
                } else {
                    console.log("🟡 Tablero marcado como reembolsando:", tableroId);
                }
            }
        );

        const pagos = await new Promise((resolve, reject) => {
            db.all(
                `SELECT paymentId
                 FROM pagos_mp
                 WHERE tableroId = ?
                 AND paymentId IS NOT NULL
                 AND paymentId <> ''
                 ORDER BY fechaPago ASC`,
                [tableroId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows || []);
                }
            );
        });

        if (pagos.length === 0) {
            console.log("⚠️ No hay pagos_mp para reembolsar en tablero:", tableroId);

            db.run(
                `UPDATE tableros
                 SET estadoReembolso = 'sin_pagos',
                     fechaFinReembolso = ?
                 WHERE id = ?`,
                [Date.now(), tableroId],
                function(errSinPagos) {
                    if (errSinPagos) {
                        console.log("❌ Error marcando tablero sin pagos:", errSinPagos.message);
                    } else {
                        console.log("ℹ️ Tablero marcado como sin_pagos:", tableroId);
                    }
                }
            );

            return {
                ok: true,
                tableroId,
                totalPagos: 0,
                reembolsados: 0,
                fallidos: 0
            };
        }

        const resultados = [];

        for (const pago of pagos) {
            const resultado = await reembolsarPagoMercadoPago(pago.paymentId);

            resultados.push({
                paymentId: pago.paymentId,
                ok: resultado.ok,
                refundId: resultado.refundId || null,
                status: resultado.status || null,
                error: resultado.error || null
            });
        }

        const reembolsados = resultados.filter(r => r.ok).length;
        const fallidos = resultados.filter(r => !r.ok).length;

        console.log("📊 RESUMEN REEMBOLSOS TABLERO:", {
            tableroId,
            totalPagos: pagos.length,
            reembolsados,
            fallidos
        });

        if (fallidos === 0) {
    db.run(
        `UPDATE tableros
         SET estadoReembolso = 'reembolsado',
             fechaFinReembolso = ?,
             noReembolsable = 1
         WHERE id = ?`,
        [Date.now(), tableroId],
        function(errFin) {
            if (errFin) {
                console.log("❌ Error marcando tablero como reembolsado:", errFin.message);
            } else {
                console.log("✅ Tablero marcado como reembolsado y NO REEMBOLSABLE:", tableroId);
            }
        }
    );
        } else {
            db.run(
                `UPDATE tableros
                 SET estadoReembolso = 'error_reembolso',
                     fechaFinReembolso = ?
                 WHERE id = ?`,
                [Date.now(), tableroId],
                function(errError) {
                    if (errError) {
                        console.log("❌ Error marcando tablero con error_reembolso:", errError.message);
                    } else {
                        console.log("⚠️ Tablero marcado como error_reembolso:", tableroId);
                    }
                }
            );
        }

        return {
            ok: fallidos === 0,
            tableroId,
            totalPagos: pagos.length,
            reembolsados,
            fallidos,
            resultados
        };

    } catch (error) {
        console.log("❌ ERROR REEMBOLSANDO TABLERO:", {
            tableroId,
            error: error.message
        });

        db.run(
            `UPDATE tableros
             SET estadoReembolso = 'error_reembolso',
                 fechaFinReembolso = ?
             WHERE id = ?`,
            [Date.now(), tableroId],
            function(errUpdate) {
                if (errUpdate) {
                    console.log("❌ Error actualizando error_reembolso:", errUpdate.message);
                }
            }
        );

        return {
            ok: false,
            tableroId,
            error: error.message
        };
    }
}
// ==========================
// TEST MANUAL - REEMBOLSAR TABLERO
// ==========================
app.post("/api/test/reembolsar-tablero", async (req, res) => {

    // 🔒 PROTECCIÓN SIMPLE
    if (req.headers["x-admin-key"] !== "QUIZ1000_ADMIN") {
        return res.status(403).json({
            ok: false,
            mensaje: "No autorizado"
        });
    }

    try {
        const folio = (req.body.folio || "").trim();

        if (!folio) {
            return res.status(400).json({
                ok: false,
                mensaje: "Folio requerido"
            });
        }

        db.get(`
            SELECT id, noReembolsable
            FROM tableros
            WHERE id = ?
        `, [folio], async (err, tablero) => {

            if (err) {
                console.log("❌ ERROR CONSULTANDO TABLERO EN TEST REEMBOLSO:", err.message);
                return res.status(500).json({
                    ok: false,
                    mensaje: "Error consultando tablero",
                    error: err.message
                });
            }

            if (!tablero) {
                return res.status(404).json({
                    ok: false,
                    mensaje: "Tablero no encontrado"
                });
            }

            if (tablero.noReembolsable === 1) {
                console.log("⛔ TABLERO NO REEMBOLSABLE:", folio);
                return res.json({
                    ok: false,
                    folio,
                    mensaje: "Este tablero ya es no reembolsable"
                });
            }

            console.log("🧪 TEST REEMBOLSO MANUAL INICIADO:", folio);

            try {
                const resultado = await reembolsarPagosDeTablero(folio);

                return res.json({
                    ok: resultado.ok,
                    folio,
                    resultado
                });

            } catch (error) {
                console.log("❌ ERROR EN TEST MANUAL REEMBOLSAR TABLERO:", error.message);

                return res.status(500).json({
                    ok: false,
                    mensaje: "Error ejecutando reembolso manual",
                    error: error.message
                });
            }
        });

    } catch (error) {
        console.log("❌ ERROR GENERAL EN ENDPOINT TEST REEMBOLSO:", error.message);

        return res.status(500).json({
            ok: false,
            mensaje: "Error general en endpoint de reembolso manual",
            error: error.message
        });
    }
});
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

// =============================
// ESTADO GENERAL DEL TABLERO
// =============================
app.get("/api/estado-tablero", (req, res) => {

    console.log("✅ ENTRE A /api/estado-tablero", req.query.folio);

    const folio = req.query.folio;

    if(!folio){
        return res.json({
            ok:false,
            mensaje:"Folio requerido"
        });
    }

    db.get(`
        SELECT id, completo, fechaCreacion, fechaApertura
        FROM tableros
        WHERE id = ?
    `, [folio], (err, tablero) => {

        if(err){
            console.log("Error leyendo estado del tablero:", err.message);
            return res.json({
                ok:false,
                mensaje:"Error leyendo tablero"
            });
        }

        if(!tablero){
            return res.json({
                ok:false,
                mensaje:"Tablero no encontrado"
            });
        }

        const ahora = Date.now();
        const diezDiasMs = 10 * 24 * 60 * 60 * 1000;

        let msRestantes = null;
        let cerradoPorTiempo = false;

        if(tablero.fechaApertura){
            const vencimiento = Number(tablero.fechaApertura) + diezDiasMs;
            msRestantes = Math.max(0, vencimiento - ahora);
            cerradoPorTiempo = ahora >= vencimiento;
        }

        res.json({
            ok:true,
            tablero:{
                id: tablero.id,
                completo: tablero.completo,
                fechaCreacion: tablero.fechaCreacion,
                fechaApertura: tablero.fechaApertura || null,
                msRestantes,
                cerradoPorTiempo
            }
        });

    });

});

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
app.get("/api/prueba-version", (req, res) => {
    res.json({
        ok: true,
        mensaje: "version nueva cargada"
    });
});
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

});



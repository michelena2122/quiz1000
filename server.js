const express = require("express");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const { MercadoPagoConfig, Preference } = require("mercadopago");
const { Payment } = require("mercadopago");

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/debug-tipo-cambio", (req, res) => {
    db.all(`SELECT * FROM configuracion`, [], (err, rows) => {
        if (err) return res.json({ ok: false, error: err.message });
        res.json({ ok: true, configuracion: rows });
    });
});
// Limpiar tableros de prueba sin casillas pagadas
app.post("/api/admin/limpiar-tableros-prueba", verificarAdmin, (req, res) => {
    db.all(`
        SELECT t.id FROM tableros t
        LEFT JOIN casillas c ON c.tableroId = t.id AND c.estado = 'pagada'
        WHERE c.id IS NULL
        AND t.completo = 0
    `, [], (err, rows) => {
        if (err) return res.json({ ok: false, error: err.message });
        if (rows.length === 0) return res.json({ ok: true, eliminados: 0 });

        const ids = rows.map(r => r.id);
        const placeholders = ids.map(() => "?").join(",");

        db.run(`DELETE FROM casillas WHERE tableroId IN (${placeholders})`, ids, (err2) => {
            if (err2) return res.json({ ok: false, error: err2.message });

            db.run(`DELETE FROM tableros WHERE id IN (${placeholders})`, ids, (err3) => {
                if (err3) return res.json({ ok: false, error: err3.message });
                console.log(`🧹 ${ids.length} tableros de prueba eliminados`);
                res.json({ ok: true, eliminados: ids.length, folios: ids });
            });
        });
    });
});
app.get("/healthz", (req, res) => {
    res.status(200).send("ok");
});

app.use(cors());
// Rate limiting
const limitadorLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { ok: false, mensaje: "Demasiados intentos. Espera 15 minutos." }
});

const limitadorCodigo = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { ok: false, mensaje: "Demasiados envíos. Espera 1 hora." }
});

const limitadorGeneral = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { ok: false, mensaje: "Demasiadas peticiones. Espera un momento." }
});

app.use(limitadorGeneral);
app.post("/login", limitadorLogin);
app.post("/enviar-codigo", limitadorCodigo);
app.post("/validar-codigo", limitadorCodigo);

// Middleware de autenticación admin
function verificarAdmin(req, res, next) {
    const key = req.headers["x-admin-key"];
    if (!key || key !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ ok: false, mensaje: "No autorizado" });
    }
    next();
}
app.use(express.json());
app.set("trust proxy", 1); // Render.com usa proxy inverso
// ── RATE LIMITING ──
const limitGeneral = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,
    message: { ok: false, mensaje: "Demasiadas peticiones. Intenta en 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false
});

const limitLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { ok: false, mensaje: "Demasiados intentos de login. Intenta en 15 minutos." }
});

const limitPagos = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 15,
    message: { ok: false, mensaje: "Demasiadas peticiones de pago. Espera un momento." }
});

app.use("/api/", limitGeneral);
app.use("/login", limitLogin);
app.use("/registro", limitLogin);
app.use("/api/pago", limitPagos);
app.use("/api/premio/solicitud", limitPagos);
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(session({
    secret: "quiz1000-secret",
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://quiz1000-nuevo.onrender.com/auth/google/callback"
},
(accessToken, refreshToken, profile, done) => {

    const email = profile.emails && profile.emails[0]
        ? profile.emails[0].value.toLowerCase().trim()
        : "";

    const nombre = profile.name?.givenName || "";
    const apellidos = profile.name?.familyName || "";

    if (!email) {
        return done(null, false);
    }

    db.get(
        `SELECT * FROM usuarios WHERE email = ?`,
        [email],
        (err, usuarioExistente) => {

            if (err) {
                console.log("ERROR BUSCANDO USUARIO GOOGLE:", err.message);
                return done(err);
            }

            if (usuarioExistente) {
                return done(null, usuarioExistente);
            }

            const nuevoId = "JUG-" + Date.now();

            db.run(
                `INSERT INTO usuarios
                (id, nombre, apellidos, email, password, numeroComprado, folioTablero, mejorTiempoGlobal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nuevoId,
                    nombre,
                    apellidos,
                    email,
                    "google_oauth",
                    null,
                    null,
                    null
                ],
                function(insertErr) {

                    if (insertErr) {
                        console.log("ERROR INSERTANDO USUARIO GOOGLE:", insertErr.message);
                        return done(insertErr);
                    }

                    db.get(
                        `SELECT * FROM usuarios WHERE id = ?`,
                        [nuevoId],
                        (errNuevo, nuevoUsuario) => {
                            if (errNuevo) {
                                console.log("ERROR LEYENDO NUEVO USUARIO GOOGLE:", errNuevo.message);
                                return done(errNuevo);
                            }

                            return done(null, nuevoUsuario);
                        }
                    );
                }
            );
        }
    );
}));
app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/healthz") {
        return next();
    }
    next();
});
const carpetaPremios = path.join(__dirname, "uploads", "premios");

if (!fs.existsSync(carpetaPremios)) {
    fs.mkdirSync(carpetaPremios, { recursive: true });
}

const storagePremios = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, carpetaPremios);
    },
    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname);
        const nombreArchivo = "premio-" + Date.now() + extension;
        cb(null, nombreArchivo);
    }
});

const uploadPremio = multer({ storage: storagePremios });

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "portada.html"));
});
app.get("/tablero", (req, res) => {
res.sendFile(path.join(__dirname, "public", "tablero.html"));
});
app.get("/portada", (req, res) => {
res.sendFile(path.join(__dirname, "public", "portada.html"));
});
app.get("/carrito", (req, res) => {
res.sendFile(path.join(__dirname, "public", "carrito.html"));
});
app.get("/registro", (req, res) => {
res.sendFile(path.join(__dirname, "public", "registro.html"));
});
app.get("/pago", (req, res) => {
res.sendFile(path.join(__dirname, "public", "pago.html"));
});
app.get("/perfil", (req, res) => {
res.sendFile(path.join(__dirname, "public", "perfil.html"));
});
app.get("/login", (req, res) => {
res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/index", (req, res) => {
res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/legales", (req, res) => {
res.sendFile(path.join(__dirname, "public", "legales.html"));
});
app.get("/lobby", (req, res) => {
res.sendFile(path.join(__dirname, "public", "lobby.html"));
});
app.get("/reglas", (req, res) => {
res.sendFile(path.join(__dirname, "public", "reglas.html"));
});
app.get("/nueva-password", (req, res) => {
res.sendFile(path.join(__dirname, "public", "nueva-password.html"));
});
app.get("/ranking", (req, res) => {
res.sendFile(path.join(__dirname, "public", "ranking.html"));
});
app.get("/recuperar", (req, res) => {
res.sendFile(path.join(__dirname, "public", "recuperar.html"));
});
app.get("/admin", (req, res) => {
res.sendFile(path.join(__dirname, "public", "admin.html"));
});
app.get("/premio", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "premio.html"));
});
app.get("/recuperar-validar", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "recuperar-validar.html"));
});
// ============================
// LOGIN CON GOOGLE
// ============================
console.log("✅ Registrando ruta /auth/google");
console.log("✅ Server cargó hasta Passport");

app.get("/auth/google", (req, res, next) => {
    const origen = req.query.origen || "registro";
    const folio = req.query.folio || "";
    const numero = req.query.numero || "";
    const email = req.query.email || "";
    const state = Buffer.from(
        JSON.stringify({ origen, folio, numero, email })
    ).toString("base64");

    console.log("🟡 /auth/google");
    console.log("   origen =", origen);
    console.log("   folio  =", folio);
    console.log("   numero =", numero);

    passport.authenticate("google", {
        scope: ["profile", "email"],
        state
    })(req, res, next);
});

app.get("/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", (err, user, info) => {
        console.log("GOOGLE CALLBACK ERR:", err);
        console.log("GOOGLE CALLBACK USER:", user);
        console.log("GOOGLE CALLBACK INFO:", info);

        if (err) {
            return res.status(500).send("Error Google callback");
        }

        if (!user || !user.id) {
            return res.status(401).send("Google no devolvió usuario válido");
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.log("REQ.LOGIN ERROR:", loginErr);
                return res.status(500).send("Error al iniciar sesión con Google");
            }

            let origen = "registro";
            let folio = "";
            let numero = "";
            let emailEsperado = "";

            try {
    if (req.query.state) {
        const parsed = JSON.parse(
            Buffer.from(req.query.state, "base64").toString("utf8")
        );
        origen = parsed.origen || "registro";
        folio = parsed.folio || "";
        numero = parsed.numero || "";
        emailEsperado = parsed.email || "";
    }
} catch (e) {
    console.log("ERROR LEYENDO STATE GOOGLE:", e.message);
}

if (emailEsperado && user.email) {
    const emailGoogle = user.email.toLowerCase().trim();
    const emailForm = emailEsperado.toLowerCase().trim();
    if (emailGoogle !== emailForm) {
        console.log("⚠️ EMAIL GOOGLE NO COINCIDE:", { emailGoogle, emailForm });
        return res.redirect(`/registro.html?error=email_no_coincide`);
    }
}

            const id = encodeURIComponent(user.id || "");
            const nombre = encodeURIComponent(user.nombre || "");
            const apellidos = encodeURIComponent(user.apellidos || "");
            const email = encodeURIComponent(user.email || "");

            console.log("✅ GOOGLE OK");
            console.log("   origen final =", origen);
            console.log("   folio final  =", folio);
            console.log("   numero final =", numero);
            console.log("   user.id      =", user.id);

            if (origen === "home") {
                return res.redirect(`/portada.html?google=ok&id=${id}&nombre=${nombre}&apellidos=${apellidos}&email=${email}`);
            }

            if (folio) {
                return res.redirect(`/pago.html?folio=${encodeURIComponent(folio)}&google=ok&id=${id}&nombre=${nombre}&apellidos=${apellidos}&email=${email}`);
            }

            return res.redirect(`/portada.html?google=ok&id=${id}&nombre=${nombre}&apellidos=${apellidos}&email=${email}`);
        });
    })(req, res, next);
});
// ============================
// LOGIN CON FACEBOOK
// ============================
console.log("FACEBOOK_CALLBACK_URL ACTUAL:", process.env.FACEBOOK_CALLBACK_URL);
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL,
    profileFields: ["id", "displayName", "emails"]
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails && profile.emails[0]
            ? profile.emails[0].value.toLowerCase().trim()
            : "";

        if (!email) {
            return done(null, false);
        }

        db.get(
            `SELECT * FROM usuarios WHERE email = ?`,
            [email],
            (err, usuarioExistente) => {

                if (err) {
                    console.log("ERROR BUSCANDO USUARIO FACEBOOK:", err.message);
                    return done(err);
                }

                if (usuarioExistente) {

                    if (usuarioExistente.id) {
                        return done(null, usuarioExistente);
                    }

                    const nuevoIdExistente = "JUG-" + Date.now();

                    db.run(
                        `UPDATE usuarios SET id = ? WHERE email = ?`,
                        [nuevoIdExistente, email],
                        function(updateErr) {

                            if (updateErr) {
                                console.log("ERROR ACTUALIZANDO ID USUARIO FACEBOOK EXISTENTE:", updateErr.message);
                                return done(updateErr);
                            }

                            db.get(
                                `SELECT * FROM usuarios WHERE email = ?`,
                                [email],
                                (errActualizado, usuarioActualizado) => {
                                    if (errActualizado) {
                                        console.log("ERROR LEYENDO USUARIO FACEBOOK ACTUALIZADO:", errActualizado.message);
                                        return done(errActualizado);
                                    }

                                    return done(null, usuarioActualizado);
                                }
                            );
                        }
                    );

                    return;
                }

                const nombreCompleto = (profile.displayName || "").trim();
                const partes = nombreCompleto.split(" ");
                const nombre = partes[0] || "Usuario";
                const apellidos = partes.slice(1).join(" ") || "";
                const nuevoId = "JUG-" + Date.now();

                db.run(
                    `INSERT INTO usuarios
                    (id, nombre, apellidos, email, password, numeroComprado, folioTablero, mejorTiempoGlobal)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        nuevoId,
                        nombre,
                        apellidos,
                        email,
                        "facebook_oauth",
                        null,
                        null,
                        null
                    ],
                    function(insertErr) {

                        if (insertErr) {
                            console.log("ERROR INSERTANDO USUARIO FACEBOOK:", insertErr.message);
                            return done(insertErr);
                        }

                        db.get(
                            `SELECT * FROM usuarios WHERE id = ?`,
                            [nuevoId],
                            (errNuevo, nuevoUsuario) => {
                                if (errNuevo) {
                                    console.log("ERROR LEYENDO NUEVO USUARIO FACEBOOK:", errNuevo.message);
                                    return done(errNuevo);
                                }

                                return done(null, nuevoUsuario);
                            }
                        );
                    }
                );
            }
        );
    } catch (error) {
        console.log("ERROR GENERAL FACEBOOK:", error.message);
        return done(error);
    }
}));

app.get("/auth/facebook", (req, res, next) => {
    const origen = req.query.origen || "registro";
    const folio = req.query.folio || "";
    const numero = req.query.numero || "";
    const email = req.query.email || "";
    const stateObj = { origen, folio, numero, email };
    const stateEncoded = Buffer.from(JSON.stringify(stateObj)).toString("base64");
    console.log("🟦 /auth/facebook");
    console.log("   origen =", origen);
    console.log("   folio  =", folio);
    console.log("   numero =", numero);
    console.log("   email  =", email);
    passport.authenticate("facebook", {
        scope: ["email"],
        state: stateEncoded
    })(req, res, next);
});
console.log("Recibiendo la solicitud en /auth/facebook/callback");

app.get("/auth/facebook/callback", (req, res, next) => {
    passport.authenticate("facebook", (err, user, info) => {
        console.log("FACEBOOK CALLBACK ERR:", err);
        console.log("FACEBOOK CALLBACK USER:", user);
        console.log("FACEBOOK CALLBACK INFO:", info);

        if (err) {
            return res.status(500).send("Error en el callback de Facebook");
        }

        if (!user || !user.id) {
            return res.redirect("/registro.html?facebook=error");
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.log("REQ.LOGIN FACEBOOK ERROR:", loginErr);
                return res.status(500).send("Error al iniciar sesión con Facebook");
            }

            let origen = "registro";
let folio = "";
let emailEsperado = "";

try {
    if (req.query.state) {
        const parsed = JSON.parse(
            Buffer.from(req.query.state, "base64").toString("utf8")
        );
        origen = parsed.origen || "registro";
        folio = parsed.folio || "";
        emailEsperado = parsed.email || "";
    }
} catch (e) {
    console.log("ERROR LEYENDO STATE FACEBOOK:", e.message);
}

if (emailEsperado && user.email) {
    const emailFacebook = user.email.toLowerCase().trim();
    const emailForm = emailEsperado.toLowerCase().trim();
    if (emailFacebook !== emailForm) {
        console.log("⚠️ EMAIL FACEBOOK NO COINCIDE:", { emailFacebook, emailForm });
        return res.redirect(`/registro.html?error=email_no_coincide`);
    }
}

            const id = encodeURIComponent(user.id || "");
            const nombre = encodeURIComponent(user.nombre || "");
            const apellidos = encodeURIComponent(user.apellidos || "");
            const email = encodeURIComponent(user.email || "");

            console.log("✅ FACEBOOK OK");
            console.log("   origen final =", origen);
            console.log("   folio final  =", folio);
            console.log("   user.id      =", user.id);

            if (origen === "home") {
                return res.redirect(`/portada.html?facebook=ok&id=${id}&nombre=${nombre}&apellidos=${apellidos}&email=${email}`);
            }

            if (folio) {
                return res.redirect(`/pago.html?folio=${encodeURIComponent(folio)}&facebook=ok&id=${id}&nombre=${nombre}&apellidos=${apellidos}&email=${email}`);
            }

            return res.redirect(`/portada.html?facebook=ok&id=${id}&nombre=${nombre}&apellidos=${apellidos}&email=${email}`);
        });
    })(req, res, next);
});
// ============================
// FACEBOOK DATA DELETION CALLBACK
// ============================

function base64UrlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) {
        str += "=";
    }
    return Buffer.from(str, "base64");
}

function parseFacebookSignedRequest(signedRequest) {
    const [encodedSig, payload] = signedRequest.split(".", 2);

    if (!encodedSig || !payload) {
        return null;
    }

    const sig = base64UrlDecode(encodedSig);
    const data = JSON.parse(base64UrlDecode(payload).toString("utf8"));

    const expectedSig = crypto
        .createHmac("sha256", process.env.FACEBOOK_APP_SECRET)
        .update(payload)
        .digest();

    if (!crypto.timingSafeEqual(sig, expectedSig)) {
        console.error("Firma inválida en signed_request de Facebook");
        return null;
    }

    return data;
}

app.post("/facebook/data-deletion", express.urlencoded({ extended: false }), (req, res) => {
    try {
        const signedRequest = req.body.signed_request;

        if (!signedRequest) {
            return res.status(400).json({ error: "signed_request no recibido" });
        }

        const data = parseFacebookSignedRequest(signedRequest);

        if (!data || !data.user_id) {
            return res.status(400).json({ error: "signed_request inválido" });
        }

        const facebookUserId = data.user_id;
        const confirmationCode = "FBDEL-" + Date.now();
        const ahora = Date.now();

        console.log("Solicitud de eliminación Facebook recibida:", { facebookUserId, confirmationCode });

        // Buscar email del usuario en la BD
        db.get(`SELECT email FROM usuarios WHERE id = ?`, [facebookUserId], (err, usuario) => {
            const emailUsuario = usuario ? usuario.email : "desconocido";

            // Guardar solicitud en BD
            db.run(`INSERT INTO solicitudes_baja (facebookUserId, email, confirmationCode, estatus, fechaSolicitud)
                    VALUES (?, ?, ?, 'pendiente', ?)`,
                [facebookUserId, emailUsuario, confirmationCode, ahora],
                function(insertErr) {
                    if (insertErr) {
                        console.error("Error guardando solicitud baja:", insertErr.message);
                    }
                }
            );

            // Enviar email al admin
            transporter.sendMail({
                from: `"Quiz $1000" <${process.env.OUTLOOK_USER}>`,
                to: process.env.OUTLOOK_USER,
                subject: "⚠️ Solicitud de eliminación de datos — Facebook",
                html: `
                    <h2>Solicitud de eliminación de datos recibida</h2>
                    <p><b>Facebook User ID:</b> ${facebookUserId}</p>
                    <p><b>Email en BD:</b> ${emailUsuario}</p>
                    <p><b>Código:</b> ${confirmationCode}</p>
                    <p><b>Fecha:</b> ${new Date(ahora).toLocaleString("es-MX")}</p>
                    <p>Ingresa al panel de administrador para ejecutar la baja.</p>
                `
            }).catch(e => console.error("Error enviando email baja:", e.message));

            const statusUrl = `https://quiz1000-nuevo.onrender.com/facebook/data-deletion-status?id=${encodeURIComponent(confirmationCode)}`;

            return res.json({
                url: statusUrl,
                confirmation_code: confirmationCode
            });
        });

    } catch (error) {
        console.error("Error en /facebook/data-deletion:", error);
        return res.status(500).json({ error: "Error interno" });
    }
});

// Endpoint para obtener solicitudes de baja
app.get("/api/admin/solicitudes-baja", verificarAdmin, (req, res) => {
    db.all(`SELECT * FROM solicitudes_baja ORDER BY fechaSolicitud DESC`, [], (err, rows) => {
        if (err) return res.json({ ok: false });
        res.json({ ok: true, solicitudes: rows || [] });
    });
});

// Endpoint para ejecutar baja
app.post("/api/admin/ejecutar-baja", verificarAdmin, (req, res) => {
    const { id } = req.body;
    if (!id) return res.json({ ok: false, mensaje: "ID requerido" });

    db.get(`SELECT * FROM solicitudes_baja WHERE id = ?`, [id], (err, solicitud) => {
        if (err || !solicitud) return res.json({ ok: false, mensaje: "Solicitud no encontrada" });
        if (solicitud.estatus === "ejecutada") return res.json({ ok: false, mensaje: "Ya fue ejecutada" });

        // Anonimizar datos del usuario
        db.run(`UPDATE usuarios SET
            nombre = 'Usuario eliminado',
            apellidos = '',
            email = NULL,
            telefono = NULL,
            password = NULL,
            nacionalidad = NULL
            WHERE id = ?`,
            [solicitud.facebookUserId],
            function(updateErr) {
                if (updateErr) {
                    console.error("Error anonimizando usuario:", updateErr.message);
                    return res.json({ ok: false, mensaje: "Error ejecutando baja" });
                }

                // Marcar solicitud como ejecutada
                db.run(`UPDATE solicitudes_baja SET estatus = 'ejecutada', fechaEjecucion = ? WHERE id = ?`,
                    [Date.now(), id],
                    function(updateErr2) {
                        if (updateErr2) return res.json({ ok: false });
                        res.json({ ok: true, mensaje: "Baja ejecutada correctamente" });
                    }
                );
            }
        );
    });
});

app.get("/facebook/data-deletion-status", (req, res) => {
    const id = req.query.id || "";

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Eliminación de datos — QUIZ1000</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: Arial, sans-serif;
                    background: url("/assets/images/fondo-rayos.jpg") no-repeat center center fixed;
                    background-size: cover;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 30px 20px;
                }
                .logo {
                    width: 160px;
                    margin-bottom: 24px;
                }
                .box {
                    max-width: 560px;
                    width: 100%;
                    background: rgba(0,0,0,0.85);
                    border-radius: 16px;
                    padding: 36px 32px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                    color: white;
                    text-align: center;
                }
                .icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                }
                h1 {
                    font-size: 22px;
                    color: #00ffcc;
                    margin-bottom: 14px;
                }
                p {
                    font-size: 15px;
                    color: #cccccc;
                    line-height: 1.6;
                    margin-bottom: 14px;
                }
                .code-box {
                    background: #1a1a1a;
                    border: 1px solid #00ffcc;
                    border-radius: 8px;
                    padding: 12px 18px;
                    font-family: monospace;
                    font-size: 14px;
                    color: #00ffcc;
                    margin: 16px 0;
                    word-break: break-all;
                }
                .footer {
                    margin-top: 24px;
                    font-size: 12px;
                    color: #888;
                }
                @media (max-width: 480px) {
                    .box { padding: 24px 18px; }
                    h1 { font-size: 20px; }
                }
            </style>
        </head>
        <body>
            <img src="/assets/images/logotipo.png" class="logo" alt="Quiz1000">
            <div class="box">
                <div class="icon">🗑️</div>
                <h1>Solicitud de eliminación recibida</h1>
                <p>Tu solicitud de eliminación de datos de <strong>Quiz1000</strong> fue registrada correctamente.</p>
                <p>Procesaremos tu solicitud en un plazo máximo de <strong>30 días</strong> conforme a nuestra política de privacidad.</p>
                ${id ? `
                <p style="margin-bottom:4px;">Código de confirmación:</p>
                <div class="code-box">${id}</div>
                ` : ""}
                <p>Si necesitas ayuda adicional, contáctanos a través de los canales oficiales de Quiz1000.</p>
                <div class="footer">© 2026 Quiz1000 LLC. All rights reserved.</div>
            </div>
        </body>
        </html>
    `);
});

const FILE_PATH = path.join(__dirname, "public", "data", "preguntas.json");

const codigosEmail = {};
const preguntasAbiertas = {};
const tokensPremio = {};
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
// ============================
// BASE DE DATOS USUARIOS
// ============================

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "usuarios.db");
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
        const existeReembolsoProcesado = columnas.some(col => col.name === "reembolsoProcesado");
        const existePremioPagado = columnas.some(col => col.name === "premioPagado");

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

        if(!existeReembolsoProcesado){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE tableros ADD COLUMN reembolsoProcesado INTEGER DEFAULT 0`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna reembolsoProcesado:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna reembolsoProcesado agregada correctamente en tableros");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna reembolsoProcesado ya existe en tableros");
        }

        if(!existePremioPagado){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE tableros ADD COLUMN premioPagado INTEGER DEFAULT 0`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna premioPagado:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna premioPagado agregada correctamente en tableros");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna premioPagado ya existe en tableros");
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
function asegurarColumnasSolicitudesPremio(callback){

    db.all(`PRAGMA table_info(solicitudes_premio)`, [], (err, columnas) => {
        if(err){
            console.log("Error consultando columnas de solicitudes_premio:", err.message);
            if(callback) return callback(err);
            return;
        }

        const existeGanadorId = columnas.some(col => col.name === "ganadorId");
        const existeBanco = columnas.some(col => col.name === "banco");
        const existeCuenta = columnas.some(col => col.name === "cuenta");
        const existeClabe = columnas.some(col => col.name === "clabe");
        const existeTipoDocumento = columnas.some(col => col.name === "tipoDocumento");
        const existeEstatus = columnas.some(col => col.name === "estatus");
        const existeFechaSolicitud = columnas.some(col => col.name === "fechaSolicitud");

        const tareas = [];

        if(!existeGanadorId){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE solicitudes_premio ADD COLUMN ganadorId TEXT`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna ganadorId:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna ganadorId agregada correctamente en solicitudes_premio");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna ganadorId ya existe en solicitudes_premio");
        }

        if(!existeBanco){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE solicitudes_premio ADD COLUMN banco TEXT`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna banco:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna banco agregada correctamente en solicitudes_premio");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna banco ya existe en solicitudes_premio");
        }

        if(!existeCuenta){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE solicitudes_premio ADD COLUMN cuenta TEXT`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna cuenta:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna cuenta agregada correctamente en solicitudes_premio");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna cuenta ya existe en solicitudes_premio");
        }

        if(!existeClabe){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE solicitudes_premio ADD COLUMN clabe TEXT`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna clabe:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna clabe agregada correctamente en solicitudes_premio");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna clabe ya existe en solicitudes_premio");
        }

        if(!existeTipoDocumento){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE solicitudes_premio ADD COLUMN tipoDocumento TEXT`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna tipoDocumento:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna tipoDocumento agregada correctamente en solicitudes_premio");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna tipoDocumento ya existe en solicitudes_premio");
        }

        if(!existeEstatus){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE solicitudes_premio ADD COLUMN estatus TEXT DEFAULT 'pendiente'`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna estatus:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna estatus agregada correctamente en solicitudes_premio");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna estatus ya existe en solicitudes_premio");
        }

        if(!existeFechaSolicitud){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE solicitudes_premio ADD COLUMN fechaSolicitud INTEGER`,
                    [],
                    (errAlter) => {
                        if(errAlter){
                            console.log("Error agregando columna fechaSolicitud:", errAlter.message);
                            return done(errAlter);
                        }

                        console.log("Columna fechaSolicitud agregada correctamente en solicitudes_premio");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna fechaSolicitud ya existe en solicitudes_premio");
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
// MIGRACION: columnas bajaEmail / bajaWhatsapp en usuarios
// ============================
function asegurarColumnasNotificacionesUsuarios(callback){
    db.all(`PRAGMA table_info(usuarios)`, [], (err, columnas) => {
        if(err){
            console.log("Error consultando columnas de usuarios:", err.message);
            if(callback) return callback(err);
            return;
        }

        const existeBajaEmail    = columnas.some(col => col.name === "bajaEmail");
        const existeBajaWhatsapp  = columnas.some(col => col.name === "bajaWhatsapp");
        const existeAceptaCorreos = columnas.some(col => col.name === "aceptaCorreos");
        const tareas = [];

        if(!existeBajaEmail){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE usuarios ADD COLUMN bajaEmail INTEGER DEFAULT 0`,
                    [],
                    (errAlter) => {
                        if(errAlter){ console.log("Error agregando bajaEmail:", errAlter.message); return done(errAlter); }
                        console.log("Columna bajaEmail agregada en usuarios");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna bajaEmail ya existe en usuarios");
        }

        if(!existeBajaWhatsapp){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE usuarios ADD COLUMN bajaWhatsapp INTEGER DEFAULT 0`,
                    [],
                    (errAlter) => {
                        if(errAlter){ console.log("Error agregando bajaWhatsapp:", errAlter.message); return done(errAlter); }
                        console.log("Columna bajaWhatsapp agregada en usuarios");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna bajaWhatsapp ya existe en usuarios");
        }

        if(!existeAceptaCorreos){
            tareas.push((done) => {
                db.run(
                    `ALTER TABLE usuarios ADD COLUMN aceptaCorreos INTEGER DEFAULT 1`,
                    [],
                    (errAlter) => {
                        if(errAlter){ console.log("Error agregando aceptaCorreos:", errAlter.message); return done(errAlter); }
                        console.log("Columna aceptaCorreos agregada en usuarios");
                        done(null);
                    }
                );
            });
        }else{
            console.log("Columna aceptaCorreos ya existe en usuarios");
        }

        if(tareas.length === 0){
            if(callback) return callback(null);
            return;
        }

        let index = 0;
        function ejecutarSiguiente(error){
            if(error){ if(callback) return callback(error); return; }
            if(index >= tareas.length){ if(callback) return callback(null); return; }
            const tarea = tareas[index++];
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

                        db.run(`CREATE TABLE IF NOT EXISTS solicitudes_baja (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        facebookUserId TEXT,
                        email TEXT,
                        confirmationCode TEXT,
                        estatus TEXT DEFAULT 'pendiente',
                        fechaSolicitud INTEGER,
                        fechaEjecucion INTEGER
                            )`, (errBaja) => {
                                 if (errBaja) console.log("Error creando tabla solicitudes_baja:", errBaja.message);
                                     else console.log("Tabla solicitudes_baja verificada");
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
folioTablero,
aceptaCorreos
} = req.body;

console.log("BODY /registro:", req.body);

try{

const hash = await bcrypt.hash(password,10);

const id = "JUG-" + Date.now();

console.log("ID GENERADO /registro:", id);

db.run(

`INSERT INTO usuarios
(id,nombre,apellidos,edad,nacionalidad,telefono,email,password,numeroComprado,folioTablero,mejorTiempoGlobal,aceptaCorreos)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,

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
null,
aceptaCorreos ?? 1
],

function(err){

if(err){
console.log("ERROR INSERTANDO USUARIO:", err);

if(String(err.message).includes("UNIQUE constraint failed: usuarios.email")){

db.get(
`SELECT id,nombre,apellidos,email,telefono FROM usuarios WHERE email = ?`,
[email],
(existingErr, existingUser) => {

if(existingErr || !existingUser){
return res.json({ ok:false, mensaje:"Usuario o email ya existen" });
}

return res.json({
ok:true,
id: existingUser.id,
usuario: existingUser,
yaExistia: true
});

}
);

return;
}

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

const { id, email, telefono, password, edad, bajaEmail, bajaWhatsapp } = req.body;

let query;
let params;

if(password){
    const hash = await bcrypt.hash(password, 10);
    query = `UPDATE usuarios SET email=?, telefono=?, password=?, edad=?, bajaEmail=?, bajaWhatsapp=? WHERE id=?`;
    params = [email, telefono, hash, edad, bajaEmail ?? 0, bajaWhatsapp ?? 0, id];
} else {
    query = `UPDATE usuarios SET email=?, telefono=?, edad=?, bajaEmail=?, bajaWhatsapp=? WHERE id=?`;
    params = [email, telefono, edad, bajaEmail ?? 0, bajaWhatsapp ?? 0, id];
}

db.run(query,params,function(err){

if(err){
    console.log("Error actualizando perfil:", err.message);
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
// GUARDAR PREGUNTAS
// =============================
app.post("/api/preguntas", (req, res) => {

    const preguntas = req.body;

    if (!Array.isArray(preguntas)) {
        return res.status(400).json({
            ok: false,
            error: "Formato inválido: se esperaba un arreglo"
        });
    }

    for (let i = 0; i < preguntas.length; i++) {
        const item = preguntas[i];

        if (
            !item ||
            typeof item.pregunta !== "string" ||
            item.pregunta.trim() === "" ||
            typeof item.resultado !== "number"
        ) {
            return res.status(400).json({
                ok: false,
                error: `Pregunta inválida en posición ${i}`
            });
        }
    }

    fs.writeFile(
        FILE_PATH,
        JSON.stringify(preguntas, null, 2),
        "utf8",
        (err) => {
            if (err) {
                console.error("ERROR GUARDANDO PREGUNTAS:", err);
                return res.status(500).json({
                    ok: false,
                    error: "Error guardando preguntas"
                });
            }

            console.log("✅ PREGUNTAS ACTUALIZADAS:", preguntas.length);

            res.json({
                ok: true,
                total: preguntas.length
            });
        }
    );

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
    const expiraReserva = ahora + 900000;

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

app.get("/admin/tablero", verificarAdmin, (req, res) => {

    const filePath = path.join(__dirname, "public", "data", "tablero.json");

    try {

        const data = fs.readFileSync(filePath, "utf8");
        const tablero = JSON.parse(data);
        const casillas = tablero.casillas || [];

        // Obtener jugadorIds únicos para cruzar con usuarios
        const ids = [...new Set(casillas.map(c => c.jugador).filter(Boolean))];

        if(ids.length === 0){
            return res.json({
                completo: tablero.completo || false,
                ocupadas: casillas.length,
                restantes: 50 - casillas.length,
                casillas
            });
        }

        const placeholders = ids.map(() => "?").join(",");
        db.all(
            `SELECT id, email FROM usuarios WHERE id IN (${placeholders})`,
            ids,
            (err, usuarios) => {
                const emailMap = {};
                (usuarios || []).forEach(u => { emailMap[u.id] = u.email; });

                const casillasEnriquecidas = casillas.map(c => ({
                    ...c,
                    email: (c.email && c.email !== "pendiente")
                        ? c.email
                        : (emailMap[c.jugador] || c.email || "pendiente")
                }));

                res.json({
                    completo: tablero.completo || false,
                    ocupadas: casillasEnriquecidas.length,
                    restantes: 50 - casillasEnriquecidas.length,
                    casillas: casillasEnriquecidas
                });
            }
        );

    } catch (error) {

        console.error("Error leyendo tablero admin:", error);

        res.status(500).json({
            error: "Error leyendo tablero"
        });

    }

});
app.post("/admin/reset", (req,res)=>{
    const key = req.headers["x-admin-key"];
    if(!key || key !== process.env.ADMIN_SECRET_KEY){
        return res.status(403).json({ ok:false, mensaje:"No autorizado" });
    }
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
// =============================
// ADMIN: TABLEROS INCOMPLETOS + REEMBOLSOS
// =============================
app.get("/admin/tableros-incompletos", (req, res) => {

    db.all(`
        SELECT
            id,
            completo,
            fechaCreacion,
            fechaApertura,
            estadoReembolso,
            fechaInicioReembolso,
            fechaFinReembolso,
            reembolsoProcesado,
            premioPagado
        FROM tableros
        WHERE completo = 0
        ORDER BY fechaCreacion DESC
    `, [], (err, rows) => {

        if(err){
            console.log("❌ ERROR TABLEROS INCOMPLETOS:", err.message);
            return res.json({ ok:false });
        }

        const ahora = Date.now();
        const DIEZ_DIAS = 10 * 24 * 60 * 60 * 1000;

        const resultado = rows.map(t => {

            let estatus = "activo";

            if(t.fechaApertura){
                const transcurrido = ahora - t.fechaApertura;

                if(transcurrido >= DIEZ_DIAS){
                    estatus = "vencido";
                }
            }

            if(t.estadoReembolso === "en_proceso"){
                estatus = "reembolso_en_proceso";
            }

            if(t.reembolsoProcesado === 1){
                estatus = "reembolsado";
            }

            return {
                ...t,
                estatus
            };
        });

        res.json({
            ok:true,
            total: resultado.length,
            tableros: resultado
        });

    });

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
    const minutos = parseFloat(partes[0]) || 0;
    const segundos = parseFloat(partes[1]) || 0;
    const decimas = parseFloat(partes[2]) || 0;
    const centesimas = parseFloat(partes[3]) || 0;
    return (minutos * 60) + segundos + (decimas / 10) + (centesimas / 100);
}

function detectarTablerosVencidos(){

    const ahora = Date.now();
    const DIEZ_DIAS = 10 * 24 * 60 * 60 * 1000;

    db.all(`
        SELECT id, fechaApertura, completo, reembolsoProcesado
        FROM tableros
        WHERE completo = 0
    `, [], (err, tableros) => {

        if(err){
            console.log("Error consultando tableros para vencimiento:", err.message);
            return;
        }

        tableros.forEach(tablero => {

            if(!tablero.fechaApertura) return;

            const tiempoTranscurrido = ahora - tablero.fechaApertura;

            if(tiempoTranscurrido >= DIEZ_DIAS){

                console.log("⏰ TABLERO VENCIDO:", tablero.id);

            }

        });

    });

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
function generarTokenPremio({ folio, jugadorId, expira }) {
    const payload = `${folio}|${jugadorId}|${expira}`;
    const firma = crypto
        .createHmac("sha256", MP_ACCESS_TOKEN)
        .update(payload)
        .digest("hex");

    return Buffer.from(`${payload}|${firma}`).toString("base64url");
}

function construirUrlPremioTemporal({ folio, token }) {
    return `https://quiz1000-nuevo.onrender.com/premio.html?folio=${encodeURIComponent(folio)}&token=${encodeURIComponent(token)}`;
}

function construirMensajesGanador({ ganador, folio, urlPremio }) {
    const nombreCompleto = `${ganador.nombre || ""} ${ganador.apellidos || ""}`.trim() || "Ganador(a)";
    const casilla = ganador.casillaGanadora || ganador.casilla || "N/D";
    const tiempo = ganador.mejorTiempo || ganador.tiempo || "N/D";

    const mensajeApp =
        `¡Felicidades ${nombreCompleto}! Ganaste el tablero ${folio} en QUIZ1000 con un mejor tiempo de ${tiempo} en la casilla ${casilla}. ` +
        `Para validar tu premio, entra aquí: ${urlPremio}`;

    const mensajeEmail = `
Hola ${nombreCompleto},

¡Felicidades! Has resultado ganador(a) del tablero ${folio} en QUIZ1000.

Tu mejor tiempo registrado fue: ${tiempo}
Casilla ganadora: ${casilla}

Para continuar con la validación de tu premio, por favor entra al siguiente enlace:
${urlPremio}

Ahí podrás capturar tus datos y subir tu identificación.

Equipo QUIZ1000
`.trim();

    const mensajeWhatsApp =
        `🏆 ¡Felicidades ${nombreCompleto}! Ganaste el tablero ${folio} en QUIZ1000.\n` +
        `⏱️ Mejor tiempo: ${tiempo}\n` +
        `🎯 Casilla ganadora: ${casilla}\n\n` +
        `Para validar tu premio, captura tus datos aquí:\n${urlPremio}`;

    return {
        app: mensajeApp,
        email: mensajeEmail,
        whatsapp: mensajeWhatsApp
    };
}

async function obtenerGanadorTableroParaNotificacion(tableroId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT
                tableroId,
                ganadorId,
                ganadorNombre,
                mejorTiempoTexto,
                resumenJson,
                fechaCierre
            FROM rankings_tableros
            WHERE tableroId = ?
            LIMIT 1
        `, [tableroId], (err, row) => {
            if (err) {
                console.error("❌ Error consultando ganador en rankings_tableros:", err);
                return reject(err);
            }

            if (!row) {
                console.log("⚠️ No se encontró ganador en rankings_tableros para:", tableroId);
                return resolve(null);
            }

            let resumen = null;

            try {
                resumen = row.resumenJson ? JSON.parse(row.resumenJson) : null;
            } catch (e) {
                resumen = null;
            }

            let nombre = row.ganadorNombre || "Jugador";
            let apellidos = "";
            let email = "";
            let casillaGanadora = null;

            if (resumen && resumen.ganador) {
                if (resumen.ganador.nombreSolo) {
                    nombre = resumen.ganador.nombreSolo;
                } else if (resumen.ganador.nombre) {
                    nombre = resumen.ganador.nombre;
                }

                apellidos = resumen.ganador.apellidos || "";
                email = resumen.ganador.email || "";

                if (Array.isArray(resumen.ganador.tiempos)) {
                    const coincidencia = resumen.ganador.tiempos.find(
                        t => t.tiempo === row.mejorTiempoTexto
                    );

                    if (coincidencia) {
                        casillaGanadora = Number(coincidencia.numero) || null;
                    }
                }
            }

            resolve({
                tableroId: row.tableroId,
                jugadorId: row.ganadorId,
                nombre,
                apellidos,
                email,
                mejorTiempo: row.mejorTiempoTexto,
                casillaGanadora,
                fechaCierre: row.fechaCierre || null
            });
        });
    });
}

async function obtenerTelefonoJugadorPorGanador(ganador) {
    return new Promise((resolve, reject) => {
        if (!ganador || !ganador.jugadorId) {
            return resolve(null);
        }

        db.get(`
            SELECT telefono
            FROM usuarios
            WHERE id = ?
            LIMIT 1
        `, [ganador.jugadorId], (err, row) => {
            if (err) {
                console.error("❌ Error consultando teléfono del ganador:", err);
                return reject(err);
            }

            resolve(row?.telefono || null);
        });
    });
}

async function prepararNotificacionGanadorTemporal(folio) {
    const ganador = await obtenerGanadorTableroParaNotificacion(folio);

    if (!ganador) {
        return {
            ok: false,
            mensaje: "No se encontró ganador para este tablero",
            ganador: null
        };
    }

    const telefono = await obtenerTelefonoJugadorPorGanador(ganador);

const ahora = Date.now();
const expiracionMs = ahora + (3 * 24 * 60 * 60 * 1000);

const token = generarTokenPremio({
    folio,
    jugadorId: ganador.jugadorId,
    expira: expiracionMs
});

    const urlPremio = construirUrlPremioTemporal({
        folio,
        token
    });

    const mensajes = construirMensajesGanador({
        ganador,
        folio,
        urlPremio
    });

    return {
        ok: true,
        folio,
        ganador: {
            tableroId: ganador.tableroId,
            jugadorId: ganador.jugadorId,
            nombre: ganador.nombre,
            apellidos: ganador.apellidos,
            email: ganador.email,
            telefono,
            mejorTiempo: ganador.mejorTiempo,
            casillaGanadora: ganador.casillaGanadora
        },
        tokenTemporal: token,
        fechaCreacion: ahora,
        fechaExpiracion: expiracionMs,
        urlPremio,
        mensajes
    };
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
                    <a href="https://quiz1000-nuevo.onrender.com/ranking">
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
// ADMIN: DETALLE TABLERO COMPLETO
// =============================
app.get("/api/admin/tablero-detalle/:folio", verificarAdmin, (req, res) => {

    const folio = req.params.folio;

    db.all(`
        SELECT jugador, casilla, email, tiempo
        FROM casillas
        WHERE tableroId = ?
        AND estado = 'pagada'
        ORDER BY casilla ASC
    `, [folio], (err, rows) => {

        if (err) {
            console.error("ERROR DETALLE TABLERO:", err.message);
            return res.json({ ok:false });
        }

        res.json({
            ok: true,
            casillas: rows
        });

    });

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
app.get("/api/premio/:folio", (req, res) => {

    const folio = req.params.folio;

    db.get(`
        SELECT
            tableroId,
            ganadorId,
            ganadorNombre,
            mejorTiempoTexto,
            resumenJson,
            fechaCierre
        FROM rankings_tableros
        WHERE tableroId = ?
    `, [folio], (err, row) => {

        if(err){
            console.log("ERROR /api/premio/:folio:", err.message);
            return res.json({
                ok:false,
                mensaje:"Error consultando premio"
            });
        }

        if(!row){
            return res.json({
                ok:false,
                mensaje:"No existe ranking guardado para este tablero"
            });
        }

        let resumen = null;

        try{
            resumen = row.resumenJson ? JSON.parse(row.resumenJson) : null;
        }catch(e){
            resumen = null;
        }

        let casillaGanadora = null;
        let apellidos = "";
        let email = "";
        let nombre = row.ganadorNombre || "Jugador";

        if(
            resumen &&
            resumen.ganador &&
            Array.isArray(resumen.ganador.tiempos)
        ){
            const tiempos = resumen.ganador.tiempos;

            const coincidencia = tiempos.find(t => t.tiempo === row.mejorTiempoTexto);

            if(coincidencia){
                casillaGanadora = Number(coincidencia.numero) || null;
            }

            if(resumen.ganador.apellidos){
                apellidos = resumen.ganador.apellidos;
            }

            if(resumen.ganador.email){
                email = resumen.ganador.email;
            }

            if(resumen.ganador.nombreSolo){
                nombre = resumen.ganador.nombreSolo;
            }else if(resumen.ganador.nombre){
                nombre = resumen.ganador.nombre;
            }
        }

        return res.json({
            ok:true,
            premio:{
                folio: row.tableroId,
                ganadorId: row.ganadorId || null,
                nombre: nombre,
                apellidos: apellidos,
                email: email,
                mejorTiempoTexto: row.mejorTiempoTexto || "",
                casillaGanadora: casillaGanadora,
                fechaCierre: row.fechaCierre || null
            }
        });

    });

});
// ── MIS PREMIOS ──
app.get('/api/mis-premios/:jugadorId', (req, res) => {
    const jugadorId = String(req.params.jugadorId);
    db.all(
        `SELECT tableroId, mejorTiempoTexto, fechaCierre
         FROM rankings_tableros
         WHERE ganadorId = ?
         ORDER BY fechaCierre DESC`,
        [jugadorId],
        (err, rows) => {
            if(err){ return res.json({ ok: false, error: err.message }); }
            const premios = (rows || []).map(row => ({
                folio:       row.tableroId,
                mejorTiempo: row.mejorTiempoTexto || "N/D",
                fechaCierre: row.fechaCierre || null
            }));
            res.json({ ok: true, premios });
        }
    );
});
app.get("/api/rankings", (req, res) => {
    db.all(`
        SELECT tableroId, ganadorId, ganadorNombre, mejorTiempoTexto,
               mejorTiempoNumero, totalParticipantes, resumenJson, fechaCierre
        FROM rankings_tableros
        ORDER BY fechaCierre DESC
    `, [], (err, rows) => {
        if(err){
            console.log("ERROR LISTANDO RANKINGS:", err.message);
            return res.json({ ok:false, rankings:[] });
        }

        const tableroIds = (rows || []).map(r => r.tableroId);
        if(tableroIds.length === 0){
            return res.json({ ok:true, total:0, rankings:[] });
        }

        const placeholders = tableroIds.map(() => "?").join(",");
        db.all(`
            SELECT tableroId, observaciones FROM pagos_mp
            WHERE tableroId IN (${placeholders})
            AND observaciones LIKE '%tc:%'
        `, tableroIds, (errPagos, pagosRows) => {
            const tcMap = {};
            (pagosRows || []).forEach(p => {
                if(!tcMap[p.tableroId] && p.observaciones){
                    const match = p.observaciones.match(/tc:([0-9.]+)/);
                    if(match) tcMap[p.tableroId] = match[1];
                }
            });

            const rankings = (rows || []).map(row => {
                let resumen = null;
                try{ resumen = row.resumenJson ? JSON.parse(row.resumenJson) : null; }
                catch(e){ resumen = null; }
                return {
                    tableroId: row.tableroId,
                    ganadorId: row.ganadorId,
                    ganadorNombre: row.ganadorNombre,
                    mejorTiempoTexto: row.mejorTiempoTexto,
                    mejorTiempoNumero: row.mejorTiempoNumero,
                    totalParticipantes: row.totalParticipantes,
                    fechaCierre: row.fechaCierre,
                    tipoCambioCobro: tcMap[row.tableroId] || "N/D",
                    ranking: resumen
                };
            });
            res.json({ ok:true, total: rankings.length, rankings });
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
const tipoCambioMetadata = metadata.tipoCambioCobro || metadata.tipo_cambio_cobro || null;
console.log("🧾 tipoCambioCobro en metadata:", tipoCambioMetadata);

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
            `pago_aprobado|tc:${tipoCambioMetadata || "no_registrado"}`
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
                            <a href="https://quiz1000-nuevo.onrender.com/perfil">Mi perfil</a>
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
        console.log("🧾 BODY /crear-pago:", { folio, jugadorId, totalItems: items?.length || 0 });

        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Carrito vacío" });
        }

        console.log("🧾 Antes de obtener tipoCambioCobro");
        const tipoCambioCobroRaw = await obtenerConfiguracion("tipoCambioCobro");
        console.log("🧾 tipoCambioCobroRaw:", tipoCambioCobroRaw);

        const tipoCambioCobro = Number(tipoCambioCobroRaw || 20);
        console.log("🧾 tipoCambioCobro final:", tipoCambioCobro);

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
                success: `https://quiz1000-nuevo.onrender.com/perfil.html?folio=${folio}&pago=success`,
                failure: `https://quiz1000-nuevo.onrender.com/pago.html?folio=${folio}&pago=failure`,
                pending: `https://quiz1000-nuevo.onrender.com/perfil.html?folio=${folio}&pago=pending`
            },

            auto_return: "approved",
            notification_url: "https://quiz1000-nuevo.onrender.com/webhook/mercadopago"
        };

        console.log("🧾 Preference lista para enviar:", JSON.stringify(preference, null, 2));

        const preferenceClient = new Preference(client);

        console.log("🧾 Antes de preferenceClient.create");
        const response = await preferenceClient.create({
            body: preference
        });
        console.log("🧾 Respuesta completa SDK:", JSON.stringify(response, null, 2));

        const link =
            response?.body?.sandbox_init_point ||
            response?.body?.init_point ||
            response?.sandbox_init_point ||
            response?.init_point ||
            null;

        console.log("🧾 LINK FINAL:", link);

        if (!link) {
            console.log("❌ No se recibió link de Mercado Pago");
            return res.status(500).json({ error: "Mercado Pago no devolvió link" });
        }

        return res.json({ link });

    } catch (error) {
        console.log("❌ ERROR SDK /crear-pago:", error);
        return res.status(500).json({ error: "Error creando pago" });
    }
});
// =============================
// ADMIN - OBTENER TIPO DE CAMBIO
// =============================
app.get("/api/admin/tipo-cambio", verificarAdmin, (req, res) => {
    db.get(`SELECT valor FROM configuracion WHERE clave = 'tipoCambioCobro'`, [], (err1, row1) => {
        if (err1) return res.json({ ok: false });
        db.get(`SELECT valor FROM configuracion WHERE clave = 'tipoCambioPremio'`, [], (err2, row2) => {
            if (err2) return res.json({ ok: false });
            res.json({
                ok: true,
                tipoCambioCobro: row1 ? row1.valor : "",
                tipoCambioPremio: row2 ? row2.valor : ""
            });
        });
    });
});
app.post("/api/admin/tipo-cambio", verificarAdmin, (req, res) => {
    const tipoCambioCobro = Number(req.body.tipoCambioCobro);
    const tipoCambioPremio = Number(req.body.tipoCambioPremio);

    if(!tipoCambioCobro || tipoCambioCobro <= 0 || !tipoCambioPremio || tipoCambioPremio <= 0){
        return res.status(400).json({ ok: false, mensaje: "Valores inválidos" });
    }

    db.run(
        `INSERT INTO configuracion (clave, valor)
         VALUES ('tipoCambioCobro', ?)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
        [tipoCambioCobro.toFixed(2)],
        function(err){
            if(err){
                console.log("❌ ERROR SQL tipoCambioCobro:", err.message);
                return res.status(500).json({ ok: false });
            }
            db.run(
                `INSERT INTO configuracion (clave, valor)
                 VALUES ('tipoCambioPremio', ?)
                 ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
                [tipoCambioPremio.toFixed(2)],
                function(err2){
                    if(err2){
                        console.log("❌ ERROR SQL tipoCambioPremio:", err2.message);
                        return res.status(500).json({ ok: false });
                    }
                    console.log("✅ Tipo de cambio actualizado:", tipoCambioCobro, tipoCambioPremio);
                    res.json({
                        ok: true,
                        tipoCambioCobro: tipoCambioCobro.toFixed(2),
                        tipoCambioPremio: tipoCambioPremio.toFixed(2)
                    });
                }
            );
        }
    );
});
// =============================
// CARRUSEL DE GANADORES - PORTADA
// =============================
app.get("/api/carrusel-ganadores", (req, res) => {
    const ganadores = [
        { nombre: "Luis Antonio M.", estado: "Nuevo León", inversion: 2 },
        { nombre: "Flor G.", estado: "Quintana Roo", inversion: 9 },
        { nombre: "Santiago P.", estado: "Sonora", inversion: 15 },
        { nombre: "Agustín H.", estado: "Aguascalientes", inversion: 36 },
        { nombre: "Alfredo F.", estado: "Tabasco", inversion: 50 },
        { nombre: "Cinthya J.", estado: "Colima", inversion: 22 },
        { nombre: "Berenice T.", estado: "CDMX", inversion: 18 },
        { nombre: "Javier L.", estado: "Tlaxcala", inversion: 1 },
        { nombre: "Francisco D.", estado: "Tamaulipas", inversion: 34 },
        { nombre: "Viridiana T.", estado: "Baja California", inversion: 23 },
        { nombre: "Raúl P.", estado: "Querétaro", inversion: 7 },
        { nombre: "Ángel P.", estado: "Chiapas", inversion: 41 },
        { nombre: "Pablo A.", estado: "Jalisco", inversion: 8 },
        { nombre: "Sergio R.", estado: "Durango", inversion: 33 },
        { nombre: "Mario D.", estado: "Zacatecas", inversion: 19 },
        { nombre: "Ana K.", estado: "Puebla", inversion: 21 },
        { nombre: "Nadia J.", estado: "Estado de México", inversion: 35 },
        { nombre: "Laura P.", estado: "Hidalgo", inversion: 6 },
        { nombre: "Diana C.", estado: "Veracruz", inversion: 28 },
        { nombre: "Maricarmen M.", estado: "Michoacán", inversion: 5 },
        { nombre: "Miguel A.", estado: "Sinaloa", inversion: 47 },
        { nombre: "Paula N.", estado: "Yucatán", inversion: 9 },
        { nombre: "Ernesto F.", estado: "Nayarit", inversion: 10 },
        { nombre: "José M.", estado: "Coahuila", inversion: 49 },
        { nombre: "Ángel C.", estado: "San Luis Potosí", inversion: 31 },
        { nombre: "José Ramón T.", estado: "Morelos", inversion: 4 },
        { nombre: "Elsa R.", estado: "Guanajuato", inversion: 11 },
        { nombre: "Mauricio F.", estado: "Oaxaca", inversion: 36 },
        { nombre: "Susana J.", estado: "Guerrero", inversion: 50 },
        { nombre: "Eugenio R.", estado: "Quintana R", inversion: 36 },
        { nombre: "Raquel V.", estado: "Baja California S", inversion: 16 },
        { nombre: "Marco T.", estado: "Chihuahua", inversion: 44 }
    ];

    db.get(
        `SELECT valor FROM configuracion WHERE clave = 'tipoCambioPremio'`,
        [],
        (err, row) => {
            if (err) {
                console.log("Error leyendo tipoCambioPremio para carrusel:", err);
                return res.status(500).json({ ok: false });
            }

            const tipoCambioPremio = parseFloat(row?.valor || "19.50");
            const montoPesos = Math.round(1000 * tipoCambioPremio);

            const mensajes = ganadores.map(item => ({
                nombre: item.nombre,
                estado: item.estado,
                inversion: item.inversion,
                premioUsd: 1000,
                premioPesos: montoPesos,
                texto: `${item.nombre} de ${item.estado} acaba de ganar 1,000 USD en pesos $${montoPesos.toLocaleString("es-MX")} con sólo ${item.inversion} USD`
            }));

            res.json({
                ok: true,
                tipoCambioPremio,
                premioPesos: montoPesos,
                mensajes
            });
        }
    );
});
app.get("/api/debug/configuracion-esquema", (req, res) => {
    db.all(`PRAGMA table_info(configuracion)`, [], (err, columnas) => {
        if(err){
            console.log("❌ ERROR PRAGMA configuracion:", err.message);
            return res.status(500).json({ ok:false, error: err.message });
        }

        db.all(`PRAGMA index_list(configuracion)`, [], (err2, indices) => {
            if(err2){
                console.log("❌ ERROR INDEX LIST configuracion:", err2.message);
                return res.status(500).json({ ok:false, error: err2.message });
            }

            res.json({
                ok:true,
                columnas,
                indices
            });
        });
    });
});
app.get("/api/debug/tableros-esquema", (req, res) => {
    db.all(`PRAGMA table_info(tableros)`, [], (err, columnas) => {
        if(err){
            console.log("❌ ERROR PRAGMA tableros:", err.message);
            return res.status(500).json({ ok:false, error: err.message });
        }

        db.all(`PRAGMA index_list(tableros)`, [], (err2, indices) => {
            if(err2){
                console.log("❌ ERROR INDEX LIST tableros:", err2.message);
                return res.status(500).json({ ok:false, error: err2.message });
            }

            res.json({
                ok:true,
                columnas,
                indices
            });
        });
    });
});
// =============================
// ADMIN: TABLEROS COMPLETOS
// =============================
app.get("/api/admin/tableros-completos", verificarAdmin, (req, res) => {

    db.all(`
        SELECT 
            t.id,
            t.completo,
            COUNT(c.id) as totalPagadas
        FROM tableros t
        LEFT JOIN casillas c 
            ON t.id = c.tableroId 
            AND c.estado = 'pagada'
        GROUP BY t.id
        HAVING totalPagadas = 50
        ORDER BY t.fechaCreacion DESC
    `, [], (err, rows) => {

        if (err) {
            console.error("ERROR TABLEROS COMPLETOS:", err.message);
            return res.json({ ok:false });
        }

        res.json({
            ok: true,
            tableros: rows
        });

    });

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
app.post("/api/premio/solicitud", uploadPremio.single("archivoDocumentoPremio"), (req, res) => {

    const {
        folio,
        ganadorId,
        banco,
        cuenta,
        clabe,
        tipoDocumento
    } = req.body;

    const archivo = req.file;

    console.log("BODY SOLICITUD PREMIO:", req.body);
    console.log("ARCHIVO RECIBIDO PREMIO:", req.file);

    if(!folio || !ganadorId || !banco || !cuenta || !clabe || !tipoDocumento || !archivo){
    return res.json({
        ok:false,
        mensaje:"Faltan datos obligatorios",
        debug: {
            folio,
            ganadorId,
            banco,
            cuenta,
            clabe,
            tipoDocumento,
            archivo: archivo ? {
                fieldname: archivo.fieldname,
                originalname: archivo.originalname,
                filename: archivo.filename
            } : null
        }
    });
}

    db.get(`
        SELECT nombre, apellidos, email, telefono
        FROM usuarios
        WHERE id = ?
    `, [ganadorId], (errUsuario, usuario) => {

        console.log("USUARIO GANADOR ENCONTRADO:", usuario);

        if(errUsuario){
            console.log("ERROR consultando usuario ganador:", errUsuario.message);
            return res.json({
                ok:false,
                mensaje:"Error consultando datos del ganador"
            });
        }

        if(!usuario){
            return res.json({
                ok:false,
                mensaje:"No se encontró el ganador"
            });
        }

        const nombreCompleto = `${usuario.nombre || ""} ${usuario.apellidos || ""}`.trim();
        const identificacionPath = `/uploads/premios/${archivo.filename}`;

        console.log("DATOS A INSERTAR EN SOLICITUD:", {
            folio,
            ganadorId,
            nombreCompleto,
            email: usuario.email || "",
            telefono: usuario.telefono || "",
            banco,
            cuenta,
            clabe,
            tipoDocumento,
            identificacionPath
        });
        console.log("VALOR IDENTIFICACION PATH:", identificacionPath);
        db.run(`
            INSERT INTO solicitudes_premio (
                tableroId,
                ganadorId,
                nombreCompleto,
                email,
                telefono,
                banco,
                cuenta,
                clabe,
                tipoDocumento,
                identificacionPath,
                estatus,
                fechaSolicitud
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
        `,
        [
            folio,
            ganadorId,
            nombreCompleto,
            usuario.email || "",
            usuario.telefono || "",
            banco,
            cuenta,
            clabe,
            tipoDocumento,
            identificacionPath,
            Date.now()
        ],
        function(err){

            if(err){
                console.log("ERROR guardando solicitud premio:", err.message);

                return res.json({
                    ok:false,
                    mensaje:"Error guardando solicitud"
                });
            }

            return res.json({
                ok:true,
                mensaje:"Solicitud de premio guardada correctamente"
            });

        });

    });

});
// ── EXPORTACIÓN Y LIMPIEZA DE DB ──
app.get('/api/admin/exportar-ganadores', verificarAdmin, (req, res) => {
    db.all(`
        SELECT rt.*, sp.banco, sp.cuenta, sp.clabe, sp.nombreCompleto,
               sp.email, sp.telefono, sp.estatus as estatusPago, sp.fechaSolicitud
        FROM rankings_tableros rt
        LEFT JOIN solicitudes_premio sp ON rt.tableroId = sp.tableroId
        ORDER BY rt.fechaCierre DESC
    `, [], (err, rows) => {
        if(err) return res.json({ ok: false, error: err.message });
        res.setHeader('Content-Disposition', 'attachment; filename=ganadores_quiz1000.json');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ exportado: new Date().toISOString(), total: rows.length, ganadores: rows }, null, 2));
    });
});

app.get('/api/admin/exportar-tableros-completos', verificarAdmin, (req, res) => {
    db.all(`SELECT * FROM tableros WHERE completo = 1 ORDER BY id DESC`, [], (err, tableros) => {
        if(err) return res.json({ ok: false, error: err.message });
        if(!tableros || tableros.length === 0){
            res.setHeader('Content-Disposition', 'attachment; filename=tableros_completos_quiz1000.json');
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify({ exportado: new Date().toISOString(), total: 0, tableros: [] }, null, 2));
        }
        const ids = tableros.map(t => t.id);
        const placeholders = ids.map(() => '?').join(',');
        db.all(`SELECT * FROM casillas WHERE tableroId IN (${placeholders}) ORDER BY tableroId, numero ASC`, ids, (errC, casillas) => {
            const casillasPorTablero = {};
            (casillas || []).forEach(c => {
                if(!casillasPorTablero[c.tableroId]) casillasPorTablero[c.tableroId] = [];
                casillasPorTablero[c.tableroId].push(c);
            });
            const resultado = tableros.map(t => ({ ...t, casillas: casillasPorTablero[t.id] || [] }));
            res.setHeader('Content-Disposition', 'attachment; filename=tableros_completos_quiz1000.json');
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ exportado: new Date().toISOString(), total: resultado.length, tableros: resultado }, null, 2));
        });
    });
});

app.get('/api/admin/exportar-reembolsados', verificarAdmin, (req, res) => {
    db.all(`SELECT * FROM tableros WHERE estatus = 'reembolsado' ORDER BY id DESC`, [], (err, tableros) => {
        if(err) return res.json({ ok: false, error: err.message });
        if(!tableros || tableros.length === 0){
            res.setHeader('Content-Disposition', 'attachment; filename=tableros_reembolsados_quiz1000.json');
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify({ exportado: new Date().toISOString(), total: 0, tableros: [] }, null, 2));
        }
        const ids = tableros.map(t => t.id);
        const placeholders = ids.map(() => '?').join(',');
        db.all(`SELECT * FROM pagos_mp WHERE tableroId IN (${placeholders}) ORDER BY tableroId`, ids, (errP, pagos) => {
            const pagosPorTablero = {};
            (pagos || []).forEach(p => {
                if(!pagosPorTablero[p.tableroId]) pagosPorTablero[p.tableroId] = [];
                pagosPorTablero[p.tableroId].push(p);
            });
            const resultado = tableros.map(t => ({ ...t, pagos: pagosPorTablero[t.id] || [] }));
            res.setHeader('Content-Disposition', 'attachment; filename=tableros_reembolsados_quiz1000.json');
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ exportado: new Date().toISOString(), total: resultado.length, tableros: resultado }, null, 2));
        });
    });
});

app.post('/api/admin/limpiar-db-antigua', verificarAdmin, (req, res) => {
    const mesesAtras = 6;
    const limite = Date.now() - (mesesAtras * 30 * 24 * 60 * 60 * 1000);

    db.run(`DELETE FROM casillas WHERE tableroId IN (
        SELECT id FROM tableros WHERE completo = 1 AND fechaCreacion < ?
    )`, [limite], function(err1) {
        db.run(`DELETE FROM pagos_mp WHERE tableroId IN (
            SELECT id FROM tableros WHERE estatus = 'reembolsado' AND fechaCreacion < ?
        )`, [limite], function(err2) {
            db.run(`DELETE FROM tableros WHERE (completo = 1 OR estatus = 'reembolsado') AND fechaCreacion < ?`,
            [limite], function(err3) {
                if(err1 || err2 || err3){
                    return res.json({ ok: false, error: 'Error en limpieza' });
                }
                res.json({ ok: true, mensaje: `Limpieza completada. Registros anteriores a ${mesesAtras} meses eliminados.` });
            });
        });
    });
});
// ── BUSCADOR DE JUGADORES ──
app.get('/api/admin/buscar-jugador', verificarAdmin, (req, res) => {
    const q = (req.query.q || '').trim();
    if(!q || q.length < 2) return res.json({ ok: false, mensaje: 'Escribe al menos 2 caracteres' });

    const termino = `%${q}%`;
    db.all(`
        SELECT id, nombre, apellidos, edad, email, telefono, password
        FROM usuarios
        WHERE email LIKE ? OR nombre LIKE ? OR apellidos LIKE ?
        ORDER BY nombre ASC LIMIT 15
    `, [termino, termino, termino], (err, jugadores) => {
        if(err) return res.json({ ok: false, error: err.message });
        if(!jugadores || jugadores.length === 0) return res.json({ ok: true, jugadores: [] });

        const ids = jugadores.map(j => j.id);
        const placeholders = ids.map(() => '?').join(',');

        db.all(`
            SELECT jugadorId, tableroId, numero, tiempo
            FROM casillas
            WHERE jugadorId IN (${placeholders})
            ORDER BY tableroId, numero ASC
        `, ids, (errC, casillas) => {
            casillas = casillas || [];

            const porJugador = {};
            casillas.forEach(c => {
                if(!porJugador[c.jugadorId]) porJugador[c.jugadorId] = {};
                if(!porJugador[c.jugadorId][c.tableroId]) porJugador[c.jugadorId][c.tableroId] = [];
                porJugador[c.jugadorId][c.tableroId].push({ casilla: c.numero, tiempo: c.tiempo });
            });

            const resultado = jugadores.map(j => ({
                id:        j.id,
                nombre:    j.nombre,
                apellidos: j.apellidos,
                edad:      j.edad,
                email:     j.email,
                telefono:  j.telefono,
                password:  j.password,
                tableros:  porJugador[j.id] || {}
            }));

            res.json({ ok: true, jugadores: resultado });
        });
    });
});
app.get("/api/admin/solicitudes-premio", verificarAdmin, (req, res) => {

    db.all(`
        SELECT * FROM solicitudes_premio
        ORDER BY fechaSolicitud DESC
    `, (err, rows) => {

        if (err) {
            console.error("Error obteniendo solicitudes:", err);
            return res.status(500).json({ ok: false });
        }

        res.json({ ok: true, solicitudes: rows });
    });

});
app.post("/api/admin/pagar-premio", verificarAdmin, (req, res) => {

    const { idSolicitud } = req.body;

    if (!idSolicitud) {
        return res.status(400).json({ ok: false });
    }

    db.get(`
        SELECT * FROM solicitudes_premio WHERE id = ?
    `, [idSolicitud], (err, solicitud) => {

        if (err || !solicitud) {
            return res.status(404).json({ ok: false });
        }

        if (solicitud.estatus === "pagado") {
            return res.json({ ok: false, mensaje: "Ya pagado" });
        }

        // 1. marcar solicitud como pagada
        db.run(`
            UPDATE solicitudes_premio
            SET estatus = 'pagado', fechaRevision = ?
            WHERE id = ?
        `, [Date.now(), idSolicitud], function (err2) {

            if (err2) {
                console.error("Error actualizando solicitud:", err2);
                return res.status(500).json({ ok: false });
            }

            // 2. bloquear tablero (no doble premio)
            db.run(`
                UPDATE tableros
                SET premioPagado = 1
                WHERE id = ?
            `, [solicitud.tableroId]);

            res.json({ ok: true });
        });

    });

});
app.get("/api/test-notificacion-ganador/:folio", async (req, res) => {
    try {
        const folio = req.params.folio;
        const data = await prepararNotificacionGanadorTemporal(folio);

        return res.json(data);
    } catch (error) {
        console.error("❌ Error en /api/test-notificacion-ganador/:folio", error);
        return res.status(500).json({
            ok: false,
            mensaje: "Error preparando notificación del ganador",
            error: error.message
        });
    }
});
app.get("/api/validar-link-premio", async (req, res) => {
    try {
        const { folio, token } = req.query;

        if (!folio || !token) {
            return res.json({
                ok: false,
                mensaje: "Folio o token no recibido"
            });
        }

        let tokenDecodificado = "";

        try {
            tokenDecodificado = Buffer.from(token, "base64url").toString("utf8");
        } catch (e) {
            return res.json({
                ok: false,
                mensaje: "Token inválido"
            });
        }

        const partes = tokenDecodificado.split("|");

        if (partes.length !== 4) {
            return res.json({
                ok: false,
                mensaje: "Token inválido"
            });
        }

        const [folioToken, jugadorIdToken, expiraToken, firmaToken] = partes;

        if (folioToken !== folio) {
            return res.json({
                ok: false,
                mensaje: "Token inválido para este folio"
            });
        }

        const expiraNumero = Number(expiraToken);

        if (!expiraNumero || Date.now() > expiraNumero) {
            return res.json({
                ok: false,
                mensaje: "Token expirado"
            });
        }

        const payload = `${folioToken}|${jugadorIdToken}|${expiraToken}`;
        const firmaEsperada = crypto
            .createHmac("sha256", MP_ACCESS_TOKEN)
            .update(payload)
            .digest("hex");

        if (firmaEsperada !== firmaToken) {
            return res.json({
                ok: false,
                mensaje: "Firma inválida"
            });
        }

        const ganador = await obtenerGanadorTableroParaNotificacion(folio);

        if (!ganador) {
            return res.json({
                ok: false,
                mensaje: "No se encontró ganador para este tablero"
            });
        }

        if (ganador.jugadorId !== jugadorIdToken) {
            return res.json({
                ok: false,
                mensaje: "Token no corresponde al ganador actual"
            });
        }

        return res.json({
            ok: true,
            mensaje: "Link válido para continuar",
            folio,
            tokenRecibido: token,
            ganador
        });

    } catch (error) {
        console.error("❌ Error en /api/validar-link-premio:", error);
        return res.status(500).json({
            ok: false,
            mensaje: "Error validando link de premio",
            error: error.message
        });
    }
});
app.get("/api/prueba-version", (req, res) => {
    res.json({
        ok: true,
        mensaje: "version nueva cargada"
    });
});

app.get("/api/debug-usuarios-schema", (req, res) => {
    db.all(`PRAGMA table_info(usuarios)`, [], (err, cols) => {
        if(err) return res.json({ ok: false });
        res.json({ ok: true, columnas: cols.map(c => c.name) });
    });
});
// ─── ENDPOINT: Notificaciones diarias de tableros activos ───────────────────
app.get('/api/notificaciones-tablero', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }

  const { enviarNotificacionDias } = require('./mailer');
  const ahora = Date.now();
  const DIEZ_DIAS_MS = 10 * 24 * 60 * 60 * 1000;

  try {
    // Obtener tableros activos con fechaApertura
    const tableros = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, fechaApertura FROM tableros 
        WHERE completo = 0 AND fechaApertura IS NOT NULL
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const resultados = [];

    for (const tablero of tableros) {
      const fechaCierre = tablero.fechaApertura + DIEZ_DIAS_MS;
      const msRestantes = fechaCierre - ahora;
      const diasRestantes = Math.ceil(msRestantes / (24 * 60 * 60 * 1000));

      // Solo notificar en días 9, 7, 5, 3, 2, 1
      if (![9, 7, 5, 3, 2, 1].includes(diasRestantes)) continue;
      if (msRestantes <= 0) continue;

      // Obtener jugadores con casillas pagadas en este tablero
      const jugadores = await new Promise((resolve, reject) => {
        db.all(`
          SELECT DISTINCT c.jugador, c.email, u.nombre,
            COUNT(c.id) as casillasJugadas
          FROM casillas c
          LEFT JOIN usuarios u ON u.id = c.jugador
          WHERE c.tableroId = ? AND c.estado = 'pagada'
          AND c.email != 'pendiente' AND c.email LIKE '%@%'
          GROUP BY c.jugador
        `, [tablero.id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const casillasRestantes = 50 - jugadores.reduce((sum, j) => sum + j.casillasJugadas, 0);

      for (const jugador of jugadores) {
        if (!jugador.email) continue;

        const resultado = await enviarNotificacionDias({
          email: jugador.email,
          nombre: jugador.nombre || 'Jugador',
          diasRestantes,
          casillasJugadas: jugador.casillasJugadas,
          casillasRestantes: Math.max(0, casillasRestantes),
          folio: tablero.id
        });

        resultados.push({
          tablero: tablero.id,
          email: jugador.email,
          diasRestantes,
          ...resultado
        });
      }
    }

    console.log(`📧 Notificaciones enviadas: ${resultados.filter(r => r.ok).length}/${resultados.length}`);
    return res.json({ ok: true, total: resultados.length, resultados });

  } catch (err) {
    console.error('❌ Error en notificaciones-tablero:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);

    // 🔥 diferir tareas pesadas
    setTimeout(() => {

        asegurarColumnasReembolsoTablero((err) => {
            if(err){
                console.log("❌ ERROR asegurando columnas:", err);
            }else{
                console.log("✅ Columnas de tableros verificadas correctamente");
            }
        });
        asegurarColumnasNotificacionesUsuarios((err) => {
            if(err){
                console.log("❌ ERROR asegurando columnas de notificaciones:", err);
            }else{
                console.log("✅ Columnas bajaEmail/bajaWhatsapp verificadas correctamente");
            }
        });
        asegurarColumnasSolicitudesPremio((err) => {
            if(err){
                 console.log("❌ ERROR asegurando solicitudes_premio:", err);
             }else{
                 console.log("✅ Columnas de solicitudes_premio verificadas correctamente");
            }
        });
        setInterval(detectarTablerosVencidos, 60000);

    }, 3000); // espera 3 segundos
});
});
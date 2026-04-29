// mailer.js - Sistema de notificaciones Quiz1000
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'onboarding@resend.dev';
const FROM_NAME = 'Quiz1000';

// ─── TEMPLATE: Notificación de días restantes ───────────────────────────────
function templateDiasRestantes({ nombre, diasRestantes, casillasJugadas, casillasRestantes, folio }) {
  const urgencia = diasRestantes <= 2 ? '🚨' : diasRestantes <= 5 ? '⚠️' : '📅';
  const mensajeUrgencia = diasRestantes === 1
    ? '¡Último día! El tablero cierra mañana.'
    : `¡Faltan ${diasRestantes} días para que cierre tu tablero!`;

  const linkWhatsapp = `https://wa.me/?text=${encodeURIComponent('¡Juega Quiz1000 y gana 1,000 USD! Entra aquí: https://quiz1000.llc/portada?ref=' + folio)}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quiz1000 - Informe de tu tablero</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #222;max-width:600px;">

        <!-- HEADER CON LOGO -->
        <tr>
          <td style="background:linear-gradient(135deg,#001a3a,#003366);padding:30px 40px 20px;text-align:center;">
            <img src="https://www.quiz1000.llc/assets/images/logotipo.png" alt="Quiz1000" style="width:180px;height:auto;display:block;margin:0 auto 16px;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:2px;font-weight:800;">INFORME DE TU TABLERO</h1>
          </td>
        </tr>

        <!-- ROBOT + URGENCIA -->
        <tr>
          <td style="padding:24px 40px 10px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="90" style="vertical-align:middle;">
                  <img src="https://www.quiz1000.llc/assets/images/robot.png" alt="Robot" style="width:80px;height:auto;">
                </td>
                <td style="vertical-align:middle;padding-left:16px;background:#0d1a2e;border-radius:12px;padding:16px;">
                  <p style="color:#ffffff;font-size:18px;font-weight:800;margin:0 0 6px;text-transform:uppercase;">
                    ${urgencia} Faltan <span style="color:#ffcc00;">${diasRestantes} días</span> para que cierre tu tablero
                  </p>
                  <p style="color:#aaaaaa;font-size:14px;margin:0;">Recomienda con amigos</p>
                  <p style="color:#00ff88;font-size:16px;font-weight:800;margin:4px 0 0;">¡1,000 USD para un ganador!</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CASILLAS -->
        <tr>
          <td style="padding:16px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="48%" style="background:#0d2137;border:1px solid #00d4ff33;border-radius:10px;padding:20px;text-align:center;">
                  <div style="color:#00d4ff;font-size:40px;font-weight:bold;">${casillasJugadas}</div>
                  <div style="color:#888;font-size:12px;margin-top:4px;letter-spacing:1px;">CASILLAS JUGADAS</div>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#1a0d0d;border:1px solid #ff444433;border-radius:10px;padding:20px;text-align:center;">
                  <div style="color:#ff6b6b;font-size:40px;font-weight:bold;">${casillasRestantes}</div>
                  <div style="color:#888;font-size:12px;margin-top:4px;letter-spacing:1px;">CASILLAS LIBRES</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- REFERIDOS -->
        <tr>
          <td style="padding:8px 40px 20px;">
            <a href="https://quiz1000-nuevo.onrender.com/assets/images/popup1.png" style="text-decoration:none;display:block;">
              <div style="background:linear-gradient(135deg,#1a2a1a,#0d1a0d);border:1px solid #00ff8844;border-radius:12px;padding:24px;text-align:center;">
                <div style="font-size:28px;margin-bottom:8px;">🤝</div>
                <h3 style="color:#00ff88;margin:0 0 8px;font-size:17px;">¡Recomienda, gana décimas y casillas!</h3>
                <p style="color:#aaa;font-size:13px;margin:0 0 16px;line-height:1.5;">
                  Por cada jugador que recomiendes y pague una casilla,<br>
                  <strong style="color:#fff;">se descuentan décimas de segundo</strong> a tu mejor tiempo.
                </p>
                <a href="${linkWhatsapp}" style="background:#00ff88;color:#000;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;">
                  📲 COMPARTIR MI TABLERO
                </a>
              </div>
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #333;text-align:center;">
            <p style="color:#ffffff;font-size:12px;margin:0 0 8px;">
              Quiz1000 · quiz1000.llc
            </p>
            <p style="margin:0;">
              <a href="https://quiz1000.llc/reglas.html" style="color:#aaaaaa;text-decoration:none;font-size:12px;">Reglas del juego</a>
              &nbsp;·&nbsp;
              <a href="https://quiz1000.llc/legales.html" style="color:#aaaaaa;text-decoration:none;font-size:12px;">Privacidad</a>
              &nbsp;·&nbsp;
              <a href="https://quiz1000-nuevo.onrender.com/api/baja-email?email=${encodeURIComponent('{{email}}')}&folio=${folio}" style="color:#666666;text-decoration:none;font-size:11px;">No deseo recibir más correos</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── FUNCIÓN PRINCIPAL DE ENVÍO ─────────────────────────────────────────────
async function enviarNotificacionDias({ email, nombre, diasRestantes, casillasJugadas, casillasRestantes, folio }) {
  try {
    const asunto = diasRestantes === 1
      ? '🚨 ¡Último día! Tu tablero Quiz1000 cierra mañana'
      : diasRestantes <= 3
      ? `⚠️ ${diasRestantes} días para que cierre tu tablero Quiz1000`
      : `📅 Faltan ${diasRestantes} días — Tu tablero Quiz1000`;

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: asunto,
      html: templateDiasRestantes({ nombre, diasRestantes, casillasJugadas, casillasRestantes, folio })
    });

    if (error) {
      console.error(`❌ Error enviando correo a ${email}:`, error);
      return { ok: false, error };
    }

    console.log(`✅ Correo enviado a ${email} (${diasRestantes} días restantes) ID: ${data.id}`);
    return { ok: true, id: data.id };

  } catch (err) {
    console.error(`❌ Excepción enviando correo a ${email}:`, err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { enviarNotificacionDias };
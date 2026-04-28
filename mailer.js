// mailer.js - Sistema de notificaciones Quiz1000
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'noreply@quiz1000.llc';
const FROM_NAME = 'Quiz1000';

// ─── TEMPLATE: Notificación de días restantes ───────────────────────────────
function templateDiasRestantes({ nombre, diasRestantes, casillasJugadas, casillasRestantes, folio }) {
  const urgencia = diasRestantes <= 2 ? '🚨' : diasRestantes <= 5 ? '⚠️' : '📅';
  const mensajeUrgencia = diasRestantes === 1
    ? '¡Último día! El tablero cierra mañana.'
    : diasRestantes <= 3
    ? `¡Solo ${diasRestantes} días! El tiempo se acaba.`
    : `Faltan ${diasRestantes} días para que cierre tu tablero.`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quiz1000 - Tu tablero cierra pronto</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #222;">
        
        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:10px;">🎯</div>
            <h1 style="color:#00d4ff;margin:0;font-size:28px;letter-spacing:2px;">QUIZ1000</h1>
            <p style="color:#666;margin:8px 0 0;font-size:13px;letter-spacing:1px;">TABLERO DE COMPETENCIA</p>
          </td>
        </tr>

        <!-- URGENCIA -->
        <tr>
          <td style="padding:30px 40px 10px;text-align:center;">
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;">
              <div style="font-size:36px;margin-bottom:8px;">${urgencia}</div>
              <h2 style="color:#fff;margin:0;font-size:20px;">${mensajeUrgencia}</h2>
            </div>
          </td>
        </tr>

        <!-- SALUDO -->
        <tr>
          <td style="padding:20px 40px;text-align:center;">
            <p style="color:#ccc;font-size:16px;line-height:1.6;margin:0;">
              Hola <strong style="color:#00d4ff;">${nombre}</strong>, 
              tu tablero <strong style="color:#fff;">${folio}</strong> está activo.
            </p>
          </td>
        </tr>

        <!-- ESTADÍSTICAS -->
        <tr>
          <td style="padding:10px 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="48%" style="background:#0d2137;border:1px solid #00d4ff33;border-radius:10px;padding:20px;text-align:center;">
                  <div style="color:#00d4ff;font-size:36px;font-weight:bold;">${casillasJugadas}</div>
                  <div style="color:#888;font-size:12px;margin-top:4px;">CASILLAS JUGADAS</div>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#1a0d0d;border:1px solid #ff444433;border-radius:10px;padding:20px;text-align:center;">
                  <div style="color:#ff6b6b;font-size:36px;font-weight:bold;">${casillasRestantes}</div>
                  <div style="color:#888;font-size:12px;margin-top:4px;">CASILLAS LIBRES</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA REFERIDOS -->
        <tr>
          <td style="padding:10px 40px 20px;">
            <div style="background:linear-gradient(135deg,#1a2a1a,#0d1a0d);border:1px solid #00ff8844;border-radius:12px;padding:24px;text-align:center;">
              <div style="font-size:24px;margin-bottom:8px;">🤝</div>
              <h3 style="color:#00ff88;margin:0 0 8px;font-size:16px;">¡Recomienda y gana décimas!</h3>
              <p style="color:#aaa;font-size:13px;margin:0 0 16px;line-height:1.5;">
                Por cada jugador que recomiendes y pague una casilla,<br>
                <strong style="color:#fff;">se descuentan décimas de segundo</strong> a tu mejor tiempo.
              </p>
              <a href="https://quiz1000.llc/tablero.html?ref=${folio}" 
                 style="background:#00ff88;color:#000;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;">
                COMPARTIR MI TABLERO
              </a>
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #222;text-align:center;">
            <p style="color:#444;font-size:12px;margin:0;">
              Quiz1000 · quiz1000.llc<br>
              <a href="https://quiz1000.llc/reglas.html" style="color:#555;text-decoration:none;">Reglas del juego</a> · 
              <a href="https://quiz1000.llc/reglas.html#privacidad" style="color:#555;text-decoration:none;">Privacidad</a>
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
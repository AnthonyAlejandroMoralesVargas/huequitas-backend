const nodemailer = require('nodemailer');

// Configuración de Nodemailer para Gmail
// Las variables de entorno se cargan en index.js
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Envía email de reseteo de contraseña con código de 6 dígitos
 * @param {string} email - Email del usuario
 * @param {string} resetCode - Código de 6 dígitos para mostrar
 * @returns {Promise}
 */
const sendResetEmail = async (email, resetCode) => {
  const expirationTime = '15 minutos';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #f9f9f9;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #ff9500 0%, #ff7c00 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 20px;
        }
        .message {
          margin: 20px 0;
          font-size: 15px;
          line-height: 1.8;
        }
        .code-box {
          display: inline-block;
          background-color: #ff9500;
          color: white;
          padding: 20px 40px;
          border-radius: 8px;
          font-weight: 700;
          margin: 30px 0;
          font-size: 48px;
          letter-spacing: 5px;
          font-family: 'Courier New', monospace;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .code-section {
          text-align: center;
          background-color: #f0f0f0;
          padding: 20px;
          border-left: 4px solid #ff9500;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
          color: #856404;
          font-size: 14px;
        }
        .footer {
          background-color: #f0f0f0;
          padding: 20px 30px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #ddd;
        }
        .footer-brand {
          font-weight: 600;
          color: #ff9500;
          margin-bottom: 10px;
        }
        .divider {
          border: none;
          border-top: 2px solid #ff9500;
          margin: 30px 0;
        }
        @media (max-width: 600px) {
          .container {
            border-radius: 0;
          }
          .content {
            padding: 20px;
          }
          .header h1 {
            font-size: 24px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🍽️ Las HueQuitas</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Reseteo de Contraseña</p>
        </div>

        <div class="content">
          <div class="greeting">
            ¡Hola!
          </div>

          <div class="message">
            Recibimos una solicitud para resetear tu contraseña en Las HueQuitas. Si no fuiste tú, puedes ignorar este email de forma segura.
          </div>

          <div class="message" style="text-align: center; font-weight: 600; color: #ff9500;">
            Tu código de reseteo:
          </div>

          <div class="code-section">
            <div class="code-box">${resetCode}</div>
          </div>

          <div class="message">
            Este código es válido por ${expirationTime}. No compartas este código con nadie.
          </div>

          <div class="warning">
            <strong>⏰ Importante:</strong> Este enlace expirará en <strong>${expirationTime}</strong>. Si el tiempo se agota, deberás solicitar un nuevo reseteo.
          </div>

          <div class="message">
            Por razones de seguridad:
            <ul>
              <li>Nunca compartiremos tu contraseña</li>
              <li>Si no solicitaste esto, ignora este email</li>
              <li>Usa una contraseña fuerte con mayúsculas, minúsculas, números y símbolos</li>
            </ul>
          </div>

          <hr class="divider">

          <div class="message">
            ¿Problemas con el enlace? Contacta a nuestro equipo de soporte.
          </div>
        </div>

        <div class="footer">
          <div class="footer-brand">Las HueQuitas</div>
          <p style="margin: 5px 0;">Tu plataforma de reseñas de restaurantes</p>
          <p style="margin: 10px 0 0 0; color: #999;">
            © 2026 Las HueQuitas. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: 'noreply-huequitas@gmail.com',
    to: email,
    subject: '🔐 Resetea tu contraseña en Las HueQuitas',
    html: htmlContent
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de reseteo enviado a: ${email}`);
    return { success: true, message: 'Email enviado exitosamente' };
  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    throw error;
  }
};

module.exports = { sendResetEmail };

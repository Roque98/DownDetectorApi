import * as mssql from 'mssql';

/**
 * Alert Service for sending Telegram notifications
 * Uses dbmensajes.[dbo].[EnviaAlertasTelegram] stored procedure
 */
export class AlertService {
  private readonly APP_NAME = 'DownDetector API';

  /**
   * Build connection to dbmensajes database
   */
  private async getAlertConnection(): Promise<mssql.ConnectionPool> {
    const config: mssql.config = {
      server: process.env.DB_SERVER || 'localhost',
      database: 'dbmensajes',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        enableArithAbort: true,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
    };

    // Handle SQL Authentication
    if (process.env.DB_USER && process.env.DB_PASSWORD) {
      config.user = process.env.DB_USER;
      config.password = process.env.DB_PASSWORD;
    }

    // Handle port
    if (process.env.DB_PORT) {
      const port = parseInt(process.env.DB_PORT);
      if (!isNaN(port) && port > 0) {
        config.port = port;
      }
    }

    return await mssql.connect(config);
  }

  /**
   * Send alert to Telegram
   * @param title - Alert title (max 50 chars)
   * @param message - Alert message
   */
  async sendAlert(title: string, message: string): Promise<void> {
    let connection: mssql.ConnectionPool | null = null;

    try {
      const telegramGroup = process.env.TELEGRAM_GROUP;

      if (!telegramGroup) {
        console.warn(`[Alert] TELEGRAM_GROUP not configured, skipping alert`);
        return;
      }

      // Truncate title to 50 chars
      const truncatedTitle = title.substring(0, 50);

      console.log(`[Alert] Sending Telegram alert: ${truncatedTitle}`);

      connection = await this.getAlertConnection();

      const request = connection.request();
      request.input('TituloMensaje', mssql.VarChar(50), truncatedTitle);
      request.input('Mensaje', mssql.VarChar(mssql.MAX), message);
      request.input('TituloGrupoTelegram', mssql.VarChar(1000), telegramGroup);

      await request.execute('dbo.EnviaAlertasTelegram');

      console.log(`[Alert] Telegram alert sent successfully`);
    } catch (error) {
      // Don't let alert failures crash the app
      console.error(`[Alert] Failed to send Telegram alert:`, error);
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (closeError) {
          console.error(`[Alert] Error closing alert connection:`, closeError);
        }
      }
    }
  }

  /**
   * Send error alert
   */
  async sendErrorAlert(serviceName: string, error: Error | unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error && error.stack ? error.stack : 'No stack trace available';

    const title = `${this.APP_NAME} - Error`;
    const message = `
Servicio: ${serviceName}
Error: ${errorMessage}

Stack trace:
${errorStack}

Fecha: ${new Date().toISOString()}
Servidor: ${process.env.COMPUTERNAME || 'Unknown'}
Ambiente: ${process.env.NODE_ENV || 'production'}
`.trim();

    await this.sendAlert(title, message);
  }

  /**
   * Send service failure alert
   */
  async sendServiceFailureAlert(serviceName: string, serviceUrl: string, details: string): Promise<void> {
    const title = `${this.APP_NAME} - Falla Servicio`;
    const message = `
Servicio afectado: ${serviceName}
URL: ${serviceUrl}
Detalles: ${details}

Fecha: ${new Date().toISOString()}
Servidor: ${process.env.COMPUTERNAME || 'Unknown'}
`.trim();

    await this.sendAlert(title, message);
  }

  /**
   * Send database error alert
   */
  async sendDatabaseErrorAlert(operation: string, error: Error | unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const title = `${this.APP_NAME} - Error BD`;
    const message = `
Operacion: ${operation}
Error: ${errorMessage}

Fecha: ${new Date().toISOString()}
Base de datos: ${process.env.DB_DATABASE || 'Unknown'}
Servidor BD: ${process.env.DB_SERVER || 'Unknown'}
`.trim();

    await this.sendAlert(title, message);
  }

  /**
   * Send Cloudflare block alert
   */
  async sendCloudflareBlockAlert(serviceName: string, httpStatus: number): Promise<void> {
    const title = `${this.APP_NAME} - Cloudflare Block`;
    const message = `
Servicio: ${serviceName}
HTTP Status: ${httpStatus}
Mensaje: DownDetector esta bloqueando las peticiones con Cloudflare

Fecha: ${new Date().toISOString()}
Accion requerida: Verificar configuracion del stealth service o actualizar puppeteer-extra-plugin-stealth
`.trim();

    await this.sendAlert(title, message);
  }

  /**
   * Send startup alert
   */
  async sendStartupAlert(): Promise<void> {
    const title = `${this.APP_NAME} - Inicio`;
    const message = `
Aplicacion iniciada correctamente

Fecha: ${new Date().toISOString()}
Servidor: ${process.env.COMPUTERNAME || 'Unknown'}
Ambiente: ${process.env.NODE_ENV || 'production'}
Modo: ${process.env.EXECUTION_MODE || 'once'}
`.trim();

    await this.sendAlert(title, message);
  }

  /**
   * Send shutdown alert
   */
  async sendShutdownAlert(reason: string = 'Normal'): Promise<void> {
    const title = `${this.APP_NAME} - Detencion`;
    const message = `
Aplicacion detenida

Razon: ${reason}
Fecha: ${new Date().toISOString()}
Servidor: ${process.env.COMPUTERNAME || 'Unknown'}
`.trim();

    await this.sendAlert(title, message);
  }
}

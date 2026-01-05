import * as mssql from 'mssql';
import { getConnection } from '../config/database';
import { Service, DowndetectorReport } from '../types';

export class DatabaseService {
  /**
   * Get or create a service in the database
   */
  async upsertService(
    serviceName: string,
    domain: string = 'com',
    isActive: boolean = true
  ): Promise<Service> {
    const pool = await getConnection();

    const result = await pool
      .request()
      .input('ServiceName', mssql.NVarChar(100), serviceName)
      .input('Domain', mssql.NVarChar(10), domain)
      .input('IsActive', mssql.Bit, isActive)
      .execute('Downdetector_UpsertService');

    return result.recordset[0];
  }

  /**
   * Get service by name
   */
  async getServiceByName(serviceName: string): Promise<Service | null> {
    const pool = await getConnection();

    const result = await pool
      .request()
      .input('ServiceName', mssql.NVarChar(100), serviceName)
      .query('SELECT * FROM Downdetector_Services WHERE ServiceName = @ServiceName');

    return result.recordset[0] || null;
  }

  /**
   * Insert reports with baselines using the SP
   * Combina los datos de reports y baselines y los inserta usando el SP
   * El SP calcula automáticamente el Status
   */
  async insertReportsWithBaselines(
    serviceId: number,
    reports: DowndetectorReport[],
    baselines: DowndetectorReport[]
  ): Promise<{ inserted: number; exists: number; errors: number }> {
    if (reports.length === 0) {
      return { inserted: 0, exists: 0, errors: 0 };
    }

    const pool = await getConnection();
    let inserted = 0;
    let exists = 0;
    let errors = 0;

    // Crear un mapa de baselines por fecha para búsqueda rápida
    const baselineMap = new Map<string, number>();
    for (const baseline of baselines) {
      baselineMap.set(baseline.date, baseline.value);
    }

    // Insertar cada reporte con su baseline correspondiente
    for (const report of reports) {
      try {
        const baselineValue = baselineMap.get(report.date) || 0;

        // Convertir fecha UTC a hora local
        // Downdetector envía fechas en UTC, necesitamos convertirlas a la zona horaria local
        const utcDate = new Date(report.date);
        const reportDate = new Date(
          utcDate.getTime() - utcDate.getTimezoneOffset() * 60000
        );

        const result = await pool
          .request()
          .input('ServiceID', mssql.Int, serviceId)
          .input('Date', mssql.DateTime2, reportDate)
          .input('ReportValue', mssql.Int, report.value)
          .input('BaseLineValue', mssql.Int, baselineValue)
          .execute('Downdetector_UpsertReport');

        const action = result.recordset[0]?.Action;
        if (action === 'INSERTED') {
          inserted++;
        } else if (action === 'EXISTS') {
          exists++;
        }
      } catch (error) {
        errors++;
        console.error(`Error inserting report for date ${report.date}:`, error);
      }
    }

    return { inserted, exists, errors };
  }
}

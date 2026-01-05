import { downdetector } from 'downdetector-api';
import { DowndetectorResponse } from '../types';

export class DowndetectorService {
  /**
   * Fetch status data from Downdetector for a specific service
   * @param serviceName - Name of the service (e.g., 'telegram', 'whatsapp')
   * @param domain - Downdetector domain (e.g., 'com', 'it', 'es')
   * @returns Promise with reports and baseline data
   */
  async fetchServiceStatus(
    serviceName: string,
    domain: string = 'com'
  ): Promise<DowndetectorResponse> {
    try {
      console.log(`[DownDetector] Fetching data for ${serviceName} from downdetector.${domain}...`);
      console.log(`[DownDetector] Node version: ${process.version}`);
      console.log(`[DownDetector] Platform: ${process.platform} ${process.arch}`);

      const response = await downdetector(serviceName, domain);

      console.log(`[DownDetector] Response received for ${serviceName}:`, JSON.stringify(response, null, 2));

      if (!response) {
        console.error(`[DownDetector] ❌ Response is null or undefined`);
        throw new Error(`Null response from Downdetector for ${serviceName}`);
      }

      if (!response.reports) {
        console.error(`[DownDetector] ❌ Response missing 'reports' property`);
        console.error(`[DownDetector] Response keys:`, Object.keys(response));
        throw new Error(`Invalid response structure from Downdetector for ${serviceName}`);
      }

      if (response.reports.length === 0) {
        console.warn(`[DownDetector] ⚠️  Received empty reports array for ${serviceName}`);
      }

      console.log(
        `[DownDetector] ✓ Fetched ${response.reports.length} reports and ${response.baseline?.length || 0} baseline entries for ${serviceName}`
      );

      return response as DowndetectorResponse;
    } catch (error) {
      console.error(`[DownDetector] ❌ Error fetching data for ${serviceName}:`);
      console.error(`[DownDetector] Error type: ${error?.constructor?.name}`);
      console.error(`[DownDetector] Error message: ${error instanceof Error ? error.message : String(error)}`);

      if (error instanceof Error && error.stack) {
        console.error(`[DownDetector] Stack trace:`, error.stack);
      }

      // Log additional error details if available
      if (error && typeof error === 'object') {
        const errorDetails = Object.keys(error).filter(key => key !== 'stack');
        if (errorDetails.length > 0) {
          console.error(`[DownDetector] Error details:`, JSON.stringify(error, errorDetails, 2));
        }
      }

      throw new Error(
        `Failed to fetch Downdetector data for ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fetch status data for multiple services
   * @param services - Array of service configurations
   * @returns Promise with results for each service
   */
  async fetchMultipleServices(
    services: Array<{ name: string; domain: string }>
  ): Promise<Array<{ serviceName: string; data: DowndetectorResponse | null; error: string | null }>> {
    const results = await Promise.allSettled(
      services.map(async (service) => {
        const data = await this.fetchServiceStatus(service.name, service.domain);
        return {
          serviceName: service.name,
          data,
          error: null,
        };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          serviceName: services[index].name,
          data: null,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
      }
    });
  }
}

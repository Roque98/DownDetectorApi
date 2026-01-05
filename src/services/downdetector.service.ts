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
      console.log(`Fetching data for ${serviceName} from downdetector.${domain}...`);

      const response = await downdetector(serviceName, domain);

      if (!response || !response.reports) {
        throw new Error(`Invalid response from Downdetector for ${serviceName}`);
      }

      console.log(
        `✓ Fetched ${response.reports.length} reports and ${response.baseline?.length || 0} baseline entries for ${serviceName}`
      );

      return response as DowndetectorResponse;
    } catch (error) {
      console.error(`✗ Error fetching data for ${serviceName}:`, error);
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

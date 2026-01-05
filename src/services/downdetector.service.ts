import { DowndetectorResponse } from '../types';
import { DowndetectorStealthService } from './downdetector-stealth.service';

export class DowndetectorService {
  // Use stealth service to bypass Cloudflare
  private stealthService = new DowndetectorStealthService();

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
      console.log(`[DownDetector] Using stealth mode to bypass Cloudflare...`);
      console.log(`[DownDetector] Node version: ${process.version}`);
      console.log(`[DownDetector] Platform: ${process.platform} ${process.arch}`);

      // Use stealth service instead of downdetector-api
      const response = await this.stealthService.fetchServiceStatus(serviceName, domain);

      if (!response) {
        console.error(`[DownDetector] ❌ Response is null or undefined`);
        throw new Error(`Null response from Downdetector for ${serviceName}`);
      }

      if (!response.reports) {
        console.error(`[DownDetector] ❌ Response missing 'reports' property`);
        throw new Error(`Invalid response structure from Downdetector for ${serviceName}`);
      }

      if (response.reports.length === 0) {
        console.warn(`[DownDetector] ⚠️  Received empty reports array for ${serviceName}`);
      }

      console.log(
        `[DownDetector] ✓ Fetched ${response.reports.length} reports and ${response.baseline?.length || 0} baseline entries for ${serviceName}`
      );

      return response;
    } catch (error) {
      console.error(`[DownDetector] ❌ Error fetching data for ${serviceName}:`);
      console.error(`[DownDetector] Error type: ${error?.constructor?.name}`);
      console.error(`[DownDetector] Error message: ${error instanceof Error ? error.message : String(error)}`);

      if (error instanceof Error && error.stack) {
        console.error(`[DownDetector] Stack trace:`, error.stack);
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
    // Use stealth service for multiple services
    return this.stealthService.fetchMultipleServices(services);
  }
}

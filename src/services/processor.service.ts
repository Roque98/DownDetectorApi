import { DowndetectorService } from './downdetector.service';
import { DatabaseService } from './database.service';
import { ConfigLoader } from '../utils/config-loader';
import { appConfig } from '../config/app';

export class ProcessorService {
  private downdetectorService: DowndetectorService;
  private databaseService: DatabaseService;
  private configLoader: ConfigLoader;

  constructor() {
    this.downdetectorService = new DowndetectorService();
    this.databaseService = new DatabaseService();
    this.configLoader = new ConfigLoader();
  }

  /**
   * Process all enabled services
   */
  async processServices(): Promise<void> {
    console.log('\n========================================');
    console.log('Starting data collection');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('========================================\n');

    try {
      const enabledServices = this.configLoader.getEnabledServices();

      if (enabledServices.length === 0) {
        console.log('⚠ No enabled services found in configuration');
        return;
      }

      console.log(`Processing ${enabledServices.length} enabled service(s):\n`);

      for (const serviceConfig of enabledServices) {
        await this.processSingleService(serviceConfig.name, serviceConfig.domain);
      }

      console.log('\n========================================');
      console.log('Data collection completed');
      console.log('========================================\n');
    } catch (error) {
      console.error('\n✗ Error in data collection:', error);
    }
  }

  /**
   * Filter reports to keep only those from the last N minutes
   */
  private filterRecentReports(reports: any[], minutesBack: number = 5): any[] {
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);

    return reports.filter((report) => {
      const reportDate = new Date(report.date);
      return reportDate >= cutoffTime;
    });
  }

  /**
   * Process a single service
   */
  private async processSingleService(serviceName: string, domain: string): Promise<void> {
    console.log(`Processing: ${serviceName} (${domain})`);
    const startTime = Date.now();

    try {
      // Get or create service in database
      const service = await this.databaseService.upsertService(serviceName, domain, true);

      // Fetch data from Downdetector
      const data = await this.downdetectorService.fetchServiceStatus(serviceName, domain);

      // Debug: Show date range of received data
      if (data.reports && data.reports.length > 0) {
        const dates = data.reports.map((r) => new Date(r.date));
        const oldestDate = new Date(Math.min(...dates.map((d) => d.getTime())));
        const newestDate = new Date(Math.max(...dates.map((d) => d.getTime())));
        const now = new Date();
        const minutesAgo = Math.round((now.getTime() - newestDate.getTime()) / (60 * 1000));

        console.log(`  Data range: ${oldestDate.toISOString()} → ${newestDate.toISOString()}`);
        console.log(`  Newest data is ${minutesAgo} minutes old`);
      }

      // Filter to keep only reports from the last N minutes (from config)
      const minutesBack = appConfig.collectLastMinutes;
      const recentReports = this.filterRecentReports(data.reports || [], minutesBack);
      const recentBaselines = this.filterRecentReports(data.baseline || [], minutesBack);

      console.log(
        `  Filtered: ${data.reports?.length || 0} reports → ${recentReports.length} recent (last ${minutesBack} min)`
      );

      // Insert only recent reports with baselines
      const result = await this.databaseService.insertReportsWithBaselines(
        service.ServiceID,
        recentReports,
        recentBaselines
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Build status message
      const statusParts = [];
      if (result.inserted > 0) statusParts.push(`${result.inserted} new`);
      if (result.exists > 0) statusParts.push(`${result.exists} already exist`);
      if (result.errors > 0) statusParts.push(`${result.errors} errors`);

      const statusMessage = statusParts.length > 0 ? statusParts.join(', ') : 'no data';

      console.log(`  ✓ ${statusMessage} (${duration}s)\n`);
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`  ✗ Error: ${errorMessage} (${duration}s)\n`);
    }
  }
}

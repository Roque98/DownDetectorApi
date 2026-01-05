import { ProcessorService } from './services/processor.service';
import { getConnection, closeConnection } from './config/database';
import { appConfig } from './config/app';
import { AlertService } from './services/alert.service';

class DowndetectorApp {
  private processor: ProcessorService;
  private alertService: AlertService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.processor = new ProcessorService();
    this.alertService = new AlertService();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Downdetector SQL Server Integration  ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
      // Test database connection
      console.log('Connecting to database...');
      await getConnection();
      console.log('✓ Database connection established\n');

      // Display configuration
      console.log('Configuration:');
      console.log(`  - Execution Mode: ${appConfig.executionMode}`);
      if (appConfig.executionMode === 'loop') {
        console.log(`  - Interval: ${appConfig.intervalMinutes} minute(s)`);
      }
      console.log(`  - Environment: ${appConfig.nodeEnv}\n`);

      // Send startup alert
      await this.alertService.sendStartupAlert();

      // Run based on mode
      if (appConfig.executionMode === 'once') {
        await this.runOnce();
      } else if (appConfig.executionMode === 'loop') {
        await this.runLoop();
      } else {
        throw new Error(`Invalid execution mode: ${appConfig.executionMode}`);
      }
    } catch (error) {
      console.error('\n✗ Initialization error:', error);
      await this.alertService.sendErrorAlert('Application Initialization', error as Error);
      await this.shutdown(1);
    }
  }

  /**
   * Run once and exit
   */
  private async runOnce(): Promise<void> {
    console.log('Mode: Single execution\n');

    try {
      await this.processor.processServices();
      console.log('✓ Execution completed successfully');
      await this.shutdown(0);
    } catch (error) {
      console.error('✗ Execution failed:', error);
      await this.alertService.sendErrorAlert('Service Processing', error as Error);
      await this.shutdown(1);
    }
  }

  /**
   * Run in loop mode
   */
  private async runLoop(): Promise<void> {
    console.log('Mode: Continuous loop\n');

    // Run immediately first time
    await this.processor.processServices();

    // Schedule next executions
    const intervalMs = appConfig.intervalMinutes * 60 * 1000;
    const nextRun = new Date(Date.now() + intervalMs);

    console.log(`Next execution scheduled for: ${nextRun.toLocaleString()}`);

    this.intervalId = setInterval(async () => {
      await this.processor.processServices();

      const nextRun = new Date(Date.now() + intervalMs);
      console.log(`Next execution scheduled for: ${nextRun.toLocaleString()}`);
    }, intervalMs);

    console.log('\nPress Ctrl+C to stop...\n');
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(exitCode: number = 0): Promise<void> {
    console.log('\nShutting down...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await closeConnection();

    // Send shutdown alert
    const reason = exitCode === 0 ? 'Normal' : 'Error';
    await this.alertService.sendShutdownAlert(reason);

    console.log('✓ Application stopped\n');
    process.exit(exitCode);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers(): void {
    process.on('SIGINT', async () => {
      console.log('\n\nReceived SIGINT signal...');
      await this.shutdown(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\nReceived SIGTERM signal...');
      await this.shutdown(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('\n✗ Uncaught Exception:', error);
      await this.alertService.sendErrorAlert('Uncaught Exception', error);
      await this.shutdown(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('\n✗ Unhandled Rejection at:', promise, 'reason:', reason);
      const error = reason instanceof Error ? reason : new Error(String(reason));
      await this.alertService.sendErrorAlert('Unhandled Rejection', error);
      await this.shutdown(1);
    });
  }
}

// Start the application
(async () => {
  const app = new DowndetectorApp();
  app.setupSignalHandlers();
  await app.initialize();
})();

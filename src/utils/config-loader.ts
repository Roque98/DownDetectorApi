import fs from 'fs';
import path from 'path';
import { ServicesConfiguration, ServiceConfig } from '../types';

export class ConfigLoader {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'services.config.json');
  }

  /**
   * Load services configuration from JSON file
   */
  loadConfig(): ServicesConfiguration {
    try {
      const configFile = fs.readFileSync(this.configPath, 'utf-8');
      const config: ServicesConfiguration = JSON.parse(configFile);

      if (!config.services || !Array.isArray(config.services)) {
        throw new Error('Invalid configuration: services array not found');
      }

      return config;
    } catch (error) {
      console.error('Error loading configuration:', error);
      throw new Error(
        `Failed to load configuration from ${this.configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get only enabled services
   */
  getEnabledServices(): ServiceConfig[] {
    const config = this.loadConfig();
    return config.services.filter((service) => service.enabled);
  }

  /**
   * Get all services
   */
  getAllServices(): ServiceConfig[] {
    const config = this.loadConfig();
    return config.services;
  }

  /**
   * Update service status
   */
  updateServiceStatus(serviceName: string, enabled: boolean): void {
    const config = this.loadConfig();
    const service = config.services.find((s) => s.name === serviceName);

    if (!service) {
      throw new Error(`Service ${serviceName} not found in configuration`);
    }

    service.enabled = enabled;
    this.saveConfig(config);
  }

  /**
   * Save configuration to file
   */
  private saveConfig(config: ServicesConfiguration): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}

// Downdetector API Types
export interface DowndetectorReport {
  date: string;
  value: number;
}

export interface DowndetectorResponse {
  reports: DowndetectorReport[];
  baseline: DowndetectorReport[];
}

// Database Types
export interface Service {
  ServiceID: number;
  ServiceName: string;
  Domain: string;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface Report {
  ReportID: number;
  ServiceID: number;
  ReportDate: Date;
  ReportValue: number;
  CreatedAt: Date;
}

export interface Baseline {
  BaselineID: number;
  ServiceID: number;
  BaselineDate: Date;
  BaselineValue: number;
  CreatedAt: Date;
}

export interface ExecutionLog {
  LogID: number;
  ServiceID: number | null;
  ExecutionDate: Date;
  Status: 'success' | 'error' | 'warning';
  Message: string;
  ErrorDetails?: string;
}

// Configuration Types
export interface ServiceConfig {
  name: string;
  domain: string;
  enabled: boolean;
  category?: string;
}

export interface ServicesConfiguration {
  services: ServiceConfig[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ServiceStats {
  ServiceID: number;
  ServiceName: string;
  Domain: string;
  TotalReports: number;
  MaxReportValue: number;
  AvgReportValue: number;
  LastReportDate: Date;
  FirstReportDate: Date;
}

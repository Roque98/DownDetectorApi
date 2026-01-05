declare module 'downdetector-api' {
  export interface DowndetectorReport {
    date: string;
    value: number;
  }

  export interface DowndetectorResponse {
    reports: DowndetectorReport[];
    baseline: DowndetectorReport[];
  }

  export function downdetector(
    service: string,
    domain?: string
  ): Promise<DowndetectorResponse>;
}

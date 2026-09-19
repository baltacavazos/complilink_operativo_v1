type ExpedienteMonitoringHost<T> = {
  complilinkMonitoring?: T;
};

export function readExpedienteMonitoring<T>(
  data?: ExpedienteMonitoringHost<T> | null,
): T | null {
  return data?.complilinkMonitoring ?? null;
}

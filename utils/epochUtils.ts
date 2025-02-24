export function subtractHoursFromTimestamp(
  timestamp: string,
  hours: number,
): string {
  const date = new Date(timestamp);
  date.setHours(date.getHours() - hours);
  return date.toISOString().split(".")[0] + "Z";
}

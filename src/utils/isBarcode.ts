export function isBarcode(value: string): boolean {
  return /^[0-9]{8,14}$/.test(value);
}

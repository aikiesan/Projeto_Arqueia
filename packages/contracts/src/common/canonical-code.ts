export function canonicalizeArqueiaCode(value: string): string {
  return value.toUpperCase().replaceAll('CP2B', 'CP2b');
}

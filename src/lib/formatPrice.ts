export function formatPrice(raw: string): string {
  return raw.replace(/\$?\d+(\.\d+)?/g, (match) => {
    const n = parseFloat(match.replace("$", ""));
    return `$${Math.ceil(n)}`;
  });
}

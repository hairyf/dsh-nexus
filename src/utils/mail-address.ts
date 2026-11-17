export function mailAddress(role: string, scope: string): string {
  return `nexus:${role}:${scope}`
}

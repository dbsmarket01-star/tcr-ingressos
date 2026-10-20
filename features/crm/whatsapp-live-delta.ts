/** Keep a bounded conversation window while preserving a message received during an in-flight fetch. */
export function mergeWhatsAppMessages<T extends { id: string; createdAt: Date }>(current: T[], incoming: T[], limit = 80): T[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return Array.from(byId.values())
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .slice(-limit);
}

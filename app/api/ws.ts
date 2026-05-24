// In-memory store for server-sent events subscribers
const sseClients = new Map<string, Set<any>>();

export function subscribeProvider(providerId: string, responseStream: any) {
  if (!sseClients.has(providerId)) {
    sseClients.set(providerId, new Set());
  }
  sseClients.get(providerId)!.add(responseStream);

  // Cleanup on disconnect
  responseStream.on('close', () => {
    const clients = sseClients.get(providerId);
    if (clients) {
      clients.delete(responseStream);
      if (clients.size === 0) {
        sseClients.delete(providerId);
      }
    }
  });

  responseStream.on('error', () => {
    const clients = sseClients.get(providerId);
    if (clients) {
      clients.delete(responseStream);
      if (clients.size === 0) {
        sseClients.delete(providerId);
      }
    }
  });
}

export function broadcastToProvider(providerId: string, message: any) {
  const clients = sseClients.get(providerId);
  if (clients && clients.size > 0) {
    const data = JSON.stringify(message);
    clients.forEach((client) => {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (error) {
        console.error('Error broadcasting to provider:', error);
        clients.delete(client);
      }
    });
  }
}

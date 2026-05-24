import { NextRequest } from 'next/server';
import { subscribeProvider } from '../ws';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const providerId = searchParams.get('providerId');

  if (!providerId) {
    return new Response('Provider ID is required', { status: 400 });
  }

  // Set up Server-Sent Events headers
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  // Use ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue('data: {"type":"connected","providerId":"' + providerId + '"}\n\n');

      // Store this controller to receive broadcasts
      const responseStream = {
        write: (data: string) => {
          try {
            controller.enqueue(data);
          } catch (error) {
            console.error('Stream write error:', error);
          }
        },
        on: (_event: string, _callback: Function) => {
          // This will be called by subscribeProvider for cleanup
          if (event === 'close') {
            // Cleanup on close
            controller.close();
          } else if (event === 'error') {
            // Handle errors
          }
        },
      };

      subscribeProvider(providerId, responseStream);

      // Keep the connection alive
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(': keep-alive\n\n');
        } catch (error) {
          clearInterval(keepAliveInterval);
          controller.close();
        }
      }, 30000); // Keep-alive every 30 seconds

      // Return cleanup function
      return () => {
        clearInterval(keepAliveInterval);
      };
    },
  });

  return new Response(stream, { headers });
}

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma Client configuration for performance
// - connection_limit: 20 (increased from default 10 for better concurrency)
// - pool_timeout: 10s (default)
// - log: query and slow query warnings in development
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: 
      process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

  // Log slow queries in development (> 1 second)
  if (process.env.NODE_ENV === 'development') {
    // @ts-expect-error - Prisma internal types
    client.$on('query', (e: { duration: number; query: string }) => {
      if (e.duration > 1000) {
        console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query.substring(0, 200)}...`);
      }
    });
  }

  return client;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// Export a function to disconnect (useful for tests and scripts)
export async function disconnectDb() {
  await db.$disconnect();
}

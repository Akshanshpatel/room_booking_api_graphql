import { prisma } from "../src/lib/prisma";

export async function createTestResource() {
  return prisma.resource.create({
    data: {
      name: `Test Room ${crypto.randomUUID()}`,
      capacity: 10,
    },
  });
}

export async function createTestBooking(
  resourceId: string,
  startTime: string,
  endTime: string,
  title = "Test Booking"
) {
  return prisma.booking.create({
    data: {
      resourceId,
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    },
  });
}

export async function cleanupResource(resourceId: string) {
  await prisma.resource.delete({
    where: {
      id: resourceId,
    },
  });
}
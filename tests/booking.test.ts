import { afterAll, describe, expect, test, afterEach } from "bun:test";
import { prisma } from "../src/lib/prisma";
import { createTestResource, cleanupResource,createTestBooking } from "./helpers";

const testResourceIds: string[] = [];
const resource = await createTestResource();
testResourceIds.push(resource.id);

afterEach(async () => {
  for (const resourceId of testResourceIds) {
    await cleanupResource(resourceId);
  }

  testResourceIds.length = 0;
});

describe("Booking database", () => {
  test("can connect to PostgreSQL", async () => {
    await prisma.$queryRaw`SELECT 1`;

    expect(true).toBe(true);
  });

  test("can create a test resource", async () => {
    const resource = await createTestResource();

    expect(resource.name).toContain("Test Room");
    expect(resource.capacity).toBe(10);

  });

  test("rejects overlapping confirmed bookings", async () => {
  const resource = await createTestResource();

  await createTestBooking(
    resource.id,
    "2026-08-27T10:00:00",
    "2026-08-27T11:00:00",
    "First Booking"
  );

  let error: unknown = null;

  try {
    await createTestBooking(
      resource.id,
      "2026-08-27T10:30:00",
      "2026-08-27T11:30:00",
      "Overlapping Booking"
    );
  } catch (err) {
    error = err;
  }

  expect(error).toBeTruthy();

  });

  test("allows back-to-back bookings", async () => {
  const resource = await createTestResource();

  const firstBooking = await createTestBooking(
    resource.id,
    "2026-08-27T10:00:00",
    "2026-08-27T11:00:00",
    "First Booking"
  );

  const secondBooking = await createTestBooking(
    resource.id,
    "2026-08-27T11:00:00",
    "2026-08-27T12:00:00",
    "Second Booking"
  );

  expect(firstBooking.id).toBeDefined();
  expect(secondBooking.id).toBeDefined();
  expect(secondBooking.id).not.toBe(firstBooking.id);

  });

  test("cancelled bookings do not block the time slot", async () => {
  const resource = await createTestResource();

  const cancelledBooking = await createTestBooking(
    resource.id,
    "2026-08-27T10:00:00",
    "2026-08-27T11:00:00",
    "Cancelled Booking"
  );

  await prisma.booking.update({
    where: {
      id: cancelledBooking.id,
    },
    data: {
      status: "CANCELLED",
    },
  });

  const newBooking = await createTestBooking(
    resource.id,
    "2026-08-27T10:00:00",
    "2026-08-27T11:00:00",
    "Replacement Booking"
  );

  expect(newBooking.id).toBeDefined();
  expect(newBooking.id).not.toBe(cancelledBooking.id);

  });

  test("allows rescheduling to a free time slot", async () => {
  const resource = await createTestResource();

  const booking = await createTestBooking(
    resource.id,
    "2026-08-27T10:00:00",
    "2026-08-27T11:00:00",
    "Original Booking"
  );

  const newStart = new Date("2026-08-27T14:00:00");
  const newEnd = new Date("2026-08-27T15:00:00");

  const updatedBooking = await prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      startTime: newStart,
      endTime: newEnd,
    },
  });

  expect(updatedBooking.startTime).toEqual(newStart);
  expect(updatedBooking.endTime).toEqual(newEnd);

});

  test("allows a booking to keep its own time slot", async () => {
  const resource = await createTestResource();

  const booking = await createTestBooking(
    resource.id,
    "2026-08-27T10:00:00",
    "2026-08-27T11:00:00",
    "Original Booking"
  );

  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      resourceId: resource.id,
      status: "CONFIRMED",
      id: {
        not: booking.id,
      },
      startTime: {
        lt: new Date("2026-08-27T11:00:00"),
      },
      endTime: {
        gt: new Date("2026-08-27T10:00:00"),
      },
    },
  });

  expect(conflictingBooking).toBeNull();

  });

  test("rejects rescheduling into another confirmed booking", async () => {
  const resource = await createTestResource();

  await createTestBooking(
    resource.id,
    "2026-08-27T14:00:00",
    "2026-08-27T15:00:00",
    "Existing Booking"
  );

  const bookingToMove = await createTestBooking(
    resource.id,
    "2026-08-27T10:00:00",
    "2026-08-27T11:00:00",
    "Booking To Move"
  );

  let error: unknown = null;

  try {
    await prisma.booking.update({
      where: {
        id: bookingToMove.id,
      },
      data: {
        startTime: new Date("2026-08-27T14:30:00"),
        endTime: new Date("2026-08-27T15:30:00"),
      },
    });
  } catch (err) {
    error = err;
  }

  expect(error).toBeTruthy();

  });

  test("prevents concurrent overlapping bookings", async () => {
  const resource = await createTestResource();

  const startTime = "2026-08-27T16:00:00";
  const endTime = "2026-08-27T17:00:00";

  const attempts = await Promise.allSettled([
    createTestBooking(
      resource.id,
      startTime,
      endTime,
      "Concurrent Booking A"
    ),
    createTestBooking(
      resource.id,
      startTime,
      endTime,
      "Concurrent Booking B"
    ),
  ]);

  const successful = attempts.filter(
    (result) => result.status === "fulfilled"
  );

  const failed = attempts.filter(
    (result) => result.status === "rejected"
  );

  expect(successful).toHaveLength(1);
  expect(failed).toHaveLength(1);

  const bookings = await prisma.booking.findMany({
    where: {
      resourceId: resource.id,
      status: "CONFIRMED",
    },
  });

  expect(bookings).toHaveLength(1);

  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
import { createYoga, createSchema } from "graphql-yoga";
import { serve } from "bun";
import { prisma } from "./lib/prisma";

const schema = createSchema({
  typeDefs: await Bun.file("src/graphql/schema.graphql").text(),

  resolvers: {
 Query: {
  resources: async () => {
    return prisma.resource.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  resource: async (
    _: unknown,
    args: { id: string }
  ) => {
    return prisma.resource.findUnique({
      where: {
        id: args.id,
      },
      include: {
        bookings: {
          orderBy: {
            startTime: "asc",
          },
        },
      },
    });
  },

  bookings: async (
  _: unknown,
  args: {
    filter?: {
      resourceId?: string;
      status?: "CONFIRMED" | "CANCELLED";
      from?: string;
      to?: string;
    };
    limit?: number;
    cursor?: string;
  }
) => {
  const filter = args.filter;
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);

  const bookings = await prisma.booking.findMany({
    where: {
      resourceId: filter?.resourceId,
      status: filter?.status,

      startTime: {
        gte: filter?.from ? new Date(filter.from) : undefined,
        lt: filter?.to ? new Date(filter.to) : undefined,
      },
    },

    orderBy: [
      {
        startTime: "asc",
      },
      {
        id: "asc",
      },
    ],

    take: limit + 1,

    ...(args.cursor
      ? {
          cursor: {
            id: args.cursor,
          },
          skip: 1,
        }
      : {}),
  });

  const hasNextPage = bookings.length > limit;
  const items = bookings.slice(0, limit);

  return {
    items,
    pageInfo: {
      nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null,
      hasNextPage,
    },
  };
},

  availability: async (
  _: unknown,
  args: {
    resourceId: string;
    startTime: string;
    endTime: string;
  }
) => {
  const startTime = new Date(args.startTime);
  const endTime = new Date(args.endTime);

  if (startTime >= endTime) {
    throw new Error("startTime must be before endTime");
  }

  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      resourceId: args.resourceId,
      status: "CONFIRMED",

      startTime: {
        lt: endTime,
      },

      endTime: {
        gt: startTime,
      },
    },
  });

  return {
    resourceId: args.resourceId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    available: !conflictingBooking,
  };
},
},

Mutation: {
  createResource: async (
    _: unknown,
    args: { name: string; capacity: number }
  ) => {
    return prisma.resource.create({
      data: {
        name: args.name,
        capacity: args.capacity,
      },
    });
  },

  // f0ed0a20-ccfa-405a-9be3-426e77683edb

 createBooking: async (
  _: unknown,
  args: {
    resourceId: string;
    title: string;
    startTime: string;
    endTime: string;
  }
) => {
  const startTime = new Date(args.startTime);
  const endTime = new Date(args.endTime);

  if (startTime >= endTime) {
    throw new Error("startTime must be before endTime");
  }

  const resource = await prisma.resource.findUnique({
    where: {
      id: args.resourceId,
    },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      resourceId: args.resourceId,
      status: "CONFIRMED",

      startTime: {
        lt: endTime,
      },

      endTime: {
        gt: startTime,
      },
    },
  });

  if (conflictingBooking) {
    throw new Error("Resource is already booked for this time");
  }

  return prisma.booking.create({
    data: {
      resourceId: args.resourceId,
      title: args.title,
      startTime,
      endTime,
    },
  });
 },

 cancelBooking: async (
  _: unknown,
  args: { id: string }
) => {
  return prisma.booking.update({
    where: {
      id: args.id,
    },
    data: {
      status: "CANCELLED",
    },
  });
},

rescheduleBooking: async (
  _: unknown,
  args: {
    id: string;
    startTime: string;
    endTime: string;
  }
) => {
  const startTime = new Date(args.startTime);
  const endTime = new Date(args.endTime);

  if (startTime >= endTime) {
    throw new Error("startTime must be before endTime");
  }

  const booking = await prisma.booking.findUnique({
    where: {
      id: args.id,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error("Cancelled booking cannot be rescheduled");
  }

  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      resourceId: booking.resourceId,
      status: "CONFIRMED",

      // Exclude the booking being rescheduled
      id: {
        not: booking.id,
      },

      startTime: {
        lt: endTime,
      },

      endTime: {
        gt: startTime,
      },
    },
  });

  if (conflictingBooking) {
    throw new Error("Resource is already booked for this time");
  }

  return prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      startTime,
      endTime,
    },
  });
},

deleteBooking: async (
  _: unknown,
  args: { id: string }
) => {
  const booking = await prisma.booking.findUnique({
    where: {
      id: args.id,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  await prisma.booking.delete({
    where: {
      id: args.id,
    },
  });

  return true;
},

},
},
});

const yoga = createYoga({
  schema,
});

const server = serve({
  port: 4000,
  fetch: yoga,
});

console.log(`GraphQL server running at http://localhost:${server.port}/graphql`);
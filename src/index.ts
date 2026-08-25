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
  }
) => {
  const filter = args.filter;

  return prisma.booking.findMany({
    where: {
      resourceId: filter?.resourceId,

      status: filter?.status,

      startTime: {
        gte: filter?.from ? new Date(filter.from) : undefined,
        lt: filter?.to ? new Date(filter.to) : undefined,
      },
    },

    orderBy: {
      startTime: "asc",
    },
  });
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
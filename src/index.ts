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
# Room Booking GraphQL API

A GraphQL API for managing meeting rooms and shared-resource bookings.

## Tech Stack

- Bun
- TypeScript
- GraphQL Yoga
- PostgreSQL
- Prisma
- Bun Test

## Features

- Create meeting-room/resources
- Create bookings
- Check resource availability
- Filter bookings
- Cursor-based booking pagination
- Reschedule bookings
- Cancel bookings
- Delete bookings
- Prevent overlapping confirmed bookings
- Allow back-to-back bookings
- Cancelled bookings do not block time slots
- PostgreSQL exclusion constraint for concurrency-safe booking
- Database-backed tests

## Requirements

- Bun
- PostgreSQL

## Setup

Install dependencies:

Run --> bun install

Make a .env file in which DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME"

Run Database Migration --> bunx prisma migrate dev

Start the server --> bun run dev

For Testing --> bun test


## Booking Rules

- Only `CONFIRMED` bookings block a resource.
- `CANCELLED` bookings do not block availability.
- Booking intervals use `[startTime, endTime)`.
- Back-to-back bookings are allowed.
- Overlapping confirmed bookings are rejected.
- PostgreSQL exclusion constraints prevent concurrent double-booking.

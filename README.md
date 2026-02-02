# Restaurant Table Reservation System API

A production-ready REST API for managing restaurant table reservations, built with Node.js, Express, TypeScript, MongoDB, and Redis.

## 🚀 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose), Redis (ioredis)
- **Validation**: Zod
- **Testing**: Jest, Supertest, MongoDB Memory Server, ioredis-mock
- **DevOps**: Docker, Docker Compose

## 🛠️ Setup Instructions

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/kingsleycj/tallie
    cd tallie
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Environment Variables:**
    Create a `.env` file:

    ```env
    PORT=3000
    MONGODB_URI=mongodb://localhost:27017/tallie-test
    REDIS_URL=redis://localhost:6379
    NODE_ENV=development
    ```

4.  **Run with Docker (Recommended):**

    ```bash
    docker-compose up --build
    ```

5.  **Run Tests:**
    ```bash
    npm test
    ```

## 📖 API Documentation

### Restaurants

| Method | Endpoint                            | Description                 |
| :----- | :---------------------------------- | :-------------------------- |
| `POST` | `/api/restaurants`                  | Create a new restaurant     |
| `GET`  | `/api/restaurants/:id`              | Get restaurant details      |
| `GET`  | `/api/restaurants/:id/availability` | Detailed availability check |

**Example Availability Request:**
`GET /api/restaurants/:id/availability?date=2024-01-01T19:00:00.000&partySize=2`

**Availability Response:**

```json
{
  "availableTables": [{ "tableNumber": 1, "capacity": 2 }],
  "suggestedTable": { "tableNumber": 1, "capacity": 2 },
  "timeSlots": ["18:00", "19:00"]
}
```

### Reservations & Waitlist

| Method   | Endpoint                | Description                                     |
| :------- | :---------------------- | :---------------------------------------------- |
| `POST`   | `/api/reservations`     | Create a reservation (Adds to Waitlist if full) |
| `GET`    | `/api/reservations`     | List reservations                               |
| `PUT`    | `/api/reservations/:id` | Update a reservation                            |
| `DELETE` | `/api/reservations/:id` | Cancel a reservation (Triggers Waitlist notify) |

## 🧠 Business Logic Decisions

### 1. Redis Caching Strategy

To allow high-read throughput for availability checks, we use Redis.

- **Key Format**: `availability:{restaurantId}:{date}:{partySize}`
- **TTL**: 5 minutes
- **Invalidation**: The cache is cleared (`availability:{restaurantId}:*`) whenever a reservation is created, updated, or cancelled for that restaurant, ensuring data consistency.

### 2. Total Tables Constraint

A `totalTables` field on the Restaurant model prevents adding infinite tables, acting as a physical constraint validation layer.

- **Default**: 10 tables.
- Attempting to add more tables than allowed returns `400 Bad Request`.

### 3. Waitlist Logic

If a user attempts to book a slot that is full (`409 Conflict`), they are automatically added to the `Waitlist` collection with status `pending`.

- **Trigger**: When a reservation is cancelled (`DELETE`), the system checks the waitlist.
- **Notification**: The first matching customer (FCFS, fitting party size) is "notified" (simulated via console log) and status updated to `notified`.

### 4. Detailed Availability Endpoint

We provide a dedicated endpoint `/restaurants/:id/availability` that:

1.  Calculates free time slots for the day.
2.  Inspects the _specific_ requested time to return exact available tables and a "suggested" table (best fit).
3.  Leverages Redis to cache the expensive time-slot calculation.

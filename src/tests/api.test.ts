import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app";

let mongoServer: MongoMemoryServer;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

describe("Restaurant API", () => {
  let restaurantId: string;
  let tableId: string;

  beforeEach(() => {
    restaurantId = "";
    tableId = "";
  });

  it("should create a restaurant", async () => {
    const res = await request(app).post("/api/restaurants").send({
      name: "Test Kitchen",
      openingTime: "10:00",
      closingTime: "22:00",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.restaurant.name).toBe("Test Kitchen");
    restaurantId = res.body.data.restaurant._id;
  });

  it("should add a table to the restaurant", async () => {
    // Re-create restaurant if this test runs in isolation (though local var shared in describe)
    if (!restaurantId) {
      const r = await request(app)
        .post("/api/restaurants")
        .send({ name: "T", openingTime: "10:00", closingTime: "22:00" });
      restaurantId = r.body.data.restaurant._id;
    }

    const res = await request(app)
      .post(`/api/restaurants/${restaurantId}/tables`)
      .send({
        tableNumber: 1,
        capacity: 4,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.table.capacity).toBe(4);
    tableId = res.body.data.table._id;
  });

  it("should create a reservation successfully", async () => {
    // Setup
    const r = await request(app)
      .post("/api/restaurants")
      .send({ name: "Res1", openingTime: "10:00", closingTime: "22:00" });
    const rId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${rId}/tables`)
      .send({ tableNumber: 1, capacity: 4 });

    const res = await request(app)
      .post("/api/reservations")
      .send({
        restaurantId: rId,
        customerName: "John Doe",
        phone: "1234567890",
        partySize: 2,
        dateTime:
          new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0] + "T19:00:00.000Z",
        duration: 60,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
  });

  it("should reject overlapping reservation", async () => {
    const r = await request(app)
      .post("/api/restaurants")
      .send({ name: "ResOverlap", openingTime: "10:00", closingTime: "22:00" });
    const rId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${rId}/tables`)
      .send({ tableNumber: 1, capacity: 4 });

    const time =
      new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0] + "T19:00:00.000Z"; // Tomorrow 7PM

    // First Res
    await request(app).post("/api/reservations").send({
      restaurantId: rId,
      customerName: "A",
      phone: "1234567890",
      partySize: 2,
      dateTime: time,
      duration: 60,
    });

    // Second Res (Overlap)
    const res = await request(app).post("/api/reservations").send({
      restaurantId: rId,
      customerName: "B",
      phone: "0987654321",
      partySize: 2,
      dateTime: time, // Same time, same table only available
      duration: 60,
    });

    expect(res.status).toBe(409); // Conflict
  });

  it("should reject if party size > table capacity", async () => {
    const r = await request(app)
      .post("/api/restaurants")
      .send({ name: "ResCap", openingTime: "10:00", closingTime: "22:00" });
    const rId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${rId}/tables`)
      .send({ tableNumber: 1, capacity: 2 });

    const res = await request(app)
      .post("/api/reservations")
      .send({
        restaurantId: rId,
        customerName: "Big Party",
        phone: "1234567890",
        partySize: 5, // Capacity is 2
        dateTime:
          new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0] + "T19:00:00.000Z",
        duration: 60,
      });

    expect(res.status).toBe(400); // Bad Request (No suitable tables)
  });

  it("should reject outside operating hours", async () => {
    const r = await request(app)
      .post("/api/restaurants")
      .send({ name: "ResHours", openingTime: "10:00", closingTime: "22:00" });
    const rId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${rId}/tables`)
      .send({ tableNumber: 1, capacity: 4 });

    const res = await request(app)
      .post("/api/reservations")
      .send({
        restaurantId: rId,
        customerName: "Late Owl",
        phone: "1234567890",
        partySize: 2,
        dateTime:
          new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0] + "T23:00:00.000Z", // 11 PM
        duration: 60,
      });

    expect(res.status).toBe(400); // Outside hours
  });

  it("should cancel a reservation", async () => {
    const r = await request(app)
      .post("/api/restaurants")
      .send({ name: "ResCancel", openingTime: "10:00", closingTime: "22:00" });
    const rId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${rId}/tables`)
      .send({ tableNumber: 1, capacity: 4 });

    // Create
    const createRes = await request(app)
      .post("/api/reservations")
      .send({
        restaurantId: rId,
        customerName: "To Cancel",
        phone: "1234567890",
        partySize: 2,
        dateTime:
          new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0] + "T12:00:00.000Z",
        duration: 60,
      });
    const resId = createRes.body.data.reservation._id;

    // Cancel
    const cancelRes = await request(app).delete(`/api/reservations/${resId}`);
    expect(cancelRes.status).toBe(200);

    // Verify Cancelled
    const getRes = await request(app).get(
      `/api/reservations?restaurantId=${rId}`
    );
    // Our list endpoint returns non-cancelled usually, or we need to check DB/Repo logic.
    // Repo logic: findByRestaurantAndDate excludes CANCELLED.
    // So it should NOT appear.
    const found = getRes.body.data.reservations.find(
      (x: any) => x._id === resId
    );
    expect(found).toBeUndefined();
  });

  it("should update a reservation", async () => {
    const r = await request(app)
      .post("/api/restaurants")
      .send({ name: "ResUpdate", openingTime: "10:00", closingTime: "22:00" });
    const rId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${rId}/tables`)
      .send({ tableNumber: 1, capacity: 4 }); // Table 1, Cap 4

    // Create
    const createRes = await request(app)
      .post("/api/reservations")
      .send({
        restaurantId: rId,
        customerName: "To Update",
        phone: "1234567890",
        partySize: 2,
        dateTime:
          new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0] + "T12:00:00.000Z",
        duration: 60,
      });
    const resId = createRes.body.data.reservation._id;

    // Update: Change Party Size to 3 (Fits) and Duration to 90
    const updateRes = await request(app)
      .put(`/api/reservations/${resId}`)
      .send({
        partySize: 3,
        duration: 90,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.reservation.partySize).toBe(3);
    // Duration isn't stored directly, but start/end are. End should be start + 90
    const start = new Date(updateRes.body.data.reservation.startTime).getTime();
    const end = new Date(updateRes.body.data.reservation.endTime).getTime();
    expect((end - start) / 60000).toBe(90);
  });

  it("should get available time slots", async () => {
    const r = await request(app)
      .post("/api/restaurants")
      .send({ name: "ResAvail", openingTime: "18:00", closingTime: "20:00" }); // 2 hours open
    const rId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${rId}/tables`)
      .send({ tableNumber: 1, capacity: 2 });

    const date = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Book 18:00 - 19:00
    const resCreate = await request(app)
      .post("/api/reservations")
      .send({
        restaurantId: rId,
        customerName: "Blocker",
        phone: "1234567890",
        partySize: 2,
        dateTime: date + "T18:00:00.000",
        duration: 60,
      });

    expect(resCreate.status).toBe(201);

    const res = await request(app).get(
      `/api/availability?restaurantId=${rId}&date=${date}&partySize=2`
    );
    expect(res.status).toBe(200);
    // 18:00 occupied.
    // 18:30 occupied (overlaps 18:00-19:00).
    // 19:00 free (19:00-20:00 fit).
    // 19:30 fail (19:30-20:30 exceeds close).

    expect(res.body.data.slots).toContain("19:00");
    expect(res.body.data.slots).not.toContain("18:00");
  });

  it("should enforce totalTables constraint", async () => {
    // 1. Create Restaurant with totalTables=2
    const r = await request(app).post("/api/restaurants").send({
      name: "NewFeatures",
      openingTime: "10:00",
      closingTime: "22:00",
      totalTables: 2, // Constraint
    });
    const restId = r.body.data.restaurant._id;

    // 2. Add 2 tables (should pass)
    await request(app)
      .post(`/api/restaurants/${restId}/tables`)
      .send({ tableNumber: 1, capacity: 4 });
    await request(app)
      .post(`/api/restaurants/${restId}/tables`)
      .send({ tableNumber: 2, capacity: 4 });

    // 3. Add 3rd table (should fail)
    const res = await request(app)
      .post(`/api/restaurants/${restId}/tables`)
      .send({ tableNumber: 3, capacity: 4 });
    expect(res.status).toBe(400);
  });

  it("should add to waitlist if no tables available", async () => {
    // Setup: 1 Table.
    const r = await request(app).post("/api/restaurants").send({
      name: "WaitlistRest",
      openingTime: "10:00",
      closingTime: "22:00",
      totalTables: 5,
    });
    const restId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${restId}/tables`)
      .send({ tableNumber: 1, capacity: 2 });

    const date =
      new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0] + "T12:00:00.000";

    // 1. Create Reservation (Takes the table)
    await request(app).post("/api/reservations").send({
      restaurantId: restId,
      customerName: "Reserver",
      phone: "1111111111",
      partySize: 2,
      dateTime: date,
      duration: 60,
    });

    // 2. Try to Create Another (Conflict -> Waitlist)
    const res = await request(app).post("/api/reservations").send({
      restaurantId: restId,
      customerName: "Waiter",
      phone: "2222222222",
      partySize: 2,
      dateTime: date,
      duration: 60,
    });

    expect(res.status).toBe(409);
    // Note: We check sidebar effect of Waitlist normally, but verifying status 409 + manual verify of DB would be better.
    // For now, testing logic flow.
  });

  it("should get detailed availability", async () => {
    // Reuse existing restaurant/table from shared state or create new if needed
    // Re-using WaitlistRest scenario above but need ID.
    // Let's create fresh to ensure clean state.
    const r = await request(app).post("/api/restaurants").send({
      name: "Detailed",
      openingTime: "10:00",
      closingTime: "22:00",
    });
    const restId = r.body.data.restaurant._id;
    await request(app)
      .post(`/api/restaurants/${restId}/tables`)
      .send({ tableNumber: 1, capacity: 2 });

    const date =
      new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0] + "T13:00:00.000";

    const res = await request(app).get(
      `/api/restaurants/${restId}/availability?date=${date}&partySize=2`
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("availableTables");
    expect(res.body.data).toHaveProperty("suggestedTable");
    expect(res.body.data).toHaveProperty("timeSlots");
  });
});

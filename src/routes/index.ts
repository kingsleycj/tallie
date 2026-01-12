import { Router } from "express";
import RestaurantController from "../controllers/RestaurantController";
import TableController from "../controllers/TableController";
import ReservationController from "../controllers/ReservationController";

const router = Router();

// Restaurant Routes
router.post("/restaurants", RestaurantController.createRestaurant);
router.get("/restaurants/:id", RestaurantController.getRestaurant);
router.get(
  "/restaurants/:id/availability",
  ReservationController.getRestaurantAvailability
);

// Table Routes (Nested)
router.post("/restaurants/:restaurantId/tables", TableController.addTable);
router.get("/restaurants/:restaurantId/tables", TableController.getTables);

// Reservation Routes
router.post("/reservations", ReservationController.createReservation);
router.get("/reservations", ReservationController.getReservations);
router.get("/availability", ReservationController.getAvailability);
router.delete("/reservations/:id", ReservationController.cancelReservation);
router.put("/reservations/:id", ReservationController.updateReservation);

export default router;

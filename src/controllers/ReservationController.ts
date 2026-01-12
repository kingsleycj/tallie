import { Request, Response, NextFunction } from "express";
import ReservationService from "../services/ReservationService";
import { reservationSchema } from "../validators";

class ReservationController {
  async createReservation(req: Request, res: Response, next: NextFunction) {
    try {
      // Basic schema validation
      const validatedData = reservationSchema.parse(req.body);

      const reservation = await ReservationService.createReservation(
        validatedData
      );

      res.status(201).json({
        status: "success",
        data: { reservation },
      });
    } catch (error) {
      next(error);
    }
  }

  async getReservations(req: Request, res: Response, next: NextFunction) {
    try {
      const { restaurantId, date } = req.query;

      if (!restaurantId || typeof restaurantId !== "string") {
        return res
          .status(400)
          .json({ status: "fail", message: "restaurantId is required" });
      }

      const reservations = await ReservationService.getReservations(
        restaurantId as string,
        date as string
      );
      res.status(200).json({
        status: "success",
        data: { reservations },
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await ReservationService.cancelReservation(id as string);
      res.status(200).json({
        // 204 No Content is also standard, but 200 with JSON is fine
        status: "success",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      // Validate body partially? Or assume full replacement?
      // Service handles partial application for some fields
      const reservation = await ReservationService.updateReservation(
        id as string,
        req.body
      );
      res.status(200).json({
        status: "success",
        data: { reservation },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { restaurantId, date, partySize } = req.query;
      if (!restaurantId || !date || !partySize) {
        return res
          .status(400)
          .json({ status: "fail", message: "Missing required params" });
      }

      const slots = await ReservationService.getAvailableTimeSlots(
        restaurantId as string,
        date as string,
        parseInt(partySize as string)
      );

      res.status(200).json({
        status: "success",
        data: { slots },
      });
    } catch (error) {
      next(error);
    }
  }
  async getRestaurantAvailability(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const { date, partySize } = req.query;

      if (!date || !partySize) {
        return res
          .status(400)
          .json({ status: "fail", message: "Missing required query params" });
      }

      const availability = await ReservationService.getRestaurantAvailability(
        id as string,
        date as string,
        parseInt(partySize as string)
      );

      res.status(200).json({
        status: "success",
        data: availability,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ReservationController();

import {
  isBefore,
  isAfter,
  parse,
  format,
  addMinutes,
  startOfDay,
  endOfDay,
} from "date-fns";
import ReservationRepository from "../repositories/ReservationRepository";
import TableRepository from "../repositories/TableRepository";
import RestaurantRepository from "../repositories/RestaurantRepository";
import { IReservation, ReservationStatus } from "../models/Reservation";
import { AppError } from "../utils/AppError";
import { IRestaurant } from "../models/Restaurant";
import RedisService from "./RedisService";
import Waitlist from "../models/Waitlist";

// Constants
const PEAK_HOUR_START = 18; // 6 PM
const PEAK_HOUR_END = 21; // 9 PM
const PEAK_MAX_DURATION = 90; // Minutes

class ReservationService {
  private isWithinOperatingHours(
    date: Date,
    start: Date,
    end: Date,
    restaurant: IRestaurant
  ): boolean {
    const dateStr = format(date, "yyyy-MM-dd");
    const openTime = parse(
      `${dateStr} ${restaurant.openingTime}`,
      "yyyy-MM-dd HH:mm",
      new Date()
    );
    const closeTime = parse(
      `${dateStr} ${restaurant.closingTime}`,
      "yyyy-MM-dd HH:mm",
      new Date()
    );

    return !isBefore(start, openTime) && !isAfter(end, closeTime);
  }

  private isPeakHour(start: Date): boolean {
    const hour = start.getHours();
    return hour >= PEAK_HOUR_START && hour < PEAK_HOUR_END;
  }

  async createReservation(data: any): Promise<IReservation> {
    const { restaurantId, customerName, phone, partySize, dateTime, duration } =
      data;
    const startTime = new Date(dateTime);
    const endTime = addMinutes(startTime, duration);

    // 1. Get Restaurant & Validate Hours
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError("Restaurant not found", 404);
    }

    if (
      !this.isWithinOperatingHours(startTime, startTime, endTime, restaurant)
    ) {
      throw new AppError("Reservation time is outside operating hours", 400);
    }

    // 2. Peak Hour Rule
    if (this.isPeakHour(startTime)) {
      if (duration > PEAK_MAX_DURATION) {
        throw new AppError(
          `During peak hours (${PEAK_HOUR_START}:00-${PEAK_HOUR_END}:00), max duration is ${PEAK_MAX_DURATION} minutes.`,
          400
        );
      }
    }

    // 3. Find Suitable Tables (Capacity >= partySize)
    const suitableTables = await TableRepository.findSuitableTables(
      restaurantId,
      partySize
    );
    if (suitableTables.length === 0) {
      throw new AppError("No tables found with sufficient capacity", 400);
    }

    // 4. Check Availability (Overlap) for each table
    let assignedTableId = null;

    for (const table of suitableTables) {
      const overlaps = await ReservationRepository.findOverlappingReservations(
        table._id as any,
        startTime,
        endTime
      );
      if (overlaps.length === 0) {
        assignedTableId = table._id as any;
        break;
      }
    }

    if (!assignedTableId) {
      // Add to Waitlist
      await Waitlist.create({
        restaurantId,
        customerName,
        phone,
        partySize,
        requestedTime: startTime,
        status: "pending",
      });
      throw new AppError(
        "No tables available for this time slot (added to waitlist)",
        409
      );
    }

    // Invalidate Cache
    await RedisService.deletePattern(`availability:${restaurantId}:*`);

    // 5. Create Reservation
    const reservation = await ReservationRepository.create({
      restaurantId,
      tableId: assignedTableId,
      customerName,
      phone,
      partySize,
      startTime,
      endTime,
      status: ReservationStatus.CONFIRMED,
    });

    console.log(
      `[SMS] Reservation confirmed for ${customerName} at ${format(
        startTime,
        "h:mm a"
      )}`
    );

    return reservation;
  }

  async getReservations(
    restaurantId: string,
    date?: string
  ): Promise<IReservation[]> {
    if (!date) {
      const now = new Date();
      const start = startOfDay(now);
      const end = endOfDay(now);
      return await ReservationRepository.findByRestaurantAndDate(
        restaurantId,
        start,
        end
      );
    } else {
      const targetDate = new Date(date);
      const start = startOfDay(targetDate);
      const end = endOfDay(targetDate);
      return await ReservationRepository.findByRestaurantAndDate(
        restaurantId,
        start,
        end
      );
    }
  }

  async cancelReservation(id: string): Promise<void> {
    const reservation = await ReservationRepository.findById(id);
    if (!reservation) {
      throw new AppError("Reservation not found", 404);
    }
    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new AppError("Reservation is already cancelled", 400);
    }
    await ReservationRepository.updateStatus(id, ReservationStatus.CANCELLED);

    // Invalidate Cache
    await RedisService.deletePattern(
      `availability:${reservation.restaurantId}:*`
    );

    // Check Waitlist
    const nextInLine = await Waitlist.findOne({
      restaurantId: reservation.restaurantId,
      status: "pending",
      partySize: { $lte: reservation.partySize }, // Simple matching logic
    }).sort({ createdAt: 1 });

    if (nextInLine) {
      console.log(
        `[WAITLIST NOTIFICATION] Notifying ${nextInLine.customerName} (${nextInLine.phone}) a table is available!`
      );
      nextInLine.status = "notified";
      await nextInLine.save();
    }
  }

  async updateReservation(id: string, data: any): Promise<IReservation> {
    const reservation = await ReservationRepository.findById(id);
    if (!reservation) {
      throw new AppError("Reservation not found", 404);
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new AppError("Cannot update a cancelled reservation", 400);
    }

    const updatedPartySize = data.partySize || reservation.partySize;
    const updatedDateTime = data.dateTime
      ? new Date(data.dateTime)
      : reservation.startTime;
    const updatedDuration =
      data.duration ||
      (reservation.endTime.getTime() - reservation.startTime.getTime()) / 60000;

    const updatedEndTime = addMinutes(updatedDateTime, updatedDuration);

    const restaurant = await RestaurantRepository.findById(
      reservation.restaurantId.toString()
    );
    if (!restaurant) {
      throw new AppError("Restaurant not found", 404);
    }

    if (
      !this.isWithinOperatingHours(
        updatedDateTime,
        updatedDateTime,
        updatedEndTime,
        restaurant
      )
    ) {
      throw new AppError("New time is outside operating hours", 400);
    }

    if (this.isPeakHour(updatedDateTime)) {
      if (updatedDuration > PEAK_MAX_DURATION) {
        throw new AppError(
          `During peak hours, max duration is ${PEAK_MAX_DURATION} minutes.`,
          400
        );
      }
    }

    const currentTable = await TableRepository.findById(
      reservation.tableId.toString()
    );
    let assignedTableId = reservation.tableId;

    const needsNewTable =
      !currentTable || currentTable.capacity < updatedPartySize;

    if (needsNewTable) {
      const suitableTables = await TableRepository.findSuitableTables(
        restaurant._id as any,
        updatedPartySize
      );
      if (suitableTables.length === 0) {
        throw new AppError(
          "No tables found with sufficient capacity for new party size",
          400
        );
      }

      let foundTableId = null;
      for (const table of suitableTables) {
        const overlaps =
          await ReservationRepository.findOverlappingReservations(
            table._id as any,
            updatedDateTime,
            updatedEndTime,
            id
          );
        if (overlaps.length === 0) {
          foundTableId = table._id;
          break;
        }
      }

      if (!foundTableId) {
        throw new AppError("No tables available for the new requirements", 409);
      }
      assignedTableId = foundTableId as any;
    } else {
      const overlaps = await ReservationRepository.findOverlappingReservations(
        assignedTableId.toString(),
        updatedDateTime,
        updatedEndTime,
        id
      );
      if (overlaps.length > 0) {
        const suitableTables = await TableRepository.findSuitableTables(
          restaurant._id as any,
          updatedPartySize
        );
        let foundTableId = null;
        for (const table of suitableTables) {
          const ov = await ReservationRepository.findOverlappingReservations(
            table._id as any,
            updatedDateTime,
            updatedEndTime,
            id
          );
          if (ov.length === 0) {
            foundTableId = table._id;
            break;
          }
        }
        if (!foundTableId) {
          throw new AppError(
            "Current table blocked and no other tables available",
            409
          );
        }
        assignedTableId = foundTableId as any;
      }
    }

    const updated = await ReservationRepository.update(id, {
      partySize: updatedPartySize,
      startTime: updatedDateTime,
      endTime: updatedEndTime,
      tableId: assignedTableId,
    });

    if (!updated) {
      throw new AppError("Failed to update reservation", 500);
    }

    // Invalidate Cache
    await RedisService.deletePattern(`availability:${restaurant._id}:*`);

    return updated;
  }

  async getAvailableTimeSlots(
    restaurantId: string,
    date: string,
    partySize: number
  ): Promise<string[]> {
    const targetDate = new Date(date);
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) throw new AppError("Restaurant not found", 404);

    const dateStr = date;
    const cacheKey = `availability:${restaurantId}:${dateStr}:${partySize}`;

    const cached = await RedisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const openTime = parse(
      `${dateStr} ${restaurant.openingTime}`,
      "yyyy-MM-dd HH:mm",
      new Date()
    );
    const closeTime = parse(
      `${dateStr} ${restaurant.closingTime}`,
      "yyyy-MM-dd HH:mm",
      new Date()
    );

    const tables = await TableRepository.findSuitableTables(
      restaurantId,
      partySize
    );
    if (tables.length === 0) return [];

    const slots: string[] = [];
    let currentSlot = openTime;

    while (addMinutes(currentSlot, 60) <= closeTime) {
      const slotEnd = addMinutes(currentSlot, 60);
      let isSlotAvailable = false;

      if (
        this.isWithinOperatingHours(
          targetDate,
          currentSlot,
          slotEnd,
          restaurant
        )
      ) {
        for (const table of tables) {
          const overlaps =
            await ReservationRepository.findOverlappingReservations(
              table._id as any,
              currentSlot,
              slotEnd
            );
          if (overlaps.length === 0) {
            isSlotAvailable = true;
            break;
          }
        }

        if (isSlotAvailable) {
          slots.push(format(currentSlot, "HH:mm"));
        }
      }

      currentSlot = addMinutes(currentSlot, 30);
    }

    await RedisService.set(cacheKey, JSON.stringify(slots), 300);
    return slots;
  }

  async getRestaurantAvailability(
    restaurantId: string,
    date: string,
    partySize: number
  ): Promise<any> {
    // 1. Get Time Slots (cached internally by getAvailableTimeSlots)
    const timeSlots = await this.getAvailableTimeSlots(
      restaurantId,
      date,
      partySize
    );

    // 2. Specific Table Availability for the requested time (if provided as full ISO with time)
    let availableTables = [];
    let suggestedTable = null;

    // Check if 'date' string contains time (ISO format)
    if (date.includes("T")) {
      const targetTime = new Date(date);
      const restaurant = await RestaurantRepository.findById(restaurantId);
      if (
        restaurant &&
        this.isWithinOperatingHours(
          targetTime,
          targetTime,
          addMinutes(targetTime, 60),
          restaurant
        )
      ) {
        const suitableTables = await TableRepository.findSuitableTables(
          restaurantId,
          partySize
        );

        // Find all free tables
        for (const table of suitableTables) {
          const overlaps =
            await ReservationRepository.findOverlappingReservations(
              table._id as any,
              targetTime,
              addMinutes(targetTime, 60)
            );
          if (overlaps.length === 0) {
            availableTables.push(table);
          }
        }

        if (availableTables.length > 0) {
          suggestedTable = availableTables[0]; // Sort order in Repo ensures best fit first
        }
      }
    }

    return {
      availableTables,
      suggestedTable,
      timeSlots,
    };
  }
}

export default new ReservationService();

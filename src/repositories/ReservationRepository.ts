import Reservation, {
  IReservation,
  ReservationStatus,
} from "../models/Reservation";

class ReservationRepository {
  async create(data: Partial<IReservation>): Promise<IReservation> {
    return await Reservation.create(data);
  }

  async findOverlappingReservations(
    tableId: string,
    startTime: Date,
    endTime: Date,
    excludeReservationId?: string
  ): Promise<IReservation[]> {
    const query: any = {
      tableId,
      status: { $ne: ReservationStatus.CANCELLED },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };

    if (excludeReservationId) {
      query._id = { $ne: excludeReservationId };
    }

    return await Reservation.find(query);
  }

  async findByRestaurantAndDate(
    restaurantId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<IReservation[]> {
    return await Reservation.find({
      restaurantId,
      startTime: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: ReservationStatus.CANCELLED },
    }).sort({ startTime: 1 });
  }

  async updateStatus(
    id: string,
    status: ReservationStatus
  ): Promise<IReservation | null> {
    return await Reservation.findByIdAndUpdate(id, { status }, { new: true });
  }

  async update(
    id: string,
    data: Partial<IReservation>
  ): Promise<IReservation | null> {
    return await Reservation.findByIdAndUpdate(id, data, { new: true });
  }

  async findById(id: string): Promise<IReservation | null> {
    return await Reservation.findById(id);
  }

  async delete(id: string): Promise<IReservation | null> {
    return this.updateStatus(id, ReservationStatus.CANCELLED);
  }
}

export default new ReservationRepository();

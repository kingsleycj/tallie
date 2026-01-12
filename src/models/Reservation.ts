import mongoose, { Schema, Document } from 'mongoose';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

export interface IReservation extends Document {
  restaurantId: mongoose.Types.ObjectId;
  tableId: mongoose.Types.ObjectId;
  customerName: string;
  phone: string;
  partySize: number;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

const ReservationSchema: Schema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  tableId: { type: Schema.Types.ObjectId, ref: 'Table', required: true },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  partySize: { type: Number, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: Object.values(ReservationStatus), default: ReservationStatus.PENDING },
});

// Required Indexes
ReservationSchema.index({ tableId: 1, startTime: 1, endTime: 1 });
ReservationSchema.index({ restaurantId: 1, startTime: 1 });

export default mongoose.model<IReservation>('Reservation', ReservationSchema);

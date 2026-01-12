import mongoose, { Schema, Document } from "mongoose";

export interface IRestaurant extends Document {
  name: string;
  openingTime: string;
  closingTime: string;
  totalTables: number;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    openingTime: { type: String, required: true }, // Store as "HH:mm"
    closingTime: { type: String, required: true },
    totalTables: { type: Number, required: true, default: 10 }, // Default for legacy/safety
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);

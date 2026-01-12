import mongoose, { Schema, Document } from "mongoose";

export interface IWaitlist extends Document {
  restaurantId: mongoose.Types.ObjectId;
  customerName: string;
  phone: string;
  partySize: number;
  requestedTime: Date;
  status: "pending" | "notified" | "expired";
  createdAt: Date;
  updatedAt: Date;
}

const WaitlistSchema: Schema = new Schema(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    partySize: { type: Number, required: true },
    requestedTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "notified", "expired"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IWaitlist>("Waitlist", WaitlistSchema);

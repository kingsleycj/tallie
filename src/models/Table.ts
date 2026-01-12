import mongoose, { Schema, Document } from 'mongoose';

export interface ITable extends Document {
  restaurantId: mongoose.Types.ObjectId;
  tableNumber: number;
  capacity: number;
}

const TableSchema: Schema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  tableNumber: { type: Number, required: true },
  capacity: { type: Number, required: true },
});

// Compound index to ensure unique table numbers per restaurant
TableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

export default mongoose.model<ITable>('Table', TableSchema);

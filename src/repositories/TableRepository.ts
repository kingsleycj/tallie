import Table, { ITable } from "../models/Table";

class TableRepository {
  async create(data: Partial<ITable>): Promise<ITable> {
    return await Table.create(data);
  }

  async findByRestaurantId(restaurantId: string): Promise<ITable[]> {
    return await Table.find({ restaurantId }).sort({ capacity: 1 }); // Sort by capacity for optimization
  }

  async findById(id: string): Promise<ITable | null> {
    return await Table.findById(id);
  }

  async findSuitableTables(
    restaurantId: string,
    minCapacity: number
  ): Promise<ITable[]> {
    return await Table.find({
      restaurantId,
      capacity: { $gte: minCapacity },
    }).sort({ capacity: 1 }); // Prefer smallest fit
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return await Table.countDocuments({ restaurantId });
  }
}

export default new TableRepository();

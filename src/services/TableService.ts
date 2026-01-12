import TableRepository from "../repositories/TableRepository";
import RestaurantRepository from "../repositories/RestaurantRepository";
import { ITable } from "../models/Table";
import { AppError } from "../utils/AppError";

class TableService {
  async addTable(restaurantId: string, data: Partial<ITable>): Promise<ITable> {
    // Check if restaurant exists
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError("Restaurant not found", 404);
    }

    // Check Total Tables Limit
    const currentCount = await TableRepository.countByRestaurantId(
      restaurantId
    );
    if (currentCount >= restaurant.totalTables) {
      throw new AppError(
        `Cannot add more tables. Limit of ${restaurant.totalTables} reached.`,
        400
      );
    }

    return await TableRepository.create({
      ...data,
      restaurantId: restaurant._id,
    });
  }

  async getTablesByRestaurant(restaurantId: string): Promise<ITable[]> {
    return await TableRepository.findByRestaurantId(restaurantId);
  }
}

export default new TableService();

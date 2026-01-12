import TableRepository from '../repositories/TableRepository';
import RestaurantRepository from '../repositories/RestaurantRepository';
import { IRestaurant } from '../models/Restaurant';
import { AppError } from '../utils/AppError';

class RestaurantService {
  async createRestaurant(data: Partial<IRestaurant>): Promise<IRestaurant> {
    return await RestaurantRepository.create(data);
  }

  async getRestaurant(id: string): Promise<any> {
    const restaurant = await RestaurantRepository.findById(id);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }
    const tables = await TableRepository.findByRestaurantId(id);
    return { ...restaurant.toObject(), tables };
  }
}

export default new RestaurantService();

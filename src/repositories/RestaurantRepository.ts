import Restaurant, { IRestaurant } from '../models/Restaurant';

class RestaurantRepository {
  async create(data: Partial<IRestaurant>): Promise<IRestaurant> {
    return await Restaurant.create(data);
  }

  async findById(id: string): Promise<IRestaurant | null> {
    return await Restaurant.findById(id);
  }

  async findAll(): Promise<IRestaurant[]> {
    return await Restaurant.find();
  }
}

export default new RestaurantRepository();

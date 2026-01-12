import { Request, Response, NextFunction } from 'express';
import RestaurantService from '../services/RestaurantService';
import { restaurantSchema } from '../validators';

class RestaurantController {
  async createRestaurant(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = restaurantSchema.parse(req.body);
      const restaurant = await RestaurantService.createRestaurant(validatedData);
      res.status(201).json({
        status: 'success',
        data: { restaurant },
      });
    } catch (error) {
      next(error);
    }
  }

  async getRestaurant(req: Request, res: Response, next: NextFunction) {
    try {
      const restaurant = await RestaurantService.getRestaurant(req.params.id as string);
      res.status(200).json({
        status: 'success',
        data: { restaurant },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new RestaurantController();

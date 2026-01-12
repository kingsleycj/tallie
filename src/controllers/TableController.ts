import { Request, Response, NextFunction } from 'express';
import TableService from '../services/TableService';
import { tableSchema } from '../validators';

class TableController {
  async addTable(req: Request, res: Response, next: NextFunction) {
    try {
        const { restaurantId } = req.params;
        const validatedData = tableSchema.omit({ restaurantId: true }).parse(req.body);
        
        const table = await TableService.addTable(restaurantId as string, validatedData);
        res.status(201).json({
            status: 'success',
            data: { table }
        });
    } catch (error) {
        next(error);
    }
  }

  async getTables(req: Request, res: Response, next: NextFunction) {
      try {
          const { restaurantId } = req.params;
          const tables = await TableService.getTablesByRestaurant(restaurantId as string);
          res.status(200).json({
              status: 'success',
              data: { tables }
          });
      } catch (error) {
          next(error);
      }
  }
}

export default new TableController();

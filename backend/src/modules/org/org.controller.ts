import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const getHierarchy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plantsRes = await query('SELECT * FROM plants WHERE status = \'active\' ORDER BY plant_name ASC');
    const shopsRes = await query('SELECT * FROM shops WHERE status = \'active\' ORDER BY shop_name ASC');
    const baysRes = await query('SELECT * FROM bays WHERE status = \'active\' ORDER BY bay_name ASC');
    const linesRes = await query('SELECT * FROM production_lines WHERE status = \'active\' ORDER BY line_name ASC');

    res.json({
      success: true,
      data: {
        plants: plantsRes.rows,
        shops: shopsRes.rows,
        bays: baysRes.rows,
        lines: linesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPlants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await query('SELECT * FROM plants ORDER BY plant_name ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

export const getShopsByPlant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { plantId } = req.params;
    const result = await query('SELECT * FROM shops WHERE plant_id = $1 ORDER BY shop_name ASC', [plantId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};


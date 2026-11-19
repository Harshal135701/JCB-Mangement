
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const shops = [
  ['TAL-WEL-001', 'Welding', 'Welding and joining operations'],
  ['TAL-CUT-001', 'Cutting', 'Metal cutting and material preparation'],
  ['TAL-PNT-001', 'Painting', 'Surface preparation, painting and coating'],
  ['TAL-ASM-001', 'Assembly', 'Machine and component assembly'],
  ['TAL-MCH-001', 'Machining', 'CNC machining, drilling and turning'],
  ['TAL-FAB-001', 'Fabrication', 'Sheet metal and structural fabrication'],
  ['TAL-QLT-001', 'Quality Inspection', 'Quality checks and product inspection'],
  ['TAL-MNT-001', 'Maintenance', 'Preventive and breakdown maintenance'],
];

async function createShops() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const plant = await client.query(
      `SELECT id, plant_name FROM public.plants
       WHERE LOWER(plant_name) = LOWER($1)`,
      ['Talegaon']
    );

    if (plant.rowCount !== 1) {
      throw new Error('Talegaon plant not found or duplicate plant names exist.');
    }

    const plantId = plant.rows[0].id;

    for (const [code, name, description] of shops) {
      const existing = await client.query(
        'SELECT id FROM public.shops WHERE shop_code = $1',
        [code]
      );

      if (existing.rowCount > 0) {
        console.log(`Already exists: ${name}`);
        continue;
      }

      await client.query(
        `INSERT INTO public.shops
         (plant_id, shop_code, shop_name, description, manager_user_id, status)
         VALUES ($1, $2, $3, $4, NULL, 'active')`,
        [plantId, code, name, description]
      );

      console.log(`Created: ${name}`);
    }

    await client.query('COMMIT');

    const result = await client.query(
      `SELECT s.shop_code, s.shop_name, s.description,
              s.status, s.manager_user_id, p.plant_name
       FROM public.shops s
       JOIN public.plants p ON p.id = s.plant_id
       WHERE p.id = $1
       ORDER BY s.shop_code`,
      [plantId]
    );

    console.log('\nTalegaon Shop Records:');
    console.table(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

createShops()
  .catch(error => {
    console.error('Shop creation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());


require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const plants = [
  {
    code: 'TALEGAON-001',
    name: 'Talegaon',
    address: 'Demo Industrial Area, Talegaon, Pune, Maharashtra',
    pin: '410507',
    phone: '0000000000',
    email: 'talegaon.demo@example.com',
  },
  {
    code: 'CHAKAN-001',
    name: 'Chakan',
    address: 'Demo Industrial Area, Chakan, Pune, Maharashtra',
    pin: '410501',
    phone: '0000000000',
    email: 'chakan.demo@example.com',
  },
  {
    code: 'PCMC-001',
    name: 'PCMC',
    address: 'Demo Industrial Area, PCMC, Pune, Maharashtra',
    pin: '411018',
    phone: '0000000000',
    email: 'pcmc.demo@example.com',
  },
];

async function createPlants() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const plant of plants) {
      const existing = await client.query(
        'SELECT id FROM public.plants WHERE plant_code = $1',
        [plant.code]
      );

      if (existing.rowCount > 0) {
        console.log(`Already exists: ${plant.name}`);
        continue;
      }

      await client.query(
        `INSERT INTO public.plants
         (plant_code, plant_name, address, state, city, pin_code,
          plant_manager, contact_number, email, status)
         VALUES ($1, $2, $3, 'Maharashtra', 'Pune', $4,
                 NULL, $5, $6, 'active')`,
        [
          plant.code,
          plant.name,
          plant.address,
          plant.pin,
          plant.phone,
          plant.email,
        ]
      );

      console.log(`Created: ${plant.name}`);
    }

    await client.query('COMMIT');

    const result = await client.query(
      `SELECT plant_code, plant_name, address, state, city,
              pin_code, plant_manager, contact_number, email, status
       FROM public.plants ORDER BY plant_code`
    );

    console.table(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

createPlants()
  .catch(console.error)
  .finally(() => pool.end());

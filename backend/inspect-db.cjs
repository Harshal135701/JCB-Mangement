require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
  override: true
});

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const result = await pool.query(`
    SELECT expected.table_name,
           CASE WHEN actual.table_name IS NULL
                THEN 'MISSING'
                ELSE 'EXISTS'
           END AS status
    FROM unnest(ARRAY[
      'plants', 'shops', 'users', 'machines',
      'spare_parts', 'inventory_transactions',
      'maintenance_requests', 'work_orders',
      'work_order_events', 'wo_parts_consumed',
      'purchase_requisitions', 'rdc_challans',
      'rdc_items', 'pm_plans'
    ]) AS expected(table_name)
    LEFT JOIN information_schema.tables actual
      ON actual.table_schema = 'public'
     AND actual.table_name = expected.table_name
    ORDER BY expected.table_name;
  `);

  console.table(result.rows);
}

main()
  .catch(err => console.error(err.message))
  .finally(() => pool.end());
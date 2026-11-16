const { createClient } = require('@supabase/supabase-js');

const url = 'https://enarwtsppwwwldvtmoee.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYXJ3dHNwcHd3d2xkdnRtb2VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mzc1NjExMSwiZXhwIjoyMTA5MzMyMTExfQ.qJpAGZnOHwA0TXSUljuVdjzBRD_-HmeTt88rGazlbto';
const supabase = createClient(url, key);

function formatQuery(text, params) {
  if (!params || params.length === 0) return text;
  let query = text;
  for (let i = params.length; i >= 1; i--) {
    const val = params[i - 1];
    let formattedVal;
    if (val === null || val === undefined) {
      formattedVal = 'NULL';
    } else if (typeof val === 'number') {
      formattedVal = String(val);
    } else if (typeof val === 'boolean') {
      formattedVal = val ? 'TRUE' : 'FALSE';
    } else if (typeof val === 'object') {
      formattedVal = "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
    } else {
      formattedVal = "'" + String(val).replace(/'/g, "''") + "'";
    }
    const regex = new RegExp('\\$' + i + '(?![0-9])', 'g');
    query = query.replace(regex, formattedVal);
  }
  return query;
}

async function test() {
  const q = 'SELECT id, machine_code, name, status, operating_hours FROM machines WHERE status = $1 AND operating_hours >= $2 LIMIT $3';
  const formatted = formatQuery(q, ['running', 100, 2]);
  console.log('Formatted Query:', formatted);

  const { data, error } = await supabase.rpc('exec_sql', { query_text: formatted });
  console.log('RPC execution output:', { data, error });
}

test();

async function testInsert() {
  const code = 'CNC-FB-' + Math.floor(100 + Math.random() * 900);
  const insertSql = `
    INSERT INTO machines (
      shop_id, machine_code, name, category, oem_manufacturer, criticality, status, operating_hours, qr_code_uid
    ) VALUES (
      'c0000000-0000-0000-0000-000000000001', '${code}', 'Fallback Test Machine', 'HMC', 'JCB Tooling', 'class_b', 'running', 50, 'QR-${code}'
    ) RETURNING *;
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query_text: insertSql });
  console.log('INSERT VIA RPC RETURNING:', { data, error });
  if (data && data.length > 0) {
    await supabase.from('machines').delete().match({ id: data[0].id });
    console.log('Cleaned up test row!');
  }
}

testInsert();

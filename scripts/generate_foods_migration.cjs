const fs = require('fs');

const pathJson = '../supabase/foods_seed.json';
const jsonString = fs.readFileSync(pathJson, 'utf-8');
const foods = JSON.parse(jsonString);

let sql = '/* Seed inicial de alimentos brasileiros (+140 itens) */\n\n';
sql += 'INSERT INTO foods (name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g) VALUES\n';

const values = foods.map(f => {
  const name = f.name.replace(/'/g, "''"); // escape single quotes for SQL
  return `  ('${name}', ${f.kcal_per_100g}, ${f.protein_per_100g}, ${f.carbs_per_100g}, ${f.fat_per_100g})`;
});

sql += values.join(',\n') + ';';

fs.writeFileSync('../supabase/migrations/044_seed_nutrition_foods.sql', sql);
console.log('Migration ../supabase/migrations/044_seed_nutrition_foods.sql created successfully!');

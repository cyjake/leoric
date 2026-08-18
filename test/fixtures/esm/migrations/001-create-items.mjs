export async function up(driver) {
  await driver.query('CREATE TABLE esm_migration_items (id INTEGER PRIMARY KEY)');
}

export async function down(driver) {
  await driver.query('DROP TABLE esm_migration_items');
}

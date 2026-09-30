export const TEST_DB_PORT = 54339;
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/store_test`;
// Fixed, test-only key (never used outside tests).
export const TEST_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');

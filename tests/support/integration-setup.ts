import { TEST_DATABASE_URL, TEST_MASTER_KEY } from './constants';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.APP_MASTER_KEY = TEST_MASTER_KEY;
process.env.APP_URL = 'https://shop.test';
delete process.env.RESEND_API_KEY;
delete process.env.BTCPAY_URL;
delete process.env.PAYMENTS_MODE;

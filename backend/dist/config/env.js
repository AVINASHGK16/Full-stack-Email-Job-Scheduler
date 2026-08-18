"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
// Load environment variables from the root .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(5000),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    // Database Configuration
    DB_USER: zod_1.z.string().default('postgres'),
    DB_PASSWORD: zod_1.z.string().default('postgres'),
    DB_NAME: zod_1.z.string().default('scheduler_db'),
    DB_HOST: zod_1.z.string().default('localhost'),
    DB_PORT: zod_1.z.coerce.number().default(5432),
    DATABASE_URL: zod_1.z.string().min(1),
    // Redis Configuration
    REDIS_HOST: zod_1.z.string().default('localhost'),
    REDIS_PORT: zod_1.z.coerce.number().default(6379),
    REDIS_URL: zod_1.z.string().min(1),
    WORKER_CONCURRENCY: zod_1.z.coerce.number().int().positive().default(1),
    PENDING_RECOVERY_THRESHOLD_MS: zod_1.z.coerce.number().int().positive().default(30000),
    // Authentication placeholders
    JWT_SECRET: zod_1.z.string().min(1),
    GOOGLE_CLIENT_ID: zod_1.z.string().min(1),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().min(1),
    GOOGLE_CALLBACK_URL: zod_1.z.string().min(1),
    // SMTP Configuration
    SMTP_HOST: zod_1.z.string().min(1),
    SMTP_PORT: zod_1.z.coerce.number().default(587),
    SMTP_USER: zod_1.z.string().min(1),
    SMTP_PASSWORD: zod_1.z.string().min(1),
});
const parseEnv = () => {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error('❌ Invalid environment configuration:');
        console.error(JSON.stringify(parsed.error.format(), null, 2));
        process.exit(1);
    }
    return parsed.data;
};
exports.env = parseEnv();

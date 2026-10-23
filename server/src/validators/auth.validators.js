const { z } = require('zod');
const loginSchema = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(128) });
module.exports = { loginSchema };

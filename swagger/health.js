/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Server status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: string }
 *                 timestamp:  { type: string }
 *                 uptime:  { type: number }
 *                 mongodb:  { type: string }
 */

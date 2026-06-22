/**
 * @openapi
 * /track/{ticketNumber}:
 *   get:
 *     tags: [Tracking]
 *     summary: Track a shipment by ticket number (public)
 *     parameters:
 *       - in: path
 *         name: ticketNumber
 *         required: true
 *         schema:  { type: string }
 *     responses:
 *       200:
 *         description: Shipment tracking info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticketNumber:  { type: string }
 *                 status:  { type: string }
 *                 pickupLocation:  { type: string }
 *                 deliveryLocation:  { type: string }
 *                 cargoType:  { type: string }
 *                 customer:  { type: string }
 *                 driver:  { type: object, properties: { name: { type: string }, phone: { type: string } } }
 *                 milestones:  { type: object }
 *       404:
 *         description: Not found
 */

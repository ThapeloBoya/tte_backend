/**
 * @openapi
 * /loads:
 *   get:
 *     tags: [Loads]
 *     summary: Get all loads
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of loads
 *   post:
 *     tags: [Loads]
 *     summary: Create a load
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer, truck, pickupLocation, deliveryLocation]
 *             properties:
 *               customer:  { type: string }
 *               driver:  { type: string }
 *               truck:  { type: string }
 *               pickupLocation:  { type: string }
 *               deliveryLocation:  { type: string }
 *               collectionDate:  { type: string, format: date }
 *               cargoType:  { type: string }
 *               customerRef:  { type: string }
 *     responses:
 *       201:
 *         description: Created
 *
 * /loads/{id}:
 *   get:
 *     tags: [Loads]
 *     summary: Get a load by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:  { type: string }
 *     responses:
 *       200:
 *         description: Load object
 *   patch:
 *     tags: [Loads]
 *     summary: Update a load
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:  { type: string }
 *     responses:
 *       200:
 *         description: Updated
 *   delete:
 *     tags: [Loads]
 *     summary: Soft delete a load
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:  { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *
 * /loads/bulk-delete:
 *   post:
 *     tags: [Loads]
 *     summary: Bulk soft delete loads
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:  { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Deleted
 */

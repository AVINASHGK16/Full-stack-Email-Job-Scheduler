import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { testQueue } from '../queues/test.queue';

const testJobSchema = z.object({
  delay: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Controller to add a delayed test job to BullMQ.
 */
export const createTestJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = testJobSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid request body',
        errors: parsed.error.format(),
      });
      return;
    }

    const { delay } = parsed.data;

    // Enqueue the job with the specified delay in milliseconds
    const job = await testQueue.add(
      'test-job',
      {
        message: 'Hello World from Antigravity!',
        createdAt: new Date().toISOString(),
        delay,
      },
      {
        delay,
      }
    );

    res.status(201).json({
      status: 'success',
      jobId: job.id,
      name: job.name,
      delay,
      scheduledAt: new Date(Date.now() + delay).toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

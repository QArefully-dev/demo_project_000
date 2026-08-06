import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ErrorResponse } from '@shop/contracts/common';
import type { Country } from '@shop/contracts/country';
import {
  AdminJob,
  AdminJobDetail,
  AdminJobDrainResponse,
  AdminJobListQuery,
  AdminJobPage,
  AdminJobRetryBody,
} from '@shop/contracts/jobs';
import type { FastifyInstance } from 'fastify';
import type { SessionService } from '../features/auth/sessionService.js';
import type { AuditContext } from '../features/audit/auditEvent.js';
import { JobAdminError, type JobService } from '../features/jobs/jobService.js';
import { requireAdmin } from '../plugins/auth.js';
import { sendBadRequest, sendConflict, sendNotFound } from '../utils/errors.js';

const JobIdParam = Type.Object(
  { jobId: Type.String({ pattern: '^[1-9][0-9]*$' }) },
  { additionalProperties: false },
);

export interface AdminJobsRouteServices {
  sessions: SessionService;
  jobs: JobService;
  jobRunner: Pick<JobService, 'runDue'>;
  clock: { now(): Date };
}

const auditContext = (
  userId: number,
  requestId: string,
  standingCountry: Country,
): AuditContext => ({
  actor: { type: 'user' as const, userId },
  requestId,
  standingCountry,
});

function sendJobError(reply: Parameters<typeof sendBadRequest>[0], error: JobAdminError) {
  sendBadRequest(reply, error.message);
}

export default function adminJobsRoutes(
  app: FastifyInstance,
  { services }: { services: AdminJobsRouteServices },
): void {
  app.addHook('onRequest', requireAdmin(services.sessions));
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();
  typed.get(
    '/api/admin/jobs',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        querystring: AdminJobListQuery,
        response: { 200: AdminJobPage, 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse },
      },
    },
    (request, reply) => {
      try {
        return services.jobs.list(request.query);
      } catch (error) {
        if (error instanceof JobAdminError) return sendJobError(reply, error);
        throw error;
      }
    },
  );
  typed.get(
    '/api/admin/jobs/:jobId',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        params: JobIdParam,
        response: {
          200: AdminJobDetail,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        const job = services.jobs.get(Number(request.params.jobId));
        if (!job) return sendNotFound(reply, 'Job');
        return job;
      } catch (error) {
        if (error instanceof JobAdminError) return sendJobError(reply, error);
        throw error;
      }
    },
  );
  typed.post(
    '/api/admin/jobs/:jobId/retry',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: {
        params: JobIdParam,
        body: AdminJobRetryBody,
        response: {
          200: AdminJob,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
        },
      },
    },
    (request, reply) => {
      try {
        const result = services.jobs.retry(Number(request.params.jobId), {
          idempotencyKey: request.body.idempotencyKey,
          context: auditContext(request.authenticatedUser!.id, request.id, request.resolvedCountry),
        });
        if (result.status === 'not_found') return sendNotFound(reply, 'Job');
        if (result.status === 'not_retryable') return sendConflict(reply, 'Job is not retryable');
        if (result.status === 'idempotency_conflict')
          return sendConflict(reply, 'Idempotency key is already used for another job');
        return result.job;
      } catch (error) {
        if (error instanceof JobAdminError) return sendJobError(reply, error);
        throw error;
      }
    },
  );
  typed.post(
    '/api/admin/jobs/run',
    {
      preHandler: [requireAdmin(services.sessions)],
      schema: { response: { 200: AdminJobDrainResponse, 401: ErrorResponse, 403: ErrorResponse } },
    },
    () => services.jobRunner.runDue(services.clock.now()),
  );
}

import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app.js';
import { registerPowderConfigAndQuote, registerCartMutations } from './powderizer.js';

/** Canonical Custom Powder endpoint at /api/custom-powder/ — same handlers as legacy powderizer. */
export default function customPowderRoutes(app: FastifyInstance, { services }: AppContext): void {
  registerPowderConfigAndQuote(app, services, '/api/custom-powder');
  registerCartMutations(app, services);
}

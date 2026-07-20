// Route module ready for S1 registration in app.ts.
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app.js';
import { registerPowderConfigAndQuote } from './powderizer.js';

/** Canonical Custom Powder endpoint at /api/custom-powder/ — same handlers as legacy powderizer.
 *  Cart mutations are registered once by the legacy powderizer route module and shared. */
export default function customPowderRoutes(app: FastifyInstance, { services }: AppContext): void {
  registerPowderConfigAndQuote(app, services, '/api/custom-powder');
}

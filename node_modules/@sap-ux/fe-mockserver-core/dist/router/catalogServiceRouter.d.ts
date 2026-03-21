import type { IRouter } from 'router';
import type { ServiceConfigEx } from '../api';
/**
 * Create a service mocking the catalog service from the ABAP backend.
 *
 * @param servicesConfig the service configuration.
 * @param version the version of the services
 * @returns a sub router
 */
export declare function catalogServiceRouter(servicesConfig: ServiceConfigEx[], version?: number): IRouter;
//# sourceMappingURL=catalogServiceRouter.d.ts.map
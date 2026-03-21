import type { IncomingMessage } from 'connect';
import type { IRouter } from 'router';
import type { ServiceConfigEx } from '../api';
import type { DataAccess } from '../data/dataAccess';
export type IncomingMessageWithTenant = IncomingMessage & {
    tenantId?: string;
};
/**
 * Creates the sub router containing the odata protocol processing.
 *
 * @param service
 * @param dataAccess
 * @returns the sub router specific to that odata query
 */
export declare function serviceRouter(service: ServiceConfigEx, dataAccess: DataAccess): Promise<IRouter>;
//# sourceMappingURL=serviceRouter.d.ts.map
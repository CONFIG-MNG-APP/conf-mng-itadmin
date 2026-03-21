import type { NextHandleFunction } from 'connect';
import type { DataAccess } from '../data/dataAccess';
import type { Batch, BatchPart } from './batchParser';
/**
 * Returns the result whether isRequest part of changeset or not.
 *
 * @param part
 * @returns {boolean}
 */
export declare function isPartChangeSet(part: BatchPart | Batch): part is Batch;
/**
 * Creates a router dedicated to batch request handling.
 *
 * @param dataAccess the current DataAccess object
 * @returns a router function for batch handling
 */
export declare function batchRouter(dataAccess: DataAccess): NextHandleFunction;
//# sourceMappingURL=batchRouter.d.ts.map
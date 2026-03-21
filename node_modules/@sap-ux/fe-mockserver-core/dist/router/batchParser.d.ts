/**
 *
 */
export declare class BatchContent {
    type: number;
    stringData: string;
    stringSplit: any;
    pos: number;
    constructor(data: string);
    lookLine(): string;
    readLine(): string;
    inc(): void;
}
export declare class Batch {
    isChangeSet: boolean;
    boundary: string;
    changeSetErrorResponse: any;
    parts: (BatchPart | Batch)[];
    constructor(isChangeSet: boolean, boundary: string);
}
export declare function getBoundary(headerValue: string): string;
export type BatchPart = {
    url: string;
    method: string;
    body: any;
    headers: Record<string, string>;
    contentId?: string;
};
export declare function parseBatch(content: BatchContent, boundary: string, isChangeset?: boolean): Batch;
//# sourceMappingURL=batchParser.d.ts.map
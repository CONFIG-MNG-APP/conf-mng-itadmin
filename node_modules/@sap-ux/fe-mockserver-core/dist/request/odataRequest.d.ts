/// <reference types="node" />
import type { IncomingHttpHeaders } from 'http';
import type { DataAccess } from '../data/dataAccess';
import type { TransformationDefinition } from './applyParser';
import type { FilterExpression } from './filterParser';
export type ErrorResponse = {
    code: string;
    message: string;
    severity?: string;
    details: ErrorDetails[];
    '@Core.ContentID'?: string;
} & Record<string, unknown>;
export type ErrorDetails = {
    code: string;
    message: string;
    severity?: string;
    '@Core.ContentID'?: string;
} & Record<string, unknown>;
export type ExpandDefinition = {
    expand: Record<string, ExpandDefinition>;
    properties: SelectDefinition;
    filter?: FilterExpression;
    orderBy?: OrderByDefinition[];
    removeFromResult?: boolean;
};
type ODataRequestContent = {
    body?: any;
    url: string;
    tenantId?: string;
    method: string;
    headers?: IncomingHttpHeaders;
    contentId?: string;
};
type OrderByDefinition = {
    name: string;
    direction: 'asc' | 'desc';
};
export type SelectDefinition = Record<string, boolean>;
export type KeyDefinitions = Record<string, number | boolean | string>;
export type QueryPath = {
    path: string;
    keys: KeyDefinitions;
    matrixParameters?: Record<string, string>;
};
export default class ODataRequest {
    private requestContent;
    private dataAccess;
    private isMinimalRepresentation;
    isStrictMode: boolean;
    forceLog: boolean;
    etagReference?: string;
    tenantId: string;
    queryPath: QueryPath[];
    searchQuery: string[];
    orderBy: OrderByDefinition[];
    startIndex: number;
    skipLocation: string | null;
    skipContext: number;
    maxElements: number;
    applyDefinition?: TransformationDefinition[];
    filterDefinition?: FilterExpression;
    selectedProperties: SelectDefinition;
    expandProperties: Record<string, ExpandDefinition>;
    responseHeaders: Record<string, string>;
    globalResponseHeaders: Record<string, string>;
    statusCode: number;
    dataCount: number;
    private responseAnnotations;
    countRequested: boolean;
    isCountQuery: boolean;
    responseData: any;
    private allParams;
    private context;
    private messages;
    private elementETag;
    private contentId?;
    get url(): string;
    get method(): string;
    constructor(requestContent: ODataRequestContent, dataAccess: DataAccess);
    private parseParameters;
    get headers(): IncomingHttpHeaders;
    private _addSelectedPropertiesForApplyExpression;
    /**
     * Split a list of properties that can contain sub-requests into an array.
     *
     * @param propertiesQuery OData properties request
     * @param delimiter Property delimiter
     * @returns an array of string with the properties
     */
    private splitProperties;
    private parseExpand;
    private parseOrderBy;
    private parseSelect;
    private parsePath;
    /**
     * Parse an OData key value.
     *
     * @param value The key value. Strings are expected to be surrounded by single quotes.
     * @returns The parsed value
     */
    private static parseKeyValue;
    handleRequest(): Promise<void>;
    setResponseData(data: any): void;
    setContext(context: string): void;
    setETag(etagValue: string | undefined): void;
    getETag(): string | undefined;
    getResponseData(asString?: boolean): any;
    addMessage(code: number, message: string, severity: number, target: string): void;
    addCustomMessage(messageData: any): void;
    addResponseHeader(headerName: string, headerValue: string, globalHeader?: boolean): void;
    removeResponseHeader(headerName: string, globalHeader?: boolean): void;
    addResponseAnnotation(annotationName: string, annotationValue: any): void;
    setDataCount(dataCount: number): void;
    private static addExpandForFilters;
    /**
     * Adding content-id to error message.
     * This helps map the error to the right request in change set.
     *
     * @param errorObj Object containing error
     * @param errorObj.error Error object
     */
    private addContentIdToErrorMessage;
    private static addExpandForOrderBy;
}
export {};
//# sourceMappingURL=odataRequest.d.ts.map
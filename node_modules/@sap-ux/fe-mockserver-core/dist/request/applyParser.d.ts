import { Lexer } from 'chevrotain';
import type { FilterExpression } from './filterParser';
import { FilterParser } from './filterParser';
export declare const SearchLexer: Lexer;
export type AncestorDescendantsParameters = {
    hierarchyRoot: string;
    qualifier: string;
    propertyPath: string;
    maximumDistance: number;
    keepStart: boolean;
    inputSetTransformations: TransformationDefinition[];
};
export type ExpandLevel = {
    '"Levels"': string;
    '"NodeID"': string;
};
export type TopLevelParameters = {
    HierarchyNodes: string;
    ExpandLevels?: ExpandLevel[];
    Levels: string;
    NodeProperty: string;
    HierarchyQualifier: string;
    Collapse?: string[];
    Expand?: string[];
    Show?: string[];
};
export type FilterTransformation = {
    type: 'filter';
    filterExpr: FilterExpression;
};
export type SearchTransformation = {
    type: 'search';
    searchExpr: string[];
};
export type ConcatTransformation = {
    type: 'concat';
    concatExpr: TransformationDefinition[][];
};
export type GroupByTransformation = {
    type: 'groupBy';
    groupBy: string[];
    subTransformations: TransformationDefinition[];
};
export type OrderByTransformation = {
    type: 'orderBy';
    orderBy: OrderByProp[];
};
export type SkipTransformation = {
    type: 'skip';
    skipCount: number;
};
export type TopTransformation = {
    type: 'top';
    topCount: number;
};
export type AggregatesTransformation = {
    type: 'aggregates';
    aggregateDef: AggregateProperty[];
};
export type AncestorsTransformation = {
    type: 'ancestors';
    parameters: AncestorDescendantsParameters;
};
export type DescendantsTransformation = {
    type: 'descendants';
    parameters: AncestorDescendantsParameters;
};
export type CustomFunctionTransformation = {
    type: 'customFunction';
    name: string;
    parameters: Record<string, string | number | boolean | string[] | object[]>;
};
export type TransformationDefinition = FilterTransformation | SearchTransformation | OrderByTransformation | GroupByTransformation | SkipTransformation | TopTransformation | AggregatesTransformation | AncestorsTransformation | DescendantsTransformation | ConcatTransformation | CustomFunctionTransformation;
export type OrderByProp = {
    name: string;
    direction: 'asc' | 'desc';
};
type CstRule<T> = (idxInCallingRule?: number, ...args: any[]) => T;
/**
 *
 */
export declare class ApplyParser extends FilterParser {
    applyExpr: CstRule<TransformationDefinition[]>;
    applyTrafo: CstRule<void>;
    rootExpr: CstRule<string>;
    aggregateTrafo: CstRule<void>;
    ancestorsTrafo: CstRule<void>;
    computeTrafo: CstRule<void>;
    concatTrafo: CstRule<void>;
    customFunction: CstRule<void>;
    preservingTrafo: CstRule<void>;
    descendantsTrafo: CstRule<void>;
    groupbyTrafo: CstRule<void>;
    filterTrafo: CstRule<void>;
    searchTrafo: CstRule<void>;
    orderByTrafo: CstRule<void>;
    skipTrafo: CstRule<void>;
    topTrafo: CstRule<void>;
    constructor();
}
type AggregateProperty = {
    name: string;
    operator?: string;
    sourceProperty: string;
};
export declare function parseApply(applyParameters: string | null): TransformationDefinition[] | undefined;
export {};
//# sourceMappingURL=applyParser.d.ts.map
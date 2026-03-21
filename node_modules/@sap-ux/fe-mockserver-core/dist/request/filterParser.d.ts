import type { IParserConfig } from 'chevrotain';
import { EmbeddedActionsParser, Lexer } from 'chevrotain';
export declare const FilterLexer: Lexer;
export type FilterMethodCall = {
    type: 'method';
    method: string;
    methodArgs: string[];
    propertyPaths?: string[];
};
export type LambdaExpression = {
    type: 'lambda';
    operator: 'ALL' | 'ANY';
    key: string;
    expression: FilterExpression;
    target: string;
    propertyPath?: string;
};
export type FilterExpression = {
    expressions?: FilterExpression[];
    operator?: string;
    isGroup?: boolean;
    isReversed?: boolean;
    literal?: string | string[];
    identifier?: string | FilterMethodCall | LambdaExpression;
};
type CstRule<T> = (idxInCallingRule?: number, ...args: any[]) => T;
/**
 *
 */
export declare class FilterParser extends EmbeddedActionsParser {
    filterExpr: CstRule<FilterExpression>;
    boolCommonExpr: CstRule<FilterExpression>;
    boolMethodCallExpr: CstRule<FilterMethodCall>;
    methodCallExpr: CstRule<FilterMethodCall>;
    literalOrIdentifier: CstRule<string>;
    lambdaOperator: CstRule<LambdaExpression>;
    memberExpr: CstRule<string>;
    constructor(tokens?: import("chevrotain").TokenType[], config?: IParserConfig);
}
export declare function parseFilter(filterParameters: string | null): FilterExpression | undefined;
export {};
//# sourceMappingURL=filterParser.d.ts.map
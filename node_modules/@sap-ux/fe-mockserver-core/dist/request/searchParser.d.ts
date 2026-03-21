import { EmbeddedActionsParser, Lexer } from 'chevrotain';
export declare const SearchLexer: Lexer;
type CstRule<T> = (idxInCallingRule?: number, ...args: any[]) => T;
/**
 *
 */
export declare class SearchParser extends EmbeddedActionsParser {
    searchExpression: CstRule<string[]>;
    expression: CstRule<string[]>;
    constructor();
}
export declare function parseSearch(searchParameters: string | null): string[];
export {};
//# sourceMappingURL=searchParser.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFilter = exports.FilterParser = exports.FilterLexer = void 0;
const chevrotain_1 = require("chevrotain");
const commonTokens_1 = require("./commonTokens");
// ----------------- Lexer -----------------
const filterTokens = [
    commonTokens_1.OPEN,
    commonTokens_1.CLOSE,
    commonTokens_1.COMMA,
    commonTokens_1.COLON,
    commonTokens_1.SLASH,
    commonTokens_1.ANYALL,
    commonTokens_1.ANDOR,
    commonTokens_1.WS,
    commonTokens_1.SIMPLE_METHOD,
    commonTokens_1.BOOL_METHOD,
    commonTokens_1.COMPLEX_METHOD,
    commonTokens_1.NOT_OPERATOR,
    commonTokens_1.IN_OPERATOR,
    commonTokens_1.LOGICAL_OPERATOR,
    commonTokens_1.TYPEDEF,
    commonTokens_1.LITERAL,
    commonTokens_1.SIMPLEIDENTIFIER,
    commonTokens_1.SIMPLEIDENTIFIERWITHWS
];
exports.FilterLexer = new chevrotain_1.Lexer(filterTokens, {
    // Less position info tracked, reduces verbosity of the playground output.
    positionTracking: 'onlyStart'
});
/**
 *
 */
class FilterParser extends chevrotain_1.EmbeddedActionsParser {
    constructor(tokens = filterTokens, config = {
        recoveryEnabled: true
    }) {
        super(tokens, config);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const $ = this;
        $.filterExpr = $.RULE('filterExpr', () => {
            return $.SUBRULE($.boolCommonExpr);
        });
        $.literalOrIdentifier = $.RULE('literalOrIdentifier', () => {
            return $.OR([
                {
                    ALT: () => {
                        const consumedTypedef = $.CONSUME(commonTokens_1.TYPEDEF);
                        return consumedTypedef.image;
                    }
                },
                {
                    ALT: () => {
                        const consumedLiteral = $.CONSUME(commonTokens_1.LITERAL);
                        return consumedLiteral.image;
                    }
                },
                {
                    ALT: () => $.SUBRULE($.memberExpr)
                }
            ]);
        });
        $.boolMethodCallExpr = $.RULE('boolMethodCallExpr', () => {
            const methodNode = $.CONSUME(commonTokens_1.BOOL_METHOD);
            $.OPTION(() => $.CONSUME(commonTokens_1.WS));
            $.CONSUME2(commonTokens_1.OPEN);
            $.OPTION2(() => $.CONSUME2(commonTokens_1.WS));
            const literal1Node = $.OR2([
                { ALT: () => $.SUBRULE2($.methodCallExpr) },
                { ALT: () => $.SUBRULE2($.literalOrIdentifier) }
            ]);
            $.OPTION3(() => $.CONSUME3(commonTokens_1.WS));
            $.CONSUME(commonTokens_1.COMMA);
            $.OPTION4(() => $.CONSUME4(commonTokens_1.WS));
            const literal2Node = $.OR3([
                { ALT: () => $.SUBRULE3($.methodCallExpr) },
                { ALT: () => $.SUBRULE3($.literalOrIdentifier) }
            ]);
            $.OPTION5(() => $.CONSUME5(commonTokens_1.WS));
            $.CONSUME2(commonTokens_1.CLOSE);
            const methodArgs = [literal1Node];
            if (literal2Node) {
                methodArgs.push(literal2Node);
            }
            return {
                type: 'method',
                method: methodNode.image,
                methodArgs
            };
        });
        $.methodCallExpr = $.RULE('methodCallExpr', () => {
            let methodNode;
            let literal1Node;
            let literal2Node;
            $.OR([
                {
                    ALT: () => {
                        methodNode = $.CONSUME(commonTokens_1.SIMPLE_METHOD);
                        $.CONSUME(commonTokens_1.OPEN);
                        literal1Node = $.OR2([
                            { ALT: () => $.SUBRULE2($.methodCallExpr) },
                            { ALT: () => $.SUBRULE2($.literalOrIdentifier) }
                        ]);
                        $.CONSUME(commonTokens_1.CLOSE);
                    }
                },
                {
                    ALT: () => {
                        methodNode = $.CONSUME(commonTokens_1.COMPLEX_METHOD);
                        $.OPTION(() => $.CONSUME(commonTokens_1.WS));
                        $.CONSUME2(commonTokens_1.OPEN);
                        $.OPTION2(() => $.CONSUME2(commonTokens_1.WS));
                        literal1Node = $.OR3([
                            { ALT: () => $.SUBRULE3($.methodCallExpr) },
                            { ALT: () => $.SUBRULE3($.literalOrIdentifier) }
                        ]);
                        $.OPTION3(() => $.CONSUME3(commonTokens_1.WS));
                        $.CONSUME(commonTokens_1.COMMA);
                        $.OPTION4(() => $.CONSUME4(commonTokens_1.WS));
                        literal2Node = $.OR4([
                            { ALT: () => $.SUBRULE4($.methodCallExpr) },
                            { ALT: () => $.SUBRULE4($.literalOrIdentifier) }
                        ]);
                        $.OPTION5(() => $.CONSUME5(commonTokens_1.WS));
                        $.CONSUME2(commonTokens_1.CLOSE);
                    }
                }
            ]);
            const methodArgs = [literal1Node.image ? literal1Node.image : literal1Node];
            if (literal2Node) {
                methodArgs.push(literal2Node.image ? literal2Node.image : literal2Node);
            }
            return {
                type: 'method',
                method: methodNode.image,
                methodArgs
            };
        });
        $.lambdaOperator = $.RULE('lambdaOperator', () => {
            const anyAll = $.CONSUME(commonTokens_1.ANYALL);
            const lambdaExpression = $.OR([
                {
                    ALT: () => {
                        const key = $.CONSUME(commonTokens_1.SIMPLEIDENTIFIER);
                        $.CONSUME(commonTokens_1.COLON);
                        const subExpr = $.SUBRULE($.boolCommonExpr);
                        $.OPTION(() => {
                            $.CONSUME(commonTokens_1.CLOSE);
                        });
                        return {
                            type: 'lambda',
                            operator: anyAll.image.toUpperCase().slice(0, anyAll.image.toUpperCase().length - 1),
                            key: key.image,
                            expression: subExpr,
                            target: ''
                        };
                    }
                },
                {
                    ALT: () => {
                        $.CONSUME2(commonTokens_1.OPEN);
                        const subExpr = $.SUBRULE2($.boolCommonExpr);
                        $.CONSUME2(commonTokens_1.CLOSE);
                        return {
                            type: 'lambda',
                            operator: anyAll.image.toUpperCase().slice(0, anyAll.image.toUpperCase().length - 1),
                            key: '',
                            expression: subExpr,
                            target: ''
                        };
                    }
                },
                {
                    ALT: () => {
                        $.CONSUME3(commonTokens_1.CLOSE);
                        return {
                            type: 'lambda',
                            operator: anyAll.image.toUpperCase().slice(0, anyAll.image.toUpperCase().length - 1),
                            key: '',
                            expression: undefined,
                            target: ''
                        };
                    }
                }
            ]);
            return lambdaExpression;
        });
        $.memberExpr = $.RULE('memberExpr', () => {
            let memberDef = '';
            const identifier = $.CONSUME(commonTokens_1.SIMPLEIDENTIFIER);
            memberDef += identifier.image;
            $.OPTION(() => {
                $.CONSUME(commonTokens_1.SLASH);
                const outMember = $.OR([
                    {
                        ALT: () => $.SUBRULE($.memberExpr)
                    },
                    {
                        ALT: () => $.SUBRULE($.lambdaOperator)
                    }
                ]);
                if (outMember.type === 'lambda') {
                    // Lamba
                    if (outMember.target === '') {
                        outMember.target = memberDef;
                    }
                    else {
                        outMember.target = memberDef + '/' + outMember.target;
                    }
                    memberDef = outMember;
                }
                else {
                    memberDef += '/';
                    memberDef += outMember;
                }
            });
            return memberDef;
        });
        $.boolCommonExpr = $.RULE('boolCommonExpr', () => {
            let operator;
            let literal;
            let subExpr = $.OR([
                {
                    ALT: () => {
                        // boolParenExpr
                        $.CONSUME(commonTokens_1.NOT_OPERATOR);
                        $.OPTION(() => $.CONSUME(commonTokens_1.WS));
                        const hasOpen = $.OPTION2(() => {
                            $.CONSUME(commonTokens_1.OPEN);
                            return true;
                        });
                        const expression = $.SUBRULE($.boolCommonExpr);
                        $.OPTION3(() => $.CONSUME(commonTokens_1.CLOSE));
                        return {
                            isGroup: !!hasOpen,
                            isReversed: true,
                            operator: expression.operator,
                            expressions: expression.expressions
                        };
                    }
                },
                {
                    ALT: () => {
                        // boolParenExpr
                        $.CONSUME2(commonTokens_1.OPEN);
                        const expression = $.SUBRULE2($.boolCommonExpr);
                        $.CONSUME3(commonTokens_1.CLOSE);
                        return {
                            isGroup: true,
                            isReversed: false,
                            operator: expression.operator,
                            expressions: expression.expressions
                        };
                    }
                },
                {
                    ALT: () => {
                        return { identifier: $.SUBRULE($.boolMethodCallExpr) };
                    }
                },
                {
                    ALT: () => {
                        const expression = {};
                        const identifier = $.OR2([
                            {
                                ALT: () => $.SUBRULE($.memberExpr)
                            },
                            {
                                ALT: () => $.SUBRULE($.methodCallExpr)
                            }
                        ]);
                        $.OPTION4(() => {
                            $.CONSUME2(commonTokens_1.WS);
                            $.OR3([
                                {
                                    ALT: () => {
                                        operator = $.CONSUME(commonTokens_1.LOGICAL_OPERATOR);
                                        $.CONSUME3(commonTokens_1.WS);
                                        literal = $.OR4([
                                            {
                                                ALT: () => {
                                                    const simpleId = $.CONSUME(commonTokens_1.SIMPLEIDENTIFIERWITHWS);
                                                    return simpleId.image.substring(1, simpleId.image.length - 1);
                                                }
                                            },
                                            {
                                                ALT: () => $.CONSUME(commonTokens_1.LITERAL)
                                            },
                                            {
                                                ALT: () => $.SUBRULE2($.methodCallExpr)
                                            }
                                        ]);
                                        expression.operator = operator.image;
                                        expression.literal = literal.image ? literal.image : literal;
                                    }
                                },
                                {
                                    ALT: () => {
                                        operator = $.CONSUME(commonTokens_1.IN_OPERATOR);
                                        $.OPTION5(() => $.CONSUME4(commonTokens_1.WS));
                                        $.CONSUME3(commonTokens_1.OPEN);
                                        const identifiers = [];
                                        $.MANY_SEP({
                                            SEP: commonTokens_1.COMMA,
                                            DEF: () => {
                                                const expression = $.SUBRULE($.literalOrIdentifier);
                                                identifiers.push(expression);
                                            }
                                        });
                                        $.CONSUME4(commonTokens_1.CLOSE);
                                        expression.operator = operator.image;
                                        expression.literal = identifiers;
                                    }
                                }
                            ]);
                        });
                        expression.identifier = identifier;
                        return expression;
                    }
                }
            ]);
            $.OPTION8(() => {
                operator = $.CONSUME(commonTokens_1.ANDOR);
                const subsubExpr = $.SUBRULE3($.boolCommonExpr);
                let expressions;
                let currentOperator = operator.image.trim().toUpperCase();
                if (!subsubExpr.expressions && subExpr.expressions) {
                    expressions = [subExpr].concat([subsubExpr]);
                }
                else if (currentOperator === subsubExpr.operator ||
                    subsubExpr.operator === '' ||
                    subsubExpr.operator === undefined) {
                    if (subsubExpr.isReversed !== true) {
                        expressions = [subExpr].concat(subsubExpr.expressions);
                    }
                    else {
                        expressions = [subExpr].concat([subsubExpr]);
                    }
                }
                else if (currentOperator === 'AND' && !subsubExpr.isGroup && subsubExpr.expressions) {
                    //AND has priority
                    expressions = [subExpr].concat(subsubExpr.expressions.shift());
                    const subObject = {
                        expressions,
                        operator: currentOperator
                    };
                    expressions = [subObject].concat(subsubExpr.expressions);
                    currentOperator = subsubExpr.operator;
                }
                else {
                    expressions = [subExpr].concat([subsubExpr]);
                }
                subExpr = {
                    operator: currentOperator,
                    expressions: expressions
                };
            });
            if (subExpr && Array.isArray(subExpr.expressions)) {
                return subExpr;
            }
            return { expressions: [subExpr] };
        });
        if (tokens === filterTokens) {
            this.performSelfAnalysis();
        }
    }
}
exports.FilterParser = FilterParser;
function parseFilter(filterParameters) {
    if (!filterParameters) {
        return undefined;
    }
    const parser = new FilterParser();
    const lexingResult = exports.FilterLexer.tokenize(filterParameters);
    // "input" is a setter which will reset the parser's state.
    parser.input = lexingResult.tokens;
    const output = parser.filterExpr();
    if (parser.errors.length > 0) {
        parser.errors.forEach(console.error);
        throw new Error(`Parsing errors detected when parsing ${filterParameters}`);
    }
    return output;
}
exports.parseFilter = parseFilter;
//# sourceMappingURL=filterParser.js.map
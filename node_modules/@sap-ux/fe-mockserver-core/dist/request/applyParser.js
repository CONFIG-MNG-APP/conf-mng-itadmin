"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseApply = exports.ApplyParser = exports.SearchLexer = void 0;
const chevrotain_1 = require("chevrotain");
const commonTokens_1 = require("./commonTokens");
const filterParser_1 = require("./filterParser");
// ----------------- Lexer -----------------
const applyTokens = [
    commonTokens_1.OPEN,
    commonTokens_1.DOT,
    commonTokens_1.EQ,
    commonTokens_1.CLOSE,
    commonTokens_1.QUOTE,
    commonTokens_1.OPEN_BRACKET,
    commonTokens_1.OPEN_CURLY_BRACKET,
    commonTokens_1.CLOSE_BRACKET,
    commonTokens_1.CLOSE_CURLY_BRACKET,
    commonTokens_1.COMMA,
    commonTokens_1.ANCESTORS_TOKEN,
    commonTokens_1.CONCAT_TOKEN,
    commonTokens_1.KEEP_START_TOKEN,
    commonTokens_1.DESCENDANTS_TOKEN,
    commonTokens_1.ROOT_TOKEN,
    commonTokens_1.SEARCH_TOKEN,
    commonTokens_1.ORDERBY_TOKEN,
    commonTokens_1.FILTER_TOKEN,
    commonTokens_1.TOP_TOKEN,
    commonTokens_1.SKIP_TOKEN,
    commonTokens_1.GROUPBY_TOKEN,
    commonTokens_1.AGGREGATE_TOKEN,
    commonTokens_1.WITH_TOKEN,
    commonTokens_1.AS_TOKEN,
    commonTokens_1.FROM_TOKEN,
    commonTokens_1.AGGREGATE_FUNCTION,
    commonTokens_1.COLON,
    commonTokens_1.SLASH,
    commonTokens_1.ANYALL,
    commonTokens_1.ANDOR,
    commonTokens_1.ASCDESC,
    commonTokens_1.WS,
    commonTokens_1.SIMPLE_METHOD,
    commonTokens_1.BOOL_METHOD,
    commonTokens_1.COMPLEX_METHOD,
    commonTokens_1.LOGICAL_OPERATOR,
    commonTokens_1.TYPEDEF,
    commonTokens_1.LITERAL,
    commonTokens_1.SIMPLEIDENTIFIER,
    commonTokens_1.SIMPLEIDENTIFIERWITHWS
];
exports.SearchLexer = new chevrotain_1.Lexer(applyTokens, {
    // Less position info tracked, reduces verbosity of the playground output.
    positionTracking: 'onlyStart'
});
/**
 *
 */
class ApplyParser extends filterParser_1.FilterParser {
    constructor() {
        super(applyTokens, {
            recoveryEnabled: true
        });
        this.applyExpr = this.RULE('applyExpr', (transformations = []) => {
            this.MANY_SEP({
                SEP: commonTokens_1.SLASH,
                DEF: () => {
                    this.SUBRULE2(this.applyTrafo, { ARGS: [transformations] });
                }
            });
            return transformations;
        });
        this.applyTrafo = this.RULE('applyTrafo', (transformations = []) => {
            //     / ancestorsTrafo
            //     / computeTrafo
            //     / concatTrafo
            //     // / descendantsTrafo
            //     // / joinTrafo
            //     // / nestTrafo
            //     // / outerjoinTrafo
            //     // / traverseTrafo
            this.OR([
                {
                    ALT: () => {
                        return this.SUBRULE(this.aggregateTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.groupbyTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.concatTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.preservingTrafo, { ARGS: [transformations] });
                    }
                }
            ]);
        });
        this.preservingTrafo = this.RULE('preservingTrafo', (transformations = []) => {
            this.OR([
                {
                    ALT: () => {
                        return this.SUBRULE(this.filterTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.orderByTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.skipTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.topTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.ancestorsTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.descendantsTrafo, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.customFunction, { ARGS: [transformations] });
                    }
                },
                {
                    ALT: () => {
                        return this.SUBRULE(this.searchTrafo, { ARGS: [transformations] });
                    }
                }
            ]);
            //  preservingTrafo = bottomcountTrafo
            // //     / bottompercentTrafo
            // //     / bottomsumTrafo
            //     / filterTrafo
            //     // / identityTrafo
            //     // / orderbyTrafo
            //     // / searchTrafo
            //     // / skipTrafo
            //     // / topTrafo
            //     // / topcountTrafo
            //     // / toppercentTrafo
            //     // / topsumTrafo
            //     // / customFunction
        });
        this.skipTrafo = this.RULE('skipTrafo', (transformations = []) => {
            this.CONSUME(commonTokens_1.SKIP_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            const skip = parseInt(this.CONSUME(commonTokens_1.LITERAL).image, 10);
            this.CONSUME(commonTokens_1.CLOSE);
            transformations.push({ type: 'skip', skipCount: skip });
        });
        this.topTrafo = this.RULE('topTrafo', (transformations = []) => {
            this.CONSUME(commonTokens_1.TOP_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            const top = parseInt(this.CONSUME(commonTokens_1.LITERAL).image, 10);
            this.CONSUME(commonTokens_1.CLOSE);
            transformations.push({ type: 'top', topCount: top });
        });
        this.filterTrafo = this.RULE('filterTrafo', (transformations = []) => {
            this.CONSUME(commonTokens_1.FILTER_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            const filterExpr = this.SUBRULE(this.filterExpr);
            transformations.push({ type: 'filter', filterExpr: filterExpr });
            this.CONSUME(commonTokens_1.CLOSE);
        });
        // searchTrafo     = %s"search" OPEN BWS ( searchExpr / searchExpr-incomplete ) BWS CLOSE
        this.searchTrafo = this.RULE('searchTrafo', (transformations = []) => {
            this.CONSUME(commonTokens_1.SEARCH_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            const searchExpr = [];
            this.MANY_SEP({
                SEP: commonTokens_1.WS,
                DEF: () => {
                    this.OR([
                        {
                            ALT: () => {
                                const stringToken = this.CONSUME(commonTokens_1.SIMPLEIDENTIFIERWITHWS);
                                searchExpr.push(stringToken.image.substring(1, stringToken.image.length - 1));
                            }
                        },
                        {
                            ALT: () => {
                                const stringToken = this.CONSUME(commonTokens_1.SIMPLEIDENTIFIER);
                                searchExpr.push(stringToken.image);
                            }
                        }
                    ]);
                }
            });
            transformations.push({ type: 'search', searchExpr: searchExpr });
            this.CONSUME(commonTokens_1.CLOSE);
        });
        //%s"groupby" OPEN BWS groupbyList [ BWS COMMA BWS applyExpr ] BWS CLOSE
        this.groupbyTrafo = this.RULE('groupbyTrafo', (transformations = []) => {
            this.CONSUME(commonTokens_1.GROUPBY_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            this.OPTION(() => this.CONSUME(commonTokens_1.WS));
            this.CONSUME2(commonTokens_1.OPEN);
            this.OPTION2(() => this.CONSUME2(commonTokens_1.WS));
            const groupBy = [];
            this.OPTION3(() => {
                this.MANY_SEP({
                    SEP: commonTokens_1.COMMA,
                    DEF: () => {
                        const groupByStr = [];
                        this.MANY_SEP2({
                            SEP: commonTokens_1.SLASH,
                            DEF: () => {
                                groupByStr.push(this.CONSUME2(commonTokens_1.SIMPLEIDENTIFIER).image);
                            }
                        });
                        groupBy.push(groupByStr.join('/'));
                    }
                });
            });
            this.OPTION4(() => this.CONSUME3(commonTokens_1.WS));
            this.CONSUME(commonTokens_1.CLOSE);
            const subTransformations = [];
            this.OPTION5(() => {
                this.OPTION6(() => this.CONSUME4(commonTokens_1.WS));
                this.CONSUME(commonTokens_1.COMMA);
                this.SUBRULE(this.applyExpr, { ARGS: [subTransformations] });
            });
            this.CONSUME2(commonTokens_1.CLOSE);
            //OPEN BWS groupbyElement *( BWS COMMA BWS groupbyElement ) BWS CLOSE
            // groupbyElement  = groupingProperty / rollupLevels / rollupRecursive
            transformations.push({ type: 'groupBy', groupBy: groupBy, subTransformations: subTransformations });
        });
        this.aggregateTrafo = this.RULE('aggregateTrafo', (transformations = []) => {
            // %s"aggregate" OPEN BWS aggregateExpr *( BWS COMMA BWS aggregateExpr ) BWS CLOSE
            this.CONSUME(commonTokens_1.AGGREGATE_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            this.OPTION(() => this.CONSUME(commonTokens_1.WS));
            const aggregates = [];
            this.MANY_SEP({
                SEP: commonTokens_1.COMMA,
                DEF: () => {
                    const sourceProperty = this.CONSUME(commonTokens_1.SIMPLEIDENTIFIER).image;
                    let operator;
                    let alias = sourceProperty;
                    this.OR([
                        {
                            ALT: () => {
                                this.CONSUME8(commonTokens_1.WS);
                                this.CONSUME2(commonTokens_1.AS_TOKEN);
                                this.CONSUME9(commonTokens_1.WS);
                                alias = this.CONSUME4(commonTokens_1.SIMPLEIDENTIFIER).image;
                            }
                        },
                        {
                            ALT: () => {
                                this.OPTION2(() => {
                                    this.CONSUME2(commonTokens_1.WS);
                                    this.CONSUME(commonTokens_1.WITH_TOKEN);
                                    this.CONSUME3(commonTokens_1.WS);
                                    operator = this.CONSUME(commonTokens_1.AGGREGATE_FUNCTION).image;
                                    this.OPTION3(() => {
                                        this.CONSUME4(commonTokens_1.WS);
                                        this.CONSUME(commonTokens_1.FROM_TOKEN);
                                        this.CONSUME2(commonTokens_1.SIMPLEIDENTIFIER);
                                    });
                                    this.CONSUME5(commonTokens_1.WS);
                                    this.CONSUME(commonTokens_1.AS_TOKEN);
                                    this.CONSUME6(commonTokens_1.WS);
                                    // NetAmount%20with%20max%20as%20maxAmount
                                    alias = this.CONSUME3(commonTokens_1.SIMPLEIDENTIFIER).image;
                                });
                            }
                        }
                    ]);
                    aggregates.push({
                        name: alias,
                        operator: operator,
                        sourceProperty: sourceProperty
                    });
                }
            });
            this.OPTION4(() => this.CONSUME7(commonTokens_1.WS));
            this.CONSUME(commonTokens_1.CLOSE);
            transformations.push({ type: 'aggregates', aggregateDef: aggregates });
        });
        this.orderByTrafo = this.RULE('orderByTrafo', (transformations = []) => {
            //%s"orderby" OPEN orderbyItem *( COMMA orderbyItem ) CLOSE
            this.CONSUME(commonTokens_1.ORDERBY_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            const orderBy = [];
            this.MANY_SEP({
                SEP: commonTokens_1.COMMA,
                DEF: () => {
                    const orderbyProp = {
                        name: this.CONSUME(commonTokens_1.SIMPLEIDENTIFIER).image,
                        direction: 'asc'
                    };
                    this.OPTION(() => {
                        this.CONSUME(commonTokens_1.WS);
                        orderbyProp.direction = this.CONSUME(commonTokens_1.ASCDESC).image;
                    });
                    orderBy.push(orderbyProp);
                }
            });
            this.CONSUME(commonTokens_1.CLOSE);
            transformations.push({ type: 'orderBy', orderBy: orderBy });
        });
        this.concatTrafo = this.RULE('concatTrafo', (transformations = []) => {
            //%s"concat" OPEN BWS applyExpr 1*( BWS COMMA BWS applyExpr ) BWS CLOSE
            this.CONSUME(commonTokens_1.CONCAT_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            this.OPTION(() => this.CONSUME(commonTokens_1.WS));
            const concatExpressions = [];
            this.MANY_SEP({
                SEP: commonTokens_1.COMMA,
                DEF: () => {
                    concatExpressions.push(this.SUBRULE(this.applyExpr));
                }
            });
            transformations.push({
                type: 'concat',
                concatExpr: concatExpressions
            });
            this.OPTION2(() => this.CONSUME2(commonTokens_1.WS));
            this.CONSUME(commonTokens_1.CLOSE);
        });
        this.ancestorsTrafo = this.RULE('ancestorsTrafo', (transformations = []) => {
            //%s"ancestors" OPEN
            //                   BWS recHierReference BWS
            //                   COMMA BWS preservingTrafos BWS
            //                   [ COMMA BWS 1*DIGIT BWS ]
            //                   [ COMMA BWS %s"keep start" BWS ]
            //                   CLOSE
            this.CONSUME(commonTokens_1.ANCESTORS_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            this.OPTION(() => this.CONSUME(commonTokens_1.WS));
            const rootExpr = this.SUBRULE(this.rootExpr);
            this.CONSUME(commonTokens_1.COMMA);
            const recHierQualifier = this.CONSUME2(commonTokens_1.SIMPLEIDENTIFIER);
            this.CONSUME2(commonTokens_1.COMMA);
            let recHierPropertyPath = this.CONSUME3(commonTokens_1.SIMPLEIDENTIFIER).image;
            this.OPTION2(() => {
                this.CONSUME(commonTokens_1.SLASH);
                recHierPropertyPath += '/' + this.CONSUME4(commonTokens_1.SIMPLEIDENTIFIER).image;
            });
            this.CONSUME3(commonTokens_1.COMMA);
            const subTransformations = [];
            this.SUBRULE(this.preservingTrafo, { ARGS: [subTransformations] });
            let maximumDistance = -1;
            // There can be more but we ignore them for now
            this.OPTION3(() => {
                this.CONSUME4(commonTokens_1.COMMA);
                maximumDistance = parseInt(this.CONSUME2(commonTokens_1.LITERAL).image, 10);
            });
            let shouldKeepStart = false;
            //                  [ COMMA BWS %s"keep start" BWS ]
            this.OPTION4(() => {
                this.CONSUME5(commonTokens_1.COMMA);
                shouldKeepStart = this.CONSUME(commonTokens_1.KEEP_START_TOKEN).image === 'keep start';
            });
            transformations.push({
                type: 'ancestors',
                parameters: {
                    hierarchyRoot: rootExpr,
                    qualifier: recHierQualifier.image,
                    propertyPath: recHierPropertyPath,
                    maximumDistance: maximumDistance,
                    keepStart: shouldKeepStart,
                    inputSetTransformations: subTransformations
                }
            });
            this.CONSUME(commonTokens_1.CLOSE);
        });
        this.rootExpr = this.RULE('rootExpr', () => {
            let rootExpr = '$root/';
            this.CONSUME(commonTokens_1.ROOT_TOKEN);
            // singleNavigationExpr
            const subExprs = [];
            this.MANY_SEP({
                SEP: commonTokens_1.SLASH,
                DEF: () => {
                    let subExpr = this.CONSUME2(commonTokens_1.SIMPLEIDENTIFIER).image;
                    this.OPTION2(() => {
                        // entitySetName + keyPredicate (simpleKey)
                        this.CONSUME(commonTokens_1.OPEN);
                        subExpr += `(${this.CONSUME(commonTokens_1.LITERAL).image})`;
                        this.CONSUME(commonTokens_1.CLOSE);
                    });
                    this.OPTION3(() => {
                        // entitySetName + keyPredicate (complexKey)
                        this.CONSUME2(commonTokens_1.OPEN);
                        const manySep = [];
                        this.MANY_SEP2({
                            SEP: commonTokens_1.COMMA,
                            DEF: () => {
                                const namespacePart = this.CONSUME3(commonTokens_1.SIMPLEIDENTIFIER).image;
                                this.CONSUME(commonTokens_1.EQ);
                                const value = this.CONSUME2(commonTokens_1.LITERAL).image;
                                manySep.push(`${namespacePart}=${value}`);
                            }
                        });
                        subExpr += `(${manySep.join(',')})`;
                        this.CONSUME2(commonTokens_1.CLOSE);
                    });
                    subExprs.push(subExpr);
                }
            });
            rootExpr += subExprs.join('/');
            return rootExpr;
        });
        this.descendantsTrafo = this.RULE('descendantsTrafo', (transformations = []) => {
            //%s"descendants" OPEN
            //                  BWS recHierReference BWS
            //                  COMMA BWS preservingTrafos BWS
            //                  [ COMMA BWS 1*DIGIT BWS ]
            //                  [ COMMA BWS %s"keep start" BWS ]
            //                  CLOSE
            this.CONSUME(commonTokens_1.DESCENDANTS_TOKEN);
            this.CONSUME(commonTokens_1.OPEN);
            //filter(ID eq 'US'),1)/orderby(Name)&$count=true&$select=DistanceFromRoot,DrillState,ID,Name&$skip=0&$top=10");
            this.OPTION(() => this.CONSUME(commonTokens_1.WS));
            const rootExpr = this.SUBRULE(this.rootExpr);
            this.CONSUME(commonTokens_1.COMMA);
            const recHierQualifier = this.CONSUME2(commonTokens_1.SIMPLEIDENTIFIER);
            this.CONSUME2(commonTokens_1.COMMA);
            let recHierPropertyPath = this.CONSUME3(commonTokens_1.SIMPLEIDENTIFIER).image;
            this.OPTION2(() => {
                this.CONSUME(commonTokens_1.SLASH);
                recHierPropertyPath += '/' + this.CONSUME4(commonTokens_1.SIMPLEIDENTIFIER).image;
            });
            this.CONSUME3(commonTokens_1.COMMA);
            const subTransformations = [];
            this.SUBRULE(this.preservingTrafo, { ARGS: [subTransformations] });
            // [ COMMA BWS 1*DIGIT BWS ]
            let maximumDistance = -1;
            // There can be more but we ignore them for now
            this.OPTION3(() => {
                this.CONSUME4(commonTokens_1.COMMA);
                maximumDistance = parseInt(this.CONSUME2(commonTokens_1.LITERAL).image, 10);
            });
            //                  [ COMMA BWS %s"keep start" BWS ]
            let shouldKeepStart = false;
            //                  [ COMMA BWS %s"keep start" BWS ]
            this.OPTION4(() => {
                this.CONSUME5(commonTokens_1.COMMA);
                shouldKeepStart = this.CONSUME(commonTokens_1.KEEP_START_TOKEN).image === 'keep start';
            });
            transformations.push({
                type: 'descendants',
                parameters: {
                    hierarchyRoot: rootExpr,
                    qualifier: recHierQualifier.image,
                    propertyPath: recHierPropertyPath,
                    maximumDistance: maximumDistance,
                    keepStart: shouldKeepStart,
                    inputSetTransformations: subTransformations
                }
            });
            this.CONSUME(commonTokens_1.CLOSE);
        });
        this.customFunction = this.RULE('customFunction', (transformations = []) => {
            const namespaceParts = [];
            this.MANY_SEP({
                SEP: commonTokens_1.DOT,
                DEF: () => {
                    const namespacePart = this.CONSUME(commonTokens_1.SIMPLEIDENTIFIER);
                    namespaceParts.push(namespacePart.image);
                }
            });
            //const functionName = this.CONSUME2(SIMPLEIDENTIFIER);
            this.CONSUME(commonTokens_1.OPEN);
            const parameters = {};
            this.MANY_SEP2({
                SEP: commonTokens_1.COMMA,
                DEF: () => {
                    this.OR([
                        {
                            ALT: () => {
                                const identifier = this.CONSUME3(commonTokens_1.SIMPLEIDENTIFIER);
                                this.CONSUME(commonTokens_1.EQ);
                                const value = this.SUBRULE(this.rootExpr);
                                parameters[identifier.image] = value;
                            }
                        },
                        {
                            ALT: () => {
                                const identifier = this.CONSUME4(commonTokens_1.SIMPLEIDENTIFIER);
                                this.CONSUME2(commonTokens_1.EQ);
                                const value = this.CONSUME(commonTokens_1.LITERAL).image;
                                parameters[identifier.image] = value;
                            }
                        },
                        {
                            ALT: () => {
                                const identifier = this.CONSUME5(commonTokens_1.SIMPLEIDENTIFIER);
                                this.CONSUME3(commonTokens_1.EQ);
                                this.CONSUME(commonTokens_1.OPEN_BRACKET);
                                const parameterArray = [];
                                this.MANY_SEP3({
                                    SEP: commonTokens_1.COMMA,
                                    DEF: () => {
                                        this.OR2([
                                            {
                                                ALT: () => {
                                                    parameterArray.push(this.CONSUME2(commonTokens_1.LITERAL).image);
                                                }
                                            },
                                            {
                                                ALT: () => {
                                                    this.CONSUME(commonTokens_1.OPEN_CURLY_BRACKET);
                                                    const parameterValue = {};
                                                    // More complex parameters  {'NodeID':'US','Levels':1}
                                                    this.MANY_SEP4({
                                                        SEP: commonTokens_1.COMMA,
                                                        DEF: () => {
                                                            const key = this.CONSUME6(commonTokens_1.SIMPLEIDENTIFIERWITHWS).image;
                                                            this.CONSUME(commonTokens_1.COLON);
                                                            const value = this.OR3([
                                                                {
                                                                    ALT: () => {
                                                                        return this.CONSUME7(commonTokens_1.SIMPLEIDENTIFIERWITHWS);
                                                                    }
                                                                },
                                                                {
                                                                    ALT: () => {
                                                                        return this.CONSUME3(commonTokens_1.LITERAL);
                                                                    }
                                                                }
                                                            ]);
                                                            parameterValue[key] = value.image;
                                                        }
                                                    });
                                                    parameterArray.push(parameterValue);
                                                    this.CONSUME(commonTokens_1.CLOSE_CURLY_BRACKET);
                                                }
                                            }
                                        ]);
                                    }
                                });
                                this.CONSUME(commonTokens_1.CLOSE_BRACKET);
                                parameters[identifier.image] = parameterArray;
                            }
                        }
                    ]);
                }
            });
            this.CONSUME(commonTokens_1.CLOSE);
            transformations.push({ type: 'customFunction', name: namespaceParts.join('.'), parameters: parameters });
        });
        this.performSelfAnalysis();
    }
}
exports.ApplyParser = ApplyParser;
function parseApply(applyParameters) {
    if (!applyParameters) {
        return undefined;
    }
    const parser = new ApplyParser();
    const lexingResult = exports.SearchLexer.tokenize(applyParameters);
    parser.input = lexingResult.tokens;
    const output = parser.applyExpr();
    if (parser.errors.length > 0) {
        parser.errors.forEach(console.error);
        throw new Error('Parsing errors detected');
    }
    return output;
}
exports.parseApply = parseApply;
//# sourceMappingURL=applyParser.js.map
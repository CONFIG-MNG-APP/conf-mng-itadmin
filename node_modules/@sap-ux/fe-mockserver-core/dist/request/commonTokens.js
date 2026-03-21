"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOT_TOKEN = exports.AGGREGATE_FUNCTION = exports.AS_TOKEN = exports.FROM_TOKEN = exports.WITH_TOKEN = exports.AGGREGATE_TOKEN = exports.SEARCH_TOKEN = exports.GROUPBY_TOKEN = exports.TOP_TOKEN = exports.SKIP_TOKEN = exports.KEEP_START_TOKEN = exports.COUNT_TOKEN = exports.CONCAT_TOKEN = exports.ANCESTORS_TOKEN = exports.DESCENDANTS_TOKEN = exports.ORDERBY_TOKEN = exports.FILTER_TOKEN = exports.DIGIT = exports.NUMBER = exports.WS = exports.ASCDESC = exports.ANDOR = exports.NOT_OPERATOR = exports.IN_OPERATOR = exports.LOGICAL_OPERATOR = exports.LITERAL = exports.TYPEDEF = exports.BOOL_METHOD = exports.COMPLEX_METHOD = exports.SIMPLE_METHOD = exports.SIMPLEIDENTIFIER = exports.QUOTE = exports.SIMPLEIDENTIFIERWITHWS = exports.COLON = exports.ANYALL = exports.SLASH = exports.COMMA = exports.CLOSE_CURLY_BRACKET = exports.CLOSE_BRACKET = exports.CLOSE = exports.EQ = exports.DOT = exports.OPEN_CURLY_BRACKET = exports.OPEN_BRACKET = exports.OPEN = void 0;
const chevrotain_1 = require("chevrotain");
exports.OPEN = (0, chevrotain_1.createToken)({ name: 'OPEN', pattern: /(?:\(|%28)/ });
exports.OPEN_BRACKET = (0, chevrotain_1.createToken)({ name: 'OPEN_BRACKET', pattern: /(?:\[)/ });
exports.OPEN_CURLY_BRACKET = (0, chevrotain_1.createToken)({ name: 'OPEN_CURLY_BRACKET', pattern: /(?:\{)/ });
exports.DOT = (0, chevrotain_1.createToken)({ name: 'DOT', pattern: /\./ });
exports.EQ = (0, chevrotain_1.createToken)({ name: 'EQ', pattern: /\=/ });
exports.CLOSE = (0, chevrotain_1.createToken)({ name: 'CLOSE', pattern: /(?:\)|%29)/ });
exports.CLOSE_BRACKET = (0, chevrotain_1.createToken)({ name: 'CLOSE_BRACKET', pattern: /(?:\])/ });
exports.CLOSE_CURLY_BRACKET = (0, chevrotain_1.createToken)({ name: 'CLOSE_CURLY_BRACKET', pattern: /(?:\})/ });
exports.COMMA = (0, chevrotain_1.createToken)({ name: 'COMMA', pattern: /(?:,|%2C)/ });
exports.SLASH = (0, chevrotain_1.createToken)({ name: 'SLASH', pattern: /\// });
exports.ANYALL = (0, chevrotain_1.createToken)({ name: 'COMMA', pattern: /(?:any|all)\(/ });
exports.COLON = (0, chevrotain_1.createToken)({ name: 'COLON', pattern: /(?::|%3A)/ });
exports.SIMPLEIDENTIFIERWITHWS = (0, chevrotain_1.createToken)({ name: 'SimpleIdentifierWithWS', pattern: /"\w+[\w\s]+"/ });
exports.QUOTE = (0, chevrotain_1.createToken)({ name: 'QUOTE', longer_alt: exports.SIMPLEIDENTIFIERWITHWS, pattern: /(?:"|%22)/ });
exports.SIMPLEIDENTIFIER = (0, chevrotain_1.createToken)({
    name: 'SimpleIdentifier',
    longer_alt: exports.SIMPLEIDENTIFIERWITHWS,
    pattern: /\w{1,128}/
});
exports.SIMPLE_METHOD = (0, chevrotain_1.createToken)({
    name: 'SIMPLE_METHOD',
    longer_alt: exports.SIMPLEIDENTIFIER,
    pattern: /(?:length|tolower|toupper|trim|round|floor|ceiling)/
});
exports.COMPLEX_METHOD = (0, chevrotain_1.createToken)({
    name: 'COMPLEX_METHOD',
    longer_alt: exports.SIMPLEIDENTIFIER,
    pattern: /(?:concat|contains|endswith|indexof|matchesPattern|startswith|substringof|substring|cast)/
});
exports.BOOL_METHOD = (0, chevrotain_1.createToken)({
    name: 'BOOL_METHOD',
    longer_alt: exports.SIMPLEIDENTIFIER,
    pattern: /(?:contains|endswith|startswith)/
});
exports.TYPEDEF = (0, chevrotain_1.createToken)({ name: 'Typedef', pattern: /Edm\.[a-zA-Z]+/ });
// null, boolean, guid, dateTimeInOffset / dateValue / timeOfDay / decimalValue / doubleValue / singleValue / string / duration / enum / binary
exports.LITERAL = (0, chevrotain_1.createToken)({
    name: 'Literal',
    longer_alt: exports.SIMPLEIDENTIFIER,
    pattern: /(?:null|true|false|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|guid(?:'|%27)[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:'|%27)|(?:datetime|datetimeoffset)'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})*(?:Z)*'|\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:.\d{3,7})*(?:Z|\+\d{2}:\d{2}))*|-?(?:0|[1-9]\d*)(\.\d+)?(?:[eE][+-]?\d+)?[lL]?|'[^\\"\n\r\']*')/
});
//ee1a9172-f3c3-47ce-b0f7-dd28c740210c
exports.LOGICAL_OPERATOR = (0, chevrotain_1.createToken)({
    name: 'Logical',
    longer_alt: exports.SIMPLEIDENTIFIER,
    pattern: /(?:eq|ne|lt|le|gt|ge)/
});
exports.IN_OPERATOR = (0, chevrotain_1.createToken)({
    name: 'In',
    longer_alt: exports.SIMPLEIDENTIFIER,
    pattern: /(?:in)/
});
exports.NOT_OPERATOR = (0, chevrotain_1.createToken)({ name: 'Not', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /(?:not)/ });
exports.ANDOR = (0, chevrotain_1.createToken)({ name: 'AndOr', pattern: /(\s|%20)(?:and|or)(\s|%20)/ });
exports.ASCDESC = (0, chevrotain_1.createToken)({ name: 'AscDesc', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /(?:asc|desc)/ });
exports.WS = (0, chevrotain_1.createToken)({ name: 'Whitespace', pattern: /(\s|%20)+/ });
// const STRINGLITERAL = createToken({
//     name: 'SimpleIdentifier',
//     pattern: /(?:[^\\"\s]+|\\(?:[bfnrtv"\\/]|u[0-9a-fA-F]{4}))+/
// });
//const COMPLEXEXPRESSION = createToken({ name: 'ComplexExpression', pattern: /(?:[^\)]+)/ });
exports.NUMBER = (0, chevrotain_1.createToken)({ name: 'Number', pattern: /(?:\d+)/ });
exports.DIGIT = (0, chevrotain_1.createToken)({ name: 'Digit', pattern: /\d/ });
// null, boolean, guid, dateTimeInOffset / dateValue / timeOfDay / decimalValue / doubleValue / singleValue / string / duration / enum / binary
exports.FILTER_TOKEN = (0, chevrotain_1.createToken)({ name: 'Filter', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /filter/ });
exports.ORDERBY_TOKEN = (0, chevrotain_1.createToken)({ name: 'Order By', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /orderby/ });
exports.DESCENDANTS_TOKEN = (0, chevrotain_1.createToken)({
    name: 'Descendants',
    longer_alt: exports.SIMPLEIDENTIFIER,
    pattern: /descendants/
});
exports.ANCESTORS_TOKEN = (0, chevrotain_1.createToken)({ name: 'Ancestors', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /ancestors/ });
exports.CONCAT_TOKEN = (0, chevrotain_1.createToken)({ name: 'Concat', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /concat/ });
exports.COUNT_TOKEN = (0, chevrotain_1.createToken)({ name: 'Count', pattern: /\$count/ });
exports.KEEP_START_TOKEN = (0, chevrotain_1.createToken)({ name: 'Keep Start', pattern: /keep start/ });
exports.SKIP_TOKEN = (0, chevrotain_1.createToken)({ name: 'Skip', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /skip/ });
exports.TOP_TOKEN = (0, chevrotain_1.createToken)({ name: 'Top', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /top/ });
exports.GROUPBY_TOKEN = (0, chevrotain_1.createToken)({ name: 'GroupBy', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /groupby/ });
exports.SEARCH_TOKEN = (0, chevrotain_1.createToken)({ name: 'Search', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /search/ });
exports.AGGREGATE_TOKEN = (0, chevrotain_1.createToken)({ name: 'Aggregate', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /aggregate/ });
exports.WITH_TOKEN = (0, chevrotain_1.createToken)({ name: 'With', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /with/ });
exports.FROM_TOKEN = (0, chevrotain_1.createToken)({ name: 'From', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /from/ });
exports.AS_TOKEN = (0, chevrotain_1.createToken)({ name: 'As', longer_alt: exports.SIMPLEIDENTIFIER, pattern: /as/ });
exports.AGGREGATE_FUNCTION = (0, chevrotain_1.createToken)({
    name: 'Aggregate Functions',
    pattern: /\b(sum|min|max|countdistinct|average)\b/
});
exports.ROOT_TOKEN = (0, chevrotain_1.createToken)({ name: 'Root Token', pattern: /\$root\// });
//# sourceMappingURL=commonTokens.js.map
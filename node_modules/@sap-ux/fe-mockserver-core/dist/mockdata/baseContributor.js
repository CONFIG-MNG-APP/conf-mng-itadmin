"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEntityContainerContributorClass = exports.MockDataContributorClass = void 0;
const common_1 = require("../data/common");
class MockDataContributorClass {
    constructor(base) {
        this.base = base;
    }
    throwError(message, statusCode = 500, messageData, isSAPMessage = false, headers = {}, isGlobalRequestError) {
        throw new common_1.ExecutionError(message, statusCode, messageData, isSAPMessage, headers, isGlobalRequestError);
    }
}
exports.MockDataContributorClass = MockDataContributorClass;
class MockEntityContainerContributorClass {
    constructor(base) {
        this.base = base;
    }
    throwError(message, statusCode = 500, messageData, isSAPMessage = false) {
        throw new common_1.ExecutionError(message, statusCode, messageData, isSAPMessage);
    }
}
exports.MockEntityContainerContributorClass = MockEntityContainerContributorClass;
//# sourceMappingURL=baseContributor.js.map
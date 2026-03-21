"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainedDataEntitySet = void 0;
const entitySet_1 = require("./entitySet");
class ContainedDataEntitySet extends entitySet_1.MockDataEntitySet {
    constructor(entitySetDefinition, containedData, dataAccess) {
        super('', entitySetDefinition, dataAccess, false, false, false);
        this._rootMockData = containedData !== null && containedData !== void 0 ? containedData : [];
        this.readyPromise = Promise.resolve(this);
    }
}
exports.ContainedDataEntitySet = ContainedDataEntitySet;
//# sourceMappingURL=ContainedDataEntitySet.js.map
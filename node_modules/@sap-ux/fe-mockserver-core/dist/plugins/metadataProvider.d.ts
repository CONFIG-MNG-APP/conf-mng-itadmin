import type { IFileLoader, IMetadataProcessor } from '../index';
export default class MetadataProvider implements IMetadataProcessor {
    private fileLoader;
    constructor(fileLoader: IFileLoader);
    loadMetadata(filePath: string): Promise<string>;
    addI18nPath(_i18Path?: string[]): void;
}
//# sourceMappingURL=metadataProvider.d.ts.map
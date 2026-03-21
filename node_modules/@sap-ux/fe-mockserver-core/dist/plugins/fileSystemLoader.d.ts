import type { IFileLoader } from '../index';
export default class FileSystemLoader implements IFileLoader {
    private readonly tsConfigPath?;
    private isTSLoaded;
    constructor(tsConfigPath?: string | undefined);
    loadFile(filePath: string): Promise<string>;
    isTypescriptEnabled(): boolean;
    exists(filePath: string): Promise<boolean>;
    syncSupported(): boolean;
    existsSync(filePath: string): boolean;
    loadFileSync(filePath: string): string;
    loadJS(filePath: string): Promise<any>;
}
//# sourceMappingURL=fileSystemLoader.d.ts.map
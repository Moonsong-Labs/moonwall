import { ApiPromise } from '@polkadot/api';
export declare function newTestSuite(): string;
export declare function testSuite({ id, title, testCases }: SuiteParameters): void;
interface CustomTest {
    (id: string, title: string, cb: () => void, only?: boolean): void;
}
interface SuiteParameters {
    id: string;
    title: string;
    environment?: string;
    testCases: (TestContext: TestContext) => void;
    options?: Object;
}
type TestContext = {
    context: {
        [name: string]: ApiPromise;
    };
    it: CustomTest;
};
export declare function executeRun(ctx: any): Promise<void>;
export declare const runMochaTests: () => Promise<unknown>;
export {};

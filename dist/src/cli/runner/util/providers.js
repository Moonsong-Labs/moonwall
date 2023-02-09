"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateProviderInterface = exports.prepareProductionProviders = void 0;
const moonbeam_types_bundle_1 = require("moonbeam-types-bundle");
const api_1 = require("@polkadot/api");
function prepareProductionProviders(providerConfigs) {
    return providerConfigs.map(({ name, endpoints, type }) => {
        if (type === ('polkadotJs' || 'moonbeam')) {
            const url = endpoints.includes('ENV_VAR') ? process.env.WSS_URL : endpoints[0];
            const options = { provider: new api_1.WsProvider(url) };
            if (type === 'moonbeam') {
                options.typesBundle = moonbeam_types_bundle_1.typesBundlePre900;
            }
            const connect = async () => {
                const api = await api_1.ApiPromise.create({
                    provider: new api_1.WsProvider(url),
                    noInitWarn: true,
                });
                await api.isReady;
                return api;
            };
            return { name, connect };
        }
    });
}
exports.prepareProductionProviders = prepareProductionProviders;
async function populateProviderInterface(name, connect) {
    const api = await connect();
    return {
        name,
        api,
        greet: () => console.log(`👋  Provider ${name} is connected to chain` +
            ` ${api.consts.system.version.specName.toString()} ` +
            `RT${api.consts.system.version.specVersion.toNumber()}`),
        disconnect: () => api.disconnect(),
    };
}
exports.populateProviderInterface = populateProviderInterface;
//# sourceMappingURL=providers.js.map
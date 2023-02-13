"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderType = exports.FoundationType = void 0;
var FoundationType;
(function (FoundationType) {
    FoundationType["ReadOnly"] = "read_only";
    FoundationType["DevMode"] = "dev";
    FoundationType["Forked"] = "fork";
    FoundationType["ZombieNet"] = "zombie";
    FoundationType["Chopsticks"] = "chopsticks";
})(FoundationType = exports.FoundationType || (exports.FoundationType = {}));
var ProviderType;
(function (ProviderType) {
    ProviderType[ProviderType["PolkadotJs"] = "polkadotJs"] = "PolkadotJs";
    ProviderType[ProviderType["Ethers"] = "ethers"] = "Ethers";
    ProviderType[ProviderType["Web3"] = "web3"] = "Web3";
    ProviderType[ProviderType["Moonbeam"] = "moon"] = "Moonbeam";
    ProviderType[ProviderType["Unknown"] = "unknown"] = "Unknown";
})(ProviderType = exports.ProviderType || (exports.ProviderType = {}));
//# sourceMappingURL=types.js.map
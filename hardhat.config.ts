import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-watcher";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";

export default {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      gasPrice: 0,
    },
  },
  watcher: {
    dev: {
      tasks: ["compile", "test"],
      files: ["./contracts", "./test"],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD",
    gasPrice: 30,
  },
  contractSizer: {
    runOnCompile: process.env.REPORT_CONTRACT_SIZE ? true : false,
  },
  mocha: {
    timeout: 60000,
    parallel: 1,
  },
};

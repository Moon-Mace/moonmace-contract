import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      metadata: {
        bytecodeHash: "none", // disable ipfs
        useLiteralContent: true // store source code in the json file directly
      }
    }
  },
  networks: {
    sepolia: {
      url: process.env.RPC_SEPOLIA,
      accounts: [
        process.env.PRIVATE_KEY_ADMIN!,
      ]
    },
    monadtest: {
      url: "https://testnet-rpc.monad.xyz/",
      accounts: [
        process.env.PRIVATE_KEY_ADMIN!,
      ]
    },
    monad: {
      url: "https://rpc.monad.xyz",
      accounts: [
        process.env.PRIVATE_KEY_ADMIN!,
      ]
    },
  },
  etherscan: {
    enabled: false
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://monadvision.com/"
  },
};

export default config;

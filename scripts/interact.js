// npx hardhat console --network monadtest

require("dotenv").config();

const moonMaceStaking = await ethers.getContractAt("MoonMaceStaking", process.env.MONAD_MC_STAKING);
const [admin] = await ethers.getSigners();

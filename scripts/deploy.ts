import "dotenv/config"
import { deployContract, deployUpgradeableContract } from "./utils"
import { MoonMaceStaking, MoonMaceToken } from "../typechain-types"
import { parseEther } from "ethers"

async function main() {
  const mcMON = await deployContract("MoonMaceToken", [], true) as MoonMaceToken
  const moonMaceStaking = await deployUpgradeableContract(
    "MoonMaceStaking", [await mcMON.getAddress()], true
  ) as MoonMaceStaking

  await mcMON.setMinter(await moonMaceStaking.getAddress(), true)
  
  await moonMaceStaking.setAllowNormalUnstake(true)
  await moonMaceStaking.setAllowInstantUnstake(true)
  await moonMaceStaking.setAllowClaim(true)
  await moonMaceStaking.setStakeAssetCap(parseEther("10000"))
  await moonMaceStaking.stake({ value: parseEther("0.001") })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


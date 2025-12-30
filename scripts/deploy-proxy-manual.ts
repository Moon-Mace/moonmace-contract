import "dotenv/config"
import { deployContract } from "./utils"
import { MoonMaceStaking, MoonMaceToken } from "../typechain-types"
import { parseEther } from "ethers"
import { ethers } from "hardhat"

async function main() {
  const [admin] = await ethers.getSigners()

  // const mcMON = await ethers.getContractAt(
  //   "MoonMaceToken", process.env.MONADTEST_MOONMACE_TOKEN!
  // ) as MoonMaceToken
  const mcMON = await deployContract("MoonMaceToken", [], true) as MoonMaceToken

  const impl = await deployContract("MoonMaceStakingTest", [], true) as MoonMaceStaking
  const proxy = await deployContract("TransparentUpgradeableProxy", [
    await impl.getAddress(),
    admin.address,
    "0xc4d66de8" + "000000000000000000000000" + (await mcMON.getAddress()).slice(2),
      // selector for `initialize(address mcMONTokenAddress)`
  ], true)
  const moonMaceStaking = await ethers.getContractAt(
    "MoonMaceStaking", await proxy.getAddress()
  ) as MoonMaceStaking
  await mcMON.setMinter(await proxy.getAddress(), true)

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


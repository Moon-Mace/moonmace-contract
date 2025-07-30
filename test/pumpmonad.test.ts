import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MoonMaceStaking } from "../typechain-types";
import { parseEther, parseUnits } from "ethers";

const delta = parseEther("0.001")

describe("moonMace Unit Test", function () {
  async function deployContracts() {
    const [_owner, operator] = await ethers.getSigners();

    const amount18 = parseUnits("100", 18);

    // MoonMace related contracts
    const moonMace = await ethers.deployContract("MoonMaceToken");
    const moonMaceStakingFactory = await ethers.getContractFactory("MoonMaceStaking");
    const moonMaceStaking = (await upgrades.deployProxy(moonMaceStakingFactory, [
      await moonMace.getAddress(),
    ])) as unknown as MoonMaceStaking;
    const moonMaceStakingAddress = await moonMaceStaking.getAddress();

    await moonMace.setMinter(moonMaceStakingAddress, true);
    await moonMaceStaking.setStakeAssetCap(amount18 * 3n);
    await moonMaceStaking.setOperator(operator.address);

    return { moonMace, moonMaceStaking };
  }

  it("should deploy the contract correctly", async function () {
    await loadFixture(deployContracts);
  });

  // Initialize function test
  it("should initialize the contract correctly", async function () {
    const { moonMaceStaking, moonMace } = await loadFixture(deployContracts);
    const [owner] = await ethers.getSigners();

    const moonMaceAddress = await moonMaceStaking.mcMON();

    expect(moonMaceAddress).to.equal(await moonMace.getAddress());
    expect(await moonMaceStaking.instantUnstakeFee()).to.equal(300);
    expect(await moonMaceStaking.owner()).to.equal(owner.address);
    expect(await moonMaceStaking.paused()).to.equal(false);
  });

  it("should handle ownership transfer in two steps", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [operator] = await ethers.getSigners();

    await moonMaceStaking.transferOwnership(operator.address);
    expect(await moonMaceStaking.pendingOwner()).to.equal(operator.address);

    await moonMaceStaking.connect(operator).acceptOwnership();
    expect(await moonMaceStaking.owner()).to.equal(operator.address);
  });

  // Utils functions test
  it("should return correct date slot", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);

    const timestamp1 = 0; // Epoch time
    const timestamp2 = 3600 * 12; // 12 hours from epoch
    const timestamp3 = 3600 * 24 * 5; // 5 days from epoch

    expect(await moonMaceStaking._getDateSlot(timestamp1)).to.equal(0); // UTC+18 => still 0
    expect(await moonMaceStaking._getDateSlot(timestamp2)).to.equal(0); // UTC+18 => still 0
    expect(await moonMaceStaking._getDateSlot(timestamp3)).to.equal(5 % 10); // UTC+18 => 5 % 10 = 5
  });

  // Owner functions test
  it("should allow owner to pause and unpause the contract", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner] = await ethers.getSigners();

    await expect(moonMaceStaking.connect(owner).pause()).to.emit(
      moonMaceStaking,
      "Paused"
    );
    expect(await moonMaceStaking.paused()).to.equal(true);

    await expect(moonMaceStaking.connect(owner).unpause()).to.emit(
      moonMaceStaking,
      "Unpaused"
    );
    expect(await moonMaceStaking.paused()).to.equal(false);
  });

  it("should revert when non-owner tries to pause and unpause the contract", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const attacker = accounts[4];

    await expect(
      moonMaceStaking.connect(attacker).pause()
    ).to.be.revertedWithCustomError(moonMaceStaking, "OwnableUnauthorizedAccount");

    await expect(
      moonMaceStaking.connect(attacker).unpause()
    ).to.be.revertedWithCustomError(moonMaceStaking, "OwnableUnauthorizedAccount");
  });

  it("should allow owner to set stake asset cap", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner] = await ethers.getSigners();

    const newCap = parseUnits("200", 18);

    await expect(moonMaceStaking.connect(owner).setStakeAssetCap(newCap))
      .to.emit(moonMaceStaking, "SetStakeAssetCap")
      .withArgs(await moonMaceStaking.totalStakingCap(), newCap);

    expect(await moonMaceStaking.totalStakingCap()).to.equal(newCap);
  });

  it("should revert when non-owner tries to set stake asset cap", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const attacker = accounts[5];

    const newCap = parseUnits("200", 18);

    await expect(
      moonMaceStaking.connect(attacker).setStakeAssetCap(newCap)
    ).to.be.revertedWithCustomError(moonMaceStaking, "OwnableUnauthorizedAccount");
  });

  it("should allow owner to set instant unstake fee", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner] = await ethers.getSigners();

    const newFee = 500; // 5%

    await expect(moonMaceStaking.connect(owner).setInstantUnstakeFee(newFee))
      .to.emit(moonMaceStaking, "SetInstantUnstakeFee")
      .withArgs(await moonMaceStaking.instantUnstakeFee(), newFee);

    expect(await moonMaceStaking.instantUnstakeFee()).to.equal(newFee);
  });

  it("should revert when non-owner tries to set instant unstake fee", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const attacker = accounts[5];
    const newFee = 500; // 5%

    await expect(
      moonMaceStaking.connect(attacker).setInstantUnstakeFee(newFee)
    ).to.be.revertedWithCustomError(moonMaceStaking, "OwnableUnauthorizedAccount");
  });

  it("should allow owner to set operator", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await expect(moonMaceStaking.connect(owner).setOperator(user1.address))
      .to.emit(moonMaceStaking, "SetOperator")
      .withArgs(await moonMaceStaking.operator(), user1.address);

    expect(await moonMaceStaking.operator()).to.equal(user1.address);
  });

  it("should revert when non-owner tries to set operator", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await expect(
      moonMaceStaking.connect(user1).setOperator(user2.address)
    ).to.be.revertedWithCustomError(moonMaceStaking, "OwnableUnauthorizedAccount");
  });

  it("should allow owner to collect fee", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowInstantUnstake(true)

    const ownerBalanceBefore = await ethers.provider.getBalance(owner);

    await moonMaceStaking.connect(user2).stake({ value: parseUnits("0.2", 18) });
    await moonMaceStaking.connect(user2).unstakeInstant(parseUnits("0.2", 18));

    const collectFeeBefore = await moonMaceStaking.collectedFee();

    await expect(moonMaceStaking.connect(owner).collectFee()).to.emit(
      moonMaceStaking,
      "FeeCollected"
    );

    const ownerBalanceAfter = await ethers.provider.getBalance(owner);

    expect(await moonMaceStaking.collectedFee()).to.equal(0);
    expect(ownerBalanceAfter - ownerBalanceBefore).to.closeTo(collectFeeBefore, delta);
  });

  it("should revert when non-owner tries to collect fee", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const user1 = accounts[2];

    await expect(
      moonMaceStaking.connect(user1).collectFee()
    ).to.be.revertedWithCustomError(moonMaceStaking, "OwnableUnauthorizedAccount");
  });

  // Operator functions test
  it("should allow operator to withdraw", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    const stakeAmount = parseUnits("1", 18);
    await moonMaceStaking.connect(user1).stake({ value: stakeAmount });

    const operatorBalanceBefore = await ethers.provider.getBalance(operator.address);

    await expect(moonMaceStaking.connect(operator).withdraw())
      .to.emit(moonMaceStaking, "AdminWithdraw")
      .withArgs(operator.address, stakeAmount);

    const operatorBalanceAfter = await ethers.provider.getBalance(operator.address);
    expect(operatorBalanceAfter - operatorBalanceBefore).to.closeTo(stakeAmount, delta);
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(0);
  });

  it("should revert when non-operator tries to withdraw", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    const stakeAmount = parseUnits("1", 18);
    await moonMaceStaking.connect(user1).stake({ value: stakeAmount });

    await expect(moonMaceStaking.connect(user2).withdraw()).to.be.revertedWith(
      "MoonMace: caller is not the operator"
    );
  });

  it("should allow operator to deposit", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const operator = accounts[1];

    const depositAmount = parseUnits("10", 18);
    const operatorBalanceBefore = await ethers.provider.getBalance(operator.address);

    await expect(moonMaceStaking.connect(operator).deposit({ value: depositAmount }))
      .to.emit(moonMaceStaking, "AdminDeposit")
      .withArgs(operator.address, depositAmount);

    const operatorBalanceAfter = await ethers.provider.getBalance(operator.address);
    expect(operatorBalanceBefore - operatorBalanceAfter).to.closeTo(depositAmount, delta);
    expect(await moonMaceStaking.totalClaimableAmount()).to.equal(depositAmount);
  });

  it("should revert when non-operator tries to deposit", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const user1 = accounts[2];
    const depositAmount = parseUnits("10", 18);
    await expect(
      moonMaceStaking.connect(user1).deposit({ value: depositAmount })
    ).to.be.revertedWith("MoonMace: caller is not the operator");
  });

  it("should allow operator to withdraw and deposit", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    const stakeAmount = parseUnits("1", 18);
    await moonMaceStaking.connect(user1).stake({ value: stakeAmount });

    const operatorBalanceBefore = await ethers.provider.getBalance(operator.address);

    const depositAmount = parseUnits("0.5", 18);
    await expect(
      moonMaceStaking.connect(operator).withdrawAndDeposit({ value: depositAmount })
    )
      .to.emit(moonMaceStaking, "AdminWithdraw")
      .withArgs(operator.address, stakeAmount)
      .and.to.emit(moonMaceStaking, "AdminDeposit")
      .withArgs(operator.address, depositAmount);

    const operatorBalanceAfter = await ethers.provider.getBalance(operator.address);
    expect(operatorBalanceAfter - operatorBalanceBefore).to.closeTo(stakeAmount - depositAmount, delta);
    expect(await moonMaceStaking.totalClaimableAmount()).to.equal(depositAmount);
  });

  it("should revert when non-operator tries to withdraw and deposit", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    const stakeAmount = parseUnits("1", 18);
    await moonMaceStaking.connect(user1).stake({ value: stakeAmount });

    const depositAmount = parseUnits("0.5", 18);
    await expect(
      moonMaceStaking.connect(user2).withdrawAndDeposit({ value: depositAmount })
    ).to.be.revertedWith("MoonMace: caller is not the operator");
  });

  // User functions test
  it("should allow user to stake tokens when not paused", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const user1 = accounts[2];

    const stakeAmount = parseUnits("1", 18);

    const userBalanceBefore = await ethers.provider.getBalance(user1.address);

    await expect(moonMaceStaking.connect(user1).stake({ value: stakeAmount }))
      .to.emit(moonMaceStaking, "Stake")
      .withArgs(user1.address, stakeAmount);

    const userBalanceAfter = await ethers.provider.getBalance(user1.address);

    expect(userBalanceBefore - userBalanceAfter).to.closeTo(stakeAmount, delta);
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(stakeAmount);
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(stakeAmount);
  });

  it("should revert stake when contract is paused", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.connect(owner).pause();

    const stakeAmount = parseUnits("1", 18);
    await expect(
      moonMaceStaking.connect(user1).stake({ value: stakeAmount })
    ).to.be.revertedWithCustomError(moonMaceStaking, "EnforcedPause");
  });

  it("should revert stake with zero amount", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const user1 = accounts[2];

    await expect(moonMaceStaking.connect(user1).stake({ value: 0 })).to.be.revertedWith(
      "MoonMace: amount should be greater than 0"
    );
  });

  it("should revert stake when exceeding the staking cap", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    const stakeAmount = await moonMaceStaking.totalStakingCap();

    await moonMaceStaking.connect(user1).stake({ value: stakeAmount });

    await expect(moonMaceStaking.connect(user1).stake({ value: 1 })).to.be.revertedWith(
      "MoonMace: exceed staking cap"
    );
  });

  it("should allow user to request unstake", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();
    
    await moonMaceStaking.setAllowNormalUnstake(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.closeTo(parseUnits("1", 18), delta);
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    const block = await ethers.provider.getBlock("latest");
    if (block === null) {
      throw new Error("Failed to fetch the latest block");
    }

    const timestamp = block.timestamp;
    const slot = await moonMaceStaking._getDateSlot(timestamp);

    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.5", 18));

    const userPendingUnstakeAmount = await moonMaceStaking.pendingUnstakeAmount(
      user1.address,
      slot
    );

    expect(userPendingUnstakeAmount).to.equal(parseUnits("0.5", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(
      parseUnits("0.5", 18)
    );
    expect(await moonMaceStaking.totalRequestedAmount()).to.equal(
      parseUnits("0.5", 18)
    );
  });

  it("should revert MoonMace: claim the previous unstake first", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowNormalUnstake(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    await expect(
      moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.1", 18))
    );

    await time.increase(86400 * 7);
    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.1", 18));

    await time.increase(86400 * 7);
    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.2", 18));

    await time.increase(86400 * 3);
    await expect(
      moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.1", 18))
    ).to.be.revertedWith("MoonMace: claim the previous unstake first");
  });

  it("should MoonMace: amount should be greater than 0", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowNormalUnstake(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    await expect(
      moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0", 18))
    ).to.be.revertedWith("MoonMace: amount should be greater than 0");
  });

  it("should allow user to claim unstake amount after the claimable time", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowNormalUnstake(true)
    await moonMaceStaking.setAllowClaim(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    await moonMaceStaking.connect(operator).deposit({ value: parseUnits("0.5", 18) });

    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.5", 18));
    const block = await ethers.provider.getBlock("latest");
    if (block === null) {
      throw new Error("Failed to fetch the latest block");
    }
    const slot = await moonMaceStaking._getDateSlot(block.timestamp);

    await time.increase(86400 * 9);
    expect(await moonMaceStaking.connect(user1).claimSlot(slot))
      .to.emit(moonMaceStaking, "ClaimSlot")
      .withArgs(user1.address, parseUnits("0.5", 18), slot);

    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999.5", 18), delta);
    expect(await moonMaceStaking.totalClaimableAmount()).to.equal(0);
    expect(await moonMaceStaking.totalRequestedAmount()).to.equal(0);
    expect(
      await moonMaceStaking.pendingUnstakeAmount(user1.address, slot)
    ).to.equal(0);
  });

  it("should revert when there is no pending unstake", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();

    await moonMaceStaking.setAllowClaim(true)

    const user1 = accounts[2];

    const block = await ethers.provider.getBlock("latest");
    if (block === null) {
      throw new Error("Failed to fetch the latest block");
    }
    const slot = await moonMaceStaking._getDateSlot(block.timestamp);

    await expect(moonMaceStaking.connect(user1).claimSlot(slot)).to.be.revertedWith(
      "MoonMace: no pending unstake"
    );
  });

  it("should revert when the claimable time has not been reached", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();
    const user1 = accounts[2];

    await moonMaceStaking.setAllowNormalUnstake(true)
    await moonMaceStaking.setAllowClaim(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.5", 18));
    const block = await ethers.provider.getBlock("latest");
    if (block === null) {
      throw new Error("Failed to fetch the latest block");
    }
    const slot = await moonMaceStaking._getDateSlot(block.timestamp);

    await time.increase(86400 * 2);

    await expect(moonMaceStaking.connect(user1).claimSlot(slot)).to.be.revertedWith(
      "MoonMace: haven't reached the claimable time"
    );
  });

  it("should allow user to claim all unstake amounts after the claimable time", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowNormalUnstake(true)
    await moonMaceStaking.setAllowClaim(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.3", 18));

    await moonMaceStaking.connect(operator).deposit({ value: parseUnits("0.5", 18) });

    expect(await moonMace.balanceOf(user1.address)).to.equal(
      parseUnits("0.7", 18)
    );
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);

    await time.increase(86400 * 9);
    await moonMaceStaking.connect(user1).claimAll();

    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999.3", 18), delta);
    expect(await moonMaceStaking.totalClaimableAmount()).to.equal(
      parseUnits("0.2", 18)
    );
    expect(await moonMaceStaking.totalRequestedAmount()).to.equal(0);
  });

  it("should revert when there is no claimable amount", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();

    await moonMaceStaking.setAllowClaim(true)

    const user1 = accounts[2];

    await expect(moonMaceStaking.connect(user1).claimAll()).to.be.revertedWith(
      "MoonMace: no pending unstake"
    );
  });

  it("should revert when there is no claimable amount before the claimable time", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowNormalUnstake(true)
    await moonMaceStaking.setAllowClaim(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.3", 18));

    await moonMaceStaking.connect(operator).deposit({ value: parseUnits("0.5", 18) });

    expect(await moonMace.balanceOf(user1.address)).to.equal(
      parseUnits("0.7", 18)
    );
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);

    await expect(moonMaceStaking.connect(user1).claimAll()).to.be.revertedWith(
      "MoonMace: haven't reached the claimable time"
    );
  });

  it("should allow user to unstake instantly", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowInstantUnstake(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    await moonMaceStaking.connect(user1).unstakeInstant(parseUnits("0.5", 18));

    const fee = await moonMaceStaking.collectedFee();
    const amountAfterFee = parseUnits("0.5", 18) - fee;

    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(
      parseUnits("9999", 18) + amountAfterFee, delta
    );
    expect(await moonMace.balanceOf(user1.address)).to.equal(
      parseUnits("0.5", 18)
    );
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(
      parseUnits("0.5", 18)
    );
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(
      parseUnits("0.5", 18)
    );
    expect(await moonMaceStaking.collectedFee()).to.equal(fee);
  });

  it("should revert when unstake amount is greater than pending stake amount", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowInstantUnstake(true)

    await moonMaceStaking.connect(user1).stake({ value: parseUnits("0.5", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999.5", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(
      parseUnits("0.5", 18)
    );
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(
      parseUnits("0.5", 18)
    );
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(
      parseUnits("0.5", 18)
    );

    await expect(
      moonMaceStaking.connect(user1).unstakeInstant(parseUnits("1", 18))
    ).to.be.revertedWith("MoonMace: insufficient liquidity");
  });

  it("should revert when unstake amount is zero", async function () {
    const { moonMaceStaking } = await loadFixture(deployContracts);
    const accounts = await ethers.getSigners();

    await moonMaceStaking.setAllowInstantUnstake(true)
    
    const user1 = accounts[2];

    await expect(
      moonMaceStaking.connect(user1).unstakeInstant(0)
    ).to.be.revertedWith("MoonMace: amount should be greater than 0");
  });

  // Finish user journey of staking test
  it("should finish user journey of staking", async function () {
    const { moonMace, moonMaceStaking } = await loadFixture(deployContracts);
    const [owner, operator, user1, user2] = await ethers.getSigners();

    await moonMaceStaking.setAllowNormalUnstake(true)
    await moonMaceStaking.setAllowInstantUnstake(true)
    await moonMaceStaking.setAllowClaim(true)

    // Day 1: User1 stakes 1 WMONAD
    await moonMaceStaking.connect(user1).stake({ value: parseUnits("1", 18) });
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    expect(await moonMace.balanceOf(user1.address)).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("1", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("1", 18));

    await moonMaceStaking.connect(operator).withdraw();
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("0", 18));

    // Day 2: User2 stakes 2 WMONAD
    await time.increase(86400);
    await moonMaceStaking.connect(user2).stake({ value: parseUnits("2", 18) });
    expect(await ethers.provider.getBalance(user2.address)).to.closeTo(parseUnits("9998", 18), delta);
    expect(await moonMace.balanceOf(user2.address)).to.equal(parseUnits("2", 18));
    expect(await moonMaceStaking.totalStakingAmount()).to.equal(parseUnits("3", 18));
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("2", 18));

    await moonMaceStaking.connect(operator).withdraw();
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(parseUnits("0", 18));

    // Day 5: User1 unstake 0.3 WMONAD
    await time.increase(86400 * 3);
    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.3", 18));

    // Day 12: User1 can't unstake yet, and request again
    await time.increase(86400 * 7);
    await expect(moonMaceStaking.connect(user1).claimAll()).to.be.revertedWith(
      "MoonMace: haven't reached the claimable time"
    );
    await moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.1", 18));

    // Day 15: User1 can't unstake again before claim
    await time.increase(86400 * 3);
    await moonMaceStaking.connect(operator).deposit({ value: parseUnits("0.5", 18) });
    await expect(
      moonMaceStaking.connect(user1).unstakeRequest(parseUnits("0.1", 18))
    ).to.be.revertedWith("MoonMace: claim the previous unstake first");

    // Day 15: User1 claim the unstake
    expect(await moonMace.balanceOf(user1.address)).to.equal(
      parseUnits("0.6", 18)
    );
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999", 18), delta);
    await moonMaceStaking.connect(user1).claimAll();
    expect(await ethers.provider.getBalance(user1.address)).to.closeTo(parseUnits("9999.3", 18), delta);

    // Day 16: User2 unstake instantly
    await time.increase(86400);
    await expect(
      moonMaceStaking.connect(user2).unstakeInstant(parseUnits("0.2", 18))
    ).to.be.revertedWith("MoonMace: insufficient liquidity");
    await moonMaceStaking.connect(user1).stake({ value: parseUnits("0.5", 18) })
    await moonMaceStaking.connect(operator).depositToInstantPool({ value: parseUnits("0.5", 18) });
    expect(await moonMaceStaking.instantPoolAmount()).to.equal(parseUnits("0.5", 18));

    await moonMaceStaking.connect(user2).unstakeInstant(parseUnits("0.2", 18)); // 0.2 * (1-3%) = 0.194
    expect(await moonMace.balanceOf(user2.address)).to.equal(
      parseUnits("1.8", 18)
    );
    expect(await ethers.provider.getBalance(user2.address)).to.closeTo(
      parseUnits("9998.194", 18), delta
    );
    expect(await moonMaceStaking.pendingStakeAmount()).to.equal(
      parseUnits("0.5", 18)
    );
    expect(await moonMaceStaking.instantPoolAmount()).to.equal(
      parseUnits("0.3", 18)
    );

    // Day 16: Collect fees
    const balanceBefore = await ethers.provider.getBalance(owner.address);
    await moonMaceStaking.collectFee();
    const balanceAfter = await ethers.provider.getBalance(owner.address);
    expect(balanceAfter - balanceBefore).to.closeTo(parseUnits("0.006", 18), delta);

    await moonMaceStaking.connect(operator).withdrawFromInstantPool(
      parseUnits("0.3", 18)
    );
    expect(await moonMaceStaking.instantPoolAmount()).to.equal(parseUnits("0", 18));
  });
});
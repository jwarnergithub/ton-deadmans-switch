import test from "node:test";
import assert from "node:assert/strict";
import { Blockchain, type SandboxContract, type TreasuryContract } from "@ton/sandbox";
import { beginCell, Cell, SendMode, toNano } from "@ton/core";
import { compile } from "@ton/blueprint";
import { DeadMansSwitchVault } from "../wrappers/DeadMansSwitchVault";

let code: Cell;

test.before(async () => {
  code = await compile("DeadMansSwitchVault");
});

async function setupSingleBeneficiaryContract(deployAmountTon = "3") {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const owner = await blockchain.treasury("owner");
  const beneficiary = await blockchain.treasury("beneficiary");

  const contract = blockchain.openContract(
    DeadMansSwitchVault.createFromConfig(
      {
        ownerAddress: owner.address.toString(),
        livenessCode: "manual check-in phrase",
        livenessDurationMonths: 6,
        beneficiaries: [
          {
            address: beneficiary.address.toString(),
            sharePercentage: "100",
          },
        ],
        minimumReserveFloorTon: "0.5",
        version: 1,
      },
      code,
    ),
  );

  const deployResult = (await contract.sendDeploy(owner.getSender(), toNano(deployAmountTon))) as any;

  return { blockchain, owner, beneficiary, contract, deployResult };
}

async function setupMultiBeneficiaryContract(deployAmountTon = "5") {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const owner = await blockchain.treasury("owner");
  const beneficiaryA = await blockchain.treasury("beneficiary-a");
  const beneficiaryB = await blockchain.treasury("beneficiary-b");

  const contract = blockchain.openContract(
    DeadMansSwitchVault.createFromConfig(
      {
        ownerAddress: owner.address.toString(),
        livenessCode: "manual check-in phrase",
        livenessDurationMonths: 6,
        beneficiaries: [
          {
            address: beneficiaryA.address.toString(),
            sharePercentage: "40",
          },
          {
            address: beneficiaryB.address.toString(),
            sharePercentage: "60",
          },
        ],
        minimumReserveFloorTon: "0.5",
        version: 1,
      },
      code,
    ),
  );

  const deployResult = (await contract.sendDeploy(owner.getSender(), toNano(deployAmountTon))) as any;

  return { blockchain, owner, beneficiaryA, beneficiaryB, contract, deployResult };
}

test("deploy initializes liveness clock and getters", async () => {
  const { blockchain, contract, deployResult } = await setupSingleBeneficiaryContract("0.2");

  assert.ok(Array.isArray(deployResult.transactions));

  const liveness = await contract.getLivenessStatus();
  const payout = await contract.getPayoutProgress();

  assert.equal(liveness.lastLivenessAt, blockchain.now);
  assert.equal(liveness.livenessIntervalSeconds, 15_552_000);
  assert.equal(liveness.expired, false);
  assert.equal(liveness.completed, false);
  assert.equal(payout.payoutIndex, 0);
  assert.equal(payout.beneficiaryCount, 1);
  assert.equal(payout.minimumReserveFloorNano.toString(), toNano("0.5").toString());
});

test("valid owner ping updates last_liveness_at", async () => {
  const { blockchain, owner, contract } = await setupSingleBeneficiaryContract("0.2");

  const before = await contract.getLivenessStatus();
  blockchain.now += 3600;

  await contract.sendOwnerPing(owner.getSender(), toNano("0.05"), "manual check-in phrase");

  const after = await contract.getLivenessStatus();

  assert.equal(after.livenessIntervalSeconds, before.livenessIntervalSeconds);
  assert.equal(after.lastLivenessAt, blockchain.now);
  assert.ok(after.lastLivenessAt > before.lastLivenessAt);
  assert.equal(after.expired, false);
});

test("owner can send a plain wallet comment matching the liveness code", async () => {
  const { blockchain, owner, contract } = await setupSingleBeneficiaryContract("0.2");

  const before = await contract.getLivenessStatus();
  blockchain.now += 3600;

  await owner.send({
    to: contract.address,
    value: toNano("0.05"),
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    body: beginCell().storeUint(0, 32).storeStringTail("manual check-in phrase").endCell(),
  });

  const after = await contract.getLivenessStatus();

  assert.equal(after.lastLivenessAt, blockchain.now);
  assert.ok(after.lastLivenessAt > before.lastLivenessAt);
  assert.equal(after.expired, false);
});

test("owner ping after expiry does not update getter state", async () => {
  const { blockchain, owner, contract } = await setupSingleBeneficiaryContract("0.2");

  const before = await contract.getLivenessStatus();
  blockchain.now = before.lastLivenessAt + before.livenessIntervalSeconds + 1;

  const result = (await contract.sendOwnerPing(
    owner.getSender(),
    toNano("0.05"),
    "manual check-in phrase",
  )) as any;

  const after = await contract.getLivenessStatus();
  const contractTx = result.transactions.find((tx: any) => tx.inMessage?.info.dest?.equals?.(contract.address));

  assert.equal(after.lastLivenessAt, before.lastLivenessAt);
  assert.equal(after.expired, false);
  assert.ok(contractTx);
  assert.equal(contractTx.description.computePhase.exitCode, 107);
});

test("owner can cancel before expiry and recover remaining TON", async () => {
  const { owner, contract, blockchain } = await setupSingleBeneficiaryContract("3");

  const ownerBalanceBefore = await owner.getBalance();
  const result = (await contract.sendCancel(owner.getSender(), toNano("0.05"))) as any;
  const ownerBalanceAfter = await owner.getBalance();
  const destroyedEvent = result.events.find((event: any) => event.type === "account_destroyed");
  const destroyedAccount = await blockchain.getContract(contract.address);

  assert.ok(ownerBalanceAfter - ownerBalanceBefore > toNano("2.5"));
  assert.ok(destroyedEvent);
  assert.ok(
    destroyedAccount.accountState === undefined ||
      destroyedAccount.accountState.type === "uninit",
  );
});

test("non-owner cannot cancel before expiry", async () => {
  const { beneficiary, contract } = await setupSingleBeneficiaryContract("3");

  const result = (await contract.sendCancel(beneficiary.getSender(), toNano("0.05"))) as any;
  const contractTx = result.transactions.find((tx: any) => tx.inMessage?.info.dest?.equals?.(contract.address));

  assert.ok(contractTx);
  assert.equal(contractTx.description.computePhase.exitCode, 105);
});

test("owner cannot cancel after expiry window has passed", async () => {
  const { blockchain, owner, contract } = await setupSingleBeneficiaryContract("3");

  const before = await contract.getLivenessStatus();
  blockchain.now = before.lastLivenessAt + before.livenessIntervalSeconds + 1;

  const result = (await contract.sendCancel(owner.getSender(), toNano("0.05"))) as any;
  const contractTx = result.transactions.find((tx: any) => tx.inMessage?.info.dest?.equals?.(contract.address));

  assert.ok(contractTx);
  assert.equal(contractTx.description.computePhase.exitCode, 112);
});

test("beneficiary can trigger expiry after the liveness deadline", async () => {
  const { blockchain, beneficiary, contract } = await setupSingleBeneficiaryContract("0.2");

  const before = await contract.getLivenessStatus();
  blockchain.now = before.lastLivenessAt + before.livenessIntervalSeconds + 1;

  await contract.sendTriggerExpiry(beneficiary.getSender(), toNano("0.05"));

  const after = await contract.getLivenessStatus();
  const payout = await contract.getPayoutProgress();

  assert.equal(after.lastLivenessAt, before.lastLivenessAt);
  assert.equal(after.expired, true);
  assert.equal(after.completed, true);
  assert.equal(payout.payoutIndex, 1);
});

test("beneficiary can trigger the dead man switch with a plain wallet comment", async () => {
  const { blockchain, beneficiary, contract } = await setupSingleBeneficiaryContract("0.2");

  const before = await contract.getLivenessStatus();
  blockchain.now = before.lastLivenessAt + before.livenessIntervalSeconds + 1;

  await beneficiary.send({
    to: contract.address,
    value: toNano("0.05"),
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    body: beginCell().storeUint(0, 32).storeStringTail("trigger").endCell(),
  });

  const after = await contract.getLivenessStatus();
  const payout = await contract.getPayoutProgress();

  assert.equal(after.expired, true);
  assert.equal(after.completed, true);
  assert.equal(payout.payoutIndex, 1);
});

test("trigger expiry distributes the full snapshot balance by percentage when funded sufficiently", async () => {
  const { blockchain, beneficiaryA, beneficiaryB, contract } = await setupMultiBeneficiaryContract("5");

  const beforeLiveness = await contract.getLivenessStatus();
  blockchain.now = beforeLiveness.lastLivenessAt + beforeLiveness.livenessIntervalSeconds + 1;
  const balanceABefore = await beneficiaryA.getBalance();
  const balanceBBefore = await beneficiaryB.getBalance();

  await contract.sendTriggerExpiry(beneficiaryA.getSender(), toNano("0.05"));

  const afterLiveness = await contract.getLivenessStatus();
  const afterPayout = await contract.getPayoutProgress();
  const balanceAAfter = await beneficiaryA.getBalance();
  const balanceBAfter = await beneficiaryB.getBalance();
  const contractAccount = await blockchain.getContract(contract.address);
  const deltaA = balanceAAfter - balanceABefore;
  const deltaB = balanceBAfter - balanceBBefore;

  assert.equal(afterLiveness.expired, true);
  assert.equal(afterLiveness.completed, true);
  assert.equal(afterPayout.payoutIndex, 2);
  assert.ok(deltaA > toNano("1.8"));
  assert.ok(deltaB > toNano("2.7"));
  assert.ok(deltaB > deltaA);
  assert.ok(contractAccount.balance <= toNano("0.06"));
});

test("non-beneficiary cannot trigger expiry", async () => {
  const { blockchain, owner, contract } = await setupSingleBeneficiaryContract("0.2");

  const before = await contract.getLivenessStatus();
  blockchain.now = before.lastLivenessAt + before.livenessIntervalSeconds + 1;

  const result = (await contract.sendTriggerExpiry(owner.getSender(), toNano("0.05"))) as any;

  const after = await contract.getLivenessStatus();
  const contractTx = result.transactions.find((tx: any) => tx.inMessage?.info.dest?.equals?.(contract.address));

  assert.equal(after.expired, false);
  assert.ok(contractTx);
  assert.equal(contractTx.description.computePhase.exitCode, 109);
});

test("resume payout before expiry does not advance payout_index", async () => {
  const { beneficiary, contract } = await setupSingleBeneficiaryContract("0.2");

  const beforePayout = await contract.getPayoutProgress();
  const beforeLiveness = await contract.getLivenessStatus();
  const result = (await contract.sendResumePayout(beneficiary.getSender(), toNano("0.05"))) as any;
  const afterPayout = await contract.getPayoutProgress();
  const afterLiveness = await contract.getLivenessStatus();
  const contractTx = result.transactions.find((tx: any) => tx.inMessage?.info.dest?.equals?.(contract.address));

  assert.equal(afterPayout.payoutIndex, beforePayout.payoutIndex);
  assert.equal(afterPayout.beneficiaryCount, beforePayout.beneficiaryCount);
  assert.equal(afterLiveness.expired, beforeLiveness.expired);
  assert.equal(afterLiveness.completed, beforeLiveness.completed);
  assert.ok(contractTx);
  assert.equal(contractTx.description.computePhase.exitCode, 111);
});

test("get_beneficiary returns share percentages in serialized index order", async () => {
  const { beneficiaryA, beneficiaryB, contract } = await setupMultiBeneficiaryContract("5");

  const first = await contract.getBeneficiary(0);
  const second = await contract.getBeneficiary(1);
  const payout = await contract.getPayoutProgress();

  assert.equal(first.wallet.toString(), beneficiaryA.address.toString());
  assert.equal(first.shareBasisPoints, 4000);
  assert.equal(first.usdtAmountStubNano.toString(), "0");
  assert.equal(first.xaut0AmountStubNano.toString(), "0");

  assert.equal(second.wallet.toString(), beneficiaryB.address.toString());
  assert.equal(second.shareBasisPoints, 6000);
  assert.equal(second.usdtAmountStubNano.toString(), "0");
  assert.equal(second.xaut0AmountStubNano.toString(), "0");

  assert.equal(payout.beneficiaryCount, 2);
});

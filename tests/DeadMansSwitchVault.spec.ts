import test from "node:test";
import assert from "node:assert/strict";
import { beginCell } from "@ton/core";
import {
  createDeadMansSwitchInitPackage,
  parseDeadMansSwitchDataCellBase64,
} from "../shared/deadMansSwitchInit";

test("serializes TON-only init config into a decodable TON data cell", () => {
  const initPackage = createDeadMansSwitchInitPackage({
    ownerAddress: "0:1111111111111111111111111111111111111111111111111111111111111111",
    livenessCode: "manual check-in phrase",
    livenessDurationMonths: 6,
    beneficiaries: [
      {
        address: "0:2222222222222222222222222222222222222222222222222222222222222222",
        sharePercentage: "40",
      },
      {
        address: "0:3333333333333333333333333333333333333333333333333333333333333333",
        sharePercentage: "60",
      },
    ],
    minimumReserveFloorTon: "0.75",
    version: 1,
  });

  const decoded = parseDeadMansSwitchDataCellBase64(initPackage.dataCellBase64);

  assert.equal(decoded.owner, initPackage.config.owner);
  assert.equal(decoded.livenessIntervalSeconds, 15_552_000);
  assert.equal(decoded.lastLivenessAt, 0);
  assert.equal(decoded.livenessCodeHashHex, initPackage.config.livenessCodeHashHex);
  assert.equal(decoded.beneficiaryCount, 2);
  assert.equal(decoded.payoutIndex, 0);
  assert.equal(decoded.payoutPoolSnapshotNano, "0");
  assert.equal(decoded.expired, false);
  assert.equal(decoded.completed, false);
  assert.equal(decoded.minimumReserveFloorNano, "750000000");
  assert.equal(decoded.version, 1);
  assert.deepEqual(decoded.beneficiaries, initPackage.config.beneficiaries);
  assert.equal(initPackage.dataCellRefs, 1);
});

test("preserves beneficiary order by dictionary index during decode", () => {
  const initPackage = createDeadMansSwitchInitPackage({
    ownerAddress: "0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    livenessCode: "ping every quarter",
    livenessDurationMonths: 3,
    beneficiaries: [
      {
        address: "0:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        sharePercentage: "25",
      },
      {
        address: "0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sharePercentage: "75",
      },
    ],
  });

  const decoded = parseDeadMansSwitchDataCellBase64(initPackage.dataCellBase64);

  assert.deepEqual(
    decoded.beneficiaries.map((entry) => ({ index: entry.index, address: entry.address })),
    [
      {
        index: 0,
        address: "0:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      },
      {
        index: 1,
        address: "0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ],
  );
});

test("owner ping payload hashes the same string representation the init package stores", () => {
  const phrase = "same phrase";
  const initPackage = createDeadMansSwitchInitPackage({
    ownerAddress: "0:1111111111111111111111111111111111111111111111111111111111111111",
    livenessCode: phrase,
    livenessDurationMonths: 12,
    beneficiaries: [
      {
        address: "0:2222222222222222222222222222222222222222222222222222222222222222",
        sharePercentage: "100",
      },
    ],
  });

  const expectedHash = beginCell().storeStringTail(phrase).endCell().hash().toString("hex");

  assert.equal(initPackage.config.livenessCodeHashHex, `0x${expectedHash}`);
});

test("rejects invalid TON addresses before building the data cell", () => {
  assert.throws(
    () =>
      createDeadMansSwitchInitPackage({
        ownerAddress: "not-a-ton-address",
        livenessCode: "keepalive",
        livenessDurationMonths: 6,
        beneficiaries: [
          {
            address: "0:2222222222222222222222222222222222222222222222222222222222222222",
            sharePercentage: "100",
          },
        ],
      }),
    /Invalid TON address/,
  );
});

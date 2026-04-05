// TON Dead Man's Switch
// Shared Tolk contract template for user-specific instances.
// Phase 1 now includes concrete storage parsing and persistence helpers,
// while leaving production message logic for later milestones.

const ERR_UNKNOWN_OPCODE = 100;
const ERR_BENEFICIARY_COUNT_MISMATCH = 101;
const ERR_NONZERO_USDT_STUB = 102;
const ERR_NONZERO_XAUT0_STUB = 103;
const ERR_PAYOUT_INDEX_OUT_OF_RANGE = 104;
const ERR_NOT_OWNER = 105;
const ERR_INVALID_LIVENESS_CODE = 106;
const ERR_ALREADY_EXPIRED = 107;
const ERR_COMPLETED = 108;
const ERR_NOT_BENEFICIARY = 109;
const ERR_EXPIRY_TOO_EARLY = 110;
const ERR_NOT_EXPIRED = 111;
const ERR_CANNOT_CANCEL_AFTER_EXPIRY = 112;
const ERR_PAYOUT_ALREADY_STARTED = 113;
const ERR_INVALID_SHARE_TOTAL = 114;
const PAYOUT_FEE_BUFFER = ton("0.05");
const EXECUTED_PROOF_RESERVE = ton("0.05");
const FULL_SHARE_BASIS_POINTS = 10000;

// Persistent state placeholders.
// Keep this contract shared across all deployments; the UI should only vary init data.
struct BeneficiaryEntry {
    wallet: address;
    share_basis_points: uint16;
    usdt_amount_stub: coins;
    xaut0_amount_stub: coins;
}

struct VaultState {
    owner: address;
    liveness_interval_seconds: uint32;
    last_liveness_at: uint64;
    liveness_code_hash: uint256;
    beneficiary_count: uint16;
    beneficiaries: map<uint16, cell>;
    payout_index: uint16;
    payout_pool_snapshot: coins;
    expired: bool;
    completed: bool;
    minimum_reserve_floor: coins;
    version: uint16;
}

// Opcode placeholders.
const OP_INIT = 0x1000;
const OP_COMMENT = 0x00000000;
const OP_OWNER_PING = 0x1001;
const OP_TRIGGER_EXPIRY = 0x1002;
const OP_RESUME_PAYOUT = 0x1003;
const OP_TOP_UP = 0x1004;
const OP_GET_STATE = 0x1005;
const OP_CANCEL = 0x1006;
const COMMENT_TRIGGER_TEXT_HASH = 0x847ff4f326db43a2c0c6af44df799285d4072a140cf0a6830374dcd65b6bde12;

// TODO Milestone 2:
// - parse init config from the shared data-cell layout below
// - persist TON-only beneficiary percentage splits
// - reserve USDT/XAUT0 fields for later phases without activating them
//
// Shared data cell layout produced by shared/deadMansSwitchInit.ts:
// root cell:
//   owner: MsgAddress
//   liveness_interval_seconds: uint32
//   last_liveness_at: uint64
//   liveness_code_hash: uint256
//   beneficiary_count: uint16
//   beneficiaries_dict: dict<uint16, cell>
//   payout_index: uint16
//   payout_pool_snapshot: coins
//   expired: bit
//   completed: bit
//   minimum_reserve_floor: coins
//   version: uint16
//
// beneficiary entry cell:
//   wallet: MsgAddress
//   share_basis_points: uint16
//   usdt_amount_stub: coins
//   xaut0_amount_stub: coins
//
// Parser plan for Milestone 2:
//   1. load root fields in the exact order above
//   2. keep beneficiary_count and beneficiaries_dict aligned
//   3. decode each beneficiary entry cell lazily by payout_index when iterating payouts
//   4. preserve payout_index, payout_pool_snapshot, expired, and completed in persistent storage
//   5. keep token stub fields zeroed until later phases activate them

fun VaultState.load() {
    return VaultState.fromCell(contract.getData());
}

fun VaultState.save(self) {
    contract.setData(self.toCell());
}

fun loadBeneficiaryEntry(data: cell): BeneficiaryEntry {
    return BeneficiaryEntry.fromCell(data);
}

fun VaultState.countBeneficiaries(self): uint16 {
    var count: uint16 = 0;
    var cursor = self.beneficiaries.findFirst();
    while (cursor.isFound) {
        count += 1;
        cursor = self.beneficiaries.iterateNext(cursor);
    }
    return count;
}

fun VaultState.requirePhaseOneLayout(self) {
    val actualCount = self.countBeneficiaries();
    assert (actualCount == self.beneficiary_count) throw ERR_BENEFICIARY_COUNT_MISMATCH;

    var cursor = self.beneficiaries.findFirst();
    var totalShareBasisPoints: uint16 = 0;
    while (cursor.isFound) {
        val beneficiary = loadBeneficiaryEntry(cursor.loadValue());
        totalShareBasisPoints += beneficiary.share_basis_points;
        assert (beneficiary.usdt_amount_stub == 0) throw ERR_NONZERO_USDT_STUB;
        assert (beneficiary.xaut0_amount_stub == 0) throw ERR_NONZERO_XAUT0_STUB;
        cursor = self.beneficiaries.iterateNext(cursor);
    }
    assert (totalShareBasisPoints == FULL_SHARE_BASIS_POINTS) throw ERR_INVALID_SHARE_TOTAL;

    assert (self.beneficiary_count == 0 || self.payout_index <= self.beneficiary_count) throw ERR_PAYOUT_INDEX_OUT_OF_RANGE;
}

fun VaultState.loadValidated() {
    val state = VaultState.load();
    state.requirePhaseOneLayout();
    return state;
}

fun VaultState.nextLivenessDeadline(self): uint64 {
    return self.last_liveness_at + self.liveness_interval_seconds;
}

fun VaultState.isExpiredAt(self, nowTs: uint64): bool {
    return nowTs >= self.nextLivenessDeadline();
}

fun VaultState.isBeneficiary(self, who: address): bool {
    var cursor = self.beneficiaries.findFirst();
    while (cursor.isFound) {
        val beneficiary = loadBeneficiaryEntry(cursor.loadValue());
        if (beneficiary.wallet == who) {
            return true;
        }
        cursor = self.beneficiaries.iterateNext(cursor);
    }
    return false;
}

fun VaultState.touchOwnerPing(mutate self, nowTs: uint64) {
    self.last_liveness_at = nowTs;
    self.expired = false;
}

fun VaultState.firstBeneficiary(self): BeneficiaryEntry {
    return loadBeneficiaryEntry(self.beneficiaries.mustGet(0));
}

fun VaultState.payoutPoolTotal(self): coins {
    if (self.payout_pool_snapshot > 0) {
        return self.payout_pool_snapshot;
    }

    if (contract.getOriginalBalance() > EXECUTED_PROOF_RESERVE + PAYOUT_FEE_BUFFER) {
        return contract.getOriginalBalance() - EXECUTED_PROOF_RESERVE - PAYOUT_FEE_BUFFER;
    }

    return 0;
}

fun VaultState.beneficiaryPayoutAmount(self, index: uint16): coins {
    val payoutPool = self.payoutPoolTotal();
    val beneficiary = loadBeneficiaryEntry(self.beneficiaries.mustGet(index));

    if (index == 0) {
        var remainder = payoutPool;
        var cursorIndex: uint16 = 1;

        while (cursorIndex < self.beneficiary_count) {
            val laterBeneficiary = loadBeneficiaryEntry(self.beneficiaries.mustGet(cursorIndex));
            remainder -= payoutPool * laterBeneficiary.share_basis_points / FULL_SHARE_BASIS_POINTS;
            cursorIndex += 1;
        }

        return remainder;
    }

    return payoutPool * beneficiary.share_basis_points / FULL_SHARE_BASIS_POINTS;
}

fun payoutRemainingIfPossible(mutate state: VaultState) {
    if (state.payout_pool_snapshot == 0) {
        state.payout_pool_snapshot = state.payoutPoolTotal();
    }

    reserveToncoinsOnBalance(EXECUTED_PROOF_RESERVE, RESERVE_MODE_AT_MOST);

    var availableToDistribute: coins = 0;
    if (contract.getOriginalBalance() > EXECUTED_PROOF_RESERVE + PAYOUT_FEE_BUFFER) {
        availableToDistribute = contract.getOriginalBalance() - EXECUTED_PROOF_RESERVE - PAYOUT_FEE_BUFFER;
    }

    var shouldContinue = state.payout_index < state.beneficiary_count;
    while (shouldContinue) {
        val beneficiary = loadBeneficiaryEntry(state.beneficiaries.mustGet(state.payout_index));
        val payoutAmount = state.beneficiaryPayoutAmount(state.payout_index);

        if (payoutAmount > availableToDistribute) {
            shouldContinue = false;
        } else {
            createMessage({
                bounce: BounceMode.NoBounce,
                value: payoutAmount,
                dest: beneficiary.wallet,
            }).send(SEND_MODE_PAY_FEES_SEPARATELY);

            availableToDistribute -= payoutAmount;
            state.payout_index += 1;
            shouldContinue = state.payout_index < state.beneficiary_count;
        }
    }

    if (state.payout_index == state.beneficiary_count) {
        state.completed = true;
        val remainderBeneficiary = state.firstBeneficiary();
        state.save();
        createMessage({
            bounce: BounceMode.NoBounce,
            value: 0,
            dest: remainderBeneficiary.wallet,
        }).send(SEND_MODE_CARRY_ALL_BALANCE);
        return ();
    }

    state.save();
    return ();
}

fun onInternalMessage(in: InMessage) {
    var state = lazy VaultState.load();
    state.requirePhaseOneLayout();

    // Skeleton dispatcher only. Production validation and sends come later.
    if (in.body.isEmpty()) {
        // Initialize liveness clock on the first deployment message.
        if (state.last_liveness_at == 0) {
            state.touchOwnerPing(blockchain.now());
            state.save();
        }
        return ();
    }

    var body = in.body;
    val op = body.loadUint(32);

    if (op == OP_COMMENT) {
        val providedCommentHash = beginCell()
            .storeSlice(body)
            .endCell()
            .hash();

        if (in.senderAddress == state.owner) {
            assert (!state.completed) throw ERR_COMPLETED;
            assert (!state.isExpiredAt(blockchain.now())) throw ERR_ALREADY_EXPIRED;
            assert (providedCommentHash == state.liveness_code_hash) throw ERR_INVALID_LIVENESS_CODE;

            state.touchOwnerPing(blockchain.now());
            state.save();
            return ();
        }

        assert (!state.completed) throw ERR_COMPLETED;
        assert (state.isBeneficiary(in.senderAddress)) throw ERR_NOT_BENEFICIARY;
        assert (state.isExpiredAt(blockchain.now())) throw ERR_EXPIRY_TOO_EARLY;
        assert (providedCommentHash == COMMENT_TRIGGER_TEXT_HASH) throw ERR_UNKNOWN_OPCODE;

        state.expired = true;
        payoutRemainingIfPossible(mutate state);
        return ();
    }

    if (op == OP_OWNER_PING) {
        assert (in.senderAddress == state.owner) throw ERR_NOT_OWNER;
        assert (!state.completed) throw ERR_COMPLETED;
        assert (!state.isExpiredAt(blockchain.now())) throw ERR_ALREADY_EXPIRED;

        val providedCodeHash = beginCell()
            .storeSlice(body)
            .endCell()
            .hash();

        assert (providedCodeHash == state.liveness_code_hash) throw ERR_INVALID_LIVENESS_CODE;

        state.touchOwnerPing(blockchain.now());
        state.save();
        return ();
    }

    if (op == OP_TRIGGER_EXPIRY) {
        assert (!state.completed) throw ERR_COMPLETED;
        assert (state.isBeneficiary(in.senderAddress)) throw ERR_NOT_BENEFICIARY;
        assert (state.isExpiredAt(blockchain.now())) throw ERR_EXPIRY_TOO_EARLY;

        state.expired = true;
        payoutRemainingIfPossible(mutate state);
        return ();
    }

    if (op == OP_RESUME_PAYOUT) {
        assert (state.expired) throw ERR_NOT_EXPIRED;
        assert (!state.completed) throw ERR_COMPLETED;
        assert (state.isBeneficiary(in.senderAddress)) throw ERR_NOT_BENEFICIARY;
        assert (state.payout_index < state.beneficiary_count) throw ERR_PAYOUT_INDEX_OUT_OF_RANGE;

        payoutRemainingIfPossible(mutate state);
        return ();
    }

    if (op == OP_CANCEL) {
        assert (in.senderAddress == state.owner) throw ERR_NOT_OWNER;
        assert (!state.completed) throw ERR_COMPLETED;
        assert (!state.expired) throw ERR_CANNOT_CANCEL_AFTER_EXPIRY;
        assert (!state.isExpiredAt(blockchain.now())) throw ERR_CANNOT_CANCEL_AFTER_EXPIRY;
        assert (state.payout_index == 0) throw ERR_PAYOUT_ALREADY_STARTED;

        createMessage({
            bounce: BounceMode.NoBounce,
            value: 0,
            dest: state.owner,
        }).send(SEND_MODE_CARRY_ALL_BALANCE | SEND_MODE_DESTROY);
        return ();
    }

    if (op == OP_GET_STATE) {
        // Getter/query placeholder for explicit message-based reads when needed.
        return ();
    }

    throw ERR_UNKNOWN_OPCODE;
}

get fun get_owner(): address {
    val state = lazy VaultState.load();
    state.requirePhaseOneLayout();
    return state.owner;
}

get fun get_version(): uint16 {
    val state = lazy VaultState.load();
    state.requirePhaseOneLayout();
    return state.version;
}

get fun get_liveness_status(): (uint64, uint32, bool, bool) {
    val state = lazy VaultState.load();
    state.requirePhaseOneLayout();
    return (
        state.last_liveness_at,
        state.liveness_interval_seconds,
        state.expired,
        state.completed
    );
}

get fun get_payout_progress(): (uint16, uint16, coins) {
    val state = lazy VaultState.load();
    state.requirePhaseOneLayout();
    return (
        state.payout_index,
        state.beneficiary_count,
        state.minimum_reserve_floor
    );
}

get fun get_beneficiary(index: uint16): BeneficiaryEntry {
    val state = lazy VaultState.load();
    state.requirePhaseOneLayout();
    return loadBeneficiaryEntry(state.beneficiaries.mustGet(index));
}

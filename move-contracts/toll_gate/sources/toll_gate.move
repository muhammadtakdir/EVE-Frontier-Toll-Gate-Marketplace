/// Toll Gate extension — charge a SUI fee for gate passage.
///
/// Gate owners configure a toll (fee in MIST). Travelers pay the toll
/// to receive a single-use `JumpPermit`. Collected fees accumulate in a
/// shared `TollVault` that the admin can withdraw from.
module toll_gate::toll_gate;

use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::Clock;
use sui::balance::{Self, Balance};
use toll_gate::config::{Self, AdminCap, TollAuth, ExtensionConfig};
use world::{character::Character, gate::{Self, Gate}};

// === Errors ===
#[error(code = 0)]
const ENoTollConfig: vector<u8> = b"Missing TollConfig on ExtensionConfig";
#[error(code = 1)]
const EInsufficientPayment: vector<u8> = b"Insufficient toll payment";
#[error(code = 2)]
const EExpiryOverflow: vector<u8> = b"Expiry timestamp overflow";
#[error(code = 3)]
const ETollDisabled: vector<u8> = b"Toll is currently disabled";

/// Stored as a dynamic field under `ExtensionConfig`.
public struct TollConfig has drop, store {
    fee_mist: u64,
    expiry_duration_ms: u64,
    enabled: bool,
}

/// Dynamic-field key for `TollConfig`.
public struct TollConfigKey has copy, drop, store {}

/// Shared vault that collects toll fees.
public struct TollVault has key {
    id: UID,
    balance: Balance<SUI>,
    total_collected: u64,
    total_jumps: u64,
}

/// Emitted when a toll is paid and permit issued.
public struct TollPaidEvent has copy, drop {
    character_id: address,
    source_gate_id: address,
    destination_gate_id: address,
    fee_paid: u64,
}

/// Create the vault at package publish.
fun init(ctx: &mut TxContext) {
    let vault = TollVault {
        id: object::new(ctx),
        balance: balance::zero<SUI>(),
        total_collected: 0,
        total_jumps: 0,
    };
    transfer::share_object(vault);
}

// === Public entry: pay toll and get a JumpPermit ===

/// Traveler pays the toll fee and receives a `JumpPermit`.
public fun pay_toll_and_jump(
    extension_config: &ExtensionConfig,
    vault: &mut TollVault,
    source_gate: &Gate,
    destination_gate: &Gate,
    character: &Character,
    payment: &mut Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(extension_config.has_rule<TollConfigKey>(TollConfigKey {}), ENoTollConfig);
    let toll_cfg = extension_config.borrow_rule<TollConfigKey, TollConfig>(TollConfigKey {});

    assert!(toll_cfg.enabled, ETollDisabled);
    assert!(coin::value(payment) >= toll_cfg.fee_mist, EInsufficientPayment);

    // Take fee from the payment coin
    let fee_balance = coin::balance_mut(payment).split(toll_cfg.fee_mist);
    vault.balance.join(fee_balance);
    vault.total_collected = vault.total_collected + toll_cfg.fee_mist;
    vault.total_jumps = vault.total_jumps + 1;

    // Issue jump permit
    let expiry_ms = toll_cfg.expiry_duration_ms;
    let ts = clock.timestamp_ms();
    assert!(ts <= (0xFFFFFFFFFFFFFFFFu64 - expiry_ms), EExpiryOverflow);
    let expires_at = ts + expiry_ms;

    gate::issue_jump_permit<TollAuth>(
        source_gate,
        destination_gate,
        character,
        config::toll_auth(),
        expires_at,
        ctx,
    );

    sui::event::emit(TollPaidEvent {
        character_id: object::id_address(character),
        source_gate_id: object::id_address(source_gate),
        destination_gate_id: object::id_address(destination_gate),
        fee_paid: toll_cfg.fee_mist,
    });
}

// === Admin functions ===

/// Set or update the toll configuration.
public fun set_toll_config(
    extension_config: &mut ExtensionConfig,
    admin_cap: &AdminCap,
    fee_mist: u64,
    expiry_duration_ms: u64,
    enabled: bool,
) {
    extension_config.set_rule<TollConfigKey, TollConfig>(
        admin_cap,
        TollConfigKey {},
        TollConfig { fee_mist, expiry_duration_ms, enabled },
    );
}

/// Enable or disable toll collection without changing the fee.
public fun set_toll_enabled(
    extension_config: &mut ExtensionConfig,
    admin_cap: &AdminCap,
    enabled: bool,
) {
    let cfg = extension_config.borrow_rule_mut<TollConfigKey, TollConfig>(
        admin_cap,
        TollConfigKey {},
    );
    cfg.enabled = enabled;
}

/// Withdraw collected fees from the vault.
public fun withdraw_fees(
    vault: &mut TollVault,
    _admin_cap: &AdminCap,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI> {
    let withdrawn = vault.balance.split(amount);
    coin::from_balance(withdrawn, ctx)
}

/// Withdraw all collected fees.
public fun withdraw_all_fees(
    vault: &mut TollVault,
    _admin_cap: &AdminCap,
    ctx: &mut TxContext,
): Coin<SUI> {
    let amount = vault.balance.value();
    let withdrawn = vault.balance.split(amount);
    coin::from_balance(withdrawn, ctx)
}

// === View functions ===

public fun toll_fee(extension_config: &ExtensionConfig): u64 {
    assert!(extension_config.has_rule<TollConfigKey>(TollConfigKey {}), ENoTollConfig);
    extension_config.borrow_rule<TollConfigKey, TollConfig>(TollConfigKey {}).fee_mist
}

public fun toll_enabled(extension_config: &ExtensionConfig): bool {
    assert!(extension_config.has_rule<TollConfigKey>(TollConfigKey {}), ENoTollConfig);
    extension_config.borrow_rule<TollConfigKey, TollConfig>(TollConfigKey {}).enabled
}

public fun toll_expiry_duration_ms(extension_config: &ExtensionConfig): u64 {
    assert!(extension_config.has_rule<TollConfigKey>(TollConfigKey {}), ENoTollConfig);
    extension_config.borrow_rule<TollConfigKey, TollConfig>(TollConfigKey {}).expiry_duration_ms
}

public fun vault_balance(vault: &TollVault): u64 {
    vault.balance.value()
}

public fun vault_total_collected(vault: &TollVault): u64 {
    vault.total_collected
}

public fun vault_total_jumps(vault: &TollVault): u64 {
    vault.total_jumps
}

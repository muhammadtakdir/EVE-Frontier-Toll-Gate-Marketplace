/// Mini Marketplace — peer-to-peer item trading via Storage Units.
///
/// Sellers list items from their inventory with a SUI price.
/// Buyers pay to purchase; proceeds go to the seller.
/// Items are held in escrow (the seller's storage unit) until sold or cancelled.
module toll_gate::marketplace;

use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::Clock;
use sui::table::{Self, Table};
use toll_gate::config::{AdminCap, ExtensionConfig};

// === Errors ===
#[error(code = 0)]
const EListingNotFound: vector<u8> = b"Listing not found";
#[error(code = 1)]
const EInsufficientPayment: vector<u8> = b"Insufficient payment for listing";
#[error(code = 2)]
const ENotSeller: vector<u8> = b"Only the seller can cancel";
#[error(code = 3)]
const EListingExpired: vector<u8> = b"Listing has expired";
#[error(code = 4)]
const EMarketplacePaused: vector<u8> = b"Marketplace is paused";
#[error(code = 5)]
const ENoMarketplaceConfig: vector<u8> = b"Missing MarketplaceConfig";

/// A single listing: an item for sale.
public struct Listing has store, drop {
    seller: address,
    item_type_id: u64,
    item_id: u64,
    price_mist: u64,
    created_at_ms: u64,
    expires_at_ms: u64,
}

/// Shared marketplace state holding all active listings.
public struct Marketplace has key {
    id: UID,
    /// listing_id → Listing
    listings: Table<u64, Listing>,
    next_listing_id: u64,
    total_sales: u64,
    total_volume_mist: u64,
    fee_bps: u64,
}

/// Config stored as dynamic field on ExtensionConfig.
public struct MarketplaceConfig has drop, store {
    enabled: bool,
    default_expiry_ms: u64,
    fee_bps: u64,
}

public struct MarketplaceConfigKey has copy, drop, store {}

/// Emitted when a new listing is created.
public struct ListingCreatedEvent has copy, drop {
    listing_id: u64,
    seller: address,
    item_type_id: u64,
    item_id: u64,
    price_mist: u64,
    expires_at_ms: u64,
}

/// Emitted on purchase.
public struct ItemSoldEvent has copy, drop {
    listing_id: u64,
    seller: address,
    buyer: address,
    item_type_id: u64,
    item_id: u64,
    price_mist: u64,
}

/// Emitted on cancel.
public struct ListingCancelledEvent has copy, drop {
    listing_id: u64,
    seller: address,
}

fun init(ctx: &mut TxContext) {
    let marketplace = Marketplace {
        id: object::new(ctx),
        listings: table::new(ctx),
        next_listing_id: 1,
        total_sales: 0,
        total_volume_mist: 0,
        fee_bps: 0,
    };
    transfer::share_object(marketplace);
}

// === Seller: create a listing ===

/// Create a listing. The seller specifies item info and price.
/// Items remain in the seller's storage unit (off-chain) until purchased.
public fun create_listing(
    extension_config: &ExtensionConfig,
    marketplace: &mut Marketplace,
    item_type_id: u64,
    item_id: u64,
    price_mist: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): u64 {
    assert!(extension_config.has_rule<MarketplaceConfigKey>(MarketplaceConfigKey {}), ENoMarketplaceConfig);
    let mkt_cfg = extension_config.borrow_rule<MarketplaceConfigKey, MarketplaceConfig>(MarketplaceConfigKey {});
    assert!(mkt_cfg.enabled, EMarketplacePaused);

    let now = clock.timestamp_ms();
    let listing_id = marketplace.next_listing_id;
    marketplace.next_listing_id = listing_id + 1;

    let listing = Listing {
        seller: ctx.sender(),
        item_type_id,
        item_id,
        price_mist,
        created_at_ms: now,
        expires_at_ms: now + mkt_cfg.default_expiry_ms,
    };

    marketplace.listings.add(listing_id, listing);

    sui::event::emit(ListingCreatedEvent {
        listing_id,
        seller: ctx.sender(),
        item_type_id,
        item_id,
        price_mist,
        expires_at_ms: now + mkt_cfg.default_expiry_ms,
    });

    listing_id
}

// === Buyer: purchase a listing ===

/// Buy a listed item. Payment goes to the seller.
/// The actual item transfer happens off-chain via the storage unit system.
public fun buy_listing(
    marketplace: &mut Marketplace,
    listing_id: u64,
    payment: &mut Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(marketplace.listings.contains(listing_id), EListingNotFound);
    let listing = marketplace.listings.remove(listing_id);

    let now = clock.timestamp_ms();
    assert!(now <= listing.expires_at_ms, EListingExpired);
    assert!(coin::value(payment) >= listing.price_mist, EInsufficientPayment);

    // Transfer payment to seller
    let payment_coin = coin::split(payment, listing.price_mist, ctx);
    transfer::public_transfer(payment_coin, listing.seller);

    marketplace.total_sales = marketplace.total_sales + 1;
    marketplace.total_volume_mist = marketplace.total_volume_mist + listing.price_mist;

    sui::event::emit(ItemSoldEvent {
        listing_id,
        seller: listing.seller,
        buyer: ctx.sender(),
        item_type_id: listing.item_type_id,
        item_id: listing.item_id,
        price_mist: listing.price_mist,
    });
}

// === Seller: cancel a listing ===

/// Cancel a listing. Only the original seller can cancel.
public fun cancel_listing(
    marketplace: &mut Marketplace,
    listing_id: u64,
    ctx: &mut TxContext,
) {
    assert!(marketplace.listings.contains(listing_id), EListingNotFound);
    let listing = marketplace.listings.remove(listing_id);
    assert!(listing.seller == ctx.sender(), ENotSeller);

    sui::event::emit(ListingCancelledEvent {
        listing_id,
        seller: listing.seller,
    });
}

// === Admin functions ===

/// Set marketplace configuration.
public fun set_marketplace_config(
    extension_config: &mut ExtensionConfig,
    admin_cap: &AdminCap,
    enabled: bool,
    default_expiry_ms: u64,
    fee_bps: u64,
) {
    extension_config.set_rule<MarketplaceConfigKey, MarketplaceConfig>(
        admin_cap,
        MarketplaceConfigKey {},
        MarketplaceConfig { enabled, default_expiry_ms, fee_bps },
    );
}

/// Pause or unpause the marketplace.
public fun set_marketplace_enabled(
    extension_config: &mut ExtensionConfig,
    admin_cap: &AdminCap,
    enabled: bool,
) {
    let cfg = extension_config.borrow_rule_mut<MarketplaceConfigKey, MarketplaceConfig>(
        admin_cap,
        MarketplaceConfigKey {},
    );
    cfg.enabled = enabled;
}

// === View functions ===

public fun listing_seller(marketplace: &Marketplace, listing_id: u64): address {
    assert!(marketplace.listings.contains(listing_id), EListingNotFound);
    marketplace.listings.borrow(listing_id).seller
}

public fun listing_price(marketplace: &Marketplace, listing_id: u64): u64 {
    assert!(marketplace.listings.contains(listing_id), EListingNotFound);
    marketplace.listings.borrow(listing_id).price_mist
}

public fun listing_item_type_id(marketplace: &Marketplace, listing_id: u64): u64 {
    assert!(marketplace.listings.contains(listing_id), EListingNotFound);
    marketplace.listings.borrow(listing_id).item_type_id
}

public fun listing_item_id(marketplace: &Marketplace, listing_id: u64): u64 {
    assert!(marketplace.listings.contains(listing_id), EListingNotFound);
    marketplace.listings.borrow(listing_id).item_id
}

public fun listing_expires_at(marketplace: &Marketplace, listing_id: u64): u64 {
    assert!(marketplace.listings.contains(listing_id), EListingNotFound);
    marketplace.listings.borrow(listing_id).expires_at_ms
}

public fun marketplace_total_sales(marketplace: &Marketplace): u64 {
    marketplace.total_sales
}

public fun marketplace_total_volume(marketplace: &Marketplace): u64 {
    marketplace.total_volume_mist
}

public fun marketplace_next_listing_id(marketplace: &Marketplace): u64 {
    marketplace.next_listing_id
}

public fun marketplace_enabled(extension_config: &ExtensionConfig): bool {
    assert!(extension_config.has_rule<MarketplaceConfigKey>(MarketplaceConfigKey {}), ENoMarketplaceConfig);
    extension_config.borrow_rule<MarketplaceConfigKey, MarketplaceConfig>(MarketplaceConfigKey {}).enabled
}

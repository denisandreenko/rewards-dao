use anchor_lang::prelude::*;

#[event]
pub struct TransferEvent {
    pub source: Pubkey,
    pub destination: Pubkey,
    pub fee_amount: u64,
    pub amount: u64,
}

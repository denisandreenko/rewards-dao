use anchor_lang::prelude::*;

pub mod constants;
pub mod instructions;
pub mod utils;
pub mod state;
pub mod error;

pub use error::*;
pub use constants::*;
pub use state::*;
pub use instructions::*;
pub use utils::*;

declare_id!("6NYSjPnBM6zH4VSxcMqUgGohHt9ggQpinetq1zi89dvw");

#[program]
pub mod rewards {
    use anchor_spl::token_interface;
    use super::*;

    pub fn initialize_token(ctx: Context<InitToken>, args: InitTokenAccountArgs) -> Result<()> {
        _initialize_token(ctx, args)
    }

    pub fn initialize_fees(ctx: Context<InitializeFees>, args: InitFeesArgs) -> Result<()> {
        _initialize_fees(ctx, args)
    }

    pub fn update_fees(ctx: Context<UpdateFees>, args: UpdateFeesArgs) -> Result<()> {
        _update_fees(ctx, args)
    }

    pub fn intialize_freeze(ctx: Context<InitFreeze>) -> Result<()> {
        _initialize_freeze(ctx)
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        _mint_tokens_with_fees(&ctx, amount)
    }

    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        _burn_tokens_with_fees(&ctx, amount)
    }

    pub fn freeze(ctx: Context<Freeze>, target: FreezeTarget) -> Result<()> {
        _toggle_freeze(ctx, target, true)
    }
    pub fn unfreeze(ctx: Context<Freeze>, target: FreezeTarget) -> Result<()> {
        _toggle_freeze(ctx, target, false)
    }
}

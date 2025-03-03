use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::*;
use crate::events::*;

use anchor_spl::token_interface::Mint as Mint2022;

pub fn _initialize_freeze(ctx: Context<InitFreeze>)  -> Result<()> {

    // Set Admin as Freeze Authority 
    let freeze_state = &mut ctx.accounts.freeze_state;
    if freeze_state.authority == Pubkey::default() {
        freeze_state.authority = ctx.accounts.signer.key();
    }

    freeze_state.is_frozen = false;
    freeze_state.freeze_mint = false;
    freeze_state.freeze_burn = false;

    msg!("FreezeState initialized: {:?}", freeze_state);
    
    Ok(())
}

pub fn _toggle_freeze(ctx: Context<Freeze>, target: FreezeTarget, freeze: bool) -> Result<()> {
    let freeze_state: &mut Account<'_, FreezeState> = &mut ctx.accounts.freeze_state;

    if freeze_state.authority != ctx.accounts.signer.key() {
        msg!("Only the authority can modify freeze state!");
        return Err(RewardTokenError::Unauthorized.into())
    }

   match target {
        FreezeTarget::All => {
            freeze_state.is_frozen = freeze;  // Global freeze/unfreeze
            freeze_state.freeze_mint = freeze; 
            freeze_state.freeze_burn = freeze;
            msg!(
                "All operations are now {}.",
                if freeze { "frozen" } else { "unfrozen" }
            );
        }
        FreezeTarget::Mint => {
            freeze_state.freeze_mint = freeze; 
            msg!(
                "Minting is now {}.",
                if freeze { "frozen" } else { "unfrozen" }
            );
        }
        FreezeTarget::Burn => {
            freeze_state.freeze_burn = freeze; 
            msg!(
                "Burning is now {}.",
                if freeze { "frozen" } else { "unfrozen" }
            );
        }
    }

    emit!(FreezeStateChangedEvent {
        authority: ctx.accounts.signer.key(),
        is_frozen: freeze,
        target,
    });

    Ok(())
}

pub fn check_freeze_state(freeze_state: &FreezeState, operation: &str) -> Result<()> {

    if freeze_state.is_frozen {
        return Err(RewardTokenError::GlobalFrozen.into());
    }

    match operation {
        "mint" if freeze_state.freeze_mint => Err(RewardTokenError::MintFrozen.into()),
        "burn" if freeze_state.freeze_burn => Err(RewardTokenError::BurnFrozen.into()),
        _ => Ok(()), // If no freeze, proceed normally
    }
}

#[derive(Accounts)]
pub struct InitFreeze<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    pub mint: Box<InterfaceAccount<'info, Mint2022>>,
    #[account(
        init,
        payer = signer,
        seeds = [FREEZE_SEED],
        bump,
        space = DISCRIMINATOR + FreezeState::INIT_SPACE, // Allocate correct space
    )]
    pub freeze_state: Account<'info, FreezeState>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct Freeze<'info> {
    #[account(
        mut,
        seeds = [FREEZE_SEED], 
        bump,
    )]
    pub freeze_state: Account<'info, FreezeState>,  
    pub mint: Box<InterfaceAccount<'info, Mint2022>>,
    #[account(mut)]
    pub signer: Signer<'info>,
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum FreezeTarget {
    All,        
    Mint,       
    Burn,       
}

#[account]
#[derive(InitSpace, Debug)]
pub struct FreezeState {
    pub is_frozen: bool,          
    pub freeze_mint: bool,           
    pub freeze_burn: bool,           
    pub authority: Pubkey,
}
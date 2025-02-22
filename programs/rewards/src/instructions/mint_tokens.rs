use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint as Mint2022, TokenInterface, TokenAccount, MintTo};

pub fn _mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    let mut cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.to_ata.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

    token_interface::mint_to(cpi_context, amount)?;
    Ok(())
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [TOKEN_2022_SEED],
        bump,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint2022>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program,
    )]
    pub to_ata: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
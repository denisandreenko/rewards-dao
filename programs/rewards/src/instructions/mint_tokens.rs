use anchor_lang::prelude::*;
use crate::{
    TOKEN_2022_SEED,
    USDC_SEED,
    USDC_MINT_ADDRESS_DEVNET,
};

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{
        self,
        Mint,
        Token,
        TokenAccount
    },
    token_interface::{
        self,
        Mint as Mint2022,
        MintTo,
        TokenAccount as TokenAccount2022,
        TokenInterface
    },
};

pub fn _charge_usdc(ctx: &Context<MintTokens>, amount: u64) -> Result<()> {
    // Transfer USDC to the specified account  
    let cpi_accounts = token_interface::TransferChecked {
        mint: ctx.accounts.usdc_mint.to_account_info(),
        from: ctx.accounts.usdc_from_ata.to_account_info(),  
        to: ctx.accounts.usdc_keeper.to_account_info(),  
        authority: ctx.accounts.payer.to_account_info(),  
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

    token_interface::transfer_checked(cpi_context, amount, 6)?;
    Ok(())
}

pub fn _mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    let mut cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.to_ata.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program2022.to_account_info();
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
        address = USDC_MINT_ADDRESS_DEVNET,
        mint::token_program = token_program,
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [USDC_SEED],
        bump,
        token::mint = usdc_mint,
        token::authority = payer,
        token::token_program = token_program,
    )]
    pub usdc_keeper: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program2022,
    )]
    pub to_ata: InterfaceAccount<'info, TokenAccount2022>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program,
    )]
    pub usdc_from_ata: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_program2022: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
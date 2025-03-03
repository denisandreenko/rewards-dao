use anchor_lang::prelude::*;
use crate::constants::*;
use crate::utils::*;

use anchor_spl::{
    token::{
        Mint,
        Token,
        TokenAccount,
    },
    token_interface::{
        self,
        Mint as Mint2022,
        TokenInterface,
        TokenMetadataInitialize
    },
};

pub fn _initialize_token(ctx: Context<InitToken>, args: InitTokenAccountArgs) -> Result<()> {
    let cpi_accounts = TokenMetadataInitialize {
        token_program_id: ctx.accounts.token_program2022.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        metadata: ctx.accounts.mint.to_account_info(), // metadata account is the mint, since data is stored in mint
        mint_authority: ctx.accounts.signer.to_account_info(),
        update_authority: ctx.accounts.signer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program2022.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

    token_interface::token_metadata_initialize(cpi_context, args.name, args.symbol, args.uri)?;

    ctx.accounts.mint.reload()?;
    // transfer minimum rent to mint account
    update_account_lamports_to_minimum_balance(
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.signer.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    )?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(args: InitTokenAccountArgs)]
pub struct InitToken<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        seeds = [TOKEN_2022_SEED],
        bump,
        mint::decimals = args.decimals,
        mint::authority = signer,
        mint::token_program = token_program2022,
        extensions::metadata_pointer::authority = signer,
        extensions::metadata_pointer::metadata_address = mint,
        extensions::transfer_hook::authority = signer,
        extensions::transfer_hook::program_id = args.transfer_hook_program_id,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint2022>>,

    #[account(
        address = USDC_MINT_ADDRESS,
        mint::token_program = token_program,
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        seeds = [USDC_SEED],
        bump,
        payer = signer,
        token::mint = usdc_mint,
        token::authority = signer,
        token::token_program = token_program,
    )]
    pub usdc_keeper: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_program2022: Interface<'info, TokenInterface>,
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct InitTokenAccountArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub transfer_hook_program_id: Pubkey,
}
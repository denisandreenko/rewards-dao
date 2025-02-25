use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{
        self,
        Mint,
        Token,
        TokenAccount,
    },
    token_interface::{
        self,
        Mint as Mint2022,
        TokenAccount as TokenAccount2022,
        TokenInterface,
        TokenMetadataInitialize
    },
};

pub mod utils;
pub use utils::*;
pub mod instructions;
pub use instructions::*;
pub mod constants;
pub use constants::*;

declare_id!("6NYSjPnBM6zH4VSxcMqUgGohHt9ggQpinetq1zi89dvw");

#[program]
pub mod rewards {
    use anchor_spl::token_interface;
    use super::*;

    pub fn initialize_token(_ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        let cpi_accounts = TokenMetadataInitialize {
            token_program_id: _ctx.accounts.token_program2022.to_account_info(),
            mint: _ctx.accounts.mint.to_account_info(),
            metadata: _ctx.accounts.mint.to_account_info(), 
            mint_authority: _ctx.accounts.payer.to_account_info(),
            update_authority: _ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = _ctx.accounts.token_program2022.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

        token_interface::token_metadata_initialize(
            cpi_context,
            metadata.name,
            metadata.symbol,
            metadata.uri,
        )?;

        _ctx.accounts.mint.reload()?;
        // transfer minimum rent to mint account
        update_account_lamports_to_minimum_balance(
            _ctx.accounts.mint.to_account_info(),
            _ctx.accounts.payer.to_account_info(),
            _ctx.accounts.system_program.to_account_info(),
        )?;

        Ok(())
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        // USDC - 6 decimals | SP - 6 decimals
        let usdc_amount = amount / 10; // 1 USDC for 10 tokens

        _charge_usdc(&ctx, usdc_amount)?;
        
        _mint_tokens(ctx, amount)
    }

    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        // USDC - 6 decimals | SP - 6 decimals
        let usdc_amount = amount / 10; // 1 USDC for 10 tokens

        // Transfer USDC from the storage account to the user 
        _release_usdc(&ctx, usdc_amount)?;

        _burn_tokens(ctx, amount)
    }

    pub fn initialize_fees(ctx: Context<InitializeFees>, args: InitFeesArgs) -> Result<()> {
        _initialize_fees(ctx, args)
    }

    pub fn update_fees(ctx: Context<UpdateFees>, args: UpdateFeesArgs) -> Result<()> {
        _update_fees(ctx, args)
    }
}

#[derive(Accounts)]
#[instruction(params: InitTokenParams)]
pub struct InitToken<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        seeds = [TOKEN_2022_SEED],
        bump,
        mint::decimals = params.decimals,
        mint::authority = payer,
        mint::token_program = token_program2022,
        extensions::metadata_pointer::authority = payer,
        extensions::metadata_pointer::metadata_address = mint,
        extensions::transfer_hook::authority = payer,
        extensions::transfer_hook::program_id = transfer_hook::ID,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint2022>>,

    #[account(
        address = USDC_MINT_ADDRESS_DEVNET,
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

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}

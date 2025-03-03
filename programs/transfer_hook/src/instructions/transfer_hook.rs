use anchor_lang::prelude::*;
use std::cell::RefMut;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::spl_token_2022::{
        extension::{
            transfer_hook::TransferHookAccount,
            BaseStateWithExtensionsMut,
            PodStateWithExtensionsMut,
        },
        pod::PodAccount,
    },
    token_interface::{
        Mint as Mint2022,
        TokenAccount as TokenAccount2022,
        TokenInterface,
    },
};
use spl_tlv_account_resolution::{account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::constants::*;
use crate::error::*;
use crate::events::*;


    #[interface(spl_transfer_hook_interface::initialize_extra_account_meta_list)]
    pub fn _initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {

        let extra_account_metas = InitializeExtraAccountMetaList::extra_account_metas()?;

        // initialize ExtraAccountMetaList account with extra accounts
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &extra_account_metas,
        )?;


        Ok(())
    }

    #[interface(spl_transfer_hook_interface::execute)]
    pub fn _transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {

        // Fail this instruction if it is not called from within a transfer hook
        check_is_transferring(&ctx)?;
        msg!("Transfer Hook invoked. Destination: {:?}", ctx.accounts.destination_token.key());

        emit!(TransferEvent {
            source: ctx.accounts.source_token.key(),
            destination: ctx.accounts.destination_token.key(),
            fee_amount: 0, //TODO: add value when task complete
            amount,
        });
    
        Ok(())
    }


    fn check_is_transferring(ctx: &Context<TransferHook>) -> Result<()> {
        let source_token_info = ctx.accounts.source_token.to_account_info();
        let mut account_data_ref: RefMut<&mut [u8]> = source_token_info.try_borrow_mut_data()?;
        let mut account = PodStateWithExtensionsMut::<PodAccount>::unpack(*account_data_ref)?;
        let account_extension = account.get_extension_mut::<TransferHookAccount>()?;
    
        if !bool::from(account_extension.transferring) {
            msg!("Transfer operation not allowed: the `transferring` flag is false.");
            return Err(TokenError::IsNotCurrentlyTransferring.into());
        }
    
        Ok(())
    }

    impl<'info> InitializeExtraAccountMetaList<'info> {
        pub fn extra_account_metas() -> Result<Vec<ExtraAccountMeta>> {
            Ok(vec![]) //TODO: Add any extra accounts
        }
    }
    

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    signer: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint2022>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        init_if_needed,
        seeds = [META_LIST_ACCOUNT_SEED, mint.key().as_ref()], 
        bump,
        space = ExtraAccountMetaList::size_of(
            InitializeExtraAccountMetaList::extra_account_metas()?.len()
        )?,
        payer = signer,
    )]
    pub extra_account_meta_list: AccountInfo<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

}

// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the token2022 program
#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        token::mint = mint, 
        token::authority = owner,
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount2022>,
    pub mint: InterfaceAccount<'info, Mint2022>,
    #[account(
        token::mint = mint,
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount2022>,
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList Account,
    #[account(
        seeds = [META_LIST_ACCOUNT_SEED, mint.key().as_ref()], 
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
}
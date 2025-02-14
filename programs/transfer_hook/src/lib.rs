use anchor_lang::prelude::*;

declare_id!("6XKBE5pgMA4GkhoFYcJNNfhhFnmm26qPLLhXhBHuBjas");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

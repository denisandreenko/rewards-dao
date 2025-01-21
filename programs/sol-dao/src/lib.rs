use anchor_lang::prelude::*;

declare_id!("HMmdKEJsaYK5fj5uDxoZzSyY7ijgufAFUujZHLzdUqAK");

#[program]
pub mod sol_dao {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

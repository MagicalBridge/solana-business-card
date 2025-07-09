use anchor_lang::prelude::*;

declare_id!("BYBFmxjHn48LVAjKfo7dX6kPTw62HNPTktMqnpNeeiHu");

#[program]
pub mod solana_business_card {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

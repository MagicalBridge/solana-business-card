use anchor_lang::prelude::*;
// Our program's address!
// This matches the key in the target/deploy directory
declare_id!("CRMKu2kLLiGM18cCtWVgyTzYXyLgdrKxAto1B2CVWNqZ");

// Anchor programs always use 8 bits for the discriminator
pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

// Our Solana program!
#[program]
pub mod solana_business_card {
    use super::*;

    // Our instruction handler! It sets the user's favorite number and color
    pub fn set_favorites(
        context: Context<SetFavorites>,
        number: u64,
        color: String,
        hobbies: Vec<String>,
    ) -> Result<()> {
        let user_public_key = context.accounts.user.key();
        msg!("Greetings from {}", context.program_id);
        msg!("User {user_public_key}'s favorite number is {number}, favorite color is: {color}",);

        // 验证颜色长度限制
        require!(color.len() <= 50, CustomError::ColorTooLong);
        
        // 验证爱好数量和每个爱好的长度限制
        require!(hobbies.len() <= 5, CustomError::TooManyHobbies);
        for hobby in &hobbies {
            require!(hobby.len() <= 50, CustomError::HobbyTooLong);
        }

        msg!("User's hobbies are: {:?}", hobbies);

        context.accounts.favorites.set_inner(Favorites {
            number,
            color,
            hobbies,
        });
        Ok(())
    }

    // We can also add a get_favorites instruction handler to return the user's favorite number and color
    pub fn get_favorites(context: Context<GetFavorites>) -> Result<Favorites> {
        let favorites = &context.accounts.favorites;
        msg!("获取用户喜好数据: 数字={}, 颜色={}, 爱好={:?}", favorites.number, favorites.color, favorites.hobbies);
        // 返回克隆的数据
        Ok(Favorites {
            number: favorites.number,
            color: favorites.color.clone(),
            hobbies: favorites.hobbies.clone(),
        })
    }
}

// What we will put inside the Favorites PDA
#[account]
#[derive(InitSpace)]
pub struct Favorites {
    pub number: u64,

    #[max_len(50)]
    pub color: String,

    #[max_len(5, 50)]
    pub hobbies: Vec<String>,
}
// When people call the set_favorites instruction, they will need to provide the accounts that will be modifed. This keeps Solana fast!
#[derive(Accounts)]
pub struct SetFavorites<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed, 
        payer = user, 
        space = ANCHOR_DISCRIMINATOR_SIZE + Favorites::INIT_SPACE, 
        seeds=[b"solana_business_card", user.key().as_ref()],
    bump)]
    pub favorites: Account<'info, Favorites>,

    pub system_program: Program<'info, System>,
}

// 查询用户喜好数据的账户结构
#[derive(Accounts)]
pub struct GetFavorites<'info> {
    pub user: Signer<'info>,

    #[account(
        seeds=[b"solana_business_card", user.key().as_ref()],
        bump
    )]
    pub favorites: Account<'info, Favorites>,
}

#[error_code]
pub enum CustomError {
    #[msg("Color string is too long (max 50 characters)")]
    ColorTooLong,
    #[msg("Too many hobbies (max 5)")]
    TooManyHobbies,
    #[msg("Hobby string is too long (max 50 characters)")]
    HobbyTooLong,
}

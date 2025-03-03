use anchor_lang::prelude::*;

#[error_code]
pub enum TokenError {
    #[msg("Unauthorized access: Caller does not have the required permissions.")]
    Unauthorized, // 6000

    #[msg("This operation is currently not allowed.")]
    OperationNotAllowed, // 6001

    #[msg("Insufficient Balance")]
    InsufficientBalance, // 6002

    #[msg("The token is not currently transferring")]
    IsNotCurrentlyTransferring, // 6003
}
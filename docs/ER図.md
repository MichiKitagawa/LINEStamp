erDiagram
    USERS ||--o{ STAMPS : has
    USERS ||--o{ TOKEN_TRANSACTIONS : purchases
    USERS ||--o{ TOKEN_CONSUMPTIONS : uses
    USERS ||--o{ LINE_SESSIONS : sessions

    STAMPS ||--o{ IMAGES : includes
    STAMPS ||--o{ TOKEN_CONSUMPTIONS : consumes
    STAMPS ||--o{ SUBMISSION_ATTEMPTS : attempts

    %% 各エンティティ定義（属性は省略、必要に応じて記述可能）
    USERS {
        UUID id
    }
    STAMPS {
        UUID id
    }
    IMAGES {
        UUID id
    }
    TOKEN_TRANSACTIONS {
        UUID id
    }
    TOKEN_CONSUMPTIONS {
        UUID id
    }
    LINE_SESSIONS {
        UUID id
    }
    SUBMISSION_ATTEMPTS {
        UUID id
    }
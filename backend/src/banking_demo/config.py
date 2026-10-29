from __future__ import annotations

from banking_demo.models import Account


def is_invalid_account(account_id: str) -> bool:
    """Check if an account ID is the invalid test account."""
    return account_id == "ACC-999"


# ---------------------------------------------------------------------------
# Mock account data
# ---------------------------------------------------------------------------

ACCOUNTS: list[Account] = [
    Account(
        id="ACC-001",
        name="Primary Checking",
        owner="Alex Johnson",
        balance=5_000.00,
        account_type="checking",
    ),
    Account(
        id="ACC-002",
        name="Savings",
        owner="Alex Johnson",
        balance=25_000.00,
        account_type="savings",
    ),
    Account(
        id="ACC-003",
        name="Business Checking",
        owner="Taylor Corp",
        balance=50_000.00,
        account_type="checking",
    ),
    Account(
        id="ACC-004",
        name="Investment Account",
        owner="Sam Lee",
        balance=100_000.00,
        account_type="savings",
    ),
    Account(
        id="ACC-999",
        name="Invalid Test Account",
        owner="N/A",
        balance=0.00,
        account_type="checking",
    ),
]

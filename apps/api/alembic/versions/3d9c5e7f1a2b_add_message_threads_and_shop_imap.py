"""add_message_threads_and_shop_imap

Revision ID: 3d9c5e7f1a2b
Revises: 2f8a3c4d9e5b
Create Date: 2026-02-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3d9c5e7f1a2b"
down_revision = "2f8a3c4d9e5b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Alter shops table to add IMAP / AdsPower columns
    op.add_column("shops", sa.Column("adspower_profile_id", sa.Text(), nullable=True))
    op.add_column("shops", sa.Column("imap_host", sa.Text(), nullable=True))
    op.add_column("shops", sa.Column("imap_email", sa.Text(), nullable=True))
    op.add_column("shops", sa.Column("imap_password_enc", sa.LargeBinary(), nullable=True))

    # 2) Create message_threads table
    op.create_table(
        "message_threads",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.BigInteger(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("shop_id", sa.BigInteger(), sa.ForeignKey("shops.id"), nullable=False),
        sa.Column("etsy_conversation_url", sa.Text(), nullable=False),
        sa.Column("customer_name", sa.Text(), nullable=True),
        sa.Column("customer_message", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Text(),
            sa.CheckConstraint(
                "status IN ('pending_read','unread','replied','failed')",
                name="ck_message_threads_status",
            ),
            nullable=False,
            server_default="pending_read",
        ),
        sa.Column("replied_text", sa.Text(), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 3) Indexes for message_threads
    op.create_index(
        "idx_message_threads_shop",
        "message_threads",
        ["shop_id"],
    )
    op.create_index(
        "idx_message_threads_tenant_status",
        "message_threads",
        ["tenant_id", "status"],
    )


def downgrade() -> None:
    # Drop indexes and table
    op.drop_index("idx_message_threads_tenant_status", table_name="message_threads")
    op.drop_index("idx_message_threads_shop", table_name="message_threads")
    op.drop_table("message_threads")

    # Remove columns from shops table
    op.drop_column("shops", "imap_password_enc")
    op.drop_column("shops", "imap_email")
    op.drop_column("shops", "imap_host")
    op.drop_column("shops", "adspower_profile_id")


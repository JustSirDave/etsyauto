"""merge migration heads

Revision ID: 20260205_merge
Revises: update_products_source_check, 20260202_order_status_enums
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260205_merge'
down_revision = ('update_products_source_check', '20260202_order_status_enums')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
